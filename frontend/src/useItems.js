import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";

/** Loads items (optionally a search or the N most recent) and refreshes while any are processing. */
export function useItems({ q = "", limit, topic } = {}) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (limit) params.set("limit", limit);
    if (topic) params.set("topic", topic);
    try {
      setItems(await api(`/items${params.size ? `?${params}` : ""}`));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [q, limit, topic]);

  useEffect(() => { setItems(null); load(); }, [load]);

  const processing = items?.some((i) => i.status === "processing");
  useEffect(() => {
    if (!processing) return;
    const t = setTimeout(load, 1500);
    return () => clearTimeout(t);
  }, [items, processing, load]);

  return { items, error, reload: load };
}
