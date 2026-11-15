import { useState } from "react";
import { api } from "../api.js";
import { ItemList } from "../components/ItemList.jsx";
import { SearchBar } from "../components/SearchBar.jsx";
import { loadPrefs } from "../prefs.js";
import { go } from "../router.js";
import { useItems } from "../useItems.js";

function AddLink({ onAdded }) {
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
    <>
      <form className="row" onSubmit={add}>
        <input type="url" required placeholder="Встав посилання: YouTube, стаття, PDF…" value={url}
          onChange={(e) => setUrl(e.target.value)} />
        <button className="primary" disabled={busy}>{busy ? "Додаю…" : "Додати"}</button>
      </form>
      {error && <p className="error">{error}</p>}
    </>
  );
}

export function SearchResults({ q, onBack, backLabel }) {
  const { items, error, reload } = useItems({ q });
  return (
    <>
      <div className="results-head">
        <button className="back" onClick={onBack}>← {backLabel}</button>
        <span className="muted">
          Результати для «{q}»{items ? `: ${items.length}` : ""}
        </span>
      </div>
      {error && <p className="error">{error}</p>}
      {items?.length === 0 && <p className="muted empty">Нічого не знайшлося. Спробуй інші слова.</p>}
      {items && <ItemList items={items} onChanged={reload} />}
    </>
  );
}

export function Home({ user }) {
  const [q, setQ] = useState("");
  const recentCount = loadPrefs().recentCount;
  const { items, error, reload } = useItems({ limit: recentCount });

  return (
    <>
      <h1 className="page-title">Привіт{user.name ? `, ${user.name}` : ""}!</h1>
      <AddLink onAdded={reload} />
      <SearchBar key={q ? "s" : "h"} onSearch={setQ} placeholder="Шукати: «відео, де пояснювали Big-O на прикладі піци»" />
      {q ? (
        <SearchResults q={q} onBack={() => setQ("")} backLabel="На головну" />
      ) : (
        <>
          <div className="section-head">
            <h2>Нещодавно додані</h2>
            <a href="#/library" onClick={(e) => { e.preventDefault(); go("/library"); }}>Уся бібліотека →</a>
          </div>
          {error && <p className="error">{error}</p>}
          {items?.length === 0 && <p className="muted empty">Тут поки порожньо. Додай перший матеріал.</p>}
          {items && <ItemList items={items} onChanged={reload} />}
        </>
      )}
    </>
  );
}
