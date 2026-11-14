"""Placeholder topic classifier: keyword rules. To be replaced by an LLM/embedding classifier."""

RULES: dict[str, list[str]] = {
    "Algorithms": ["algorithm", "big-o", "big o", "sorting", "graph", "dynamic programming", "complexity"],
    "OOAD": ["uml", "use case", "class diagram", "design pattern", "object-oriented", "ooad", "solid"],
    "Databases": ["sql", "database", "postgres", "normal form", "query"],
    "Math": ["calculus", "linear algebra", "probability", "matrix", "integral", "statistics"],
    "English": ["english", "grammar", "ielts", "vocabulary"],
    "Programming": ["python", "java", "c++", "javascript", "programming", "code"],
}


def guess_topic(title: str, text: str) -> str:
    haystack = f"{title} {text[:5000]}".lower()
    best, best_hits = "Unsorted", 0
    for topic, words in RULES.items():
        hits = sum(haystack.count(w) for w in words)
        if hits > best_hits:
            best, best_hits = topic, hits
    return best
