import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"
if os.path.exists("test.db"):
    os.remove("test.db")

from fastapi.testclient import TestClient  # noqa: E402

from app import extract  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)


def auth(email="a@ucu.edu.ua", password="password123"):
    r = client.post("/auth/signup", json={"email": email, "password": password})
    if r.status_code == 409:
        r = client.post("/auth/signin", json={"email": email, "password": password})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_signup_signin_me():
    r = client.post("/auth/signup", json={"email": "B@ucu.edu.ua", "password": "password123", "name": "Bo"})
    assert r.status_code == 201
    assert client.post("/auth/signup", json={"email": "b@ucu.edu.ua", "password": "password123"}).status_code == 409
    assert client.post("/auth/signin", json={"email": "b@ucu.edu.ua", "password": "wrongpass"}).status_code == 401
    token = client.post("/auth/signin", json={"email": "b@ucu.edu.ua", "password": "password123"}).json()["access_token"]
    me = client.get("/me", headers={"Authorization": f"Bearer {token}"}).json()
    assert me["email"] == "b@ucu.edu.ua" and me["name"] == "Bo"


def test_requires_auth():
    assert client.get("/items").status_code == 401


def test_add_search_update_delete(monkeypatch):
    monkeypatch.setattr(extract, "extract", lambda url: extract.Extracted(
        "web", "Big-O explained", "Big-O with the pizza example: sorting algorithm complexity"))
    h = auth()
    item = client.post("/items", json={"url": "https://example.com/bigo"}, headers=h).json()
    assert item["topic"] == "Algorithms" and item["status"] == "ready"
    found = client.get("/items", params={"q": "pizza"}, headers=h).json()
    assert [i["id"] for i in found] == [item["id"]] and "pizza" in found[0]["snippet"]
    assert client.get("/items", params={"q": "nothing-here"}, headers=h).json() == []
    assert client.patch(f"/items/{item['id']}", json={"topic": "Exam prep"}, headers=h).json()["topic"] == "Exam prep"
    other = auth("c@ucu.edu.ua")
    assert client.delete(f"/items/{item['id']}", headers=other).status_code == 404
    assert client.delete(f"/items/{item['id']}", headers=h).status_code == 204


def test_detect_type():
    assert extract.detect_type("https://youtu.be/abc") == "youtube"
    assert extract.detect_type("https://site.org/notes.pdf") == "pdf"
    assert extract.detect_type("https://site.org/page") == "web"
