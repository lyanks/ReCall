import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useT } from "../i18n.jsx";
import { ConfirmDialog } from "./Dialog.jsx";
import { Icon, SourceIcon } from "./Icons.jsx";
import { TagsDialog } from "./TagsDialog.jsx";
import { TopicDialog } from "./TopicDialog.jsx";

function ItemCard({ item, showTopic, onEdit, onTags, onDelete }) {
  const t = useT();
  // AI summary in the interface language; fall back to the other language if only one exists
  const summary = t.lang === "en" ? item.summary_en || item.summary : item.summary || item.summary_en;
  return (
    <article className="card item">
      <SourceIcon type={item.source_type} />
      <div className="item-body">
        <a className="item-title" href={item.url} target="_blank" rel="noreferrer">{item.title || item.url}</a>
        <div className="meta">
          {showTopic && <span className="chip">{t.topic(item.topic)}</span>}
          <span>{t.source(item.source_type)}{item.created_at && ` · ${t.ago(item.created_at)}`}</span>
          {item.status === "processing" && <span className="status processing">{t("item.processing")}</span>}
          {item.status === "failed" && <span className="error status">{t("item.failed")}</span>}
        </div>
        {summary
          ? <p className="snippet summary" title={t("item.aiSummary")}>{summary}</p>
          : item.snippet && <p className="snippet">{item.snippet}</p>}
        {/* key topics are generated in Ukrainian only, so show them in the Ukrainian interface */}
        {(item.tags?.length > 0 || item.needs_tags) && (
          <div className="tags">
            {item.tags?.map((k) => <span key={k} className="tag user-tag">#{k}</span>)}
            {item.needs_tags && (
              <button className="needs-tags" onClick={() => onTags(item, true)}>
                <Icon name="hash" size={14} />{t("tags.add")}
              </button>
            )}
          </div>
        )}
        {t.lang === "uk" && item.key_topics?.length > 0 && (
          <div className="tags">{item.key_topics.map((k) => <span key={k} className="tag">{k}</span>)}</div>
        )}
      </div>
      <div className="actions">
        <button className="ghost icon" onClick={() => onTags(item, false)} title={t("tags.title")} aria-label={t("tags.title")}>
          <Icon name="hash" size={18} />
        </button>
        <button className="ghost icon" onClick={() => onEdit(item)} title={t("item.changeTopic")} aria-label={t("item.changeTopic")}>
          <Icon name="tag" size={18} />
        </button>
        <button className="ghost icon icon-danger" onClick={() => onDelete(item)} title={t("item.delete")} aria-label={t("item.delete")}>
          <Icon name="trash" size={18} />
        </button>
      </div>
    </article>
  );
}

/** Items with rename-topic and delete (with confirmation). groupByTopic = library view. */
export function ItemList({ items, groupByTopic, onChanged, askTagsFor, onAsked }) {
  const t = useT();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [tagging, setTagging] = useState(null); // { item, prompt }

  // Home asks us to open the tags popup for a just-added TikTok/Instagram we could not read
  useEffect(() => {
    if (askTagsFor) { setTagging({ item: askTagsFor, prompt: true }); onAsked?.(); }
  }, [askTagsFor, onAsked]);

  async function saveTags(tags) {
    await api(`/items/${tagging.item.id}`, { method: "PATCH", body: { tags } });
    setTagging(null);
    onChanged();
  }

  async function saveTopic(topic) {
    await api(`/items/${editing.id}`, { method: "PATCH", body: { topic } });
    setEditing(null);
    onChanged();
  }

  async function confirmDelete() {
    await api(`/items/${deleting.id}`, { method: "DELETE" });
    setDeleting(null);
    onChanged();
  }

  const card = (i) => (
    <ItemCard key={i.id} item={i} showTopic={!groupByTopic} onEdit={setEditing} onDelete={setDeleting}
      onTags={(item, prompt) => setTagging({ item, prompt })} />
  );

  let body;
  if (groupByTopic) {
    const groups = items.reduce((acc, i) => ((acc[i.topic] ||= []).push(i), acc), {});
    body = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([topic, list]) => (
      <section key={topic}>
        <h2>{t.topic(topic)} <span className="muted">({list.length})</span></h2>
        <div className="item-list">{list.map(card)}</div>
      </section>
    ));
  } else {
    body = <div className="item-list">{items.map(card)}</div>;
  }

  return (
    <>
      {body}
      {editing && (
        <TopicDialog current={editing.topic} onConfirm={saveTopic} onCancel={() => setEditing(null)} />
      )}
      {tagging && (
        <TagsDialog item={tagging.item} prompt={tagging.prompt} onSave={saveTags} onCancel={() => setTagging(null)} />
      )}
      {deleting && (
        <ConfirmDialog title={t("delete.title")} danger confirmLabel={t("delete.confirm")}
          message={<>{t("delete.before")}<b>{deleting.title}</b>{t("delete.after")}</>}
          onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />
      )}
    </>
  );
}
