"""AI features through the LLMClient port, with a fake model (no network, no key)."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.ai.ports import Digest
from app.modules.ingestion.adapters import YouTubeExtractor
from app.modules.ingestion.ports import Extracted
from app.modules.search.ranker import KeywordRanker
from app.modules.search.semantic import SemanticSearch

client = TestClient(app)


def h(email="ai@ucu.edu.ua"):
    return {"Authorization": f"Bearer dev:{email}"}


class Extractor:
    source_type = "web"

    def supports(self, url):
        return True

    def extract(self, url):
        if "dp" in url:
            return Extracted("Memoization and tabulation", "Fibonacci with memoization, knapsack, tabulation tables")
        return Extracted("Cooking pasta", "Boil water, add salt")


class FakeLLM:
    enabled = True

    def __init__(self, fail=False):
        self.fail = fail
        self.queries = []

    def digest(self, title, text, url, source_type, topics):
        self.digested = getattr(self, "digested", 0) + 1
        if self.fail:
            raise RuntimeError("API down")
        if "Memoization" in title:
            return Digest("Відео про динамічне програмування.", "A video on dynamic programming.",
                          ["динамічне програмування", "мемоізація"], ["dynamic programming", "динамічне програмування"],
                          "Algorithms")
        return Digest("Рецепт пасти.", "A pasta recipe.", ["кулінарія"], ["cooking"], "Cooking")

    def pick_relevant(self, query, cards):
        self.queries.append(query)
        if self.fail:
            raise RuntimeError("API down")
        return [c.id for c in cards if "динамічне" in query and "динамічне" in c.summary]


@pytest.fixture
def llm(monkeypatch):
    fake = FakeLLM()
    monkeypatch.setattr(app.state.ingestion, "extractors", [Extractor()])
    monkeypatch.setattr(app.state.ingestion, "llm", fake)
    monkeypatch.setattr(app.state, "search", SemanticSearch(fake, fallback=KeywordRanker()))
    return fake


def test_digest_saved_and_returned(llm):
    item = client.post("/api/items", json={"url": "https://example.com/dp"}, headers=h()).json()
    got = client.get(f"/api/items/{item['id']}", headers=h()).json()
    assert got["summary"] == "Відео про динамічне програмування."
    assert got["summary_en"] == "A video on dynamic programming."
    assert got["key_topics"] == ["динамічне програмування", "мемоізація"]


def test_model_files_what_rules_could_not(llm):
    item = client.post("/api/items", json={"url": "https://example.com/pasta"}, headers=h()).json()
    assert client.get(f"/api/items/{item['id']}", headers=h()).json()["topic"] == "Cooking"


def test_search_by_meaning_across_languages(llm):
    dp = client.post("/api/items", json={"url": "https://example.com/dp"}, headers=h("x@ucu.edu.ua")).json()
    client.post("/api/items", json={"url": "https://example.com/pasta"}, headers=h("x@ucu.edu.ua"))
    # no word of the query is in the English page text, the model links them
    found = client.get("/api/items", params={"q": "динамічне програмування"}, headers=h("x@ucu.edu.ua")).json()
    assert [i["id"] for i in found] == [dp["id"]]


def test_ai_failure_keeps_app_working(llm):
    llm.fail = True
    item = client.post("/api/items", json={"url": "https://example.com/dp"}, headers=h("y@ucu.edu.ua")).json()
    got = client.get(f"/api/items/{item['id']}", headers=h("y@ucu.edu.ua")).json()
    assert got["status"] == "ready" and got["summary"] == ""
    found = client.get("/api/items", params={"q": "memoization"}, headers=h("y@ucu.edu.ua")).json()
    assert [i["id"] for i in found] == [item["id"]]  # keyword fallback


def test_backfill_digests_old_items(llm, monkeypatch):
    monkeypatch.setattr(llm, "enabled", False)
    item = client.post("/api/items", json={"url": "https://example.com/dp"}, headers=h("z@ucu.edu.ua")).json()
    monkeypatch.setattr(llm, "enabled", True)
    app.state.ingestion.backfill()
    assert client.get(f"/api/items/{item['id']}", headers=h("z@ucu.edu.ua")).json()["summary"]


def test_no_ai_tokens_on_tiktok_we_could_not_read(llm, monkeypatch):
    class Tiktok:
        source_type = "tiktok"
        def supports(self, url): return True
        def extract(self, url): return Extracted("TikTok від @someone", "TikTok відео від @someone")
    monkeypatch.setattr(app.state.ingestion, "extractors", [Tiktok()])
    item = client.post("/api/items", json={"url": "https://www.tiktok.com/@someone/video/7"}, headers=h("t@ucu.edu.ua")).json()
    got = client.get(f"/api/items/{item['id']}", headers=h("t@ucu.edu.ua")).json()
    assert getattr(llm, "digested", 0) == 0 and got["summary"] == "" and got["needs_tags"] is True
    app.state.ingestion.backfill()  # nor later, at start-up
    assert getattr(llm, "digested", 0) == 0


def test_no_key_means_no_ai():
    assert client.get("/api/health").json() == {"status": "ok", "ai": False}


@pytest.mark.parametrize("url,vid", [
    ("https://www.youtube.com/watch?v=abc123&t=5", "abc123"),
    ("https://youtu.be/abc123?si=x", "abc123"),
    ("https://www.youtube.com/shorts/abc123", "abc123"),
    ("https://www.youtube.com/@channel", None),
])
def test_youtube_video_id(url, vid):
    assert YouTubeExtractor.video_id(url) == vid


def test_hedging_sentences_are_dropped():
    from app.modules.ai.adapters import clean_summary

    assert clean_summary("Текст містить лише назву, тож точний зміст невідомий; ймовірно, йдеться про ООП.") == ""
    assert clean_summary("Патерн Observer: видавець сповіщає підписників. Ймовірно, є приклад коду.") == \
        "Патерн Observer: видавець сповіщає підписників."
    assert clean_summary("Probably about sorting. Merge sort in O(n log n).") == "Merge sort in O(n log n)."
