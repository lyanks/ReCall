import { useState } from "react";
import { api } from "../api.js";
import { LanguageSwitch, useT } from "../i18n.jsx";
import { loadPrefs, savePrefs } from "../prefs.js";

export function Settings({ user, onUserChanged, onSignOut }) {
  const t = useT();
  const [name, setName] = useState(user.name);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [prefs, setPrefs] = useState(loadPrefs);

  function setPref(key, value) {
    const next = { ...loadPrefs(), [key]: value };
    setPrefs(next);
    savePrefs(next);
  }

  async function saveName(e) {
    e.preventDefault();
    setError("");
    setSaved("");
    try {
      onUserChanged(await api("/me", { method: "PATCH", body: { name } }));
      setSaved("ok");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <h1 className="page-title">{t("settings.title")}</h1>

      <form className="card settings-block" onSubmit={saveName}>
        <h2 className="tight">{t("settings.name")}</h2>
        <div className="row">
          <input value={name} maxLength={120} required onChange={(e) => { setName(e.target.value); setSaved(""); }} />
          <button className="primary" disabled={!name.trim() || name.trim() === user.name}>{t("common.save")}</button>
        </div>
        {saved && <p className="ok">{t("common.saved")}</p>}
        {error && <p className="error">{error}</p>}
      </form>

      <div className="card settings-block">
        <h2 className="tight">{t("settings.language")}</h2>
        <LanguageSwitch />
      </div>

      <div className="card settings-block">
        <h2 className="tight">{t("settings.theme")}</h2>
        <div className="segmented" role="radiogroup">
          {["system", "light", "dark"].map((v) => (
            <button key={v} role="radio" aria-checked={prefs.theme === v}
              className={prefs.theme === v ? "active" : ""} onClick={() => setPref("theme", v)}>{t(`settings.theme.${v}`)}</button>
          ))}
        </div>
      </div>

      <div className="card settings-block">
        <h2 className="tight">{t("settings.home")}</h2>
        <label className="field">{t("settings.recentCount")}
          <select value={prefs.recentCount} onChange={(e) => setPref("recentCount", Number(e.target.value))}>
            {[3, 5, 10, 20].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

      <div className="card settings-block">
        <h2 className="tight">{t("settings.account")}</h2>
        <p className="muted">{user.email}</p>
        <button onClick={onSignOut}>{t("settings.signout")}</button>
      </div>
    </>
  );
}
