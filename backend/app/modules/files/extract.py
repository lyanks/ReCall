"""Which files we accept, and how we get text out of them.

Limits keep a huge upload from costing much: the file size is capped, only the first pages/slides are read,
and the AI digest sees only the start of the text (AI_INPUT_CHARS in the ingestion service).
"""

import html
import io
import re
import zipfile
from dataclasses import dataclass
from pathlib import PurePath

from ..ingestion.ports import Extracted

MAX_FILE_MB = 10
MAX_IMAGE_MB = 5  # Claude's limit for one image
MAX_PAGES = 30  # PDF pages we read
MAX_SLIDES = 60  # PPTX slides we read
MAX_TEXT = 60_000  # characters kept for keyword search (the AI sees fewer, see AI_INPUT_CHARS)
_MAX_XML = 30 * 1024 * 1024  # an unpacked DOCX/PPTX part bigger than this is a zip bomb


@dataclass(frozen=True)
class Format:
    source_type: str  # what the card shows: pdf | doc | image
    content_type: str
    magic: tuple[bytes, ...] = ()  # first bytes of a real file of this kind


FORMATS = {
    ".pdf": Format("pdf", "application/pdf", (b"%PDF",)),
    ".docx": Format("doc", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", (b"PK",)),
    ".pptx": Format("doc", "application/vnd.openxmlformats-officedocument.presentationml.presentation", (b"PK",)),
    ".txt": Format("doc", "text/plain; charset=utf-8"),
    ".md": Format("doc", "text/markdown; charset=utf-8"),
    ".png": Format("image", "image/png", (b"\x89PNG",)),
    ".jpg": Format("image", "image/jpeg", (b"\xff\xd8",)),
    ".jpeg": Format("image", "image/jpeg", (b"\xff\xd8",)),
    ".webp": Format("image", "image/webp", (b"RIFF",)),
}


class UnsupportedFile(ValueError):
    pass


def suffix(filename: str) -> str:
    return PurePath(filename).suffix.lower()


def check(filename: str, data: bytes) -> Format:
    """The file's format, or UnsupportedFile with a reason the user can act on."""
    fmt = FORMATS.get(suffix(filename))
    if fmt is None:
        raise UnsupportedFile("unsupported_type")
    limit = MAX_IMAGE_MB if fmt.source_type == "image" else MAX_FILE_MB
    if len(data) > limit * 1024 * 1024:
        raise UnsupportedFile("too_large")
    if not data:
        raise UnsupportedFile("empty")
    if fmt.magic and not data.startswith(fmt.magic):
        raise UnsupportedFile("unsupported_type")  # e.g. an .exe renamed to .pdf
    if suffix(filename) == ".webp" and data[8:12] != b"WEBP":
        raise UnsupportedFile("unsupported_type")
    return fmt


def title_from(filename: str) -> str:
    stem = PurePath(filename).stem
    return re.sub(r"[_\s]+", " ", stem).strip() or filename


def _clean(text: str) -> str:
    return re.sub(r"[ \t\r\f\v]+", " ", re.sub(r"\n\s*\n+", "\n", text)).strip()[:MAX_TEXT]


def _pdf(data: bytes) -> tuple[str, str]:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    if reader.is_encrypted:
        reader.decrypt("")  # many PDFs are "encrypted" with an empty password; a real one fails below
    meta_title = ""
    try:
        meta_title = (reader.metadata.title or "").strip() if reader.metadata else ""
    except Exception:
        pass
    parts, size = [], 0
    for page in reader.pages[:MAX_PAGES]:
        t = page.extract_text() or ""
        parts.append(t)
        size += len(t)
        if size > MAX_TEXT:
            break
    return meta_title, "\n".join(parts)


def _xml_text(z: zipfile.ZipFile, name: str, tag: str, para: str) -> str:
    info = z.getinfo(name)
    if info.file_size > _MAX_XML:
        raise UnsupportedFile("too_large")
    xml = z.read(name).decode("utf-8", "replace")
    # runs of text (<w:t>, <a:t>) joined; a paragraph end becomes a line break
    pattern = re.compile(rf"<{tag}(?:\s[^>]*)?>([^<]*)</{tag}>|(</{para}>)")
    return "".join(html.unescape(m.group(1)) if m.group(2) is None else "\n" for m in pattern.finditer(xml))


def _office_title(z: zipfile.ZipFile) -> str:
    try:
        core = z.read("docProps/core.xml").decode("utf-8", "replace")
    except KeyError:
        return ""
    m = re.search(r"<dc:title>([^<]*)</dc:title>", core)
    return html.unescape(m.group(1)).strip() if m else ""


def _docx(data: bytes) -> tuple[str, str]:
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        return _office_title(z), _xml_text(z, "word/document.xml", "w:t", "w:p")


def _pptx(data: bytes) -> tuple[str, str]:
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        slides = sorted((n for n in z.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)),
                        key=lambda n: int(re.search(r"\d+", n.rsplit("/", 1)[1]).group()))
        text = "\n".join(_xml_text(z, n, "a:t", "a:p") for n in slides[:MAX_SLIDES])
        return _office_title(z), text


def _plain(data: bytes) -> tuple[str, str]:
    for enc in ("utf-8-sig", "cp1251"):
        try:
            return "", data.decode(enc)
        except UnicodeDecodeError:
            continue
    return "", data.decode("utf-8", "replace")


def extract(filename: str, data: bytes) -> Extracted:
    """Title + text of an uploaded file. Images have no text here; the AI digest looks at the picture."""
    reader = {".pdf": _pdf, ".docx": _docx, ".pptx": _pptx, ".txt": _plain, ".md": _plain}.get(suffix(filename))
    if reader is None:
        return Extracted(title_from(filename), "")
    try:
        meta_title, text = reader(data)
    except UnsupportedFile:
        raise
    except Exception as e:  # broken or password-protected file
        raise ValueError(f"cannot read {filename}: {type(e).__name__}") from e
    # Office "titles" are often template leftovers ("PowerPoint Presentation"); the file name is safer
    title = meta_title if meta_title and len(meta_title) > 3 and "presentation" not in meta_title.lower() else ""
    return Extracted(title or title_from(filename), _clean(text))
