import { useState } from "react";
import { Check, Dumbbell, Play, Target, TrendingDown, TrendingUp, X } from "lucide-react";
import { CHART } from "../charts/tokens.js";
import IconBadge from "../icons/IconBadge.jsx";
import { GrowBar } from "../motion/index.jsx";
import { useI18n } from "../../i18n/index.js";

/**
 * Report blocks that answer "what should I fix, and where": the single most costly issue,
 * where the points went, progress since last time, and a marker strip for the video.
 * All of them are optional: older reports don't carry the fields and render nothing.
 */

export function clock(seconds) {
  const t = Math.max(0, Math.round(seconds));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

/** Clickable timestamps; plain text when there is no video to seek. */
export function TimeChips({ times, onSeek, className = "" }) {
  const { t: tr } = useI18n();
  if (!times?.length) return null;
  return (
    <span className={`inline-flex flex-wrap gap-1 ${className}`}>
      {times.map((t) =>
        onSeek ? (
          <button
            key={t}
            type="button"
            onClick={() => onSeek(t)}
            className="inline-flex items-center gap-1 rounded-sm border border-brand-200 bg-white px-1.5 py-0.5 font-mono text-xs font-semibold text-brand-600 transition-colors hover:border-brand-400 hover:text-brand-700"
            title={tr("report.focus.playFrom")}
          >
            <Play size={10} strokeWidth={2.75} fill="currentColor" />
            {clock(t)}
          </button>
        ) : (
          <span key={t} className="rounded-sm bg-paper px-1.5 py-0.5 font-mono text-xs text-ink-muted">
            {clock(t)}
          </span>
        ),
      )}
    </span>
  );
}

/** The one thing to fix first. */
export function FocusCard({ focus, onSeek }) {
  const { t } = useI18n();
  if (!focus?.title) return null;
  const times = focus.times ?? (focus.timeSeconds != null ? [focus.timeSeconds] : []);
  return (
    <section className="glass-card mt-6 overflow-hidden p-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-1 rounded-l-md bg-bad" />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <IconBadge icon={Target} tone="rose" size="sm" />
        <span className="chip border-bad/50 text-bad">{t("report.focus.fixFirst")}</span>
        <h2 className="font-display text-xl font-semibold text-brand-800">{focus.title}</h2>
        {focus.impact ? (
          <span className="ml-auto text-sm font-semibold text-ink-muted">{t("report.focus.impact", { points: focus.impact })}</span>
        ) : null}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="eyebrow">{t("report.focus.why")}</p>
          <p className="mt-1 text-sm leading-6 text-ink-soft">{focus.why}</p>
          {times.length ? (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
              {t("report.focus.seenAt")} <TimeChips times={times} onSeek={onSeek} />
            </p>
          ) : null}
        </div>
        {focus.drill ? (
          <div className="tile-dashed">
            <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-good">
              <Dumbbell size={14} strokeWidth={2.25} />
              {t("report.focus.practice")}
            </p>
            <p className="mt-1 text-sm leading-6 text-ink-soft">{focus.drill}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Horizontal bars: points lost per issue (one hue; the number is printed on each row). */
export function PointsLostCard({ items, total, onSeek }) {
  const { t } = useI18n();
  if (!items?.length) return null;
  const max = Math.max(...items.map((i) => i.points), 1);
  return (
    <article className="glass-card p-6">
      <h2 className="section-title">{t("report.points.title", { total })}</h2>
      <p className="mt-1 text-sm text-ink-muted">{t("report.points.subtitle")}</p>
      <ul className="mt-4 space-y-3">
        {items.map((item, i) => (
          <li key={`${item.code ?? "other"}-${i}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
            <span className={`text-sm ${item.code ? "font-medium text-ink" : "text-ink-muted"}`}>{item.label}</span>
            <span className="font-display text-base font-semibold tabular-nums text-ink">−{item.points}</span>
            <div className="h-1 overflow-hidden rounded-full bg-[#ebe6dc]">
              <GrowBar
                percent={(item.points / max) * 100}
                delay={0.08 * i}
                className="h-1 rounded-full"
                style={{ background: item.code ? CHART.downBad : CHART.deEmphasis }}
              />
            </div>
            <TimeChips times={item.times} onSeek={onSeek} className="justify-end" />
          </li>
        ))}
      </ul>
    </article>
  );
}

/** Progress since the previous session plus measurable targets. */
export function ProgressCard({ changes, metrics }) {
  const { t } = useI18n();
  if (!changes?.length && !metrics?.length) return null;
  return (
    <article className="glass-card p-6">
      {changes?.length ? (
        <>
          <h2 className="section-title">{t("report.progress.since")}</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {changes.map((c) => {
              const up = c.to > c.from;
              return (
                <li key={c.dimension} className="flex items-center gap-2">
                  <span aria-hidden className="w-4" style={{ color: up ? CHART.upGood : CHART.downBad }}>
                    {up ? <TrendingUp size={16} strokeWidth={2.25} /> : <TrendingDown size={16} strokeWidth={2.25} />}
                  </span>
                  <span className="text-ink">{c.name}</span>
                  <span className="ml-auto tabular-nums text-ink-muted">
                    {c.from} → <span className="font-semibold text-ink">{c.to}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
      {metrics?.length ? (
        <>
          <h2 className={`section-title ${changes?.length ? "mt-6" : ""}`}>{t("report.progress.target")}</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {metrics.map((m) => (
              <li key={m.key} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-white ${
                    m.ok ? "bg-good" : "bg-bad"
                  }`}
                >
                  {m.ok ? <Check size={10} strokeWidth={3} /> : <X size={10} strokeWidth={3} />}
                </span>
                <span className="text-ink">{m.label}</span>
                <span className="ml-auto tabular-nums">
                  <span className="font-semibold text-ink">{m.display}</span>
                  <span className="text-ink-muted">{t("report.progress.targetValue", { target: m.target })}</span>
                  <span className="sr-only">{m.ok ? t("report.progress.met") : t("report.progress.missed")}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </article>
  );
}

/** Marker styles; legend and aria text come from report.eventType.<type>. */
const STRIP_STYLE = {
  error: { color: "#a24e36", height: "100%", width: 6, type: "error" },
  warning: { color: "#b8913f", height: "75%", width: 6, type: "warning" },
  normal: { color: "#d9d3c6", height: "40%", width: 2, type: "normal" },
};

/** Where events fall along the recording; click a marker to play from there. */
export function TimelineStrip({ events, duration, onSeek }) {
  const { t } = useI18n();
  const [hover, setHover] = useState(null);
  if (!events?.length || !duration) return null;
  const pos = (t) => `${Math.min(100, Math.max(0, (t / duration) * 100))}%`;
  const ordered = [...events].sort((a, b) => (a.type === "normal") - (b.type === "normal")).reverse();
  return (
    <div className="mt-3">
      <div className="relative h-8 rounded-sm border border-line bg-paper" onMouseLeave={() => setHover(null)}>
        {ordered.map((e) => {
          const s = STRIP_STYLE[e.type] ?? STRIP_STYLE.normal;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onSeek?.(e.timeSeconds)}
              onMouseEnter={() => setHover(e)}
              onFocus={() => setHover(e)}
              aria-label={t("report.strip.markerAria", {
                type: t(`report.eventType.${s.type}`),
                time: clock(e.timeSeconds),
                title: e.title,
              })}
              className="absolute bottom-0 -translate-x-1/2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              style={{
                left: pos(e.timeSeconds),
                height: s.height,
                width: Math.max(s.width, 12),
                background: "transparent",
                padding: 0,
              }}
            >
              <span
                className={`absolute bottom-0 left-1/2 -translate-x-1/2 rounded-sm ${e.overturned ? "opacity-40" : ""}`}
                style={{ height: "100%", width: s.width, background: s.color }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
        {hover ? (
          <span className="font-medium text-ink">
            {clock(hover.timeSeconds)} · {hover.title}
          </span>
        ) : (
          <>
            <span className="flex items-center gap-1.5"><span className="h-3 w-1.5 rounded-sm" style={{ background: STRIP_STYLE.error.color }} />{t("report.eventType.error")}</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-1.5 rounded-sm" style={{ background: STRIP_STYLE.warning.color }} />{t("report.eventType.warning")}</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-0.5 rounded-sm" style={{ background: STRIP_STYLE.normal.color }} />{t("report.eventType.normal")}</span>
            <span className="ml-auto">{t("report.strip.hint", { end: clock(duration) })}</span>
          </>
        )}
      </div>
    </div>
  );
}
