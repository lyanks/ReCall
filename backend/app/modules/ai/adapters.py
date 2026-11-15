"""LLMClient adapters: ClaudeClient (Anthropic API) and NoLLM (no key configured)."""

import json
import logging
import re
from typing import Sequence

from pydantic import BaseModel, Field

from .ports import Card, Digest

log = logging.getLogger(__name__)


# Sentences that only hedge about missing content. The prompt forbids them; this is a safety net.
HEDGES = re.compile(r"ймовірно|імовірно|зміст невідом|лише назв|тільки назв|"
                    r"\b(likely|probably|presumably|only (the |a )?title)\b", re.IGNORECASE)


def clean_summary(text: str) -> str:
    sentences = re.split(r"(?<=[.!?…])\s+", text.strip())
    return " ".join(s for s in sentences if s and not HEDGES.search(s)).strip()


class NoLLM:
    """Used when ANTHROPIC_API_KEY is not set: the app keeps keyword search and rule-based topics."""

    enabled = False

    def digest(self, title, text, url, source_type, topics) -> Digest:
        raise RuntimeError("LLM is not configured")

    def pick_relevant(self, query, cards) -> list[int]:
        raise RuntimeError("LLM is not configured")


class _DigestOut(BaseModel):
    summary_uk: str = Field(description="1-2 short factual sentences in Ukrainian (max 30 words), or empty if the text is too thin")
    summary_en: str = Field(description="The same summary in English, or empty")
    key_topics: list[str] = Field(description="3-5 short key topics (1-3 words each) in Ukrainian")
    keywords: list[str] = Field(description="10-20 search terms: key concepts and synonyms in BOTH Ukrainian and English")
    topic: str = Field(description="Best study topic for this material: one of the existing topics if it fits, "
                                   "otherwise a short new subject name in English (1-3 words); empty if unclear")


class _PickOut(BaseModel):
    ids: list[int] = Field(description="Ids of the relevant materials, most relevant first")


DIGEST_SYSTEM = """You help a university student organise study materials they saved (web pages, YouTube videos, \
TikTok/Instagram posts, PDFs). Given the extracted text of one material, write what it is about so the student \
can recall it later.

Rules for the summary:
- 1-2 short sentences, at most 30 words. Only the substance: the concrete concepts, methods, examples.
- State facts from the text directly. No filler, no intro ("This article...", "The video explains..." is fine \
only if short), no evaluation, no marketing tone.
- Never guess and never comment on the input: do not write that the text is short, that only a title is \
available, that the content is unknown, or what the material "probably" or "likely" covers.
- If the text is too thin to say anything concrete, return an empty string for both summaries.

Key topics and keywords may still be filled from the title when the summary is empty."""

PICK_SYSTEM = """You are the search engine of a student's personal library of study materials. \
Given a query and the library (one card per material), return the ids of materials that are relevant to the \
query BY MEANING, best first. The query and the materials may be in different languages (Ukrainian, English, \
others): match across languages, synonyms and related concepts (e.g. "динамічне програмування" matches a video \
about "dynamic programming" or "memoization"). Include a material only if it would really help with the query; \
return an empty list if nothing fits. At most 20 ids."""


class ClaudeClient:
    """Claude via the official Anthropic SDK. A small fast model is enough for both tasks and keeps the cost
    at a fraction of a cent per call."""

    enabled = True

    def __init__(self, api_key: str, model: str):
        import anthropic  # imported here so the app starts even if the package is missing locally

        self.client = anthropic.Anthropic(api_key=api_key, max_retries=2, timeout=60.0)
        self.model = model

    def _ask(self, system: str, user: str, schema: type[BaseModel], max_tokens: int, timeout: float):
        response = self.client.with_options(timeout=timeout).messages.parse(
            model=self.model,
            max_tokens=max_tokens,
            output_config={"effort": "low"},
            system=system,
            messages=[{"role": "user", "content": user}],
            output_format=schema,
        )
        if response.stop_reason == "refusal":
            raise RuntimeError(f"model declined: {getattr(response.stop_details, 'category', None)}")
        if response.parsed_output is None:
            raise RuntimeError(f"no structured output (stop_reason={response.stop_reason})")
        return response.parsed_output

    def digest(self, title: str, text: str, url: str, source_type: str, topics: Sequence[str]) -> Digest:
        user = (
            f"Existing topics in the student's library: {json.dumps(list(topics), ensure_ascii=False)}\n"
            f"Source type: {source_type}\nURL: {url}\nTitle: {title}\n\n<material>\n{text}\n</material>"
        )
        out: _DigestOut = self._ask(DIGEST_SYSTEM, user, _DigestOut, max_tokens=4000, timeout=60.0)
        return Digest(
            summary_uk=clean_summary(out.summary_uk),
            summary_en=clean_summary(out.summary_en),
            key_topics=[t.strip() for t in out.key_topics if t.strip()][:5],
            keywords=[k.strip() for k in out.keywords if k.strip()][:25],
            topic=out.topic.strip()[:120],
        )

    def pick_relevant(self, query: str, cards: Sequence[Card]) -> list[int]:
        library = "\n".join(
            json.dumps({"id": c.id, "title": c.title, "topic": c.topic, "about": c.summary,
                        "keywords": c.keywords}, ensure_ascii=False)
            for c in cards
        )
        user = f"<library>\n{library}\n</library>\n\nQuery: {query}"
        out: _PickOut = self._ask(PICK_SYSTEM, user, _PickOut, max_tokens=2000, timeout=20.0)
        known = {c.id for c in cards}
        seen: set[int] = set()
        return [i for i in out.ids if i in known and not (i in seen or seen.add(i))]
