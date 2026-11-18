from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from ...db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    """Local profile for an identity that lives in the auth provider (Firebase)."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    auth_uid: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), default="")
    name: Mapped[str] = mapped_column(String(120), default="")
    # login of a login+password account (None for Google / older email accounts)
    login: Mapped[str | None] = mapped_column(String(32), unique=True, index=True, nullable=True)
    # address the user asked to confirm; becomes `email` once Firebase confirms it
    pending_email: Mapped[str] = mapped_column(String(255), default="", server_default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
