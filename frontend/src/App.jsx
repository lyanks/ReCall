import { useEffect, useState } from "react";
import { api } from "./api.js";
import { DEV_MODE, onUser, requestPasswordReset, signInGoogle, signInLogin, signOut, signUpLogin, takePendingName } from "./auth.js";
import { Nav } from "./components/Nav.jsx";
import { Home } from "./pages/Home.jsx";
import { Landing } from "./pages/Landing.jsx";
import { Library } from "./pages/Library.jsx";
import { Profile } from "./pages/Profile.jsx";
import { Settings } from "./pages/Settings.jsx";
import { I18nProvider, LanguageSwitch, useT } from "./i18n.jsx";
import { applyTheme, loadPrefs } from "./prefs.js";
import { go, useRoute } from "./router.js";
import { loginProblem, passwordProblem, passwordStrength } from "./validate.js";

const APP_NAME = "ReCall";
const AUTH_ROUTES = ["/signin", "/signup"];
applyTheme(loadPrefs().theme);

function AuthForm({ initialMode = "signin" }) {
  const t = useT();
  const [mode, setMode] = useState(initialMode);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn) {
    setError("");
    setBusy(true);
    try { await fn(); } catch (err) { setError(err.code && t(err.code) !== err.code ? t(err.code) : err.message); } finally { setBusy(false); }
  }

  const signup = mode === "signup";
  const strength = signup && !DEV_MODE ? passwordStrength(password, login) : 0;

  function submit(e) {
    e.preventDefault();
    if (signup) {
      const problem = loginProblem(login) || (DEV_MODE ? "" : passwordProblem(password, login));
      if (problem) return setError(t(problem));
    }
    run(() => (signup ? signUpLogin(login, password, name) : signInLogin(login, password)));
  }

  return (
    <div className="auth-wrap">
    <div className="card auth">
      <a className="auth-back" href="#/">{t("auth.back")}</a>
      <div className="auth-lang"><LanguageSwitch compact /></div>
      <h1 className="brand"><span className="mark">Re</span>{APP_NAME.slice(2)}</h1>
      <p className="auth-tagline">{t("tagline")}</p>
      {DEV_MODE && <p className="dev">{t("auth.dev")}</p>}
      {!DEV_MODE && (
        <>
          <button className="google" disabled={busy} onClick={() => run(signInGoogle)}>{t("auth.google")}</button>
          <div className="divider">{t("auth.or")}</div>
        </>
      )}
      <div className="tabs">
        <button className={mode === "signin" ? "active" : ""} onClick={() => { setMode("signin"); setError(""); }}>{t("auth.signin")}</button>
        <button className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(""); }}>{t("auth.signup")}</button>
      </div>
      <form onSubmit={submit}>
        {mode === "signup" && <input placeholder={t("auth.name")} value={name} onChange={(e) => setName(e.target.value)} />}
        <input placeholder={t(signup ? "auth.newLogin" : "auth.loginOrEmail")} aria-label={t("auth.login")} required
          autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={signup ? 20 : 120}
          value={login} onChange={(e) => { setLogin(e.target.value); setError(""); }} />
        {!DEV_MODE && (
          <input type="password" placeholder={t(signup ? "auth.newPassword" : "auth.password")} required
            autoComplete={signup ? "new-password" : "current-password"} minLength={signup ? 8 : undefined}
            value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} />
        )}
        {strength > 0 && (
          <div className={`pw-meter pw-${strength}`} aria-live="polite">
            <div className="pw-bars"><i /><i /><i /></div>
            <span>{t(`auth.pw.${strength}`)}</span>
            {strength === 2 && <small>{t("auth.pw.tip")}</small>}
          </div>
        )}
        {signup && !DEV_MODE && <p className="muted small auth-hint">{t("auth.noReset")}</p>}
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>{mode === "signup" ? t("auth.create") : t("auth.signin")}</button>
      </form>
      {!signup && !DEV_MODE && <ForgotPassword initial={login} />}
    </div>
    </div>
  );
}

/** "Forgot password?": a reset link goes to the confirmed email of the account (login or email). */
function ForgotPassword({ initial }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [state, setState] = useState(""); // "" | "busy" | "sent" | "error"

  if (!open) {
    return <button type="button" className="ghost forgot-link" onClick={() => { setValue(initial); setOpen(true); }}>{t("forgot.link")}</button>;
  }
  async function send(e) {
    e.preventDefault();
    setState("busy");
    try { await requestPasswordReset(value); setState("sent"); } catch { setState("error"); }
  }
  return (
    <form className="forgot" onSubmit={send}>
      <p className="muted small">{t("forgot.help")}</p>
      <div className="row">
        <input placeholder={t("auth.loginOrEmail")} required autoCapitalize="none" value={value}
          onChange={(e) => { setValue(e.target.value); setState(""); }} />
        <button disabled={state === "busy" || !value.trim()}>{t("forgot.send")}</button>
      </div>
      {state === "sent" && <p className="ok">{t("forgot.sent")}</p>}
      {state === "error" && <p className="error">{t("forgot.error")}</p>}
    </form>
  );
}

function Shell({ user, setUser }) {
  const route = useRoute();
  let page;
  if (route === "/library") page = <Library />;
  else if (route.startsWith("/library/")) page = <Library key={route} topic={decodeURIComponent(route.slice(9))} />;
  else if (route === "/profile") page = <Profile user={user} />;
  else if (route === "/settings") page = <Settings user={user} onUserChanged={setUser} onSignOut={signOut} />;
  else page = <Home user={user} />;

  return (
    <>
      <Nav appName={APP_NAME} route={route.startsWith("/library") ? "/library" : ["/profile", "/settings"].includes(route) ? route : "/"}
        onSignOut={signOut} />
      <main className="page">{page}</main>
    </>
  );
}

export default function App() {
  return <I18nProvider><Root /></I18nProvider>;
}

function Root() {
  const [user, setUser] = useState(undefined);
  const route = useRoute();

  useEffect(() => onUser(async (u) => {
    if (!u) return setUser(null);
    try {
      let me = await api("/me");
      // the name typed at sign-up (Firebase's ID token does not carry it yet on the very first request)
      const pending = takePendingName();
      if (pending && !me.name) me = await api("/me", { method: "PATCH", body: { name: pending } });
      await api("/sessions", { method: "POST" });
      setUser(me);
    } catch {
      setUser(null);
    }
  }), []);

  // After signing in from #/signin or #/signup, land on Home.
  useEffect(() => { if (user && AUTH_ROUTES.includes(route)) go("/"); }, [user, route]);

  if (user === undefined) return null;
  // Signed-out visitors see the landing page; its buttons open the sign-in / sign-up form.
  if (!user) {
    if (AUTH_ROUTES.includes(route)) return <AuthForm key={route} initialMode={route.slice(1)} />;
    return <Landing appName={APP_NAME} />;
  }
  return <Shell user={user} setUser={setUser} />;
}
