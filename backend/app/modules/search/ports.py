from dataclasses import dataclass
from typing import Protocol, Sequence


@dataclass
class SearchDoc:
    id: int
    title: str
    topic: str
    url: str
    text: str


@dataclass
class Hit:
    id: int
    score: float
    snippet: str


class SearchIndex(Protocol):
    """Port: ranks a user's items for a free-text query.
    Now: KeywordRanker (word-by-word, typo-tolerant). Next: embeddings via LLMClient for search by meaning."""

    def search(self, query: str, docs: Sequence[SearchDoc]) -> list[Hit]: ...
