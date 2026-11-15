import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { useT } from "../i18n.jsx";
import { Dialog } from "./Dialog.jsx";

/** Pick one of the user's existing topics, or type a new one. */
export function TopicDialog({ current, onConfirm, onCancel }) {
  const t = useT();
  const [topics, setTopics] = useState(null);
  const [value, setValue] = useState("");
  useEffect(() => { api("/topics").then(setTopics).catch(() => setTopics([])); }, []);

  const q = value.trim().toLowerCase();
  const shown = useMemo(
    () => (topics || []).filter((x) => x.name !== current && (!q || x.name.toLowerCase().includes(q) || t.topic(x.name).toLowerCase().includes(q))),
    [topics, q, current, t],
  );
  const match = (topics || []).find((x) => x.name.toLowerCase() === q || t.topic(x.name).toLowerCase() === q);
  const exists = Boolean(match);

  return (
    <Dialog title={t("topic.title")} onClose={onCancel}>
      {current && <p className="muted small">{t("topic.current")} <span className="chip">{t.topic(current)}</span></p>}
      <input autoFocus placeholder={t("topic.placeholder")} value={value} maxLength={120}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) onConfirm(match ? match.name : shown.length === 1 ? shown[0].name : value.trim()); }} />
      <div className="topic-picker" role="listbox" aria-label={t("topic.existing")}>
        {topics === null && <span className="muted small">{t("topic.loading")}</span>}
        {shown.map((x) => (
          <button key={x.name} role="option" className="topic-option" onClick={() => onConfirm(x.name)}>
            {t.topic(x.name)} <span className="muted">{x.count}</span>
          </button>
        ))}
        {topics && shown.length === 0 && !value.trim() && <span className="muted small">{t("topic.noOthers")}</span>}
      </div>
      <div className="dialog-actions">
        <button type="button" onClick={onCancel}>{t("common.cancel")}</button>
        {value.trim() && !exists && (
          <button className="primary" onClick={() => onConfirm(value.trim())}>{t("topic.create", { name: value.trim() })}</button>
        )}
      </div>
    </Dialog>
  );
}
