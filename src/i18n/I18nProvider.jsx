import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { getLocale, setCurrentLocale, storeLocale } from "./locale.js";
import { formatDate, formatDateTime, formatNumber, rawMessage, translate } from "./translate.js";

const I18nContext = createContext(null);

/**
 * Holds the UI locale. Changing it updates the module-level locale first (read by the API
 * client and the plain formatting helpers), then re-renders every useI18n() consumer.
 */
export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(getLocale);

  const setLocale = useCallback((next) => {
    setCurrentLocale(next);
    storeLocale(getLocale());
    setLocaleState(getLocale());
  }, []);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      /** t("dashboard.startTraining"), t("dashboard.hello", { name }), t(key, { count, defaultValue }) */
      t: (key, params) => translate(locale, key, params),
      /** Raw entry (e.g. an array of lines) for the active locale. */
      tRaw: (key) => rawMessage(locale, key),
      /** Pick the plural form of `key` for `count` (shorthand for t(key, { ...params, count })). */
      plural: (key, count, params) => translate(locale, key, { ...params, count }),
      formatDate: (value, opts) => formatDate(value, opts, locale),
      formatDateTime: (value, opts) => formatDateTime(value, opts, locale),
      formatNumber: (n, opts) => formatNumber(n, opts, locale),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
