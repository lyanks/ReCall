from sqlalchemy import select
from sqlalchemy.orm import Session

from ..analytics.service import log_event
from .models import User
from .ports import Principal


def get_or_create_user(db: Session, p: Principal) -> User:
    user = db.scalar(select(User).where(User.auth_uid == p.uid))
    if user is None:
        user = User(auth_uid=p.uid, email=p.email, name=p.name)
        db.add(user)
        db.flush()
        log_event(db, user.id, "signup")
        db.commit()
    return user
