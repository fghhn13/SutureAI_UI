import { useState } from "react";
import { CHART } from "../charts/tokens.js";

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
  if (!times?.length) return null;
  return (
    <span className={`inline-flex flex-wrap gap-1 ${className}`}>
      {times.map((t) =>
        onSeek ? (
          <button
            key={t}
            type="button"
            onClick={() => onSeek(t)}
            className="rounded-md border border-brand-200 bg-white px-1.5 py-0.5 font-mono text-xs font-semibold text-brand-700 hover:bg-brand-50"
            title="Play from this moment"
          >
            ▶ {clock(t)}
          </button>
        ) : (
          <span key={t} className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">
            {clock(t)}
          </span>
        ),
      )}
    </span>
  );
}

/** The one thing to fix first. */
export function FocusCard({ focus, onSeek }) {
  if (!focus?.title) return null;
  const times = focus.times ?? (focus.timeSeconds != null ? [focus.timeSeconds] : []);
  return (
    <section className="mt-6 rounded-2xl border border-rose-200 bg-white p-6 shadow-soft">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800">
          ▲ Fix this first
        </span>
        <h2 className="text-lg font-semibold text-slate-900">{focus.title}</h2>
        {focus.impact ? (
          <span className="ml-auto text-sm font-semibold text-slate-600">about −{focus.impact} pts</span>
        ) : null}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Why it matters</p>
          <p className="mt-1 text-sm leading-6 text-slate-700">{focus.why}</p>
          {times.length ? (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              Seen at <TimeChips times={times} onSeek={onSeek} />
            </p>
          ) : null}
        </div>
        {focus.drill ? (
          <div className="rounded-xl bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Practice this</p>
            <p className="mt-1 text-sm leading-6 text-emerald-950">{focus.drill}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Horizontal bars: points lost per issue (one hue; the number is printed on each row). */
export function PointsLostCard({ items, total, onSeek }) {
  if (!items?.length) return null;
  const max = Math.max(...items.map((i) => i.points), 1);
  return (
    <article className="surface-card p-6">
      <h2 className="text-lg font-semibold text-slate-900">Where the {total} points went</h2>
      <p className="mt-1 text-sm text-slate-600">Biggest losses first. Fix the top row before the rest.</p>
      <ul className="mt-4 space-y-3">
        {items.map((item, i) => (
          <li key={`${item.code ?? "other"}-${i}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
            <span className={`text-sm ${item.code ? "font-medium text-slate-800" : "text-slate-500"}`}>{item.label}</span>
            <span className="text-sm font-semibold tabular-nums text-slate-900">−{item.points}</span>
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-r-full"
                style={{ width: `${(item.points / max) * 100}%`, background: item.code ? CHART.downBad : CHART.deEmphasis }}
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
  if (!changes?.length && !metrics?.length) return null;
  return (
    <article className="surface-card p-6">
      {changes?.length ? (
        <>
          <h2 className="text-lg font-semibold text-slate-900">Since your last session</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {changes.map((c) => {
              const up = c.to > c.from;
              return (
                <li key={c.dimension} className="flex items-center gap-2">
                  <span aria-hidden className="w-4 font-semibold" style={{ color: up ? CHART.upGood : CHART.downBad }}>
                    {up ? "▲" : "▼"}
                  </span>
                  <span className="text-slate-800">{c.name}</span>
                  <span className="ml-auto tabular-nums text-slate-600">
                    {c.from} → <span className="font-semibold text-slate-900">{c.to}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
      {metrics?.length ? (
        <>
          <h2 className={`text-lg font-semibold text-slate-900 ${changes?.length ? "mt-5" : ""}`}>Against target</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {metrics.map((m) => (
              <li key={m.key} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                    m.ok ? "bg-emerald-600" : "bg-rose-600"
                  }`}
                >
                  {m.ok ? "✓" : "✕"}
                </span>
                <span className="text-slate-800">{m.label}</span>
                <span className="ml-auto tabular-nums">
                  <span className="font-semibold text-slate-900">{m.display}</span>
                  <span className="text-slate-500"> / target {m.target}</span>
                  <span className="sr-only">{m.ok ? " (met)" : " (missed)"}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </article>
  );
}

const STRIP_STYLE = {
  error: { color: "#d03b3b", height: "100%", width: 6, label: "Issue" },
  warning: { color: "#fab219", height: "75%", width: 6, label: "Warning" },
  normal: { color: "#c3c2b7", height: "40%", width: 2, label: "Step" },
};

/** Where events fall along the recording; click a marker to play from there. */
export function TimelineStrip({ events, duration, onSeek }) {
  const [hover, setHover] = useState(null);
  if (!events?.length || !duration) return null;
  const pos = (t) => `${Math.min(100, Math.max(0, (t / duration) * 100))}%`;
  const ordered = [...events].sort((a, b) => (a.type === "normal") - (b.type === "normal")).reverse();
  return (
    <div className="mt-3">
      <div className="relative h-8 rounded-md bg-slate-100" onMouseLeave={() => setHover(null)}>
        {ordered.map((e) => {
          const s = STRIP_STYLE[e.type] ?? STRIP_STYLE.normal;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onSeek?.(e.timeSeconds)}
              onMouseEnter={() => setHover(e)}
              onFocus={() => setHover(e)}
              aria-label={`${s.label} at ${clock(e.timeSeconds)}: ${e.title}`}
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
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        {hover ? (
          <span className="font-medium text-slate-800">
            {clock(hover.timeSeconds)} · {hover.title}
          </span>
        ) : (
          <>
            <span className="flex items-center gap-1.5"><span className="h-3 w-1.5 rounded-sm" style={{ background: STRIP_STYLE.error.color }} />Issue</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-1.5 rounded-sm" style={{ background: STRIP_STYLE.warning.color }} />Warning</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-0.5 rounded-sm" style={{ background: STRIP_STYLE.normal.color }} />Step</span>
            <span className="ml-auto">0:00 – {clock(duration)} · click a marker to jump</span>
          </>
        )}
      </div>
    </div>
  );
}
