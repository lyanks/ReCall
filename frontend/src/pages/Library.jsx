import { useState } from "react";
import { ItemList } from "../components/ItemList.jsx";
import { SearchBar } from "../components/SearchBar.jsx";
import { useItems } from "../useItems.js";
import { SearchResults } from "./Home.jsx";

export function Library() {
  const [q, setQ] = useState("");
  const { items, error, reload } = useItems();

  return (
    <>
      <h1 className="page-title">Моя бібліотека {items && <span className="muted">({items.length})</span>}</h1>
      <SearchBar key={q ? "s" : "l"} onSearch={setQ} placeholder="Шукати в бібліотеці" />
      {q ? (
        <SearchResults q={q} onBack={() => { setQ(""); reload(); }} backLabel="До бібліотеки" />
      ) : (
        <>
          {error && <p className="error">{error}</p>}
          {items?.length === 0 && <p className="muted empty">Бібліотека порожня. Додай матеріал на головній.</p>}
          {items && <ItemList items={items} groupByTopic onChanged={reload} />}
        </>
      )}
    </>
  );
}
