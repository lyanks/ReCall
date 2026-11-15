import httpx

from app.modules.ingestion import adapters
from app.modules.ingestion.adapters import (DEFAULT_EXTRACTORS, InstagramExtractor, TikTokExtractor,
                                            WebPageExtractor)
from app.modules.ingestion.service import IngestionService


class Resp:
    def __init__(self, text="", json=None, status=200):
        self.text, self._json, self.status_code = text, json, status

    def json(self):
        return self._json

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("err", request=None, response=None)


def test_routing():
    svc = IngestionService(DEFAULT_EXTRACTORS, None, None)
    assert svc.detect_type("https://www.tiktok.com/@ucu/video/123") == "tiktok"
    assert svc.detect_type("https://vm.tiktok.com/ZMabc/") == "tiktok"
    assert svc.detect_type("https://www.instagram.com/reel/Cabc/") == "instagram"
    assert svc.detect_type("https://notinstagram.com/x") == "web"


def test_tiktok_oembed(monkeypatch):
    monkeypatch.setattr(adapters.httpx, "get", lambda *a, **k: Resp(json={"title": "Big-O in 60s #cs", "author_name": "cs.girl"}))
    ex = TikTokExtractor().extract("https://www.tiktok.com/@cs.girl/video/1")
    assert ex.title == "Big-O in 60s #cs" and "cs.girl" in ex.text


def test_instagram_og_tags_and_fallback(monkeypatch):
    html = '<html><head><meta property="og:title" content="UCU on Instagram"><meta property="og:description" content="Exam tips: spaced repetition"></head></html>'
    monkeypatch.setattr(adapters.httpx, "get", lambda *a, **k: Resp(text=html))
    ex = InstagramExtractor().extract("https://www.instagram.com/p/abc/")
    assert ex.title == "UCU on Instagram" and "spaced repetition" in ex.text
    monkeypatch.setattr(adapters.httpx, "get", lambda *a, **k: Resp(text="<html>login</html>"))
    assert InstagramExtractor().extract("https://www.instagram.com/reel/abc/").title == "Instagram · Reel"


def test_web_page_uses_meta_for_js_sites(monkeypatch):
    html = ('<html><head><title>Poki</title><meta name="description" content="Free online mini games">'
            '<meta property="og:site_name" content="Poki"></head><body><div id="root"></div><script>x()</script></body></html>')
    monkeypatch.setattr(adapters.httpx, "get", lambda *a, **k: Resp(text=html))
    ex = WebPageExtractor().extract("https://poki.com")
    assert ex.title == "Poki" and "mini games" in ex.text and "x()" not in ex.text


def test_preview_images(monkeypatch):
    html = ('<html><head><title>Big-O</title><meta property="og:image" content="/img/cover.png"></head>'
            '<body>text</body></html>')
    monkeypatch.setattr(adapters.httpx, "get", lambda *a, **k: Resp(text=html))
    assert WebPageExtractor().extract("https://site.com/a/b").image == "https://site.com/img/cover.png"
    monkeypatch.setattr(adapters.httpx, "get", lambda *a, **k: Resp(text='<meta property="og:image" content="javascript:x">'))
    assert WebPageExtractor().extract("https://site.com/").image == ""
    monkeypatch.setattr(adapters.httpx, "get", lambda *a, **k: Resp(json={"title": "t", "thumbnail_url": "https://p16.tiktokcdn.com/x.jpg"}))
    assert TikTokExtractor().extract("https://www.tiktok.com/@a/video/1").image == "https://p16.tiktokcdn.com/x.jpg"
    monkeypatch.setattr(adapters.httpx, "get", lambda *a, **k: Resp(json={"title": "t"}))
    monkeypatch.setattr(adapters.YouTubeExtractor, "transcript", lambda self, url: "")
    assert adapters.YouTubeExtractor().extract("https://youtu.be/abc123").image == "https://i.ytimg.com/vi/abc123/hqdefault.jpg"
