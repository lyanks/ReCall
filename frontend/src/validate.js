// Client-side checks for the sign-up form. Firebase still has the final say (and can enforce its own password policy).

// name@domain.tld: no spaces, one @, a dot in the domain, a 2+ letter ending.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i;

export function emailOk(email) {
  return EMAIL_RE.test(email.trim());
}

// Passwords that appear at the top of every leaked-password list.
const COMMON = new Set([
  "12345678", "123456789", "1234567890", "11111111", "00000000", "12341234", "87654321", "123123123",
  "password", "password1", "password123", "passw0rd", "qwerty123", "qwertyuiop", "1q2w3e4r", "1q2w3e4r5t",
  "qwerty12", "abc12345", "abcd1234", "iloveyou", "iloveyou1", "admin123", "welcome1", "letmein1", "sunshine1",
  "football1", "monkey123", "dragon123", "zaq12wsx", "asdf1234", "q1w2e3r4", "aa123456", "1qaz2wsx",
  "parol123", "ukraine1", "ukraina1", "kyiv2024", "lviv2024", "student1", "ucu12345",
]);

/** The first rule a new password breaks, as an i18n key, or "" when it is fine. */
export function passwordProblem(password, email = "") {
  const p = password;
  if (p.length < 8) return "auth.err.pwShort";
  if (!/[a-zа-яіїєґ]/i.test(p) || !/\d/.test(p)) return "auth.err.pwMix";
  const low = p.toLowerCase();
  if (COMMON.has(low) || /^(.)\1+$/.test(p)) return "auth.err.pwCommon";
  const local = email.split("@")[0].toLowerCase();
  if (local.length >= 4 && low.includes(local)) return "auth.err.pwEmail";
  return "";
}

/** 0 = empty, 1 = weak, 2 = okay, 3 = strong. */
export function passwordStrength(password, email = "") {
  if (!password) return 0;
  if (passwordProblem(password, email)) return 1;
  let score = 0;
  if (password.length >= 12) score++;
  if (/[a-zа-яіїєґ]/.test(password) && /[A-ZА-ЯІЇЄҐ]/.test(password)) score++;
  if (/[^\p{L}\d]/u.test(password)) score++;
  return score >= 2 ? 3 : 2;
}
