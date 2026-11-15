import { useState } from "react";
import { useT } from "../i18n.jsx";
import { Dialog } from "./Dialog.jsx";

/** Edit a material's title and the user's own key phrases.
 *  `prompt` = we could not read the content (TikTok/Instagram), so we ask for them right after adding. */
export function EditItemDialog({ item, prompt, onSave, onCancel }) {
  const t = useT();
  const initialTitle = item.title && item.title !== item.url ? item.title : "";
  const [title, setTitle] = useState(initialTitle);
  const [tags, setTags] = useState(item.tags || []);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const addDraft = (text = draft) => {
    const parts = text.split(",").map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return tags;
    const next = [...tags];
    for (const p of parts) if (!next.some((x) => x.toLowerCase() === p.toLowerCase())) next.push(p.slice(0, 60));
    setTags(next);
    setDraft("");
    return next;
  };

  async function save(e) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    const body = { tags: addDraft().slice(0, 15) };
    const newTitle = title.trim();
    if (newTitle !== initialTitle) body.title = newTitle; // empty = back to the source's title
    try { await onSave(body); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <Dialog title={prompt ? t("tags.promptTitle") : t("edit.title")} onClose={onCancel}>
      {prompt && <p className="muted">{t("tags.promptText")}</p>}
      <form onSubmit={save} className="edit-form">
        <label className="field-label">
          {t("edit.name")}
          <input value={title} maxLength={300} placeholder={t("edit.namePlaceholder")} autoFocus={!prompt}
            onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="field-label">
          {t("tags.title")}
          <div className="tag-editor">
            {tags.map((x) => (
              <span key={x} className="tag user-tag">
                #{x}
                <button type="button" aria-label={t("tags.remove", { tag: x })} onClick={() => setTags(tags.filter((y) => y !== x))}>×</button>
              </span>
            ))}
            <input autoFocus={prompt} value={draft} maxLength={120} aria-label={t("tags.title")}
              placeholder={tags.length ? t("tags.more") : t("tags.placeholder")}
              onChange={(e) => (e.target.value.includes(",") ? addDraft(e.target.value) : setDraft(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && draft.trim()) { e.preventDefault(); addDraft(); }
                if (e.key === "Backspace" && !draft && tags.length) setTags(tags.slice(0, -1));
              }} />
          </div>
          <span className="muted small">{t("tags.hint")}</span>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="dialog-actions">
          <button type="button" onClick={onCancel}>{prompt ? t("tags.skip") : t("common.cancel")}</button>
          <button className="primary" disabled={busy}>{busy ? t("common.wait") : t("common.save")}</button>
        </div>
      </form>
    </Dialog>
  );
}
