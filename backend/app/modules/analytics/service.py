from sqlalchemy.orm import Session

from .models import Event


def log_event(db: Session, user_id: int, kind: str) -> None:
    db.add(Event(user_id=user_id, kind=kind))
