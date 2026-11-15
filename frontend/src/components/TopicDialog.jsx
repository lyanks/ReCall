import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { Dialog } from "./Dialog.jsx";

/** Pick one of the user's existing topics, or type a new one. */
export function TopicDialog({ current, onConfirm, onCancel }) {
  const [topics, setTopics] = useState(null);
  const [value, setValue] = useState("");
  useEffect(() => { api("/topics").then(setTopics).catch(() => setTopics([])); }, []);

  const q = value.trim().toLowerCase();
  const shown = useMemo(
    () => (topics || []).filter((t) => t.name !== current && (!q || t.name.toLowerCase().includes(q))),
    [topics, q, current],
  );
  const exists = (topics || []).some((t) => t.name.toLowerCase() === q);

  return (
    <Dialog title="Обрати тему" onClose={onCancel}>
      <p className="muted small">Зараз: <span className="chip">{current}</span></p>
      <input autoFocus placeholder="Знайти або створити тему…" value={value} maxLength={120}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) onConfirm(shown.length === 1 && !exists ? shown[0].name : value.trim()); }} />
      <div className="topic-picker" role="listbox" aria-label="Наявні теми">
        {topics === null && <span className="muted small">Завантажую…</span>}
        {shown.map((t) => (
          <button key={t.name} role="option" className="topic-option" onClick={() => onConfirm(t.name)}>
            {t.name} <span className="muted">{t.count}</span>
          </button>
        ))}
        {topics && shown.length === 0 && !value.trim() && <span className="muted small">Інших тем ще немає.</span>}
      </div>
      <div className="dialog-actions">
        <button type="button" onClick={onCancel}>Скасувати</button>
        {value.trim() && !exists && (
          <button className="primary" onClick={() => onConfirm(value.trim())}>Створити «{value.trim()}»</button>
        )}
      </div>
    </Dialog>
  );
}
