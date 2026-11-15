// UI translations. The user picks the language (Settings or the sign-in screen); the choice is saved on the device.
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loadPrefs, savePrefs } from "./prefs.js";

export const LANGUAGES = [["uk", "Українська"], ["en", "English"]];
const LOCALE = { uk: "uk-UA", en: "en-GB" };

// Plurals: uk = [one, few, many] ("1 матеріал / 2 матеріали / 5 матеріалів"), en = [one, other].
const STRINGS = {
  uk: {
    tagline: "Зберігай один раз. Знаходь за змістом, а не за тим, куди зберіг.",
    "auth.dev": "Dev mode: Firebase не налаштовано, вхід лише за email.",
    "auth.google": "Увійти через Google",
    "auth.or": "або email",
    "auth.signin": "Увійти",
    "auth.signup": "Зареєструватися",
    "auth.name": "Ім'я",
    "auth.password": "Пароль (мін. 6 символів)",
    "auth.create": "Створити акаунт",
    "auth/invalid-credential": "Невірний email або пароль",
    "auth/email-already-in-use": "Цей email вже зареєстровано",
    "auth/weak-password": "Пароль має містити щонайменше 6 символів",
    "auth/invalid-email": "Некоректний email",
    "auth/popup-closed-by-user": "Вікно входу закрито",
    "nav.home": "Головна",
    "nav.library": "Моя бібліотека",
    "nav.profile": "Профіль",
    "nav.settings": "Налаштування",
    "nav.menu": "Меню",
    "nav.signout": "Вийти",
    "common.cancel": "Скасувати",
    "common.wait": "Зачекай…",
    "common.save": "Зберегти",
    "common.saved": "Збережено",
    "common.search": "Шукати",
    "common.searchLabel": "Пошук",
    "home.hello": "Привіт",
    "home.addLabel": "Додати матеріал",
    "home.linkLabel": "Посилання",
    "home.linkPlaceholder": "Встав посилання на відео, допис, статтю чи PDF",
    "home.adding": "Додаю…",
    "home.add": "Додати",
    "home.supported": "Підтримуємо:",
    "home.searchPlaceholder": "Шукати за змістом: «відео, де Big-O пояснювали на піці»",
    "home.recent": "Нещодавно додані",
    "home.allLibrary": "Уся бібліотека →",
    "home.empty": "Тут поки порожньо. Встав посилання вище, і перший матеріал з’явиться тут.",
    "home.back": "На головну",
    "search.results": "Результати для «{q}»",
    "search.none": "Нічого не знайшлося. Спробуй інші слова.",
    "library.title": "Моя бібліотека",
    "library.summary": "{items} у {topics}",
    "library.search": "Шукати в бібліотеці",
    "library.back": "До бібліотеки",
    "library.allTopics": "Усі теми",
    "library.empty": "Бібліотека порожня. Додай матеріал на головній.",
    "library.sources": "Джерела",
    "item.link": "Посилання",
    "item.processing": "обробляю…",
    "item.failed": "не вдалося отримати текст",
    "item.changeTopic": "Змінити тему",
    "item.delete": "Видалити",
    "delete.title": "Видалити матеріал?",
    "delete.confirm": "Так, видалити",
    "delete.before": "Ти дійсно хочеш видалити «",
    "delete.after": "»? Цю дію не можна скасувати.",
    "topic.title": "Обрати тему",
    "topic.current": "Зараз:",
    "topic.placeholder": "Знайти або створити тему…",
    "topic.existing": "Наявні теми",
    "topic.loading": "Завантажую…",
    "topic.noOthers": "Інших тем ще немає.",
    "topic.create": "Створити «{name}»",
    "profile.title": "Профіль",
    "profile.noName": "Без імені",
    "profile.since": "З нами з {date}",
    "profile.bySource": "За джерелом",
    "settings.title": "Налаштування",
    "settings.name": "Ім'я",
    "settings.language": "Мова",
    "settings.theme": "Тема оформлення",
    "settings.theme.system": "Як у системі",
    "settings.theme.light": "Світла",
    "settings.theme.dark": "Темна",
    "settings.home": "Головна сторінка",
    "settings.recentCount": "Скільки нещодавніх матеріалів показувати",
    "settings.account": "Акаунт",
    "settings.signout": "Вийти з акаунта",
    "time.now": "щойно",
    "time.min": "{n} хв тому",
    "time.hour": "{n} год тому",
    "time.yesterday": "вчора",
    "time.days": "{n} дн. тому",
    "src.web": "Стаття",
    "srcs.web": "Статті",
    "topic.Unsorted": "Без теми",
    "topic.Algorithms": "Алгоритми",
    "topic.Databases": "Бази даних",
    "topic.Math": "Математика",
    "topic.English": "Англійська",
    "topic.Programming": "Програмування",
    "n.items": ["матеріал", "матеріали", "матеріалів"],
    "n.topics": ["тема", "теми", "тем"],
    "n.searches": ["пошук", "пошуки", "пошуків"],
    "n.inTopics": ["темі", "темах", "темах"],
  },
  en: {
    tagline: "Save it once. Find it by what it said, not where you saved it.",
    "auth.dev": "Dev mode: Firebase is not configured, sign in with email only.",
    "auth.google": "Sign in with Google",
    "auth.or": "or email",
    "auth.signin": "Sign in",
    "auth.signup": "Sign up",
    "auth.name": "Name",
    "auth.password": "Password (min. 6 characters)",
    "auth.create": "Create account",
    "auth/invalid-credential": "Wrong email or password",
    "auth/email-already-in-use": "This email is already registered",
    "auth/weak-password": "The password needs at least 6 characters",
    "auth/invalid-email": "Invalid email",
    "auth/popup-closed-by-user": "The sign-in window was closed",
    "nav.home": "Home",
    "nav.library": "My library",
    "nav.profile": "Profile",
    "nav.settings": "Settings",
    "nav.menu": "Menu",
    "nav.signout": "Sign out",
    "common.cancel": "Cancel",
    "common.wait": "Please wait…",
    "common.save": "Save",
    "common.saved": "Saved",
    "common.search": "Search",
    "common.searchLabel": "Search",
    "home.hello": "Hi",
    "home.addLabel": "Add material",
    "home.linkLabel": "Link",
    "home.linkPlaceholder": "Paste a link to a video, post, article or PDF",
    "home.adding": "Adding…",
    "home.add": "Add",
    "home.supported": "Supported:",
    "home.searchPlaceholder": "Search by meaning: “the video that explained Big-O with pizza”",
    "home.recent": "Recently added",
    "home.allLibrary": "Whole library →",
    "home.empty": "Nothing here yet. Paste a link above and your first material will show up here.",
    "home.back": "Back to home",
    "search.results": "Results for “{q}”",
    "search.none": "Nothing found. Try other words.",
    "library.title": "My library",
    "library.summary": "{items} in {topics}",
    "library.search": "Search the library",
    "library.back": "Back to library",
    "library.allTopics": "All topics",
    "library.empty": "Your library is empty. Add a material on the home page.",
    "library.sources": "Sources",
    "item.link": "Link",
    "item.processing": "processing…",
    "item.failed": "couldn't get the text",
    "item.changeTopic": "Change topic",
    "item.delete": "Delete",
    "delete.title": "Delete this material?",
    "delete.confirm": "Yes, delete",
    "delete.before": "Do you really want to delete “",
    "delete.after": "”? This can't be undone.",
    "topic.title": "Choose a topic",
    "topic.current": "Now:",
    "topic.placeholder": "Find or create a topic…",
    "topic.existing": "Existing topics",
    "topic.loading": "Loading…",
    "topic.noOthers": "No other topics yet.",
    "topic.create": "Create “{name}”",
    "profile.title": "Profile",
    "profile.noName": "No name",
    "profile.since": "Member since {date}",
    "profile.bySource": "By source",
    "settings.title": "Settings",
    "settings.name": "Name",
    "settings.language": "Language",
    "settings.theme": "Theme",
    "settings.theme.system": "System",
    "settings.theme.light": "Light",
    "settings.theme.dark": "Dark",
    "settings.home": "Home page",
    "settings.recentCount": "How many recent materials to show",
    "settings.account": "Account",
    "settings.signout": "Sign out",
    "time.now": "just now",
    "time.min": "{n} min ago",
    "time.hour": "{n} h ago",
    "time.yesterday": "yesterday",
    "time.days": "{n} days ago",
    "src.web": "Article",
    "srcs.web": "Articles",
    "topic.Unsorted": "Unsorted",
    "n.items": ["material", "materials"],
    "n.topics": ["topic", "topics"],
    "n.searches": ["search", "searches"],
    "n.inTopics": ["topic", "topics"],
  },
};

function pluralIndex(lang, n) {
  if (lang === "en") return n === 1 ? 0 : 1;
  const d = n % 10, h = n % 100;
  if (d === 1 && h !== 11) return 0;
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return 1;
  return 2;
}

export function detectLanguage() {
  const saved = loadPrefs().lang;
  if (saved && STRINGS[saved]) return saved;
  const nav = (typeof navigator !== "undefined" && navigator.language) || "uk";
  return nav.toLowerCase().startsWith("en") ? "en" : "uk";
}

export function makeT(lang) {
  const dict = STRINGS[lang] || STRINGS.uk;
  /** t("key", {vars}) — falls back to Ukrainian, then to the key itself. */
  const t = (key, vars) => {
    let s = dict[key] ?? STRINGS.uk[key] ?? key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));
    return s;
  };
  /** tn(3, "n.items") -> "3 матеріали" / "3 materials" */
  t.n = (n, key) => {
    const forms = dict[key] || STRINGS.uk[key];
    return `${n} ${forms[pluralIndex(lang, n)]}`;
  };
  /** Display name for a topic: built-in topics are translated, the user's own names stay as typed. */
  t.topic = (name) => dict[`topic.${name}`] ?? name;
  t.source = (type) => dict[`src.${type}`] ?? { youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram", pdf: "PDF" }[type] ?? t("item.link");
  t.sources = (type) => dict[`srcs.${type}`] ?? t.source(type);
  t.date = (iso, opts) => new Date(iso).toLocaleDateString(LOCALE[lang], opts);
  /** "just now", "5 min ago", …, or a short date */
  t.ago = (iso) => {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (!(s >= 0)) return "";
    if (s < 60) return t("time.now");
    if (s < 3600) return t("time.min", { n: Math.floor(s / 60) });
    if (s < 86400) return t("time.hour", { n: Math.floor(s / 3600) });
    if (s < 2 * 86400) return t("time.yesterday");
    if (s < 7 * 86400) return t("time.days", { n: Math.floor(s / 86400) });
    return t.date(iso, { day: "numeric", month: "short" });
  };
  t.lang = lang;
  return t;
}

const I18n = createContext({ t: makeT("uk"), lang: "uk", setLang: () => {} });

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detectLanguage);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const value = useMemo(() => ({
    lang,
    t: makeT(lang),
    setLang: (l) => { setLangState(l); savePrefs({ ...loadPrefs(), lang: l }); },
  }), [lang]);
  return <I18n.Provider value={value}>{children}</I18n.Provider>;
}

export const useI18n = () => useContext(I18n);
export const useT = () => useContext(I18n).t;

/** Small UA / EN switch, used on the sign-in screen and in Settings. */
export function LanguageSwitch({ compact }) {
  const { lang, setLang } = useI18n();
  return (
    <div className={`segmented${compact ? " lang-compact" : ""}`} role="radiogroup" aria-label="Language / Мова">
      {LANGUAGES.map(([code, label]) => (
        <button key={code} type="button" role="radio" aria-checked={lang === code}
          className={lang === code ? "active" : ""} onClick={() => setLang(code)}>
          {compact ? code.toUpperCase() : label}
        </button>
      ))}
    </div>
  );
}
