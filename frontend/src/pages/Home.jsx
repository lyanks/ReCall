import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { Icon, SourceIcon } from "../components/Icons.jsx";
import { ItemList } from "../components/ItemList.jsx";
import { SearchBar } from "../components/SearchBar.jsx";
import { TopicDialog } from "../components/TopicDialog.jsx";
import { useT } from "../i18n.jsx";
import { loadPrefs } from "../prefs.js";
import { go } from "../router.js";
import { useItems } from "../useItems.js";

const SUPPORTED = ["youtube", "tiktok", "instagram", "web", "pdf", "doc", "image"];

const QUICK_TOPICS = 6;

/** Topic for the link being added: automatic (default), one of the user's topics, or a new one. */
function TopicChooser({ value, onChange, refreshKey }) {
  const t = useT();
  const [topics, setTopics] = useState([]);
  const [dialog, setDialog] = useState(false);
  useEffect(() => { api("/topics").then(setTopics).catch(() => setTopics([])); }, [refreshKey]);

  const quick = topics.filter((x) => x.name !== "Unsorted").slice(0, QUICK_TOPICS).map((x) => x.name);
  if (value && !quick.includes(value)) quick.push(value); // a new or less-used topic picked in the dialog

  return (
    <div className="topic-choose" role="radiogroup" aria-label={t("add.topic")}>
      <span className="sources-label">{t("add.topic")}</span>
      <button type="button" role="radio" aria-checked={!value} className={`choice${!value ? " active" : ""}`}
        onClick={() => onChange("")}>✨ {t("add.auto")}</button>
      {quick.map((name) => (
        <button key={name} type="button" role="radio" aria-checked={value === name}
          className={`choice${value === name ? " active" : ""}`} onClick={() => onChange(value === name ? "" : name)}>
          {t.topic(name)}
        </button>
      ))}
      <button type="button" className="choice more" onClick={() => setDialog(true)}>+ {t("add.other")}</button>
      {dialog && (
        <TopicDialog onConfirm={(name) => { onChange(name); setDialog(false); }} onCancel={() => setDialog(false)} />
      )}
    </div>
  );
}

const ACCEPT = ".pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp";
const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes("Files");

/** Drop zone + file picker. Dragging a file anywhere on the page highlights the add panel; dropping uploads it. */
function useFileDrop(onFiles) {
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    let depth = 0; // dragenter/leave fire for every child element
    const enter = (e) => { if (hasFiles(e)) { depth += 1; setDragging(true); } };
    const leave = (e) => { if (hasFiles(e)) { depth = Math.max(0, depth - 1); if (!depth) setDragging(false); } };
    const over = (e) => { if (hasFiles(e)) e.preventDefault(); }; // allow dropping (and stop the browser opening the file)
    const drop = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      if (e.dataTransfer.files.length) onFiles([...e.dataTransfer.files]);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [onFiles]);
  return dragging;
}

function AddLink({ onAdded }) {
  const t = useT();
  const [url, setUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [added, setAdded] = useState(0);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(""); // progress text while files upload
  const [error, setError] = useState("");
  const picker = useRef(null);

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const item = await api("/items", { method: "POST", body: { url, topic: topic || null } });
      setUrl("");
      setTopic("");
      setAdded((n) => n + 1);
      onAdded(item);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const topicRef = useRef(topic);
  topicRef.current = topic;
  const uploadFiles = useCallback(async (files) => {
    setError("");
    const errors = [];
    for (const [i, file] of files.entries()) {
      setUploading(files.length > 1
        ? t("upload.busyMany", { n: i + 1, total: files.length, name: file.name })
        : t("upload.busy", { name: file.name }));
      const form = new FormData();
      form.append("file", file);
      form.append("topic", topicRef.current || "");
      try {
        onAdded(await api("/items/upload", { method: "POST", form }));
      } catch (err) {
        const key = `upload.err.${err.code}`;
        const msg = err.code ? t(key, { name: file.name }) : "";
        errors.push(msg && msg !== key ? msg : `${file.name}: ${err.message}`);
        if (err.code === "daily_limit" || err.code === "storage_full") break;
      }
    }
    setUploading("");
    setTopic("");
    setAdded((n) => n + 1);
    setError(errors.join(" "));
  }, [onAdded, t]);

  const dragging = useFileDrop(uploadFiles);

  return (
    <section className={`card add-panel${dragging ? " dragging" : ""}`} aria-label={t("home.addLabel")}>
      <form onSubmit={add}>
        <label className="field-icon">
          <Icon name="link" />
          <input type="url" required aria-label={t("home.linkLabel")} placeholder={t("home.linkPlaceholder")}
            value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <button className="primary" disabled={busy}><Icon name="plus" size={18} />{busy ? t("home.adding") : t("home.add")}</button>
      </form>
      <div className="dropzone">
        <span className="drop-ic"><Icon name="upload" size={22} /></span>
        <span className="drop-text">
          {dragging
            ? <b>{t("upload.release")}</b>
            : <span className="drop-hint-desktop"><b>{t("upload.drop")}</b> {t("upload.dropOr")}</span>}
          <span className="drop-limits">{t("upload.limits")}</span>
        </span>
        <button type="button" disabled={!!uploading} onClick={() => picker.current?.click()}>
          <Icon name="upload" size={16} />{t("upload.pick")}
        </button>
        <input ref={picker} type="file" accept={ACCEPT} multiple hidden
          onChange={(e) => { const files = [...e.target.files]; e.target.value = ""; if (files.length) uploadFiles(files); }} />
      </div>
      {uploading && <p className="upload-status" role="status">{uploading}</p>}
      <TopicChooser value={topic} onChange={setTopic} refreshKey={added} />
      {error && <p className="error">{error}</p>}
      <div className="sources">
        <span className="sources-label">{t("home.supported")}</span>
        {SUPPORTED.map((type) => (
          <span key={type} className="source-chip"><SourceIcon type={type} size={13} />{t.sources(type)}</span>
        ))}
      </div>
    </section>
  );
}

export function SearchResults({ q, onBack, backLabel }) {
  const t = useT();
  const { items, error, reload } = useItems({ q });
  return (
    <>
      <div className="results-head">
        <button className="back" onClick={onBack}><Icon name="back" size={16} />{backLabel}</button>
        <span className="muted">
          {t("search.results", { q })}{items ? `: ${items.length}` : ""}
        </span>
      </div>
      {error && <p className="error">{error}</p>}
      {items?.length === 0 && <p className="muted empty">{t("search.none")}</p>}
      {items && <ItemList items={items} onChanged={reload} />}
    </>
  );
}

export function Home({ user }) {
  const t = useT();
  const [q, setQ] = useState("");
  const recentCount = loadPrefs().recentCount;
  const { items, error, reload } = useItems({ limit: recentCount });
  // the link just added: once it is processed, ask for tags if we could not read it
  const [pending, setPending] = useState(null);
  const [askTags, setAskTags] = useState(null);
  useEffect(() => {
    const it = pending && items?.find((i) => i.id === pending);
    if (!it || it.status === "processing") return;
    setPending(null);
    if (it.needs_tags) setAskTags(it);
  }, [items, pending]);
  const clearAsk = useCallback(() => setAskTags(null), []);
  const onAdded = useCallback((item) => { setPending(item.id); reload(); }, [reload]);

  return (
    <>
      <h1 className="page-title">{t("home.hello")}{user.name ? <>, <span className="mark">{user.name}</span></> : ""}!</h1>
      <p className="page-sub">{t("tagline")}</p>
      <AddLink onAdded={onAdded} />
      <SearchBar key={q ? "s" : "h"} onSearch={setQ} placeholder={t("home.searchPlaceholder")} />
      {q ? (
        <SearchResults q={q} onBack={() => setQ("")} backLabel={t("home.back")} />
      ) : (
        <>
          <div className="section-head">
            <h2>{t("home.recent")}</h2>
            <a href="#/library" onClick={(e) => { e.preventDefault(); go("/library"); }}>{t("home.allLibrary")}</a>
          </div>
          {error && <p className="error">{error}</p>}
          {items?.length === 0 && <p className="muted empty">{t("home.empty")}</p>}
          {items && <ItemList items={items} onChanged={reload} askTagsFor={askTags} onAsked={clearAsk} />}
        </>
      )}
    </>
  );
}
