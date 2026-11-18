import { useEffect, useState } from "react";
import { api } from "./api.js";
import { DEV_MODE, onUser, resendVerification, signInEmail, signInGoogle, signOut, signUpEmail, unverifiedEmail } from "./auth.js";
import { Nav } from "./components/Nav.jsx";
import { Home } from "./pages/Home.jsx";
import { Landing } from "./pages/Landing.jsx";
import { Library } from "./pages/Library.jsx";
import { Profile } from "./pages/Profile.jsx";
import { Settings } from "./pages/Settings.jsx";
import { I18nProvider, LanguageSwitch, useT } from "./i18n.jsx";
import { applyTheme, loadPrefs } from "./prefs.js";
import { go, useRoute } from "./router.js";
import { emailOk, passwordProblem, passwordStrength } from "./validate.js";

const APP_NAME = "ReCall";
const AUTH_ROUTES = ["/signin", "/signup"];
applyTheme(loadPrefs().theme);

function AuthForm({ initialMode = "signin" }) {
  const t = useT();
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
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
  const strength = signup && !DEV_MODE ? passwordStrength(password, email) : 0;

  function submit(e) {
    e.preventDefault();
    if (signup) {
      if (!emailOk(email)) return setError(t("auth.err.email"));
      const problem = DEV_MODE ? "" : passwordProblem(password, email);
      if (problem) return setError(t(problem));
    }
    run(() => (mode === "signup" ? signUpEmail(email, password, name) : signInEmail(email, password)));
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
      <form onSubmit={submit} noValidate={signup}>
        {mode === "signup" && <input placeholder={t("auth.name")} value={name} onChange={(e) => setName(e.target.value)} />}
        <input type="email" placeholder="Email" required autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} />
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
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>{mode === "signup" ? t("auth.create") : t("auth.signin")}</button>
      </form>
    </div>
    </div>
  );
}

/** Reminder for email sign-ups that have not clicked the confirmation link yet. */
function VerifyBanner() {
  const t = useT();
  const email = unverifiedEmail();
  const key = `verify_hidden_${email}`;
  const [hidden, setHidden] = useState(() => { try { return !!sessionStorage.getItem(key); } catch { return false; } });
  const [sent, setSent] = useState(false);
  if (!email || hidden) return null;
  const hide = () => { setHidden(true); try { sessionStorage.setItem(key, "1"); } catch { /* private mode */ } };
  return (
    <div className="verify-banner" role="status">
      <span>{t("verify.text", { email })}</span>
      <button className="ghost" disabled={sent} onClick={() => resendVerification().then(() => setSent(true), () => {})}>
        {sent ? t("verify.sent") : t("verify.resend")}
      </button>
      <button className="ghost" onClick={hide}>{t("verify.hide")}</button>
    </div>
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
      <VerifyBanner />
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
      const me = await api("/me");
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
