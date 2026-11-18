// "Support 25 UAH": instead of a payment, a donation to the team's charity jar (Monobank). Hidden without a link.
import { useT } from "../i18n.jsx";
import { Icon } from "./Icons.jsx";

// One-line swap: set VITE_SUPPORT_URL in frontend/.env.production to the jar link (https://send.monobank.ua/jar/…).
export const SUPPORT_URL = (import.meta.env.VITE_SUPPORT_URL || "").trim();
export const SUPPORT_UAH = 25;

export function SupportButton({ className = "" }) {
  const t = useT();
  if (!SUPPORT_URL) return null;
  return (
    <a className={`btn support ${className}`} href={SUPPORT_URL} target="_blank" rel="noopener noreferrer"
      title={t("support.title")}>
      <Icon name="heart" size={16} />{t("support.label", { n: SUPPORT_UAH })}
    </a>
  );
}
