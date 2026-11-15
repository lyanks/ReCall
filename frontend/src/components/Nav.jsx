import { useState } from "react";
import { go } from "../router.js";
import { Icon } from "./Icons.jsx";

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
      <a className="brand" href="#/" onClick={nav("/")} aria-label={appName}><span className="mark">Re</span>{appName.slice(2)}</a>
      <button className="burger ghost icon" aria-label="Меню" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name={open ? "close" : "menu"} />
      </button>
      <nav className={open ? "open" : ""}>
        {LINKS.map(([path, label]) => (
          <a key={path} href={`#${path}`} onClick={nav(path)} className={route === path ? "active" : ""}
            aria-current={route === path ? "page" : undefined}>{label}</a>
        ))}
        <button className="signout" onClick={onSignOut}><Icon name="logout" size={16} />Вийти</button>
      </nav>
    </header>
  );
}
