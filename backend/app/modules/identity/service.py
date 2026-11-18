from sqlalchemy import select
from sqlalchemy.orm import Session

from ...config import LOGIN_DOMAIN
from ..analytics.service import log_event
from .models import User
from .ports import Principal


def is_login_email(email: str) -> bool:
    return email.lower().endswith("@" + LOGIN_DOMAIN)


def login_of(email: str) -> str | None:
    return email.lower().split("@")[0] if is_login_email(email) else None


def get_or_create_user(db: Session, p: Principal) -> User:
    user = db.scalar(select(User).where(User.auth_uid == p.uid))
    if user is None:
        user = User(auth_uid=p.uid, email=p.email, name=p.name, login=login_of(p.email))
        db.add(user)
        db.flush()
        log_event(db, user.id, "signup")
        db.commit()
    elif p.email and p.email.lower() != user.email.lower():
        # the user confirmed a new address in Firebase: keep our copy in sync, the login stays the same
        user.email = p.email
        if p.email.lower() == user.pending_email.lower():
            user.pending_email = ""
        db.commit()
    return user
