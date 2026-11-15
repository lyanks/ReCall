from dataclasses import dataclass
from typing import Protocol, Sequence


@dataclass
class SearchDoc:
    id: int
    title: str
    topic: str
    url: str
    text: str
    summary: str = ""  # AI summary, if any
    keywords: str = ""  # AI keywords in both languages, if any


@dataclass
class Hit:
    id: int
    score: float
    snippet: str


class SearchIndex(Protocol):
    """Port: ranks a user's items for a free-text query.
    KeywordRanker: word-by-word, typo-tolerant, no network.
    SemanticSearch: asks the LLM which items answer the query by meaning (any language), keyword hits as a fallback."""

    def search(self, query: str, docs: Sequence[SearchDoc]) -> list[Hit]: ...
