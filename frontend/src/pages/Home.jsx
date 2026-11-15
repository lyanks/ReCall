import { useState } from "react";
import { api } from "../api.js";
import { Icon, SourceIcon } from "../components/Icons.jsx";
import { ItemList } from "../components/ItemList.jsx";
import { SearchBar } from "../components/SearchBar.jsx";
import { loadPrefs } from "../prefs.js";
import { go } from "../router.js";
import { useItems } from "../useItems.js";

const SUPPORTED = [["youtube", "YouTube"], ["tiktok", "TikTok"], ["instagram", "Instagram"], ["web", "Статті"], ["pdf", "PDF"]];

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
    <section className="card add-panel" aria-label="Додати матеріал">
      <form onSubmit={add}>
        <label className="field-icon">
          <Icon name="link" />
          <input type="url" required aria-label="Посилання" placeholder="Встав посилання на відео, допис, статтю чи PDF"
            value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <button className="primary" disabled={busy}><Icon name="plus" size={18} />{busy ? "Додаю…" : "Додати"}</button>
      </form>
      {error && <p className="error">{error}</p>}
      <div className="sources">
        <span className="sources-label">Підтримуємо:</span>
        {SUPPORTED.map(([type, label]) => (
          <span key={type} className="source-chip"><SourceIcon type={type} size={13} />{label}</span>
        ))}
      </div>
    </section>
  );
}

export function SearchResults({ q, onBack, backLabel }) {
  const { items, error, reload } = useItems({ q });
  return (
    <>
      <div className="results-head">
        <button className="back" onClick={onBack}><Icon name="back" size={16} />{backLabel}</button>
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
      <h1 className="page-title">Привіт{user.name ? <>, <span className="mark">{user.name}</span></> : ""}!</h1>
      <p className="page-sub">Зберігай один раз. Знаходь за змістом, а не за тим, куди зберіг.</p>
      <AddLink onAdded={reload} />
      <SearchBar key={q ? "s" : "h"} onSearch={setQ} placeholder="Шукати за змістом: «відео, де Big-O пояснювали на піці»" />
      {q ? (
        <SearchResults q={q} onBack={() => setQ("")} backLabel="На головну" />
      ) : (
        <>
          <div className="section-head">
            <h2>Нещодавно додані</h2>
            <a href="#/library" onClick={(e) => { e.preventDefault(); go("/library"); }}>Уся бібліотека →</a>
          </div>
          {error && <p className="error">{error}</p>}
          {items?.length === 0 && <p className="muted empty">Тут поки порожньо. Встав посилання вище, і перший матеріал з’явиться тут.</p>}
          {items && <ItemList items={items} onChanged={reload} />}
        </>
      )}
    </>
  );
}
