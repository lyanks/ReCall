import { useState } from "react";

export function SearchBar({ onSearch, placeholder }) {
  const [q, setQ] = useState("");
  return (
    <form className="row" role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) onSearch(q.trim()); }}>
      <input type="search" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
      <button>Шукати</button>
    </form>
  );
}
