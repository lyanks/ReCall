from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ...db import get_db
from ..analytics.service import log_event
from ..identity.api import current_user
from ..identity.models import User
from .models import Item

router = APIRouter(prefix="/items", tags=["library"])


class ItemCreate(BaseModel):
    url: HttpUrl


class ItemUpdate(BaseModel):
    topic: str = Field(min_length=1, max_length=120)


class ItemOut(BaseModel):
    id: int
    source_type: str
    url: str
    title: str
    topic: str
    status: str
    snippet: str
    created_at: datetime


def to_out(item: Item, query: str | None = None) -> ItemOut:
    snippet = item.text[:200]
    if query and item.text:
        pos = item.text.lower().find(query.lower())
        if pos >= 0:
            start = max(0, pos - 80)
            snippet = ("…" if start else "") + item.text[start : pos + 120] + "…"
    return ItemOut(id=item.id, source_type=item.source_type, url=item.url, title=item.title or item.url,
                   topic=item.topic, status=item.status, snippet=snippet, created_at=item.created_at)


@router.post("", response_model=ItemOut, status_code=status.HTTP_202_ACCEPTED)
def add_item(body: ItemCreate, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Saves the link and returns at once (202); text extraction runs in the background."""
    ingestion = request.app.state.ingestion
    url = str(body.url)
    item = Item(owner_id=user.id, url=url, source_type=ingestion.detect_type(url), title=url)
    db.add(item)
    log_event(db, user.id, "add_item")
    db.commit()
    request.app.state.tasks.enqueue(ingestion.process, item.id)
    return to_out(item)


@router.get("", response_model=list[ItemOut])
def list_items(
    q: str | None = None,
    limit: int | None = Query(None, ge=1, le=100, description="Only the N most recently added"),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    stmt = select(Item).where(Item.owner_id == user.id)
    if q:
        # v0: keyword search. Next: semantic search (embeddings) behind a SearchIndex port.
        like = f"%{q}%"
        stmt = stmt.where(or_(Item.title.ilike(like), Item.text.ilike(like), Item.topic.ilike(like)))
        log_event(db, user.id, "search")
        db.commit()
    stmt = stmt.order_by(Item.created_at.desc(), Item.id.desc())
    if limit:
        stmt = stmt.limit(limit)
    return [to_out(i, q) for i in db.scalars(stmt)]


def _own(item_id: int, user: User, db: Session) -> Item:
    item = db.get(Item, item_id)
    if item is None or item.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")
    return item


@router.get("/{item_id}", response_model=ItemOut)
def get_item(item_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return to_out(_own(item_id, user, db))


@router.patch("/{item_id}", response_model=ItemOut)
def update_item(item_id: int, body: ItemUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    item = _own(item_id, user, db)
    item.topic = body.topic.strip()
    db.commit()
    return to_out(item)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(_own(item_id, user, db))
    db.commit()
