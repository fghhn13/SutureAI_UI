/**
 * Dictionary lookup, `{name}` interpolation and plural selection. Pure functions; the
 * React side lives in I18nProvider.jsx.
 */
import en from "./en.js";
import zh from "./zh.js";
import { getLocale, intlLocale } from "./locale.js";

export const DICTIONARIES = { en, zh };

function lookup(dict, key) {
  let node = dict;
  for (const part of key.split(".")) {
    if (node == null || typeof node !== "object") return undefined;
    node = node[part];
  }
  return node;
}

/** Raw dictionary value (string, array or object) for a key, falling back to English. */
export function rawMessage(locale, key) {
  const value = lookup(DICTIONARIES[locale] ?? en, key);
  return value !== undefined ? value : lookup(en, key);
}

const pluralRulesCache = new Map();
function pluralCategory(locale, count) {
  const tag = intlLocale(locale);
  if (!pluralRulesCache.has(tag)) pluralRulesCache.set(tag, new Intl.PluralRules(tag));
  return pluralRulesCache.get(tag).select(count);
}

/** Replace `{name}` placeholders; unknown ones are left as-is so they stay visible. */
export function interpolate(text, params) {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) =>
    params[name] !== undefined && params[name] !== null ? String(params[name]) : match,
  );
}

/**
 * Translate `key`. `params` fills `{name}` placeholders. When the entry is a plural object
 * ({ one, other, ... }) the form is chosen from `params.count` with Intl.PluralRules.
 * `params.defaultValue` is returned (interpolated) when the key is missing in every
 * dictionary; otherwise the key itself is returned so gaps are easy to spot.
 */
export function translate(locale, key, params) {
  let value = rawMessage(locale, key);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const count = Number(params?.count ?? 0);
    value = value[pluralCategory(locale, count)] ?? value.other;
  }
  if (typeof value !== "string") {
    if (params?.defaultValue !== undefined) return interpolate(String(params.defaultValue), params);
    return key;
  }
  return interpolate(value, params);
}

/** Translate with the module-level locale (for code outside React components). */
export function t(key, params) {
  return translate(getLocale(), key, params);
}

/* ---- Intl formatting -------------------------------------------------------------- */

function toDate(value) {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date only; returns `fallback` for empty/invalid input. */
export function formatDate(value, opts = { dateStyle: "medium" }, locale = getLocale(), fallback = "—") {
  const d = toDate(value);
  return d ? d.toLocaleDateString(intlLocale(locale), opts) : fallback;
}

/** Date and time; returns `fallback` for empty/invalid input. */
export function formatDateTime(
  value,
  opts = { dateStyle: "medium", timeStyle: "short" },
  locale = getLocale(),
  fallback = "—",
) {
  const d = toDate(value);
  return d ? d.toLocaleString(intlLocale(locale), opts) : fallback;
}

export function formatNumber(n, opts, locale = getLocale()) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString(intlLocale(locale), opts);
}
