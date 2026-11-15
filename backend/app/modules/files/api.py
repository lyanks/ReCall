"""Upload a file instead of pasting a link, and download it again by its link."""

import re
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import PurePath
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ...db import get_db
from ..analytics.service import log_event
from ..identity.api import current_user
from ..identity.models import User
from ..library.api import ItemOut, to_out
from ..library.models import FILE_URL_PREFIX, Item
from . import extract
from .models import StoredFile

# Fair-use limits for one account. Each upload costs at most one small AI call (see AI_INPUT_CHARS),
# and Neon's free database holds 0.5 GB for everyone.
UPLOADS_PER_DAY = 30
STORAGE_PER_USER_MB = 100

router = APIRouter(tags=["files"])

_ERRORS = {
    "unsupported_type": (status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                         "Unsupported file. Upload PDF, DOCX, PPTX, TXT, MD, PNG, JPG or WebP."),
    "too_large": (status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                  f"File is too large: up to {extract.MAX_FILE_MB} MB (images up to {extract.MAX_IMAGE_MB} MB)."),
    "empty": (status.HTTP_400_BAD_REQUEST, "The file is empty."),
}


def _error(code: str, message: str | None = None) -> HTTPException:
    http, default = _ERRORS.get(code, (status.HTTP_400_BAD_REQUEST, code))
    # the frontend shows a translated message by code; detail stays readable in the API docs
    return HTTPException(http, {"code": code, "message": message or default})


def safe_name(name: str) -> str:
    name = PurePath((name or "").replace("\\", "/")).name
    name = re.sub(r"[\x00-\x1f\x7f]", "", name).strip()
    if len(name) > 150:  # keep the extension
        ext = PurePath(name).suffix[:10]
        name = name[: 150 - len(ext)] + ext
    return name or "file"


@router.post("/items/upload", response_model=ItemOut, status_code=status.HTTP_202_ACCEPTED)
async def upload_item(request: Request, file: UploadFile = File(...), topic: str = Form(""),
                      user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Saves the file and returns at once (202); text extraction and the AI summary run in the background."""
    name = safe_name(file.filename or "")
    data = await file.read(extract.MAX_FILE_MB * 1024 * 1024 + 1)
    try:
        fmt = extract.check(name, data)
    except extract.UnsupportedFile as e:
        raise _error(str(e))

    since = datetime.now(timezone.utc) - timedelta(days=1)
    today = db.scalar(select(func.count()).select_from(StoredFile)
                      .where(StoredFile.owner_id == user.id, StoredFile.created_at >= since))
    if today >= UPLOADS_PER_DAY:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            {"code": "daily_limit", "message": f"Up to {UPLOADS_PER_DAY} files a day. Try again tomorrow."})
    used = db.scalar(select(func.coalesce(func.sum(StoredFile.size), 0)).where(StoredFile.owner_id == user.id))
    if used + len(data) > STORAGE_PER_USER_MB * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            {"code": "storage_full", "message": f"Your {STORAGE_PER_USER_MB} MB of files are used up. "
                                                                "Delete some files to upload more."})

    topic = topic.strip()[:120]
    token = secrets.token_urlsafe(24)
    item = Item(owner_id=user.id, url=f"{FILE_URL_PREFIX}{token}/{quote(name)}", source_type=fmt.source_type,
                title=extract.title_from(name), topic=topic or "Unsorted")
    db.add(item)
    db.flush()
    db.add(StoredFile(item_id=item.id, owner_id=user.id, token=token, filename=name,
                      content_type=fmt.content_type, size=len(data), data=data))
    log_event(db, user.id, "upload_file")
    db.commit()
    request.app.state.tasks.enqueue(request.app.state.ingestion.process, item.id, bool(topic))
    return to_out(item)


@router.get("/files/{token}/{name}", include_in_schema=False)
def download(token: str, name: str, db: Session = Depends(get_db)):
    """The link on the card. The random token is the key, so it opens in a new tab without a login header."""
    f = db.scalar(select(StoredFile).where(StoredFile.token == token))
    if f is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found")
    return Response(f.data, media_type=f.content_type, headers={
        "Content-Disposition": f"inline; filename*=UTF-8''{quote(f.filename)}",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=86400",
    })
