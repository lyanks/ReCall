import { useEffect, useState } from "react";
import { api } from "../api.js";
import { ItemList } from "../components/ItemList.jsx";
import { SearchBar } from "../components/SearchBar.jsx";
import { go } from "../router.js";
import { Icon, SourceIcon } from "../components/Icons.jsx";
import { useT } from "../i18n.jsx";
import { useItems } from "../useItems.js";
import { SearchResults } from "./Home.jsx";

function TopicGrid({ topics }) {
  const t = useT();
  return (
    <div className="topic-grid">
      {[...topics.filter((x) => x.name !== "Unsorted"), ...topics.filter((x) => x.name === "Unsorted")].map((x) => (
        <a key={x.name} className={`card topic-tile${x.name === "Unsorted" ? " unsorted" : ""}`} href={`#/library/${encodeURIComponent(x.name)}`}
          onClick={(e) => { e.preventDefault(); go(`/library/${encodeURIComponent(x.name)}`); }}>
          <span className="topic-head">
            <span className="topic-name">{t.topic(x.name)}</span>
            <span className="topic-num" aria-hidden="true">{x.count}</span>
          </span>
          <span className="topic-count">{t.n(x.count, "n.items")}</span>
          <span className="topic-foot">
            <span className="src-badges" aria-label={`${t("library.sources")}: ${Object.keys(x.sources).map((s) => t.sources(s)).join(", ")}`}>
              {Object.keys(x.sources).map((s) => (
                <SourceIcon key={s} type={s} size={14} className="src-badge" />
              ))}
            </span>
            <span className="muted small">{t.ago(x.latest)}</span>
          </span>
        </a>
      ))}
    </div>
  );
}

function TopicView({ topic }) {
  const t = useT();
  const { items, error, reload } = useItems({ topic });
  // after moving the last item out of this topic, go back to the grid
  useEffect(() => { if (items && items.length === 0) go("/library"); }, [items]);
  return (
    <>
      <div className="results-head">
        <button className="back" onClick={() => go("/library")}><Icon name="back" size={16} />{t("library.allTopics")}</button>
      </div>
      <h1 className="page-title">{t.topic(topic)} {items && <span className="muted">({items.length})</span>}</h1>
      {error && <p className="error">{error}</p>}
      {items && <ItemList items={items} onChanged={reload} />}
    </>
  );
}

export function Library({ topic }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [topics, setTopics] = useState(null);
  const [error, setError] = useState("");
  const loadTopics = () => api("/topics").then(setTopics).catch((e) => setError(e.message));
  useEffect(() => { if (!topic) loadTopics(); }, [topic]);

  if (topic) return <TopicView topic={topic} />;
  const total = topics?.reduce((n, t) => n + t.count, 0);

  return (
    <>
      <h1 className="page-title">{t("library.title")}</h1>
      <p className="page-sub">{topics ? t("library.summary", { items: t.n(total, "n.items"), topics: t.n(topics.length, "n.inTopics") }) : "\u00a0"}</p>
      <SearchBar key={q ? "s" : "l"} onSearch={setQ} placeholder={t("library.search")} />
      {q ? (
        <SearchResults q={q} onBack={() => { setQ(""); loadTopics(); }} backLabel={t("library.back")} />
      ) : (
        <>
          {error && <p className="error">{error}</p>}
          {topics?.length === 0 && <p className="muted empty">{t("library.empty")}</p>}
          {topics && <TopicGrid topics={topics} />}
        </>
      )}
    </>
  );
}
