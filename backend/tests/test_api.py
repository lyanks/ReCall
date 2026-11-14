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
