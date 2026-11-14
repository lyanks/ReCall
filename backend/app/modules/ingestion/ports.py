from dataclasses import dataclass
from typing import Protocol


@dataclass
class Extracted:
    title: str
    text: str


class ContentExtractor(Protocol):
    """Port: one adapter per source type (web page, YouTube, PDF)."""

    source_type: str

    def supports(self, url: str) -> bool: ...
    def extract(self, url: str) -> Extracted: ...


class TopicClassifier(Protocol):
    """Port: keyword rules now; an LLM adapter (Claude API via LLMClient) later."""

    def classify(self, title: str, text: str) -> str: ...
