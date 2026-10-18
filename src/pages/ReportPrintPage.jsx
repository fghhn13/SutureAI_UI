import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, apiUrl } from "../api/client.js";
import { CHART } from "../components/charts/tokens.js";
import { formatDateTime, reliabilityLabel, reportStatusLabel, useI18n } from "../i18n/index.js";

/**
 * Print layout of a report, used for "Export PDF" (browser print → Save as PDF).
 * Same warm-paper language as the on-screen report, flattened for paper: white sheet, no
 * grain, no motion, no shadows; grey and blue tiles group content and never split a page.
 * Each timeline event gets a still from the recording at its timestamp, captured in the
 * browser from the session video.
 */

const THUMB_W = 240;
const THUMB_H = 135;
// Event type labels: report.eventType.<type>; appeal reasons: report.printView.reasons.<reason>.

function seconds(event) {
  if (typeof event.timeSeconds === "number") return event.timeSeconds;
  const parts = String(event.time ?? "").split(":").map(Number);
  if (parts.some(Number.isNaN)) return null;
  return parts.length === 2 ? parts[0] * 60 + parts[1] : parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : null;
}

function clock(s) {
  const t = Math.round(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

function fmtDate(iso, locale) {
  return formatDateTime(iso, undefined, locale, "");
}

/** Labels such as "Student: " carry their own colon for inline use; leaders and eyebrows don't. */
function bare(label) {
  return String(label).replace(/[:：]\s*$/, "");
}

/** Grab a JPEG still at each requested time (seconds) from a same-origin video URL. */
async function captureFrames(url, times) {
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "auto";
  video.src = url;
  await new Promise((resolve, reject) => {
    video.onloadeddata = resolve;
    video.onerror = () => reject(new Error("video failed to load"));
    setTimeout(() => reject(new Error("video load timed out")), 10000);
  });
  const canvas = document.createElement("canvas");
  canvas.width = THUMB_W;
  canvas.height = THUMB_H;
  const ctx = canvas.getContext("2d");
  const out = {};
  for (const t of times) {
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("seek timed out")), 4000);
        video.onseeked = () => {
          clearTimeout(timer);
          resolve();
        };
        video.currentTime = Math.min(Math.max(0, t), Math.max(0, (video.duration || t) - 0.05));
      });
      // Letterbox into 16:9.
      const vw = video.videoWidth || THUMB_W;
      const vh = video.videoHeight || THUMB_H;
      const scale = Math.min(THUMB_W / vw, THUMB_H / vh);
      const w = vw * scale;
      const h = vh * scale;
      ctx.fillStyle = CHART.inkPrimary;
      ctx.fillRect(0, 0, THUMB_W, THUMB_H);
      ctx.drawImage(video, (THUMB_W - w) / 2, (THUMB_H - h) / 2, w, h);
      out[t] = canvas.toDataURL("image/jpeg", 0.82);
    } catch {
      /* leave this frame out */
    }
  }
  video.removeAttribute("src");
  video.load();
  return out;
}

/** Numbered section, as on screen: Barlow title led by a blue two-digit number. */
function Section({ num, title, children, keepTogether = true }) {
  // Short sections stay on one page; long ones (the timeline) may break between rows.
  return (
    <section className={`mt-7 ${keepTogether ? "break-inside-avoid-page" : ""}`}>
      <h2 className="section-title break-after-avoid border-b border-line pb-1.5 text-lg">
        <span className="section-num">{String(num).padStart(2, "0")}</span>
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Static score ring (the screen one animates). */
function ScoreRing({ score }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="64" cy="64" r={r} stroke="#ebe6dc" strokeWidth="7" fill="none" />
        <circle
          cx="64"
          cy="64"
          r={r}
          stroke={CHART.series}
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(100, Math.max(0, score)) / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold leading-none text-brand-800">{score}</span>
        <span className="mt-1 text-[10px] text-ink-muted">/ 100</span>
      </div>
    </div>
  );
}

/** Static radar in the chart tokens: grid in CHART.grid, the score shape in the series blue. */
function Radar({ dimensions }) {
  const size = 260;
  const center = size / 2;
  const maxRadius = 76;
  const levels = 4;
  const step = (Math.PI * 2) / dimensions.length;
  const axis = dimensions.map((_, i) => {
    const angle = -Math.PI / 2 + step * i;
    return { angle, x: center + Math.cos(angle) * maxRadius, y: center + Math.sin(angle) * maxRadius };
  });
  const at = (i, f) => [center + (axis[i].x - center) * f, center + (axis[i].y - center) * f];
  const ring = (f) => axis.map((_, i) => at(i, f).join(",")).join(" ");
  const shape = dimensions.map((d, i) => at(i, d.score / 100).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[62mm]" aria-hidden="true">
      {Array.from({ length: levels }, (_, l) => (
        <polygon
          key={l}
          points={ring((l + 1) / levels)}
          fill="none"
          stroke={CHART.grid}
          strokeWidth="1"
          strokeDasharray={l === levels - 1 ? undefined : "3 3"}
        />
      ))}
      {axis.map((p, i) => (
        <line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke={CHART.grid} strokeWidth="1" />
      ))}
      <polygon points={shape} fill="rgba(79, 105, 194, 0.12)" stroke={CHART.series} strokeWidth="1.5" strokeLinejoin="round" />
      {dimensions.map((d, i) => {
        const [x, y] = at(i, d.score / 100);
        const lx = center + Math.cos(axis[i].angle) * (maxRadius + 20);
        const ly = center + Math.sin(axis[i].angle) * (maxRadius + 20);
        return (
          <g key={d.name}>
            <circle cx={x} cy={y} r="3" fill={CHART.surface} stroke={CHART.series} strokeWidth="1.5" />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fill={CHART.inkSecondary} fontSize="10" fontWeight="500">
              {d.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Bar({ percent, color }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-[#ebe6dc]">
      <div className="h-1 rounded-full" style={{ width: `${Math.min(100, Math.max(0, percent))}%`, background: color }} />
    </div>
  );
}

const EVENT_STYLE = {
  normal: { dot: "border-brand-300 bg-white", chip: "border-brand-200 text-brand-600" },
  warning: { dot: "border-warn bg-warn/25", chip: "border-warn/50 text-warn" },
  error: { dot: "border-bad bg-bad", chip: "border-bad/50 text-bad" },
};

const APPEAL_CHIP = {
  open: "border-warn/50 text-warn",
  accepted: "border-good/50 text-good",
  rejected: "border-mist text-ink-muted",
};

export default function ReportPrintPage() {
  const { t, locale } = useI18n();
  const [params] = useSearchParams();
  const sessionId = params.get("session");
  const autoPrint = params.get("autoprint") === "1";
  const [report, setReport] = useState(null);
  const [frames, setFrames] = useState(null); // null = capturing
  const [error, setError] = useState(null);
  const printedRef = useRef(false);

  useEffect(() => {
    if (!sessionId) {
      setError(t("report.printView.noSession"));
      return;
    }
    api(`/reports/${encodeURIComponent(sessionId)}`)
      .then(setReport)
      .catch((e) => setError(e.message));
  }, [sessionId]);

  useEffect(() => {
    if (!report) return;
    const url = report.evidenceVideoUrl?.startsWith("/api/") ? apiUrl(report.evidenceVideoUrl) : null;
    const times = [...new Set(report.timeline.map(seconds).filter((t) => t != null))];
    if (!url || !times.length) {
      setFrames({});
      return;
    }
    captureFrames(url, times)
      .then(setFrames)
      .catch(() => setFrames({}));
  }, [report]);

  const ready = report && frames;
  useEffect(() => {
    if (ready && autoPrint && !printedRef.current) {
      printedRef.current = true;
      // Wait for Barlow/Montserrat so the PDF doesn't fall back to system fonts.
      const fontsReady = document.fonts?.ready ?? Promise.resolve();
      fontsReady.then(() => setTimeout(() => window.print(), 300));
    }
  }, [ready, autoPrint]);

  useEffect(() => {
    if (report) document.title = t("report.printView.docTitle", { student: report.student, task: report.task });
  }, [report, t]);

  if (error) return <p className="p-10 text-bad">{error}</p>;
  if (!report) return <p className="p-10 text-ink-muted">{t("report.loading")}</p>;

  const scores = report.scores ?? { ai: report.overallScore, current: report.overallScore };
  const review = report.review?.status === "completed" ? report.review : null;
  const appeals = report.appeals ?? [];
  const reviewed = /^Reviewed\b/.test(report.status ?? "");
  const hasStills = Object.keys(frames ?? {}).length > 0;
  const dimensionAvg = report.dimensions.length
    ? Math.round(report.dimensions.reduce((sum, d) => sum + d.score, 0) / report.dimensions.length)
    : 0;
  const delta = String(report.delta);
  const deltaClass = delta.startsWith("-") ? "text-bad" : delta.startsWith("+") ? "text-good" : "text-ink-muted";
  const maxLost = Math.max(...(report.pointsLost ?? []).map((p) => p.points), 1);
  const nextSteps = report.suggestionDetails ?? report.suggestions.map((text) => ({ text, times: [] }));

  const headerMeta = [
    [t("report.header.student"), report.student],
    [t("report.header.dateTime"), fmtDate(report.recordedAt, locale) || report.dateTime],
    [t("report.header.taskDuration"), report.duration],
    [t("report.header.confidence"), reliabilityLabel(t, report.reliability)],
  ];
  const overallStats = [
    [t("report.overall.reliability"), reliabilityLabel(t, report.reliability)],
    [t("report.overall.change"), report.delta, deltaClass],
    [t("report.overall.dimensionAvg"), dimensionAvg],
  ];
  // 01–04 always print; review and appeals take the next numbers when present.
  let nextNum = 5;
  const reviewNum = review ? nextNum++ : null;
  const appealsNum = appeals.length ? nextNum++ : null;
  const footerText = t("report.printView.footer", {
    date: fmtDate(new Date().toISOString(), locale),
    id: report.meta?.sessionId,
  });
  // The footer runs in the page margin on every printed page (Chrome/Edge page-margin boxes).
  const marginBox = "font-family: Montserrat, sans-serif; font-size: 7.5pt; color: #6f6a60;";

  return (
    <div className="min-h-screen print:min-h-0 print:bg-white">
      <style>
        {`@page { size: A4; margin: 14mm 12mm;
            @bottom-left { content: ${JSON.stringify(t("report.printView.brand"))}; ${marginBox} }
            @bottom-right { content: ${JSON.stringify(`${footerText} · `)} counter(page) " / " counter(pages); ${marginBox} } }
          @media print { html, body { background: #fff; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}
      </style>

      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-white px-6 py-3 print:hidden">
        <button type="button" disabled={!ready} onClick={() => window.print()} className="btn-primary px-4 py-2">
          {ready ? t("report.printView.savePdf") : t("report.printView.preparing")}
        </button>
        <span className="text-sm text-ink-soft">
          {t("report.printView.hint.before")}
          <strong>{t("report.printView.hint.strong")}</strong>
          {t("report.printView.hint.after")}
        </span>
      </div>

      <article className="mx-auto my-6 max-w-[210mm] border border-line bg-white px-[12mm] py-[14mm] text-[12.5px] leading-relaxed text-ink print:my-0 print:max-w-none print:border-0 print:px-px print:py-0">
        {/* Header: brand rule, display title, status stamp, then the meta row. */}
        <header className="break-inside-avoid-page">
          <div aria-hidden="true" className="h-1 rounded-full bg-brand-500" />
          <div className="mt-4 flex items-start justify-between gap-6">
            <div className="min-w-0">
              <p className="pill-header">{t("report.printView.brand")}</p>
              <h1 className="title-display mt-2 text-[26px] leading-tight">{report.reportTitle ?? report.task}</h1>
              {report.reportTitle ? <p className="mt-1 text-sm font-medium text-ink-muted">{report.task}</p> : null}
            </div>
            <span
              title={reportStatusLabel(t, report.status)}
              className={`stamp mr-1 mt-2 ${reviewed ? "border-good text-good outline-good/50" : "border-warn text-warn outline-warn/50"}`}
            >
              {reviewed ? t("report.statusBadge.stampReviewed") : t("report.statusBadge.stampPending")}
            </span>
          </div>
          <dl className="mt-5 grid grid-cols-4 gap-x-5">
            {headerMeta.map(([label, value]) => (
              <div key={label} className="min-w-0 border-t border-line pt-2">
                <dt className="eyebrow">{bare(label)}</dt>
                <dd className="text-[13px] font-semibold leading-snug text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </header>

        <Section num={1} title={t("report.overall.title")} keepTogether={false}>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center">
              <ScoreRing score={scores.current} />
              <p className="mt-1.5 text-center text-[10.5px] text-ink-muted">
                {scores.current !== scores.ai || review
                  ? t("report.printView.aiScoreValue", { score: scores.ai })
                  : t("report.printView.aiScore")}
                {review ? t("report.printView.confirmed") : ""}
              </p>
            </div>
            <div className="min-w-0 flex-1">
              <ul>
                {overallStats.map(([label, value, cls]) => (
                  <li key={label} className="leader py-1 text-[12.5px]">
                    <span className="text-ink-muted">{bare(label)}</span>
                    <span className={`font-display text-sm font-semibold ${cls ?? "text-brand-800"}`}>{value}</span>
                  </li>
                ))}
              </ul>
              <span className={`chip mt-2 ${report.completed ? "border-good/50 text-good" : "border-bad/50 text-bad"}`}>
                {report.completed ? t("report.printView.taskCompleted") : t("report.printView.taskIncomplete")}
              </span>
              <p className="mt-2 text-ink-soft">{report.summary}</p>
            </div>
          </div>

          {report.focus?.title ? (
            <div className="tile mt-4 break-inside-avoid border-l-[3px] border-bad py-3">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="chip border-bad/50 text-bad">{t("report.focus.fixFirst")}</span>
                <h3 className="font-display text-base font-semibold text-brand-800">{report.focus.title}</h3>
                {report.focus.impact ? (
                  <span className="ml-auto text-xs font-semibold text-ink-muted">
                    {t("report.focus.impact", { points: report.focus.impact })}
                  </span>
                ) : null}
              </div>
              <div className={`mt-2 grid gap-4 ${report.focus.drill ? "grid-cols-2" : ""}`}>
                <div>
                  <p className="text-ink-soft">{report.focus.why}</p>
                  {report.focus.times?.length ? (
                    <p className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-ink-muted">
                      {t("report.focus.seenAt")}
                      {report.focus.times.map((s) => (
                        <span key={s} className="chip border-mist font-mono text-ink-soft">{clock(s)}</span>
                      ))}
                    </p>
                  ) : null}
                </div>
                {report.focus.drill ? (
                  <div className="tile-dashed bg-white px-3 py-2">
                    <p className="text-[11px] font-semibold tracking-wide text-good">{t("report.focus.practice")}</p>
                    <p className="mt-0.5 text-ink-soft">{report.focus.drill}</p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {report.pointsLost?.length || report.keyMetrics?.length || report.changes?.length ? (
            <div className="mt-4 grid grid-cols-2 gap-4">
              {report.pointsLost?.length ? (
                <div className="tile break-inside-avoid">
                  <p className="pill-header">{t("report.points.title", { total: 100 - report.overallScore })}</p>
                  <ul className="mt-2.5 space-y-2">
                    {report.pointsLost.map((p, i) => (
                      <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                        <span className={p.code ? "font-medium text-ink" : "text-ink-muted"}>{p.label}</span>
                        <span className="font-display text-sm font-semibold tabular-nums text-ink">−{p.points}</span>
                        <Bar percent={(p.points / maxLost) * 100} color={p.code ? CHART.downBad : CHART.deEmphasis} />
                        <span className="text-right font-mono text-[10.5px] text-ink-muted">
                          {(p.times ?? []).map(clock).join(" ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {report.changes?.length || report.keyMetrics?.length ? (
                <div className="tile break-inside-avoid">
                  {report.changes?.length ? (
                    <>
                      <p className="pill-header">{t("report.progress.since")}</p>
                      <ul className="mb-3 mt-1.5">
                        {report.changes.map((c) => (
                          <li key={c.dimension} className="leader py-1 text-[12.5px]">
                            <span className="text-ink">{c.name}</span>
                            <span className="tabular-nums text-ink-muted">
                              {c.from} →{" "}
                              <span className="font-semibold" style={{ color: c.to > c.from ? CHART.upGood : CHART.downBad }}>
                                {c.to}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  {report.keyMetrics?.length ? (
                    <>
                      <p className="pill-header">{t("report.progress.target")}</p>
                      <ul className="mt-1.5">
                        {report.keyMetrics.map((m) => (
                          <li key={m.label} className="leader py-1 text-[12.5px]">
                            <span className="text-ink">
                              <span className={`mr-1.5 font-semibold ${m.ok ? "text-good" : "text-bad"}`}>{m.ok ? "✓" : "✕"}</span>
                              {m.label}
                            </span>
                            <span className="tabular-nums">
                              <span className="font-semibold text-ink">{m.display}</span>
                              <span className="text-ink-muted">{t("report.progress.targetValue", { target: m.target })}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {report.uncertainty?.length ? (
            <div className="tile mt-4 break-inside-avoid py-3">
              <p className="pill-header">{t("report.notice.title")}</p>
              <ul className="mt-2 space-y-1">
                {report.uncertainty.map((u, i) => (
                  <li key={u} className="flex gap-2">
                    <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
                    <span>
                      <span className="font-semibold text-warn">
                        {i === 0
                          ? t("report.notice.levelPrefix", { level: reliabilityLabel(t, report.reliability) })
                          : t("report.notice.caution")}
                      </span>
                      <span className="text-ink-soft">{u}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Section>

        <Section num={2} title={t("report.dimensionScores")}>
          <div className="grid grid-cols-[64mm_minmax(0,1fr)] items-start gap-4">
            <div className="tile break-inside-avoid">
              <p className="pill-header">{t("report.radar.title")}</p>
              <div className="mt-1">
                <Radar dimensions={report.dimensions} />
              </div>
            </div>
            <ul className="divide-y divide-line">
              {report.dimensions.map((d) => (
                <li key={d.name} className="break-inside-avoid py-2 first:pt-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-display text-[14px] font-semibold text-brand-800">{d.name}</h3>
                    <span className="font-display text-lg font-bold tabular-nums text-brand-700">{d.score}</span>
                  </div>
                  <div className="mt-1">
                    <Bar percent={d.score} color={CHART.series} />
                  </div>
                  <p className="mt-1.5 text-[11.5px] leading-5 text-ink-muted">{d.explanation}</p>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section num={3} title={t("report.timelineSection.title")} keepTogether={false}>
          <ol>
            {report.timeline.map((e) => {
              const at = seconds(e);
              const still = at != null ? frames?.[at] : null;
              const style = EVENT_STYLE[e.type] ?? EVENT_STYLE.normal;
              return (
                <li key={e.id} className="flex break-inside-avoid items-start gap-3 border-b border-line py-2.5 last:border-b-0">
                  {hasStills ? (
                    <div className="w-[34mm] shrink-0">
                      {still ? (
                        <img src={still} alt={t("report.printView.stillAlt", { time: e.time })} className="w-full rounded-md" />
                      ) : null}
                    </div>
                  ) : null}
                  <div className="flex w-14 shrink-0 items-center gap-2 pt-0.5">
                    <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full border-[1.5px] ${style.dot}`} />
                    <span className="font-mono text-[12px] font-semibold text-brand-700">{at != null ? clock(at) : e.time}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className={`font-semibold ${e.overturned ? "text-ink-muted line-through" : "text-ink"}`}>{e.title}</p>
                      <span className={`chip shrink-0 ${style.chip}`}>
                        {t(`report.eventType.${e.type}`, { defaultValue: e.type })}
                      </span>
                    </div>
                    {e.detail ? <p className="text-ink-soft">{e.detail}</p> : null}
                    {e.overturned ? (
                      <span className="chip mt-1 border-good/50 text-good">{t("report.printView.overturned")}</span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </Section>

        <Section num={4} title={t("report.printView.feedback")} keepTogether={false}>
          <div className="grid grid-cols-2 gap-4">
            <div className="tile break-inside-avoid">
              <h3 className="tile-title is-good text-[14px]">{t("report.printView.strengths")}</h3>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-ink-soft marker:text-good">
                {report.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <div className="tile break-inside-avoid">
              <h3 className="tile-title is-bad text-[14px]">{t("report.printView.improvements")}</h3>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-ink-soft marker:text-bad">
                {report.weaknesses.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="tile-dashed mt-4 break-inside-avoid">
            <h3 className="tile-title text-[14px]">{t("report.printView.nextSteps")}</h3>
            <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-ink-soft marker:font-semibold marker:text-brand-500">
              {nextSteps.map((item) => (
                <li key={item.text}>
                  {item.text}
                  {item.times?.length ? (
                    <span className="ml-1.5 font-mono text-[10.5px] text-ink-muted">{item.times.map(clock).join(", ")}</span>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </Section>

        {review ? (
          <Section num={reviewNum} title={t("report.printView.instructorReview")}>
            <div className="tile-blue break-inside-avoid">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-6">
                <div className="min-w-0">
                  <p className="font-display text-base font-semibold text-brand-800">{review.instructorName}</p>
                  <p className="text-xs text-ink-muted">{fmtDate(review.completedAt, locale)}</p>
                  {review.comment ? <p className="mt-2 text-ink-soft">{review.comment}</p> : null}
                </div>
                <div className="text-right">
                  <p className="eyebrow">{t("report.printView.finalScore")}</p>
                  <p className="font-display text-3xl font-bold leading-none text-brand-800">{review.finalScore}</p>
                  <p className="mt-1 text-[10.5px] text-ink-muted">{t("report.printView.aiParen", { score: review.aiScore }).trim()}</p>
                </div>
              </div>
              {review.teachingFocus?.length ? (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="eyebrow mr-1">{t("report.printView.teachingFocusLabel")}</span>
                  {review.teachingFocus.map((f) => (
                    <span key={f} className="chip border-brand-200 bg-white text-brand-600">{f}</span>
                  ))}
                </div>
              ) : null}
            </div>
          </Section>
        ) : null}

        {appeals.length ? (
          <Section num={appealsNum} title={t("report.printView.appeals")}>
            <div className="space-y-3">
              {appeals.map((a) => (
                <div key={a.id} className="tile break-inside-avoid py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.eventTime != null ? (
                      <span className="font-mono text-[12px] font-semibold text-brand-700">{clock(a.eventTime)}</span>
                    ) : null}
                    <span className="font-semibold text-ink">{a.eventLabel ?? t("report.appeals.wholeReport")}</span>
                    <span className={`chip ml-auto ${APPEAL_CHIP[a.status] ?? APPEAL_CHIP.rejected}`}>
                      {a.status === "open"
                        ? t("report.printView.appealStatus.pending")
                        : a.status === "accepted"
                          ? t("report.printView.appealStatus.accepted", {
                              value: `${a.scoreAdjustment > 0 ? "+" : ""}${a.scoreAdjustment}`,
                            })
                          : t("report.printView.appealStatus.rejected")}
                    </span>
                  </div>
                  <p className="mt-1 text-ink-soft">
                    {t("report.printView.studentReason", {
                      reason: t(`report.printView.reasons.${a.reason}`, { defaultValue: a.reason }),
                      message: a.message,
                    })}
                  </p>
                  {a.decisionNote ? (
                    <p className="mt-1 border-l-2 border-mist pl-2.5 text-ink-soft">
                      <span className="font-semibold text-ink">{a.decidedBy}:</span> “{a.decisionNote}”
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        <footer className="mt-8 flex justify-between gap-4 border-t border-line pt-2 text-[10.5px] text-ink-muted print:hidden">
          <span>{t("report.printView.brand")}</span>
          <span>{footerText}</span>
        </footer>
      </article>
    </div>
  );
}
