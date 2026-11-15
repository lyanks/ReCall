import { useState } from "react";
import { api } from "../api.js";
import { ConfirmDialog, PromptDialog } from "./Dialog.jsx";

const ICON = { youtube: "▶", pdf: "📄", web: "🌐" };

function ItemCard({ item, showTopic, onEdit, onDelete }) {
  return (
    <div className="card item">
      <div className="item-body">
        <a href={item.url} target="_blank" rel="noreferrer">{ICON[item.source_type]} {item.title}</a>
        <div className="meta">
          {showTopic && <span className="chip">{item.topic}</span>}
          {item.status === "processing" && <span className="muted">обробляю…</span>}
          {item.status === "failed" && <span className="error">не вдалося отримати текст</span>}
        </div>
        {item.snippet && <p className="muted snippet">{item.snippet}</p>}
      </div>
      <div className="actions">
        <button onClick={() => onEdit(item)} title="Змінити тему">Тема</button>
        <button className="icon-danger" onClick={() => onDelete(item)} title="Видалити" aria-label="Видалити">🗑</button>
      </div>
    </div>
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
        <h2>{topic} <span className="muted">({list.length})</span></h2>
        {list.map(card)}
      </section>
    ));
  } else {
    body = items.map(card);
  }

  return (
    <>
      {body}
      {editing && (
        <PromptDialog title="Змінити тему" label="Тема" initial={editing.topic} confirmLabel="Зберегти"
          onConfirm={saveTopic} onCancel={() => setEditing(null)} />
      )}
      {deleting && (
        <ConfirmDialog title="Видалити матеріал?" danger confirmLabel="Так, видалити"
          message={<>Ти дійсно хочеш видалити «<b>{deleting.title}</b>»? Цю дію не можна скасувати.</>}
          onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />
      )}
    </>
  );
}
