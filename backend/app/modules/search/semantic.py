"""SemanticSearch: search by meaning across languages through the LLMClient port.

Why not embeddings: the Anthropic API has no embeddings endpoint, a second vendor (e.g. Voyage) means a second
key, and a local multilingual model does not fit a 512 MB free instance. A student's library is small (tens to
hundreds of items), so we send compact cards (title, topic, AI summary, keywords) to a small fast Claude model
and let it pick the relevant ones. When libraries grow, a pgvector adapter can replace this behind the same port.
"""

import logging
from typing import Sequence

from ..ai.ports import Card, LLMClient
from .ports import Hit, SearchDoc, SearchIndex

log = logging.getLogger(__name__)

MAX_CARDS = 200  # newest items first; ~100 tokens each


class SemanticSearch:
    def __init__(self, llm: LLMClient, fallback: SearchIndex):
        self.llm = llm
        self.fallback = fallback

    def search(self, query: str, docs: Sequence[SearchDoc]) -> list[Hit]:
        keyword_hits = self.fallback.search(query, docs)
        if not self.llm.enabled or not docs:
            return keyword_hits
        newest = sorted(docs, key=lambda d: d.id, reverse=True)[:MAX_CARDS]
        cards = [Card(d.id, d.title, d.topic, d.summary or d.text[:300], d.keywords) for d in newest]
        try:
            ids = self.llm.pick_relevant(query, cards)
        except Exception:
            log.exception("semantic search failed, using keyword results")
            return keyword_hits

        by_id = {d.id: d for d in docs}
        kw = {h.id: h for h in keyword_hits}
        hits = [
            Hit(i, 1000.0 - n, kw[i].snippet if i in kw else (by_id[i].summary or by_id[i].text[:200]))
            for n, i in enumerate(ids)
        ]
        # Keyword matches the model left out still count (exact names, URLs), after the semantic ones.
        picked = set(ids)
        hits += [h for h in keyword_hits if h.id not in picked]
        return hits
