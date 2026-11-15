import { getIdToken } from "./auth.js";

const API = (import.meta.env.VITE_API_URL || "") + "/api";

export async function api(path, { method = "GET", body, form } = {}) {
  // form = FormData (file upload): the browser sets the multipart Content-Type itself
  const headers = form ? {} : { "Content-Type": "application/json" };
  const token = await getIdToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API + path, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = data.detail;
    const detail = Array.isArray(d) ? d.map((x) => x.msg).join(", ") : d?.message ?? d;
    const err = new Error(detail || `Request failed (${res.status})`);
    err.code = d?.code || (res.status === 413 ? "too_large" : undefined); // translated in the UI
    throw err;
  }
  return data;
}
