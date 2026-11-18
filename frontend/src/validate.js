// Client-side checks for the sign-up form (login + password). Firebase still has the final say (and can enforce its own password policy).

// Login for password accounts: 3–20 characters, Latin letters, digits, "." "_" "-", starts with a letter.
const LOGIN_RE = /^[a-z][a-z0-9._-]{2,19}$/;

/** i18n key of the first rule the login breaks, or "". */
export function loginProblem(login) {
  const v = login.trim().toLowerCase();
  if (v.length < 3 || v.length > 20) return "auth.err.loginLength";
  if (!LOGIN_RE.test(v)) return "auth.err.loginChars";
  return "";
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
export function passwordProblem(password, login = "") {
  const p = password;
  if (p.length < 8) return "auth.err.pwShort";
  if (!/[a-zа-яіїєґ]/i.test(p) || !/\d/.test(p)) return "auth.err.pwMix";
  const low = p.toLowerCase();
  if (COMMON.has(low) || /^(.)\1+$/.test(p)) return "auth.err.pwCommon";
  const name = login.split("@")[0].trim().toLowerCase();
  if (name.length >= 4 && low.includes(name)) return "auth.err.pwLogin";
  return "";
}

/** 0 = empty, 1 = weak, 2 = okay, 3 = strong. */
export function passwordStrength(password, login = "") {
  if (!password) return 0;
  if (passwordProblem(password, login)) return 1;
  let score = 0;
  if (password.length >= 12) score++;
  if (/[a-zа-яіїєґ]/.test(password) && /[A-ZА-ЯІЇЄҐ]/.test(password)) score++;
  if (/[^\p{L}\d]/u.test(password)) score++;
  return score >= 2 ? 3 : 2;
}
