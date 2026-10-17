/**
 * Active UI locale outside React: detection, persistence, and a module-level getter so
 * non-component code (the API client, plain formatting helpers) can follow the choice.
 * I18nProvider is the only writer.
 */

export const LOCALES = ["zh", "en"];
export const DEFAULT_LOCALE = "en";

const STORAGE_KEY = "sutureai.locale";

/** BCP 47 tags for Intl and the API's Accept-Language header. */
const INTL_TAGS = { zh: "zh-CN", en: "en-US" };
const API_TAGS = { zh: "zh-CN", en: "en" };

function normalize(value) {
  if (typeof value !== "string") return null;
  const v = value.toLowerCase();
  if (v.startsWith("zh")) return "zh";
  if (v.startsWith("en")) return "en";
  return null;
}

function readStored() {
  try {
    return normalize(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null; // storage blocked (private mode, sandboxed iframe)
  }
}

export function storeLocale(locale) {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* not persisted; the choice still applies for this page load */
  }
}

/** Saved choice, else Chinese when the browser prefers zh*, else English. */
export function detectLocale() {
  const stored = readStored();
  if (stored) return stored;
  const browser = typeof navigator !== "undefined" ? navigator.languages?.[0] ?? navigator.language : null;
  return normalize(browser) === "zh" ? "zh" : DEFAULT_LOCALE;
}

let current = detectLocale();

export function getLocale() {
  return current;
}

export function setCurrentLocale(locale) {
  current = LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
  if (typeof document !== "undefined") document.documentElement.lang = INTL_TAGS[current];
}

export function intlLocale(locale = current) {
  return INTL_TAGS[locale] ?? INTL_TAGS[DEFAULT_LOCALE];
}

/** Value for the Accept-Language header on API requests. */
export function apiLanguage(locale = current) {
  return API_TAGS[locale] ?? API_TAGS[DEFAULT_LOCALE];
}

setCurrentLocale(current);
