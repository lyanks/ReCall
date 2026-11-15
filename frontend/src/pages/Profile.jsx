import { useEffect, useState } from "react";
import { api } from "../api.js";
import { SourceIcon } from "../components/Icons.jsx";
import { useT } from "../i18n.jsx";



export function Profile({ user }) {
  const t = useT();
  const [stats, setStats] = useState(null);
  useEffect(() => { api("/stats/me").then(setStats).catch(() => setStats(null)); }, []);
  const since = t.date(user.created_at, { day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <h1 className="page-title">{t("profile.title")}</h1>
      <div className="card profile">
        <div className="avatar" aria-hidden="true">{(user.name || user.email)[0]?.toUpperCase()}</div>
        <div>
          <div className="profile-name">{user.name || t("profile.noName")}</div>
          <div className="muted">{user.email}</div>
          <div className="muted small">{t("profile.since", { date: since })}</div>
        </div>
      </div>
      {stats && (
        <div className="stats">
          <div className="card stat"><b>{stats.items}</b><span>{t.n(stats.items, "n.items").replace(/^\d+ /, "")}</span></div>
          <div className="card stat"><b>{stats.topics}</b><span>{t.n(stats.topics, "n.topics").replace(/^\d+ /, "")}</span></div>
          <div className="card stat"><b>{stats.searches}</b><span>{t.n(stats.searches, "n.searches").replace(/^\d+ /, "")}</span></div>
        </div>
      )}
      {stats && stats.items > 0 && (
        <div className="card">
          <h2 className="tight">{t("profile.bySource")}</h2>
          {Object.entries(stats.by_source).map(([k, v]) => (
            <div className="kv" key={k}><span><SourceIcon type={k} size={16} />{t.sources(k)}</span><b>{v}</b></div>
          ))}
        </div>
      )}
    </>
  );
}
