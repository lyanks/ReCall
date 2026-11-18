import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.identity.adapters import DevAuthVerifier, FirebaseAuthVerifier
from app.modules.identity.ports import InvalidToken
from app.modules.ingestion.ports import Extracted

client = TestClient(app)


def h(email="a@ucu.edu.ua"):
    return {"Authorization": f"Bearer dev:{email}"}


class FakeExtractor:
    source_type = "web"

    def supports(self, url):
        return True

    def extract(self, url):
        if "broken" in url:
            raise RuntimeError("site down")
        return Extracted("Big-O explained", "Big-O with the pizza example: sorting algorithm complexity")


@pytest.fixture(autouse=True)
def fake_extractors(monkeypatch):
    monkeypatch.setattr(app.state.ingestion, "extractors", [FakeExtractor()])


def test_requires_auth():
    assert client.get("/api/items").status_code == 401
    assert client.get("/api/me", headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_first_request_creates_profile():
    me = client.get("/api/me", headers=h("New@ucu.edu.ua")).json()
    assert me["email"] == "new@ucu.edu.ua"
    assert client.get("/api/me", headers=h("new@ucu.edu.ua")).json()["id"] == me["id"]
    assert client.post("/api/sessions", headers=h("new@ucu.edu.ua")).status_code == 204


def test_add_is_async_then_ready_and_searchable():
    r = client.post("/api/items", json={"url": "https://example.com/bigo"}, headers=h())
    assert r.status_code == 202
    item = client.get(f"/api/items/{r.json()['id']}", headers=h()).json()
    assert item["status"] == "ready" and item["topic"] == "Algorithms"
    found = client.get("/api/items", params={"q": "pizza"}, headers=h()).json()
    assert [i["id"] for i in found] == [item["id"]] and "pizza" in found[0]["snippet"]
    assert client.get("/api/items", params={"q": "nothing-here"}, headers=h()).json() == []


def test_failed_extraction_is_marked():
    r = client.post("/api/items", json={"url": "https://broken.example.com"}, headers=h())
    assert client.get(f"/api/items/{r.json()['id']}", headers=h()).json()["status"] == "failed"


def test_owner_isolation_update_delete():
    item = client.post("/api/items", json={"url": "https://example.com/x"}, headers=h()).json()
    assert client.patch(f"/api/items/{item['id']}", json={"topic": "Exam prep"}, headers=h()).json()["topic"] == "Exam prep"
    assert client.get(f"/api/items/{item['id']}", headers=h("other@ucu.edu.ua")).status_code == 404
    assert client.delete(f"/api/items/{item['id']}", headers=h("other@ucu.edu.ua")).status_code == 404
    assert client.delete(f"/api/items/{item['id']}", headers=h()).status_code == 204


def test_extractor_selection():
    from app.modules.ingestion.adapters import DEFAULT_EXTRACTORS
    from app.modules.ingestion.service import IngestionService

    svc = IngestionService(DEFAULT_EXTRACTORS, None, None)
    assert svc.detect_type("https://youtu.be/abc") == "youtube"
    assert svc.detect_type("https://site.org/notes.pdf") == "pdf"
    assert svc.detect_type("https://site.org/page") == "web"


def test_dev_verifier_rejects_non_dev_tokens():
    with pytest.raises(InvalidToken):
        DevAuthVerifier().verify("eyJhbGciOi...")


def test_firebase_verifier_requires_project():
    with pytest.raises(RuntimeError):
        FirebaseAuthVerifier("")
    with pytest.raises(InvalidToken):
        FirebaseAuthVerifier("demo-project").verify("not-a-jwt")


def test_recent_limit_profile_and_stats():
    u = h("stats@ucu.edu.ua")
    ids = [client.post("/api/items", json={"url": f"https://example.com/{n}"}, headers=u).json()["id"] for n in range(4)]
    recent = client.get("/api/items", params={"limit": 2}, headers=u).json()
    assert [i["id"] for i in recent] == ids[::-1][:2]
    assert client.get("/api/items", params={"limit": 0}, headers=u).status_code == 422
    client.get("/api/items", params={"q": "pizza"}, headers=u)
    stats = client.get("/api/stats/me", headers=u).json()
    assert stats == {"items": 4, "topics": 1, "searches": 1, "by_source": {"web": 4}}
    me = client.patch("/api/me", json={"name": "  Уляна "}, headers=u).json()
    assert me["name"] == "Уляна" and "created_at" in me
    assert client.patch("/api/me", json={"name": ""}, headers=u).status_code == 422


def test_topics_and_topic_filter_and_refresh_keeps_topic():
    u = h("topics@ucu.edu.ua")
    a = client.post("/api/items", json={"url": "https://example.com/a"}, headers=u).json()
    client.post("/api/items", json={"url": "https://example.com/b"}, headers=u)
    client.patch(f"/api/items/{a['id']}", json={"topic": "Exam prep"}, headers=u)
    topics = client.get("/api/topics", headers=u).json()
    assert [(t["name"], t["count"]) for t in topics] == [("Algorithms", 1), ("Exam prep", 1)]
    only = client.get("/api/items", params={"topic": "Exam prep"}, headers=u).json()
    assert [i["id"] for i in only] == [a["id"]]
    r = client.post(f"/api/items/{a['id']}/refresh", headers=u)
    assert r.status_code == 202
    again = client.get(f"/api/items/{a['id']}", headers=u).json()
    assert again["status"] == "ready" and again["topic"] == "Exam prep"


def test_search_ranks_partial_sentence():
    u = h("search@ucu.edu.ua")
    client.post("/api/items", json={"url": "https://example.com/x"}, headers=u)
    found = client.get("/api/items", params={"q": "that video about pizza and sorting"}, headers=u).json()
    assert len(found) == 1 and "pizza" in found[0]["snippet"]


class SocialExtractor:
    """Pretends to be TikTok: empty caption for /empty, a real caption otherwise."""
    source_type = "tiktok"

    def supports(self, url):
        return "tiktok" in url

    def extract(self, url):
        if "empty" in url:
            return Extracted("TikTok від cs.girl", "cs.girl tiktok")
        return Extracted("Big-O in 60 seconds with pizza", "Big-O in 60 seconds with pizza #cs #algorithms cs.girl tiktok")


def test_topic_chosen_while_adding_is_kept(monkeypatch):
    u = h("addtopic@ucu.edu.ua")
    item = client.post("/api/items", json={"url": "https://example.com/t", "topic": "Exam prep"}, headers=u).json()
    got = client.get(f"/api/items/{item['id']}", headers=u).json()
    assert got["status"] == "ready" and got["topic"] == "Exam prep"   # classifier would say Algorithms
    auto = client.post("/api/items", json={"url": "https://example.com/u", "topic": ""}, headers=u).json()
    assert client.get(f"/api/items/{auto['id']}", headers=u).json()["topic"] == "Algorithms"


def test_social_without_content_asks_for_tags_and_tags_are_searchable(monkeypatch):
    monkeypatch.setattr(app.state.ingestion, "extractors", [SocialExtractor(), FakeExtractor()])
    u = h("tags@ucu.edu.ua")
    empty = client.post("/api/items", json={"url": "https://www.tiktok.com/@x/video/empty"}, headers=u).json()
    full = client.post("/api/items", json={"url": "https://www.tiktok.com/@x/video/1"}, headers=u).json()
    web = client.post("/api/items", json={"url": "https://example.com/w"}, headers=u).json()
    get = lambda i: client.get(f"/api/items/{i['id']}", headers=u).json()
    assert get(empty)["needs_tags"] is True
    assert get(full)["needs_tags"] is False and get(web)["needs_tags"] is False
    r = client.patch(f"/api/items/{empty['id']}", json={"tags": [" merge sort ", "рекурсія", "Merge sort", ""]}, headers=u)
    assert r.status_code == 422  # empty tag rejected
    r = client.patch(f"/api/items/{empty['id']}", json={"tags": [" merge sort ", "рекурсія", "Merge sort"]}, headers=u).json()
    assert r["tags"] == ["merge sort", "рекурсія"] and r["needs_tags"] is False and r["topic"]
    found = client.get("/api/items", params={"q": "рекурсія"}, headers=u).json()
    assert [i["id"] for i in found] == [empty["id"]]


def test_rename_is_kept_on_refresh_and_empty_title_restores_it(monkeypatch):
    monkeypatch.setattr(app.state.ingestion, "extractors", [FakeExtractor()])
    u = h("rename@ucu.edu.ua")
    item = client.post("/api/items", json={"url": "https://example.com/r"}, headers=u).json()
    original = client.get(f"/api/items/{item['id']}", headers=u).json()["title"]
    r = client.patch(f"/api/items/{item['id']}", json={"title": "  Мій   конспект  "}, headers=u).json()
    assert r["title"] == "Мій конспект"
    client.post(f"/api/items/{item['id']}/refresh", headers=u)
    assert client.get(f"/api/items/{item['id']}", headers=u).json()["title"] == "Мій конспект"
    assert [i["id"] for i in client.get("/api/items", params={"q": "конспект"}, headers=u).json()] == [item["id"]]
    client.patch(f"/api/items/{item['id']}", json={"title": ""}, headers=u)
    assert client.get(f"/api/items/{item['id']}", headers=u).json()["title"] == original


LOGIN_DOMAIN = "users.recall-ucu-edu.firebaseapp.com"


def test_login_account_gets_login_and_resolves_without_leaking_email():
    u = h(f"sofiia.d@{LOGIN_DOMAIN}")
    me = client.get("/api/me", headers=u).json()
    assert me["login"] == "sofiia.d"
    # no real email yet: the login resolves to its internal address
    r = client.post("/api/auth/resolve", json={"login": "Sofiia.D", "password": "x"})
    assert r.json() == {"email": f"sofiia.d@{LOGIN_DOMAIN}"}
    # unknown login: same shape, nothing to reveal
    assert client.post("/api/auth/resolve", json={"login": "nobody1", "password": "x"}).json()["email"].startswith("nobody1@")

    # the user adds an email; until Firebase confirms it the account email stays internal
    me = client.patch("/api/me", json={"pending_email": "Sofiia@Gmail.com"}, headers=u).json()
    assert me["pending_email"] == "sofiia@gmail.com" and me["name"] == "sofiia.d"
    assert client.patch("/api/me", json={"pending_email": "not-an-email"}, headers=u).status_code == 422

    # confirmed while signed out: the right password finds the new address and saves it
    pw = app.state.passwords
    checks = []
    def check(email, password):
        checks.append(email)
        return email == "sofiia@gmail.com" and password == "Kotyk_7exams"
    orig = pw.check_password
    pw.check_password = check
    try:
        assert client.post("/api/auth/resolve", json={"login": "sofiia.d", "password": "wrong1234"}).status_code == 401
        r = client.post("/api/auth/resolve", json={"login": "sofiia.d", "password": "Kotyk_7exams"})
        assert r.json() == {"email": "sofiia@gmail.com"}
    finally:
        pw.check_password = orig



def test_token_with_new_email_updates_profile_and_keeps_login():
    u = h(f"olena.k@{LOGIN_DOMAIN}")
    client.get("/api/me", headers=u)
    client.patch("/api/me", json={"pending_email": "olena@ucu.edu.ua"}, headers=u)
    # Firebase keeps the uid when the email changes; the dev verifier derives uid from email, so simulate it
    from app.db import SessionLocal
    from app.modules.identity.models import User
    from app.modules.identity.ports import Principal
    from app.modules.identity.service import get_or_create_user
    with SessionLocal() as db:
        user = get_or_create_user(db, Principal(uid=f"dev|olena.k@{LOGIN_DOMAIN}", email="olena@ucu.edu.ua"))
        assert (user.email, user.login, user.pending_email) == ("olena@ucu.edu.ua", "olena.k", "")
        assert db.query(User).filter(User.login == "olena.k").count() == 1
