import { useState } from "react";
import { api } from "../api.js";
import { Icon, SourceIcon } from "../components/Icons.jsx";
import { ItemList } from "../components/ItemList.jsx";
import { SearchBar } from "../components/SearchBar.jsx";
import { useT } from "../i18n.jsx";
import { loadPrefs } from "../prefs.js";
import { go } from "../router.js";
import { useItems } from "../useItems.js";

const SUPPORTED = ["youtube", "tiktok", "instagram", "web", "pdf"];

function AddLink({ onAdded }) {
  const t = useT();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/items", { method: "POST", body: { url } });
      setUrl("");
      onAdded();
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

  return (
    <>
      <h1 className="page-title">{t("home.hello")}{user.name ? <>, <span className="mark">{user.name}</span></> : ""}!</h1>
      <p className="page-sub">{t("tagline")}</p>
      <AddLink onAdded={reload} />
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
          {items && <ItemList items={items} onChanged={reload} />}
        </>
      )}
    </>
  );
}
