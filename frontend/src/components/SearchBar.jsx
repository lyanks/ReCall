import { useState } from "react";
import { Icon } from "./Icons.jsx";

export function SearchBar({ onSearch, placeholder }) {
  const [q, setQ] = useState("");
  return (
    <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) onSearch(q.trim()); }}>
      <Icon name="search" />
      <input type="search" aria-label="Пошук" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
      <button>Шукати</button>
    </form>
  );
}
