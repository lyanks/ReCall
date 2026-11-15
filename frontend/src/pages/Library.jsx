import { useEffect, useState } from "react";
import { api } from "../api.js";
import { ItemList } from "../components/ItemList.jsx";
import { SearchBar } from "../components/SearchBar.jsx";
import { go } from "../router.js";
import { SOURCE_ICON } from "../sources.js";
import { useItems } from "../useItems.js";
import { SearchResults } from "./Home.jsx";

const fmtDate = (d) => new Date(d).toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
const plural = (n) => (n % 10 === 1 && n % 100 !== 11 ? "матеріал"
  : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "матеріали" : "матеріалів");

function TopicGrid({ topics }) {
  return (
    <div className="topic-grid">
      {topics.map((t) => (
        <a key={t.name} className="card topic-tile" href={`#/library/${encodeURIComponent(t.name)}`}
          onClick={(e) => { e.preventDefault(); go(`/library/${encodeURIComponent(t.name)}`); }}>
          <span className="topic-name">{t.name}</span>
          <span className="topic-count">{t.count} {plural(t.count)}</span>
          <span className="topic-foot">
            <span className="src-badges" aria-label="Джерела">
              {Object.keys(t.sources).map((s) => <span key={s} className="src-badge" title={s}>{SOURCE_ICON[s] || "🌐"}</span>)}
            </span>
            <span className="muted small">{fmtDate(t.latest)}</span>
          </span>
        </a>
      ))}
    </div>
  );
}

function TopicView({ topic }) {
  const { items, error, reload } = useItems({ topic });
  // after moving the last item out of this topic, go back to the grid
  useEffect(() => { if (items && items.length === 0) go("/library"); }, [items]);
  return (
    <>
      <div className="results-head">
        <button className="back" onClick={() => go("/library")}>← Усі теми</button>
      </div>
      <h1 className="page-title">{topic} {items && <span className="muted">({items.length})</span>}</h1>
      {error && <p className="error">{error}</p>}
      {items && <ItemList items={items} onChanged={reload} />}
    </>
  );
}

export function Library({ topic }) {
  const [q, setQ] = useState("");
  const [topics, setTopics] = useState(null);
  const [error, setError] = useState("");
  const loadTopics = () => api("/topics").then(setTopics).catch((e) => setError(e.message));
  useEffect(() => { if (!topic) loadTopics(); }, [topic]);

  if (topic) return <TopicView topic={topic} />;
  const total = topics?.reduce((n, t) => n + t.count, 0);

  return (
    <>
      <h1 className="page-title">Моя бібліотека {topics && <span className="muted">({total})</span>}</h1>
      <SearchBar key={q ? "s" : "l"} onSearch={setQ} placeholder="Шукати в бібліотеці" />
      {q ? (
        <SearchResults q={q} onBack={() => { setQ(""); loadTopics(); }} backLabel="До бібліотеки" />
      ) : (
        <>
          {error && <p className="error">{error}</p>}
          {topics?.length === 0 && <p className="muted empty">Бібліотека порожня. Додай матеріал на головній.</p>}
          {topics && <TopicGrid topics={topics} />}
        </>
      )}
    </>
  );
}
