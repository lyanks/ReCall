import { useState } from "react";
import { api } from "../api.js";
import { SOURCE_LABEL, timeAgo, topicLabel } from "../sources.js";
import { ConfirmDialog } from "./Dialog.jsx";
import { Icon, SourceIcon } from "./Icons.jsx";
import { TopicDialog } from "./TopicDialog.jsx";

function ItemCard({ item, showTopic, onEdit, onDelete }) {
  return (
    <article className="card item">
      <SourceIcon type={item.source_type} />
      <div className="item-body">
        <a className="item-title" href={item.url} target="_blank" rel="noreferrer">{item.title || item.url}</a>
        <div className="meta">
          {showTopic && <span className="chip">{topicLabel(item.topic)}</span>}
          <span>{SOURCE_LABEL[item.source_type] || "Посилання"}{item.created_at && ` · ${timeAgo(item.created_at)}`}</span>
          {item.status === "processing" && <span className="status processing">обробляю…</span>}
          {item.status === "failed" && <span className="error status">не вдалося отримати текст</span>}
        </div>
        {item.summary
          ? <p className="snippet summary" title="Короткий опис від AI">{item.summary}</p>
          : item.snippet && <p className="snippet">{item.snippet}</p>}
        {item.key_topics?.length > 0 && (
          <div className="tags">{item.key_topics.map((k) => <span key={k} className="tag">{k}</span>)}</div>
        )}
      </div>
      <div className="actions">
        <button className="ghost icon" onClick={() => onEdit(item)} title="Змінити тему" aria-label="Змінити тему">
          <Icon name="tag" size={18} />
        </button>
        <button className="ghost icon icon-danger" onClick={() => onDelete(item)} title="Видалити" aria-label="Видалити">
          <Icon name="trash" size={18} />
        </button>
      </div>
    </article>
  );
}

/** Items with rename-topic and delete (with confirmation). groupByTopic = library view. */
export function ItemList({ items, groupByTopic, onChanged }) {
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

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
    <ItemCard key={i.id} item={i} showTopic={!groupByTopic} onEdit={setEditing} onDelete={setDeleting} />
  );

  let body;
  if (groupByTopic) {
    const groups = items.reduce((acc, i) => ((acc[i.topic] ||= []).push(i), acc), {});
    body = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([topic, list]) => (
      <section key={topic}>
        <h2>{topicLabel(topic)} <span className="muted">({list.length})</span></h2>
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
      {deleting && (
        <ConfirmDialog title="Видалити матеріал?" danger confirmLabel="Так, видалити"
          message={<>Ти дійсно хочеш видалити «<b>{deleting.title}</b>»? Цю дію не можна скасувати.</>}
          onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />
      )}
    </>
  );
}
