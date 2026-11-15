from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import distinct, func, select
from sqlalchemy.orm import Session

from ...db import get_db
from ..identity.api import current_user
from ..identity.models import User
from ..library.models import Item
from .models import Event

router = APIRouter(prefix="/stats", tags=["analytics"])


class MyStats(BaseModel):
    items: int
    topics: int
    searches: int
    by_source: dict[str, int]


@router.get("/me", response_model=MyStats)
def my_stats(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Numbers for the profile page."""
    mine = Item.owner_id == user.id
    by_source = dict(db.execute(select(Item.source_type, func.count()).where(mine).group_by(Item.source_type)).all())
    return MyStats(
        items=sum(by_source.values()),
        topics=db.scalar(select(func.count(distinct(Item.topic))).where(mine)) or 0,
        searches=db.scalar(select(func.count()).where(Event.user_id == user.id, Event.kind == "search")) or 0,
        by_source=by_source,
    )
