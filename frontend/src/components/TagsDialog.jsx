import { useState } from "react";
import { useT } from "../i18n.jsx";
import { Dialog } from "./Dialog.jsx";

/** The user's own key phrases for an item. `prompt` = we could not read the content (TikTok/Instagram). */
export function TagsDialog({ item, prompt, onSave, onCancel }) {
  const t = useT();
  const [tags, setTags] = useState(item.tags || []);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const addDraft = (text = draft) => {
    const parts = text.split(",").map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return tags;
    const next = [...tags];
    for (const p of parts) if (!next.some((x) => x.toLowerCase() === p.toLowerCase())) next.push(p.slice(0, 60));
    setTags(next);
    setDraft("");
    return next;
  };

  async function save() {
    setBusy(true);
    try { await onSave(addDraft()); } finally { setBusy(false); }
  }

  return (
    <Dialog title={prompt ? t("tags.promptTitle") : t("tags.title")} onClose={onCancel}>
      {prompt && <p className="muted">{t("tags.promptText")}</p>}
      <p className="tags-item-title">{item.title}</p>
      <div className="tag-editor">
        {tags.map((x) => (
          <span key={x} className="tag user-tag">
            #{x}
            <button type="button" aria-label={t("tags.remove", { tag: x })} onClick={() => setTags(tags.filter((y) => y !== x))}>×</button>
          </span>
        ))}
        <input autoFocus value={draft} maxLength={120} placeholder={tags.length ? t("tags.more") : t("tags.placeholder")}
          onChange={(e) => (e.target.value.includes(",") ? addDraft(e.target.value) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); draft.trim() ? addDraft() : save(); }
            if (e.key === "Backspace" && !draft && tags.length) setTags(tags.slice(0, -1));
          }} />
      </div>
      <p className="muted small">{t("tags.hint")}</p>
      <div className="dialog-actions">
        <button type="button" onClick={onCancel}>{prompt ? t("tags.skip") : t("common.cancel")}</button>
        <button className="primary" disabled={busy || (!tags.length && !draft.trim() && !item.tags?.length)} onClick={save}>
          {busy ? t("common.wait") : t("common.save")}
        </button>
      </div>
    </Dialog>
  );
}
