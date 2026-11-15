import { useEffect, useState } from "react";
import { api } from "../api.js";

// Ukrainian plural: 1 матеріал, 2 матеріали, 5 матеріалів
const plural = (n, [one, few, many]) => {
  const d = n % 10, h = n % 100;
  if (d === 1 && h !== 11) return one;
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return few;
  return many;
};

const SOURCE = { web: "Статті", youtube: "Відео YouTube", pdf: "PDF" };

export function Profile({ user }) {
  const [stats, setStats] = useState(null);
  useEffect(() => { api("/stats/me").then(setStats).catch(() => setStats(null)); }, []);
  const since = new Date(user.created_at).toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <h1 className="page-title">Профіль</h1>
      <div className="card profile">
        <div className="avatar" aria-hidden="true">{(user.name || user.email)[0]?.toUpperCase()}</div>
        <div>
          <div className="profile-name">{user.name || "Без імені"}</div>
          <div className="muted">{user.email}</div>
          <div className="muted small">З нами з {since}</div>
        </div>
      </div>
      {stats && (
        <div className="stats">
          <div className="card stat"><b>{stats.items}</b><span>{plural(stats.items, ["матеріал", "матеріали", "матеріалів"])}</span></div>
          <div className="card stat"><b>{stats.topics}</b><span>{plural(stats.topics, ["тема", "теми", "тем"])}</span></div>
          <div className="card stat"><b>{stats.searches}</b><span>{plural(stats.searches, ["пошук", "пошуки", "пошуків"])}</span></div>
        </div>
      )}
      {stats && stats.items > 0 && (
        <div className="card">
          <h2 className="tight">За джерелом</h2>
          {Object.entries(stats.by_source).map(([k, v]) => (
            <div className="kv" key={k}><span>{SOURCE[k] || k}</span><b>{v}</b></div>
          ))}
        </div>
      )}
    </>
  );
}
