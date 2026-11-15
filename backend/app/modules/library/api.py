from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, HttpUrl, StringConstraints
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ...db import get_db
from ..analytics.service import log_event
from ..identity.api import current_user
from ..identity.models import User
from ..search.ports import SearchDoc
from .models import SOCIAL, Item, content_unknown

router = APIRouter(prefix="/items", tags=["library"])


Tag = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]


class ItemCreate(BaseModel):
    url: HttpUrl
    topic: str | None = Field(None, max_length=120, description="Chosen by the user while adding; empty = automatic")


class ItemUpdate(BaseModel):
    title: str | None = Field(None, max_length=300, description="Empty = back to the title from the source")
    topic: str | None = Field(None, min_length=1, max_length=120)
    tags: list[Tag] | None = Field(None, max_length=15)


def needs_tags(item: Item) -> bool:
    """A TikTok/Instagram post whose content we could not read: ask the user for a few key phrases."""
    if item.status == "processing" or item.tags:
        return False
    return item.status == "failed" and item.source_type in SOCIAL or content_unknown(item)


class ItemOut(BaseModel):
    id: int
    source_type: str
    url: str
    title: str
    topic: str
    status: str
    snippet: str
    summary: str = ""
    summary_en: str = ""
    key_topics: list[str] = []
    key_topics_en: list[str] = []
    image_url: str = ""
    tags: list[str] = []
    needs_tags: bool = False
    created_at: datetime


def to_out(item: Item, snippet: str | None = None) -> ItemOut:
    snippet = item.text[:200] if snippet is None else snippet
    return ItemOut(id=item.id, source_type=item.source_type, url=item.url, title=item.title or item.url,
                   topic=item.topic, status=item.status, snippet=snippet, summary=item.summary or "",
                   summary_en=item.summary_en or "", key_topics=item.key_topics or [], tags=item.tags or [],
                   key_topics_en=item.key_topics_en or [], image_url=item.image_url or "",
                   needs_tags=needs_tags(item), created_at=item.created_at)


@router.post("", response_model=ItemOut, status_code=status.HTTP_202_ACCEPTED)
def add_item(body: ItemCreate, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Saves the link and returns at once (202); text extraction runs in the background."""
    ingestion = request.app.state.ingestion
    url = str(body.url)
    topic = (body.topic or "").strip()
    item = Item(owner_id=user.id, url=url, source_type=ingestion.detect_type(url), title=url, topic=topic or "Unsorted")
    db.add(item)
    log_event(db, user.id, "add_item")
    db.commit()
    # a topic the user chose while adding wins over the automatic one
    request.app.state.tasks.enqueue(ingestion.process, item.id, bool(topic))
    return to_out(item)


class TopicOut(BaseModel):
    name: str
    count: int
    sources: dict[str, int]
    latest: datetime


topics_router = APIRouter(prefix="/topics", tags=["library"])


@topics_router.get("", response_model=list[TopicOut])
def list_topics(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """The user's topics with item counts, for the library grid and the topic picker."""
    rows = db.execute(
        select(Item.topic, Item.source_type, func.count(), func.max(Item.created_at))
        .where(Item.owner_id == user.id).group_by(Item.topic, Item.source_type)
    ).all()
    topics: dict[str, TopicOut] = {}
    for name, source, count, latest in rows:
        t = topics.setdefault(name, TopicOut(name=name, count=0, sources={}, latest=latest))
        t.count += count
        t.sources[source] = count
        t.latest = max(t.latest, latest)
    return sorted(topics.values(), key=lambda t: (-t.count, t.name.lower()))


@router.get("", response_model=list[ItemOut])
def list_items(
    request: Request,
    q: str | None = None,
    topic: str | None = None,
    limit: int | None = Query(None, ge=1, le=100, description="Only the N most recently added"),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    stmt = select(Item).where(Item.owner_id == user.id)
    if topic:
        stmt = stmt.where(Item.topic == topic)
    if q and q.strip():
        log_event(db, user.id, "search")
        db.commit()
        items = {i.id: i for i in db.scalars(stmt)}
        docs = [SearchDoc(i.id, i.title, i.topic, i.url, i.text, i.summary or "", i.keywords or "", " ".join(i.tags or []))
                for i in items.values()]
        hits = request.app.state.search.search(q, docs)[: limit or 50]
        return [to_out(items[h.id], snippet=h.snippet) for h in hits]
    stmt = stmt.order_by(Item.created_at.desc(), Item.id.desc())
    if limit:
        stmt = stmt.limit(limit)
    return [to_out(i) for i in db.scalars(stmt)]


def _own(item_id: int, user: User, db: Session) -> Item:
    item = db.get(Item, item_id)
    if item is None or item.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")
    return item


@router.get("/{item_id}", response_model=ItemOut)
def get_item(item_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return to_out(_own(item_id, user, db))


@router.post("/{item_id}/refresh", response_model=ItemOut, status_code=status.HTTP_202_ACCEPTED)
def refresh_item(item_id: int, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Fetch the source again (e.g. after the extractor got better)."""
    item = _own(item_id, user, db)
    item.status = "processing"
    db.commit()
    request.app.state.tasks.enqueue(request.app.state.ingestion.process, item.id, True)
    return to_out(item)


@router.patch("/{item_id}", response_model=ItemOut)
def update_item(item_id: int, body: ItemUpdate, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    item = _own(item_id, user, db)
    if body.topic is not None:
        item.topic = body.topic.strip()
    if body.title is not None:
        title = " ".join(body.title.split())
        item.custom_title = bool(title)
        if title:
            item.title = title
        else:  # back to the source's own title
            item.status = "processing"
            db.commit()
            request.app.state.tasks.enqueue(request.app.state.ingestion.process, item.id, True)
    if body.tags is not None:
        seen, tags = set(), []
        for t in body.tags:  # keep order, drop duplicates (case-insensitive)
            if t.lower() not in seen:
                seen.add(t.lower())
                tags.append(t)
        item.tags = tags
    db.commit()
    return to_out(item)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(_own(item_id, user, db))
    db.commit()
