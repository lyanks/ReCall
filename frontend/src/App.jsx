import { useEffect, useState } from "react";
import { api } from "./api.js";
import { DEV_MODE, onUser, signInEmail, signInGoogle, signOut, signUpEmail } from "./auth.js";
import { Nav } from "./components/Nav.jsx";
import { Home } from "./pages/Home.jsx";
import { Library } from "./pages/Library.jsx";
import { Profile } from "./pages/Profile.jsx";
import { Settings } from "./pages/Settings.jsx";
import { applyTheme, loadPrefs } from "./prefs.js";
import { useRoute } from "./router.js";

const APP_NAME = "ReCall";
applyTheme(loadPrefs().theme);

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
    <div className="auth-wrap">
    <div className="card auth">
      <h1 className="brand"><span className="mark">Re</span>{APP_NAME.slice(2)}</h1>
      <p className="auth-tagline">Зберігай один раз. Знаходь за змістом, а не за тим, куди зберіг.</p>
      {DEV_MODE && <p className="dev">Dev mode: Firebase не налаштовано, вхід лише за email.</p>}
      {!DEV_MODE && (
        <>
          <button className="google" disabled={busy} onClick={() => run(signInGoogle)}>Увійти через Google</button>
          <div className="divider">або email</div>
        </>
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
      <main className="page">{page}</main>
    </>
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
  return <Shell user={user} setUser={setUser} />;
}
