import re
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from .ports import Extracted

MAX_TEXT = 20_000
UA = {"User-Agent": "Mozilla/5.0 (compatible; ReCall/0.1)"}
YOUTUBE_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}


class YouTubeExtractor:
    source_type = "youtube"

    def supports(self, url: str) -> bool:
        return urlparse(url).netloc.lower() in YOUTUBE_HOSTS

    def extract(self, url: str) -> Extracted:
        # Title + channel via oEmbed (no API key). Subtitles: next step (youtube-transcript-api).
        r = httpx.get("https://www.youtube.com/oembed", params={"url": url, "format": "json"}, timeout=10)
        r.raise_for_status()
        data = r.json()
        title = data.get("title", url)
        return Extracted(title, f"{title} {data.get('author_name', '')}".strip())


class PdfLinkExtractor:
    source_type = "pdf"

    def supports(self, url: str) -> bool:
        return urlparse(url).path.lower().endswith(".pdf")

    def extract(self, url: str) -> Extracted:
        # Next step: download to object storage and extract text with pypdf in the worker.
        return Extracted(url.rsplit("/", 1)[-1], "")


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
        title = (soup.title.string or "").strip() if soup.title and soup.title.string else url
        text = re.sub(r"\s+", " ", soup.get_text(" ")).strip()
        return Extracted(title, text[:MAX_TEXT])


DEFAULT_EXTRACTORS = [YouTubeExtractor(), PdfLinkExtractor(), WebPageExtractor()]


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
