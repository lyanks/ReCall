import logging
import re
from urllib.parse import parse_qs, urlparse

import httpx
from bs4 import BeautifulSoup

from .ports import Extracted

log = logging.getLogger(__name__)

MAX_TEXT = 20_000
UA = {"User-Agent": "Mozilla/5.0 (compatible; ReCall/0.1)"}
YOUTUBE_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}


class YouTubeExtractor:
    source_type = "youtube"

    def supports(self, url: str) -> bool:
        return urlparse(url).netloc.lower() in YOUTUBE_HOSTS

    def extract(self, url: str) -> Extracted:
        # Title + channel via oEmbed (no API key), then subtitles if the video has any.
        r = httpx.get("https://www.youtube.com/oembed", params={"url": url, "format": "json"}, timeout=10)
        r.raise_for_status()
        data = r.json()
        title = data.get("title", url)
        head = f"{title} {data.get('author_name', '')}".strip()
        subtitles = self.transcript(url)
        return Extracted(title, f"{head} {subtitles}".strip()[:MAX_TEXT])

    @staticmethod
    def video_id(url: str) -> str | None:
        u = urlparse(url)
        if u.netloc.lower() == "youtu.be":
            return u.path.strip("/").split("/")[0] or None
        if u.path == "/watch":
            return parse_qs(u.query).get("v", [None])[0]
        parts = [p for p in u.path.split("/") if p]
        if len(parts) >= 2 and parts[0] in {"shorts", "embed", "live", "v"}:
            return parts[1]
        return None

    def transcript(self, url: str) -> str:
        """Best effort: YouTube often blocks subtitle requests from cloud servers; then we keep title only."""
        vid = self.video_id(url)
        if not vid:
            return ""
        try:
            from youtube_transcript_api import YouTubeTranscriptApi

            api = YouTubeTranscriptApi()
            listing = api.list(vid)
            try:
                tr = listing.find_transcript(["uk", "en", "ru", "pl"])
            except Exception:
                tr = next(iter(listing))
            return " ".join(s.text for s in tr.fetch()).replace("\n", " ")
        except Exception as e:  # no subtitles, blocked, network error
            log.info("no transcript for %s: %s", vid, type(e).__name__)
            return ""


class PdfLinkExtractor:
    source_type = "pdf"

    def supports(self, url: str) -> bool:
        return urlparse(url).path.lower().endswith(".pdf")

    def extract(self, url: str) -> Extracted:
        # Next step: download to object storage and extract text with pypdf in the worker.
        return Extracted(url.rsplit("/", 1)[-1], "")


def _host(url: str) -> str:
    return urlparse(url).netloc.lower().split(":")[0]


def _meta(soup: BeautifulSoup, *names: str) -> str:
    for n in names:
        tag = soup.find("meta", attrs={"property": n}) or soup.find("meta", attrs={"name": n})
        if tag and tag.get("content"):
            return tag["content"].strip()
    return ""


class TikTokExtractor:
    """TikTok public oEmbed: caption (title) + author. No API key needed."""

    source_type = "tiktok"

    def supports(self, url: str) -> bool:
        h = _host(url)
        return h == "tiktok.com" or h.endswith(".tiktok.com")

    def extract(self, url: str) -> Extracted:
        r = httpx.get("https://www.tiktok.com/oembed", params={"url": url}, headers=UA, timeout=10,
                      follow_redirects=True)
        r.raise_for_status()
        data = r.json()
        caption = (data.get("title") or "").strip()
        author = data.get("author_name") or data.get("author_unique_id") or ""
        title = caption[:120] or f"TikTok від {author}".strip()
        return Extracted(title, f"{caption} {author} tiktok".strip())


class InstagramExtractor:
    """Instagram needs an app token for oEmbed; the public page still carries og: tags with the caption
    for link previews. Best effort: if Instagram hides them, we keep the post with a readable title."""

    source_type = "instagram"

    def supports(self, url: str) -> bool:
        h = _host(url)
        return h in {"instagram.com", "www.instagram.com", "instagr.am"}

    def extract(self, url: str) -> Extracted:
        path = [p for p in urlparse(url).path.split("/") if p]
        kind = {"reel": "Reel", "reels": "Reel", "p": "Допис", "tv": "Відео"}.get(path[0] if path else "", "Instagram")
        fallback = Extracted(f"Instagram · {kind}", f"instagram {kind.lower()}")
        try:
            r = httpx.get(url, headers={"User-Agent": "facebookexternalhit/1.1"}, timeout=10, follow_redirects=True)
            soup = BeautifulSoup(r.text, "html.parser")
        except httpx.HTTPError:
            return fallback
        title = _meta(soup, "og:title")
        desc = _meta(soup, "og:description", "description")
        if not (title or desc):
            return fallback
        return Extracted((title or fallback.title)[:160], f"{title} {desc} instagram".strip())


class WebPageExtractor:
    source_type = "web"

    def supports(self, url: str) -> bool:
        return True  # fallback

    def extract(self, url: str) -> Extracted:
        r = httpx.get(url, headers=UA, timeout=10, follow_redirects=True)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "noscript"]):
            tag.decompose()
        title = (soup.title.string or "").strip() if soup.title and soup.title.string else ""
        title = title or _meta(soup, "og:title", "twitter:title") or url
        # Many sites (games, apps) render with JS and have little body text; their meta tags still describe them.
        head = " ".join(filter(None, [
            _meta(soup, "og:site_name"), _meta(soup, "og:title"),
            _meta(soup, "description", "og:description", "twitter:description"), _meta(soup, "keywords"),
        ]))
        for tag in soup(["script", "style", "nav", "footer", "header", "noscript"]):
            tag.decompose()
        body = re.sub(r"\s+", " ", soup.get_text(" ")).strip()
        return Extracted(title, f"{head} {body}".strip()[:MAX_TEXT])


DEFAULT_EXTRACTORS = [YouTubeExtractor(), TikTokExtractor(), InstagramExtractor(), PdfLinkExtractor(), WebPageExtractor()]


class KeywordTopicClassifier:
    RULES: dict[str, list[str]] = {
        "Algorithms": ["algorithm", "big-o", "big o", "sorting", "graph", "dynamic programming", "complexity"],
        "OOAD": ["uml", "use case", "class diagram", "design pattern", "object-oriented", "ooad", "solid"],
        "Databases": ["sql", "database", "postgres", "normal form", "query"],
        "Math": ["calculus", "linear algebra", "probability", "matrix", "integral", "statistics"],
        "English": ["english", "grammar", "ielts", "vocabulary"],
        "Programming": ["python", "java", "c++", "javascript", "programming"],
    }

    def classify(self, title: str, text: str) -> str:
        haystack = f"{title} {text[:5000]}".lower()
        best, best_hits = "Unsorted", 0
        for topic, words in self.RULES.items():
            hits = sum(haystack.count(w) for w in words)
            if hits > best_hits:
                best, best_hits = topic, hits
        return best
