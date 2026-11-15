import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { Icon, SourceIcon } from "../components/Icons.jsx";
import { ItemList } from "../components/ItemList.jsx";
import { SearchBar } from "../components/SearchBar.jsx";
import { TopicDialog } from "../components/TopicDialog.jsx";
import { useT } from "../i18n.jsx";
import { loadPrefs } from "../prefs.js";
import { go } from "../router.js";
import { useItems } from "../useItems.js";

const SUPPORTED = ["youtube", "tiktok", "instagram", "web", "pdf"];

const QUICK_TOPICS = 6;

/** Topic for the link being added: automatic (default), one of the user's topics, or a new one. */
function TopicChooser({ value, onChange, refreshKey }) {
  const t = useT();
  const [topics, setTopics] = useState([]);
  const [dialog, setDialog] = useState(false);
  useEffect(() => { api("/topics").then(setTopics).catch(() => setTopics([])); }, [refreshKey]);

  const quick = topics.filter((x) => x.name !== "Unsorted").slice(0, QUICK_TOPICS).map((x) => x.name);
  if (value && !quick.includes(value)) quick.push(value); // a new or less-used topic picked in the dialog

  return (
    <div className="topic-choose" role="radiogroup" aria-label={t("add.topic")}>
      <span className="sources-label">{t("add.topic")}</span>
      <button type="button" role="radio" aria-checked={!value} className={`choice${!value ? " active" : ""}`}
        onClick={() => onChange("")}>✨ {t("add.auto")}</button>
      {quick.map((name) => (
        <button key={name} type="button" role="radio" aria-checked={value === name}
          className={`choice${value === name ? " active" : ""}`} onClick={() => onChange(value === name ? "" : name)}>
          {t.topic(name)}
        </button>
      ))}
      <button type="button" className="choice more" onClick={() => setDialog(true)}>+ {t("add.other")}</button>
      {dialog && (
        <TopicDialog onConfirm={(name) => { onChange(name); setDialog(false); }} onCancel={() => setDialog(false)} />
      )}
    </div>
  );
}

function AddLink({ onAdded }) {
  const t = useT();
  const [url, setUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [added, setAdded] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const item = await api("/items", { method: "POST", body: { url, topic: topic || null } });
      setUrl("");
      setTopic("");
      setAdded((n) => n + 1);
      onAdded(item);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card add-panel" aria-label={t("home.addLabel")}>
      <form onSubmit={add}>
        <label className="field-icon">
          <Icon name="link" />
          <input type="url" required aria-label={t("home.linkLabel")} placeholder={t("home.linkPlaceholder")}
            value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <button className="primary" disabled={busy}><Icon name="plus" size={18} />{busy ? t("home.adding") : t("home.add")}</button>
      </form>
      <TopicChooser value={topic} onChange={setTopic} refreshKey={added} />
      {error && <p className="error">{error}</p>}
      <div className="sources">
        <span className="sources-label">{t("home.supported")}</span>
        {SUPPORTED.map((type) => (
          <span key={type} className="source-chip"><SourceIcon type={type} size={13} />{t.sources(type)}</span>
        ))}
      </div>
    </section>
  );
}

export function SearchResults({ q, onBack, backLabel }) {
  const t = useT();
  const { items, error, reload } = useItems({ q });
  return (
    <>
      <div className="results-head">
        <button className="back" onClick={onBack}><Icon name="back" size={16} />{backLabel}</button>
        <span className="muted">
          {t("search.results", { q })}{items ? `: ${items.length}` : ""}
        </span>
      </div>
      {error && <p className="error">{error}</p>}
      {items?.length === 0 && <p className="muted empty">{t("search.none")}</p>}
      {items && <ItemList items={items} onChanged={reload} />}
    </>
  );
}

export function Home({ user }) {
  const t = useT();
  const [q, setQ] = useState("");
  const recentCount = loadPrefs().recentCount;
  const { items, error, reload } = useItems({ limit: recentCount });
  // the link just added: once it is processed, ask for tags if we could not read it
  const [pending, setPending] = useState(null);
  const [askTags, setAskTags] = useState(null);
  useEffect(() => {
    const it = pending && items?.find((i) => i.id === pending);
    if (!it || it.status === "processing") return;
    setPending(null);
    if (it.needs_tags) setAskTags(it);
  }, [items, pending]);
  const clearAsk = useCallback(() => setAskTags(null), []);

  return (
    <>
      <h1 className="page-title">{t("home.hello")}{user.name ? <>, <span className="mark">{user.name}</span></> : ""}!</h1>
      <p className="page-sub">{t("tagline")}</p>
      <AddLink onAdded={(item) => { setPending(item.id); reload(); }} />
      <SearchBar key={q ? "s" : "h"} onSearch={setQ} placeholder={t("home.searchPlaceholder")} />
      {q ? (
        <SearchResults q={q} onBack={() => setQ("")} backLabel={t("home.back")} />
      ) : (
        <>
          <div className="section-head">
            <h2>{t("home.recent")}</h2>
            <a href="#/library" onClick={(e) => { e.preventDefault(); go("/library"); }}>{t("home.allLibrary")}</a>
          </div>
          {error && <p className="error">{error}</p>}
          {items?.length === 0 && <p className="muted empty">{t("home.empty")}</p>}
          {items && <ItemList items={items} onChanged={reload} askTagsFor={askTags} onAsked={clearAsk} />}
        </>
      )}
    </>
  );
}
