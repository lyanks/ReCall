import { useEffect, useState } from "react";
import { api } from "./api.js";
import { DEV_MODE, onUser, signInEmail, signInGoogle, signOut, signUpEmail } from "./auth.js";

const APP_NAME = "ReCall";

function AuthForm() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn) {
    setError("");
    setBusy(true);
    try { await fn(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  function submit(e) {
    e.preventDefault();
    run(() => (mode === "signup" ? signUpEmail(email, password, name) : signInEmail(email, password)));
  }

  return (
    <div className="card auth">
      <h1>{APP_NAME}</h1>
      <p className="muted">Зберігай один раз. Знаходь за змістом, а не за тим, куди зберіг.</p>
      {DEV_MODE && <p className="dev">Dev mode: Firebase не налаштовано, вхід лише за email.</p>}
      {!DEV_MODE && (
        <button className="google" disabled={busy} onClick={() => run(signInGoogle)}>Увійти через Google</button>
      )}
      <div className="tabs">
        <button className={mode === "signin" ? "active" : ""} onClick={() => setMode("signin")}>Увійти</button>
        <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Зареєструватися</button>
      </div>
      <form onSubmit={submit}>
        {mode === "signup" && <input placeholder="Ім'я" value={name} onChange={(e) => setName(e.target.value)} />}
        <input type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        {!DEV_MODE && (
          <input type="password" placeholder="Пароль (мін. 6 символів)" required
            value={password} onChange={(e) => setPassword(e.target.value)} />
        )}
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>{mode === "signup" ? "Створити акаунт" : "Увійти"}</button>
      </form>
    </div>
  );
}

const ICON = { youtube: "▶", pdf: "📄", web: "🌐" };

function Library({ user, onSignOut }) {
  const [items, setItems] = useState([]);
  const [url, setUrl] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load(q = "") {
    try {
      setItems(await api(q ? `/items?q=${encodeURIComponent(q)}` : "/items"));
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => { load(); }, []);

  // Links are processed in the background (API answers 202); refresh until they are done.
  const processing = items.some((i) => i.status === "processing");
  useEffect(() => {
    if (!processing) return;
    const t = setTimeout(() => load(query), 1500);
    return () => clearTimeout(t);
  }, [items]);

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/items", { method: "POST", body: { url } });
      setUrl("");
      setQuery("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function rename(item) {
    const topic = window.prompt("Нова тема", item.topic);
    if (!topic) return;
    await api(`/items/${item.id}`, { method: "PATCH", body: { topic } });
    load(query);
  }

  async function remove(item) {
    await api(`/items/${item.id}`, { method: "DELETE" });
    load(query);
  }

  const byTopic = items.reduce((acc, i) => ((acc[i.topic] ||= []).push(i), acc), {});

  return (
    <div className="page">
      <header>
        <h1>{APP_NAME}</h1>
        <span className="muted">{user.name || user.email}</span>
        <button onClick={onSignOut}>Вийти</button>
      </header>

      <form className="row" onSubmit={add}>
        <input type="url" required placeholder="Встав посилання: YouTube, стаття, PDF…" value={url}
          onChange={(e) => setUrl(e.target.value)} />
        <button className="primary" disabled={busy}>{busy ? "Додаю…" : "Додати"}</button>
      </form>

      <form className="row" onSubmit={(e) => { e.preventDefault(); load(query); }}>
        <input placeholder="Шукати: «відео, де пояснювали Big-O на прикладі піци»" value={query}
          onChange={(e) => setQuery(e.target.value)} />
        <button>Шукати</button>
      </form>

      {error && <p className="error">{error}</p>}
      {items.length === 0 && <p className="muted">Тут поки порожньо. Додай перший матеріал.</p>}

      {Object.entries(byTopic).map(([topic, list]) => (
        <section key={topic}>
          <h2>{topic} <span className="muted">({list.length})</span></h2>
          {list.map((i) => (
            <div className="card item" key={i.id}>
              <div>
                <a href={i.url} target="_blank" rel="noreferrer">{ICON[i.source_type]} {i.title}</a>
                {i.status === "processing" && <span className="muted"> · обробляю…</span>}
                {i.status === "failed" && <span className="error"> · не вдалося отримати текст</span>}
                {i.snippet && <p className="muted snippet">{i.snippet}</p>}
              </div>
              <div className="actions">
                <button onClick={() => rename(i)}>Тема</button>
                <button onClick={() => remove(i)}>✕</button>
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined);

  useEffect(() => onUser(async (u) => {
    if (!u) return setUser(null);
    try {
      const me = await api("/me");
      await api("/sessions", { method: "POST" });
      setUser(me);
    } catch {
      setUser(null);
    }
  }), []);

  if (user === undefined) return null;
  if (!user) return <AuthForm />;
  return <Library user={user} onSignOut={signOut} />;
}
