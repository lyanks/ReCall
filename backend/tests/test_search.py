from app.modules.search.ports import SearchDoc
from app.modules.search.ranker import KeywordRanker

DOCS = [
    SearchDoc(1, "Poki – Free Online Games", "Unsorted", "https://poki.com/",
              "Poki Play free online mini games: puzzle, racing and io games in your browser"),
    SearchDoc(2, "Big-O notation explained with pizza", "Algorithms", "https://example.com/bigo",
              "Big-O describes algorithm complexity. Imagine slicing a pizza."),
    SearchDoc(3, "Сортування злиттям", "Алгоритми", "https://uk.wikipedia.org/wiki/merge",
              "Сортування злиттям — алгоритм сортування, складність O(n log n)."),
    SearchDoc(4, "MiniGames.com", "Unsorted", "https://www.minigames.com/", ""),
]
r = KeywordRanker()


def ids(q):
    return [h.id for h in r.search(q, DOCS)]


def test_whole_sentence_query_finds_by_some_words():
    assert ids("the website with minigames")[:2] == [4, 1] or set(ids("the website with minigames")[:2]) == {1, 4}


def test_split_and_joined_words():
    assert 4 in ids("mini games") and 1 in ids("mini games")
    assert 1 in ids("minigames")


def test_word_forms_and_typos():
    assert ids("algorithms")[0] == 2           # plural vs "algorithm"
    assert ids("алгоритми")[0] == 3            # Ukrainian ending
    assert 2 in ids("complexty pizza")         # typo
    assert ids("піца") == []                   # no cross-language magic (that's semantic search, next step)


def test_site_name_and_url_count():
    assert ids("poki") == [1]


def test_title_beats_body_and_snippet_points_at_match():
    hits = r.search("pizza", DOCS)
    assert hits[0].id == 2 and "pizza" in hits[0].snippet


def test_unrelated_query_returns_nothing():
    assert ids("quantum chemistry") == []
