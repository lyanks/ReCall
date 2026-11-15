import io
import zipfile

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.ai.ports import Digest
from app.modules.files import api as files_api
from app.modules.files import extract
from app.modules.ingestion import service as ingestion_service

client = TestClient(app)


def h(email="files@ucu.edu.ua"):
    return {"Authorization": f"Bearer dev:{email}"}


def make_pdf(pages: list[str]) -> bytes:
    """A tiny valid PDF with one line of text per page."""
    objs = ["<< /Type /Catalog /Pages 2 0 R >>", None, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    kids = []
    for text in pages:
        stream = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode()
        objs.append(f"<< /Length {len(stream)} >>\nstream\n{stream.decode()}\nendstream")
        content = len(objs)
        objs.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents {content} 0 R "
                    f"/Resources << /Font << /F1 3 0 R >> >> >>")
        kids.append(f"{len(objs)} 0 R")
    objs[1] = f"<< /Type /Pages /Kids [{' '.join(kids)}] /Count {len(kids)} >>"
    out, offsets = io.BytesIO(), []
    out.write(b"%PDF-1.4\n")
    for i, body in enumerate(objs, 1):
        offsets.append(out.tell())
        out.write(f"{i} 0 obj\n{body}\nendobj\n".encode())
    xref = out.tell()
    out.write(f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode())
    for off in offsets:
        out.write(f"{off:010d} 00000 n \n".encode())
    out.write(f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
    return out.getvalue()


def make_zip(files: dict[str, str]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for name, body in files.items():
            z.writestr(name, body)
    return buf.getvalue()


def make_docx(paragraphs: list[str]) -> bytes:
    body = "".join(f"<w:p><w:r><w:t xml:space=\"preserve\">{p}</w:t></w:r></w:p>" for p in paragraphs)
    return make_zip({"word/document.xml": f'<w:document xmlns:w="w"><w:body>{body}</w:body></w:document>'})


def make_pptx(slides: list[str]) -> bytes:
    files = {f"ppt/slides/slide{i}.xml": f"<p:sld><a:p><a:r><a:t>{s}</a:t></a:r></a:p></p:sld>"
             for i, s in enumerate(slides, 1)}
    return make_zip(files)


PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


def upload(name, data, topic="", email="files@ucu.edu.ua"):
    return client.post("/api/items/upload", files={"file": (name, data)}, data={"topic": topic}, headers=h(email))


# ---- extraction ----

def test_pdf_text_and_page_cap(monkeypatch):
    monkeypatch.setattr(extract, "MAX_PAGES", 2)
    ex = extract.extract("Lecture_3_sorting.pdf", make_pdf(["Merge sort splits", "Quick sort pivots", "Page three"]))
    assert ex.title == "Lecture 3 sorting"
    assert "Merge sort" in ex.text and "Quick sort" in ex.text and "Page three" not in ex.text


def test_docx_pptx_txt():
    assert extract.extract("notes.docx", make_docx(["UML class diagram", "Use case &amp; actors"])).text \
        == "UML class diagram\nUse case & actors"
    slides = [f"Slide {i}" for i in range(1, 12)]
    assert extract.extract("deck.pptx", make_pptx(slides)).text.split("\n")[:3] == ["Slide 1", "Slide 2", "Slide 3"]
    assert extract.extract("a.txt", "Конспект з алгебри".encode("cp1251")).text == "Конспект з алгебри"
    assert extract.extract("photo.png", PNG).text == ""


def test_check_rejects_bad_files():
    for name, data, code in [("virus.exe", b"MZ", "unsupported_type"), ("fake.pdf", b"MZ...", "unsupported_type"),
                             ("empty.txt", b"", "empty"),
                             ("big.png", b"\x89PNG" + b"0" * (extract.MAX_IMAGE_MB * 1024 * 1024), "too_large")]:
        with pytest.raises(extract.UnsupportedFile, match=code):
            extract.check(name, data)


# ---- API ----

def test_upload_pdf_then_ready_searchable_downloadable_deletable():
    r = upload("Big-O.pdf", make_pdf(["Big-O notation and algorithm complexity of sorting"]))
    assert r.status_code == 202, r.text
    item = client.get(f"/api/items/{r.json()['id']}", headers=h()).json()
    assert item["status"] == "ready" and item["source_type"] == "pdf" and item["topic"] == "Algorithms"
    assert item["title"] == "Big-O" and item["url"].startswith("/api/files/")
    assert not item["needs_tags"]
    found = client.get("/api/items", params={"q": "complexity"}, headers=h()).json()
    assert item["id"] in [i["id"] for i in found]

    d = client.get(item["url"])  # the link works without a login header
    assert d.status_code == 200 and d.content.startswith(b"%PDF") and d.headers["content-type"] == "application/pdf"
    assert d.headers["x-content-type-options"] == "nosniff"
    assert client.get("/api/files/wrong-token/Big-O.pdf").status_code == 404

    assert client.delete(f"/api/items/{item['id']}", headers=h()).status_code == 204
    assert client.get(item["url"]).status_code == 404


def test_upload_keeps_chosen_topic_and_rejects_unknown_type():
    r = upload("notes.docx", make_docx(["SQL joins"]), topic="Exam week")
    assert r.status_code == 202 and r.json()["topic"] == "Exam week"
    item = client.get(f"/api/items/{r.json()['id']}", headers=h()).json()
    assert item["topic"] == "Exam week" and item["source_type"] == "doc"
    bad = upload("song.mp3", b"ID3...")
    assert bad.status_code == 415 and bad.json()["detail"]["code"] == "unsupported_type"


def test_image_without_ai_asks_for_tags():
    r = upload("whiteboard.jpg", b"\xff\xd8\xff" + b"\x00" * 32)
    item = client.get(f"/api/items/{r.json()['id']}", headers=h()).json()
    assert item["status"] == "ready" and item["source_type"] == "image" and item["needs_tags"]


def test_daily_limit(monkeypatch):
    monkeypatch.setattr(files_api, "UPLOADS_PER_DAY", 1)
    email = "limit@ucu.edu.ua"
    assert upload("a.txt", b"first", email=email).status_code == 202
    r = upload("b.txt", b"second", email=email)
    assert r.status_code == 429 and r.json()["detail"]["code"] == "daily_limit"


def test_storage_quota(monkeypatch):
    monkeypatch.setattr(files_api, "STORAGE_PER_USER_MB", 0)
    r = upload("a.txt", b"x", email="quota@ucu.edu.ua")
    assert r.status_code == 413 and r.json()["detail"]["code"] == "storage_full"


# ---- AI limits ----

class RecordingLLM:
    enabled = True

    def __init__(self):
        self.calls = []

    def digest(self, title, text, url, source_type, topics, image=None):
        self.calls.append({"text": text, "url": url, "image": image})
        return Digest("Фото конспекту про графи.", "A photo of notes on graphs.", ["графи"], ["graph", "граф"], "")

    def pick_relevant(self, query, cards):
        return []


@pytest.fixture
def llm(monkeypatch):
    fake = RecordingLLM()
    monkeypatch.setattr(app.state.ingestion, "llm", fake)
    return fake


def test_ai_sees_only_the_start_of_a_long_file(llm):
    long_text = ("Dynamic programming and memoization. " * 2000).encode()  # ~74k chars
    r = upload("long.txt", long_text)
    assert r.status_code == 202
    sent = llm.calls[-1]
    assert len(sent["text"]) <= ingestion_service.AI_INPUT_CHARS + 50 and "first part" in sent["text"]
    assert sent["url"] == "uploaded file" and sent["image"] is None


def test_image_goes_to_ai_as_picture(llm):
    r = upload("graphs.png", PNG)
    item = client.get(f"/api/items/{r.json()['id']}", headers=h()).json()
    assert llm.calls[-1]["image"] == ("image/png", PNG)
    assert item["summary"].startswith("Фото") and not item["needs_tags"]
    assert item["image_url"] == item["url"]  # the photo is its own preview
    assert item["id"] in [i["id"] for i in client.get("/api/items", params={"q": "graph"}, headers=h()).json()]
