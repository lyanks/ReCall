// Auth adapter for the frontend. Firebase in production; a dev stub when no Firebase config is set.
import { initializeApp } from "firebase/app";
import { api } from "./api.js";
import {
  getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut as fbSignOut,
  verifyBeforeUpdateEmail,
} from "firebase/auth";

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const DEV_MODE = !cfg.apiKey;
const auth = DEV_MODE ? null : getAuth(initializeApp(cfg));

// Keep Firebase's error code so the UI can show it in the user's language (see i18n.jsx).
const nice = (e) => Object.assign(new Error(e.message), { code: e.code });

let devUser = JSON.parse(localStorage.getItem("dev_user") || "null");
const listeners = new Set();

export function onUser(cb) {
  if (!DEV_MODE) return onAuthStateChanged(auth, cb);
  listeners.add(cb);
  cb(devUser);
  return () => listeners.delete(cb);
}

function setDevUser(u) {
  devUser = u;
  if (u) localStorage.setItem("dev_user", JSON.stringify(u));
  else localStorage.removeItem("dev_user");
  listeners.forEach((cb) => cb(u));
}

export async function getIdToken() {
  if (DEV_MODE) return devUser ? `dev:${devUser.email}` : null;
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}

export async function signInGoogle() {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { throw nice(e); }
}

// Password accounts use a login, not an email. Firebase Auth only knows email + password, so a login is stored as
// "<login>@<LOGIN_DOMAIN>": an address nobody receives mail at (no password reset by email for these accounts).
export const LOGIN_DOMAIN = "users.recall-ucu-edu.firebaseapp.com";
const loginToEmail = (login) => {
  const v = login.trim().toLowerCase();
  return v.includes("@") ? v : `${v}@${LOGIN_DOMAIN}`; // "@" = an older email account (still allowed to sign in)
};

export const isLoginEmail = (email = "") => email.endsWith(`@${LOGIN_DOMAIN}`);

/** What to show for an account: "@login", "@login · real@email", or the email of a Google / older account. */
export function accountLabel(user) {
  if (!user.login) return user.email;
  return isLoginEmail(user.email) ? `@${user.login}` : `@${user.login} · ${user.email}`;
}

let pendingName = "";
/** The name typed at sign-up, picked up once after the account is created (see App.jsx). */
export function takePendingName() { const n = pendingName; pendingName = ""; return n; }

export async function signInLogin(login, password) {
  let email = loginToEmail(login);
  // A login account may have swapped its internal address for a confirmed real one: ask the server which
  // address to use (it only reveals a real address when the password is right).
  if (!login.includes("@")) {
    try { email = (await api("/auth/resolve", { method: "POST", body: { login: login.trim(), password } })).email; }
    catch (e) { throw Object.assign(new Error(e.message), { code: e.code || "auth/invalid-credential" }); }
  }
  if (DEV_MODE) return setDevUser({ email });
  try { await signInWithEmailAndPassword(auth, email, password); } catch (e) { throw nice(e); }
}

export async function signUpLogin(login, password, name) {
  const email = loginToEmail(login);
  pendingName = name.trim() || login.trim();
  if (DEV_MODE) return setDevUser({ email });
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(user, { displayName: pendingName });
  } catch (e) {
    pendingName = "";
    // the address is ours, so "email taken" really means "login taken"
    throw nice(e.code === "auth/email-already-in-use" ? Object.assign(e, { code: "auth/login-taken" }) : e);
  }
}

/** "Forgot password?": the server mails a reset link to the account's confirmed email, if it has one. */
export async function requestPasswordReset(loginOrEmail) {
  await api("/auth/reset", { method: "POST", body: { login: loginOrEmail.trim() } });
}

/** Login accounts: Firebase mails a link to `email`; the account switches to it once the link is opened. */
export async function addEmail(email) {
  const clean = email.trim().toLowerCase();
  if (!DEV_MODE) {
    try { await verifyBeforeUpdateEmail(auth.currentUser, clean); } catch (e) { throw nice(e); }
  }
  return api("/me", { method: "PATCH", body: { pending_email: clean } });
}

export async function signOut() {
  if (DEV_MODE) return setDevUser(null);
  await fbSignOut(auth);
}
