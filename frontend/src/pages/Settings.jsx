import { useState } from "react";
import { api } from "../api.js";
import { loadPrefs, savePrefs } from "../prefs.js";

export function Settings({ user, onUserChanged, onSignOut }) {
  const [name, setName] = useState(user.name);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [prefs, setPrefs] = useState(loadPrefs);

  function setPref(key, value) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    savePrefs(next);
  }

  async function saveName(e) {
    e.preventDefault();
    setError("");
    setSaved("");
    try {
      onUserChanged(await api("/me", { method: "PATCH", body: { name } }));
      setSaved("Збережено");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <h1 className="page-title">Налаштування</h1>

      <form className="card settings-block" onSubmit={saveName}>
        <h2 className="tight">Ім'я</h2>
        <div className="row">
          <input value={name} maxLength={120} required onChange={(e) => { setName(e.target.value); setSaved(""); }} />
          <button className="primary" disabled={!name.trim() || name.trim() === user.name}>Зберегти</button>
        </div>
        {saved && <p className="ok">{saved}</p>}
        {error && <p className="error">{error}</p>}
      </form>

      <div className="card settings-block">
        <h2 className="tight">Тема оформлення</h2>
        <div className="segmented" role="radiogroup">
          {[["system", "Як у системі"], ["light", "Світла"], ["dark", "Темна"]].map(([v, label]) => (
            <button key={v} role="radio" aria-checked={prefs.theme === v}
              className={prefs.theme === v ? "active" : ""} onClick={() => setPref("theme", v)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="card settings-block">
        <h2 className="tight">Головна сторінка</h2>
        <label className="field">Скільки нещодавніх матеріалів показувати
          <select value={prefs.recentCount} onChange={(e) => setPref("recentCount", Number(e.target.value))}>
            {[3, 5, 10, 20].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

      <div className="card settings-block">
        <h2 className="tight">Акаунт</h2>
        <p className="muted">{user.email}</p>
        <button onClick={onSignOut}>Вийти з акаунта</button>
      </div>
    </>
  );
}
