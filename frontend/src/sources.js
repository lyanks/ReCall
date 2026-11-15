export const SOURCE_ICON = { youtube: "▶", tiktok: "♪", instagram: "◎", pdf: "📄", web: "🌐" };
export const SOURCE_NAME = { youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram", pdf: "PDF", web: "Статті" };
// One item's source, singular ("Стаття" rather than "Статті").
export const SOURCE_LABEL = { youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram", pdf: "PDF", web: "Стаття" };

/** "щойно", "5 хв тому", "2 год тому", "вчора", "3 дн. тому", or a date. */
export function timeAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!(s >= 0)) return "";
  if (s < 60) return "щойно";
  if (s < 3600) return `${Math.floor(s / 60)} хв тому`;
  if (s < 86400) return `${Math.floor(s / 3600)} год тому`;
  if (s < 2 * 86400) return "вчора";
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} дн. тому`;
  return new Date(iso).toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
}

// The backend files items without a topic under "Unsorted"; show it in Ukrainian.
export const topicLabel = (name) => (name === "Unsorted" ? "Без теми" : name);
