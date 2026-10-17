/**
 * UI localisation (English / Simplified Chinese), no third-party library.
 *
 *   const { t, locale, setLocale, formatDate } = useI18n();
 *   t("dashboard.hello", { name })            // "{name}" interpolation
 *   t("instructor.counts.reports", { count: 3 })  // plural entries: { one, other }
 *
 * To add a string: add the key to en.js and zh.js (same nested path), then call t().
 * Values that arrive in English from the API go through the helpers in domain.js.
 */
export { I18nProvider, useI18n } from "./I18nProvider.jsx";
export { LOCALES, apiLanguage, getLocale, intlLocale } from "./locale.js";
export { formatDate, formatDateTime, formatNumber, t, translate } from "./translate.js";
export * from "./domain.js";
