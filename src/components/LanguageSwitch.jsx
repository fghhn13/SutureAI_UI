import { LOCALES, useI18n } from "../i18n/index.js";

/** Compact 中文 / EN toggle. Each option is labelled in its own language. */
export default function LanguageSwitch({ className = "" }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <div
      role="group"
      aria-label={t("language.label")}
      className={`inline-flex shrink-0 rounded-md border border-mist bg-white p-0.5 text-xs font-semibold ${className}`}
    >
      {LOCALES.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            lang={l === "zh" ? "zh-CN" : "en"}
            aria-pressed={active}
            onClick={() => setLocale(l)}
            className={`rounded px-2 py-1 transition-colors ${
              active ? "bg-brand-500 text-white" : "text-ink-muted hover:bg-paper hover:text-ink"
            }`}
          >
            {t(`language.${l}`)}
          </button>
        );
      })}
    </div>
  );
}
