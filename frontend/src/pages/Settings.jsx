import { accountLabel, addEmail, isLoginEmail } from "../auth.js";
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

      {user.login && <RecoveryEmail user={user} onUserChanged={onUserChanged} />}

      <div className="card settings-block">
        <h2 className="tight">{t("settings.account")}</h2>
        <p className="muted">{accountLabel(user)}</p>
        <button onClick={onSignOut}>{t("settings.signout")}</button>
      </div>
    </>
  );
}

/** Login accounts: add an email, confirm it by link, then it is used for "Forgot password?". */
function RecoveryEmail({ user, onUserChanged }) {
  const t = useT();
  const confirmed = isLoginEmail(user.email) ? "" : user.email;
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.trim())) return setError(t("email.err.format"));
    setBusy(true);
    try {
      onUserChanged(await addEmail(email));
      setEmail("");
    } catch (err) {
      setError(err.code && t(err.code) !== err.code ? t(err.code) : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card settings-block" onSubmit={submit} noValidate>
      <h2 className="tight">{t("email.title")}</h2>
      <p className="muted small">{t("email.why")}</p>
      {confirmed && <p className="ok">{t("email.confirmed", { email: confirmed })}</p>}
      {user.pending_email && <p className="email-pending">{t("email.pending", { email: user.pending_email })}</p>}
      <div className="row">
        <input type="email" autoComplete="email" placeholder={confirmed ? t("email.newPlaceholder") : "name@ucu.edu.ua"}
          value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} />
        <button className="primary" disabled={busy || !email.trim()}>{t("email.send")}</button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
