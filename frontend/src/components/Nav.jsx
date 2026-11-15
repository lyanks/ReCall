import { useState } from "react";
import { go } from "../router.js";

const LINKS = [
  ["/", "Головна"],
  ["/library", "Моя бібліотека"],
  ["/profile", "Профіль"],
  ["/settings", "Налаштування"],
];

export function Nav({ appName, route, onSignOut }) {
  const [open, setOpen] = useState(false);
  const nav = (path) => (e) => { e.preventDefault(); setOpen(false); go(path); };

  return (
    <header className="topbar">
      <a className="brand" href="#/" onClick={nav("/")}>{appName}</a>
      <button className="burger" aria-label="Меню" aria-expanded={open} onClick={() => setOpen(!open)}>☰</button>
      <nav className={open ? "open" : ""}>
        {LINKS.map(([path, label]) => (
          <a key={path} href={`#${path}`} onClick={nav(path)} className={route === path ? "active" : ""}
            aria-current={route === path ? "page" : undefined}>{label}</a>
        ))}
        <button className="signout" onClick={onSignOut}>Вийти</button>
      </nav>
    </header>
  );
}
