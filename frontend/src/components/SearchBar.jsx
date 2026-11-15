import { useState } from "react";
import { useT } from "../i18n.jsx";
import { Icon } from "./Icons.jsx";

export function SearchBar({ onSearch, placeholder }) {
  const t = useT();
  const [q, setQ] = useState("");
  return (
    <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) onSearch(q.trim()); }}>
      <Icon name="search" />
      <input type="search" enterKeyHint="search" aria-label={t("common.searchLabel")} placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
      <button className="search-go" aria-label={t("common.search")} title={t("common.search")}>
        <span className="search-go-label">{t("common.search")}</span>
        <Icon name="arrow" size={18} />
      </button>
    </form>
  );
}
