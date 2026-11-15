"""Keyword ranker: no exact-phrase requirement, word stems, typo tolerance, URL and site name count too."""

import math
import re
from difflib import SequenceMatcher
from typing import Sequence

from .ports import Hit, SearchDoc

STOPWORDS = {
    # en
    "a", "an", "the", "of", "on", "in", "to", "for", "and", "or", "with", "about", "that", "this", "is", "was",
    "it", "by", "from", "at", "as", "my", "i", "me", "where", "what", "how", "video", "site", "website", "page",
    # uk
    "і", "й", "та", "в", "у", "на", "з", "із", "зі", "до", "по", "про", "що", "де", "як", "це", "той", "та",
    "відео", "сайт", "сторінка", "стаття", "який", "яка", "яке", "які", "мене", "мій", "моя", "там",
}
FIELDS = (("title", 3.0), ("topic", 2.0), ("url", 2.0), ("text", 1.0))
WORD = re.compile(r"[\w']+", re.UNICODE)


def words(s: str) -> list[str]:
    return [w.replace("_", "") for w in WORD.findall(s.lower()) if w.replace("_", "")]


def stem(w: str) -> str:
    # Crude, language-agnostic: drop a short ending so "games"~"game", "алгоритми"~"алгоритм".
    if len(w) >= 7:
        return w[:-2]
    if len(w) >= 5:
        return w[:-1]
    return w


class KeywordRanker:
    def search(self, query: str, docs: Sequence[SearchDoc]) -> list[Hit]:
        q_words = [w for w in words(query) if w not in STOPWORDS] or words(query)
        if not q_words:
            return []
        stems = [stem(w) for w in q_words]
        phrase = " ".join(q_words)
        compact_q = "".join(q_words)
        need = max(1, math.ceil(len(stems) * 0.5))

        hits = []
        for d in docs:
            fields = {
                "title": d.title, "topic": d.topic, "url": d.url, "text": d.text,
            }
            norm = {k: " ".join(words(v)) for k, v in fields.items()}
            compact = {k: v.replace(" ", "") for k, v in norm.items()}
            vocab = None
            score, matched = 0.0, 0

            for s in stems:
                best = 0.0
                for name, weight in FIELDS:
                    if s in norm[name] or (len(s) >= 4 and s in compact[name]):
                        best = max(best, weight)
                if best == 0 and len(s) >= 5:  # typo tolerance on whole words
                    if vocab is None:
                        vocab = {w for name, _ in FIELDS for w in norm[name].split() if len(w) >= 4}
                    if any(SequenceMatcher(None, s, w[: len(s) + 1]).ratio() >= 0.8 for w in vocab):
                        best = 0.6
                if best:
                    matched += 1
                    score += best

            # "mini games" should find "minigames.com" and the other way round
            if len(q_words) > 1 and any(compact_q in compact[n] for n, _ in FIELDS):
                score += 3
                matched = max(matched, need)
            if matched < need:
                continue
            if phrase in norm["title"] or phrase in norm["text"]:
                score += 2
            score += matched / len(stems)  # prefer items that match more of the query
            hits.append(Hit(d.id, score, self._snippet(d.text, stems)))

        hits.sort(key=lambda h: h.score, reverse=True)
        return hits

    @staticmethod
    def _snippet(text: str, stems: list[str]) -> str:
        low = text.lower()
        positions = [p for p in (low.find(s) for s in stems) if p >= 0]
        if not positions:
            return text[:200]
        pos = min(positions)
        start = max(0, pos - 80)
        return ("…" if start else "") + text[start : pos + 140] + "…"
