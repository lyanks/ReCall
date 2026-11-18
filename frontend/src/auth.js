// Auth adapter for the frontend. Firebase in production; a dev stub when no Firebase config is set.
import { initializeApp } from "firebase/app";
import {
  getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut as fbSignOut,
  sendEmailVerification,
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

export async function signInEmail(email, password) {
  if (DEV_MODE) return setDevUser({ email });
  try { await signInWithEmailAndPassword(auth, email, password); } catch (e) { throw nice(e); }
}

export async function signUpEmail(email, password, name) {
  if (DEV_MODE) return setDevUser({ email });
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    if (name) await updateProfile(user, { displayName: name });
    // Proves the address is real; the account works meanwhile, the app shows a reminder until it is confirmed.
    sendEmailVerification(user).catch(() => {});
  } catch (e) { throw nice(e); }
}

/** Email of a password account that has not confirmed its address yet, else "" (Google accounts are verified). */
export function unverifiedEmail() {
  const u = auth?.currentUser;
  if (!u || u.emailVerified || !u.providerData.some((p) => p.providerId === "password")) return "";
  return u.email || "";
}

export async function resendVerification() {
  if (auth?.currentUser) await sendEmailVerification(auth.currentUser);
}

export async function signOut() {
  if (DEV_MODE) return setDevUser(null);
  await fbSignOut(auth);
}
