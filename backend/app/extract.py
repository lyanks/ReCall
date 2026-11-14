"""Content extraction for v1 sources. Kept deliberately simple for the prototype."""

import re
from dataclasses import dataclass
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

YOUTUBE_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}
MAX_TEXT = 20_000


@dataclass
class Extracted:
    source_type: str
    title: str
    text: str


def detect_type(url: str) -> str:
    parsed = urlparse(url)
    if parsed.netloc.lower() in YOUTUBE_HOSTS:
        return "youtube"
    if parsed.path.lower().endswith(".pdf"):
        return "pdf"
    return "web"


def extract(url: str) -> Extracted:
    source_type = detect_type(url)
    if source_type == "youtube":
        return _youtube(url)
    if source_type == "pdf":
        # TODO(v1): download and run PDF text extraction (e.g. pypdf)
        return Extracted("pdf", url.rsplit("/", 1)[-1], "")
    return _web(url)


def _get(url: str) -> httpx.Response:
    headers = {"User-Agent": "Mozilla/5.0 (compatible; ZbirkaBot/0.1)"}
    return httpx.get(url, headers=headers, timeout=10, follow_redirects=True)


def _web(url: str) -> Extracted:
    resp = _get(url)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "noscript"]):
        tag.decompose()
    title = (soup.title.string or "").strip() if soup.title else url
    text = re.sub(r"\s+", " ", soup.get_text(" ")).strip()
    return Extracted("web", title or url, text[:MAX_TEXT])


def _youtube(url: str) -> Extracted:
    # Title via oEmbed (no API key). Subtitles come later (youtube-transcript-api).
    resp = httpx.get("https://www.youtube.com/oembed", params={"url": url, "format": "json"}, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    title = data.get("title", url)
    author = data.get("author_name", "")
    return Extracted("youtube", title, f"{title} {author}".strip())
