"""Port: LLMClient. Everything the app asks a language model goes through here, so the vendor can change
(Claude now) and tests run with a fake. Without a key the app uses NoLLM and works exactly as before."""

from dataclasses import dataclass, field
from typing import Protocol, Sequence


@dataclass
class Digest:
    """What the model says about one saved material."""

    summary_uk: str
    summary_en: str
    key_topics: list[str] = field(default_factory=list)  # 3-5 short tags shown on the card
    keywords: list[str] = field(default_factory=list)  # synonyms in both languages, used by search
    topic: str = ""  # suggested topic (course/subject), "" if unsure


@dataclass
class Card:
    """A compact description of one item, enough to judge whether it answers a query."""

    id: int
    title: str
    topic: str
    summary: str
    keywords: str


class LLMClient(Protocol):
    enabled: bool

    def digest(self, title: str, text: str, url: str, source_type: str, topics: Sequence[str]) -> Digest: ...

    def pick_relevant(self, query: str, cards: Sequence[Card]) -> list[int]:
        """Ids of the cards that answer the query by meaning (any language), best first."""
        ...
