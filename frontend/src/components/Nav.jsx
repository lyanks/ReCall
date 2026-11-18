import { useState } from "react";
import { useT } from "../i18n.jsx";
import { go } from "../router.js";
import { Icon } from "./Icons.jsx";
import { SupportButton } from "./Support.jsx";

const LINKS = [
  ["/", "nav.home"],
  ["/library", "nav.library"],
  ["/profile", "nav.profile"],
  ["/settings", "nav.settings"],
];

export function Nav({ appName, route, onSignOut }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const nav = (path) => (e) => { e.preventDefault(); setOpen(false); go(path); };

  return (
    <header className="topbar">
      <a className="brand" href="#/" onClick={nav("/")} aria-label={appName}><img className="brand-logo" src="/logo.svg" alt="" width="32" height="32" /><span><span className="mark">Re</span>{appName.slice(2)}</span></a>
      <button className="burger ghost icon" aria-label={t("nav.menu")} aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name={open ? "close" : "menu"} />
      </button>
      <nav className={open ? "open" : ""}>
        {LINKS.map(([path, label]) => (
          <a key={path} href={`#${path}`} onClick={nav(path)} className={route === path ? "active" : ""}
            aria-current={route === path ? "page" : undefined}>{t(label)}</a>
        ))}
        <SupportButton className="nav-support" />
        <button className="signout" onClick={onSignOut}><Icon name="logout" size={16} />{t("nav.signout")}</button>
      </nav>
    </header>
  );
}
