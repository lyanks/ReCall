from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ...db import Base


class Item(Base):
    """One saved study material: a web page, a YouTube video or a PDF."""

    __tablename__ = "items"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    source_type: Mapped[str] = mapped_column(String(20))  # web | youtube | pdf
    url: Mapped[str] = mapped_column(Text)
    title: Mapped[str] = mapped_column(Text, default="")
    topic: Mapped[str] = mapped_column(String(120), default="Unsorted")
    text: Mapped[str] = mapped_column(Text, default="")
    # AI digest (empty when no LLM is configured or it has not run yet)
    summary: Mapped[str] = mapped_column(Text, default="", server_default="")
    summary_en: Mapped[str] = mapped_column(Text, default="", server_default="")
    key_topics: Mapped[list] = mapped_column(JSON, default=list, server_default="[]")
    keywords: Mapped[str] = mapped_column(Text, default="", server_default="")
    # the user's own key phrases (e.g. for a TikTok whose content we could not read)
    tags: Mapped[list] = mapped_column(JSON, default=list, server_default="[]")
    status: Mapped[str] = mapped_column(String(20), default="processing")  # processing | ready | failed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


SOCIAL = {"tiktok", "instagram"}
# words our social extractors add themselves; they say nothing about the content
_FILLER = {"tiktok", "instagram", "reel", "допис", "відео", "від", "post", "video"}


def content_unknown(item: "Item") -> bool:
    """A TikTok/Instagram post that gave us little more than its author's name.

    Nothing to summarise, so we skip the AI call (saves tokens) and ask the user for key phrases instead.
    """
    if item.source_type not in SOCIAL:
        return False
    words = [w for w in (item.text or "").lower().replace("#", " ").split() if w not in _FILLER and len(w) > 2]
    return len(words) < 4
