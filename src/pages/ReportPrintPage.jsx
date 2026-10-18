import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, apiUrl } from "../api/client.js";
import { formatDateTime, reliabilityLabel, reportStatusLabel, useI18n } from "../i18n/index.js";

/**
 * Print layout of a report, used for "Export PDF" (browser print → Save as PDF).
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
      ctx.fillStyle = "#2b2924";
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

function Section({ title, children, keepTogether = true }) {
  // Short sections stay on one page; long ones (the timeline) may break between rows.
  return (
    <section className={`mt-6 ${keepTogether ? "break-inside-avoid-page" : ""}`}>
      <h2 className="break-after-avoid border-b border-slate-300 pb-1 text-sm font-bold uppercase tracking-wide text-slate-700">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

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
      setTimeout(() => window.print(), 300);
    }
  }, [ready, autoPrint]);

  useEffect(() => {
    if (report) document.title = t("report.printView.docTitle", { student: report.student, task: report.task });
  }, [report, t]);

  if (error) return <p className="p-10 text-rose-700">{error}</p>;
  if (!report) return <p className="p-10 text-slate-500">{t("report.loading")}</p>;

  const scores = report.scores ?? { ai: report.overallScore, current: report.overallScore };
  const review = report.review?.status === "completed" ? report.review : null;
  const appeals = report.appeals ?? [];

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <style>{"@page { size: A4; margin: 14mm 12mm; } body { background: white; }"}</style>

      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-6 py-3 print:hidden">
        <button type="button" disabled={!ready} onClick={() => window.print()} className="btn-primary px-4 py-2">
          {ready ? t("report.printView.savePdf") : t("report.printView.preparing")}
        </button>
        <span className="text-sm text-slate-600">
          {t("report.printView.hint.before")}
          <strong>{t("report.printView.hint.strong")}</strong>
          {t("report.printView.hint.after")}
        </span>
      </div>

      <article className="mx-auto my-6 max-w-[210mm] bg-white p-10 text-[13px] leading-relaxed text-slate-800 shadow print:my-0 print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b-2 border-brand-600 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">{t("report.printView.brand")}</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{report.task}</h1>
            <p className="mt-1 text-slate-600">
              {report.student} · {fmtDate(report.recordedAt, locale) || report.dateTime} · {report.duration}
            </p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold text-slate-900">{scores.current}</p>
            <p className="text-xs text-slate-500">
              {scores.current !== scores.ai || review
                ? t("report.printView.aiScoreValue", { score: scores.ai })
                : t("report.printView.aiScore")}
              {review ? t("report.printView.confirmed") : ""}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-600">{reportStatusLabel(t, report.status)}</p>
          </div>
        </header>

        <Section title={t("report.printView.summary")}>
          <p>{report.summary}</p>
          <p className="mt-1 text-xs text-slate-500">
            {t("report.printView.summaryLine", {
              reliability: reliabilityLabel(t, report.reliability),
              delta: report.delta,
              completion: report.completed ? t("report.printView.taskCompleted") : t("report.printView.taskIncomplete"),
            })}
          </p>
        </Section>

        {report.focus?.title ? (
          <Section title={t("report.focus.fixFirst")}>
            <div className="rounded border-l-4 border-rose-500 bg-rose-50/50 px-3 py-2">
              <p className="font-semibold">
                {report.focus.title}
                {report.focus.impact ? <span className="font-normal text-slate-600">
                    {" · "}
                    {t("report.focus.impact", { points: report.focus.impact })}
                  </span> : null}
                {report.focus.times?.length ? (
                  <span className="font-normal text-slate-600">
                    {t("report.printView.focusAt", { times: report.focus.times.map(clock).join(", ") })}
                  </span>
                ) : null}
              </p>
              <p className="text-slate-700">{report.focus.why}</p>
              {report.focus.drill ? <p className="mt-1">
                  <strong>{t("report.printView.practice")}</strong> {report.focus.drill}
                </p> : null}
            </div>
          </Section>
        ) : null}

        {report.pointsLost?.length ? (
          <Section title={t("report.points.title", { total: 100 - report.overallScore })}>
            <table className="w-full border-collapse">
              <tbody>
                {report.pointsLost.map((p, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1">{p.label}</td>
                    <td className="w-44 py-1">
                      <div className="h-2 rounded bg-slate-100">
                        <div
                          className={`h-2 rounded ${p.code ? "bg-rose-600" : "bg-slate-400"}`}
                          style={{ width: `${(p.points / Math.max(...report.pointsLost.map((x) => x.points))) * 100}%` }}
                        />
                      </div>
                    </td>
                    <td className="w-12 py-1 text-right font-semibold tabular-nums">−{p.points}</td>
                    <td className="w-28 py-1 pl-3 font-mono text-xs text-slate-500">{(p.times ?? []).map(clock).join(" ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.keyMetrics?.length ? (
              <p className="mt-2 text-xs text-slate-600">
                {report.keyMetrics
                  .map((m) =>
                    t("report.printView.metricLine", {
                      mark: m.ok ? "✓" : "✕",
                      label: m.label,
                      value: m.display,
                      target: m.target,
                    }),
                  )
                  .join("   ")}
              </p>
            ) : null}
          </Section>
        ) : null}

        <Section title={t("report.printView.dimensions")}>
          <table className="w-full border-collapse">
            <tbody>
              {report.dimensions.map((d) => (
                <tr key={d.name} className="border-b border-slate-100">
                  <td className="w-36 py-1.5 font-semibold">{d.name}</td>
                  <td className="w-40 py-1.5">
                    <div className="h-2 rounded bg-slate-100">
                      <div className="h-2 rounded bg-brand-600" style={{ width: `${d.score}%` }} />
                    </div>
                  </td>
                  <td className="w-10 py-1.5 text-right font-semibold tabular-nums">{d.score}</td>
                  <td className="py-1.5 pl-4 text-slate-600">{d.explanation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title={t("report.printView.timeline")} keepTogether={false}>
          <table className="w-full border-collapse">
            <tbody>
              {report.timeline.map((e) => {
                const at = seconds(e);
                const still = at != null ? frames?.[at] : null;
                return (
                  <tr key={e.id} className="break-inside-avoid border-b border-slate-100 align-top">
                    {Object.keys(frames ?? {}).length ? (
                      <td className="w-[124px] py-2 pr-3">
                        {still ? (
                          <img src={still} alt={t("report.printView.stillAlt", { time: e.time })} className="w-[120px] rounded border border-slate-200" />
                        ) : null}
                      </td>
                    ) : null}
                    <td className="w-14 py-2 font-mono font-semibold text-brand-700">{at != null ? clock(at) : e.time}</td>
                    <td className="py-2">
                      <p className={`font-semibold ${e.overturned ? "text-slate-400 line-through" : ""}`}>{e.title}</p>
                      {e.detail ? <p className="text-slate-600">{e.detail}</p> : null}
                      {e.overturned ? <p className="text-xs font-semibold text-emerald-700">{t("report.printView.overturned")}</p> : null}
                    </td>
                    <td className="w-20 py-2 text-right text-xs font-semibold text-slate-500">{t(`report.eventType.${e.type}`, { defaultValue: e.type })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        <div className="grid grid-cols-2 gap-6">
          <Section title={t("report.printView.strengths")}>
            <ul className="list-disc pl-5">
              {report.strengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </Section>
          <Section title={t("report.printView.improvements")}>
            <ul className="list-disc pl-5">
              {report.weaknesses.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </Section>
        </div>

        <Section title={t("report.printView.nextSteps")}>
          <ol className="list-decimal pl-5">
            {(report.suggestionDetails ?? report.suggestions.map((text) => ({ text, times: [] }))).map((item) => (
              <li key={item.text}>
                {item.text}
                {item.times?.length ? (
                  <span className="ml-1 font-mono text-xs text-slate-500">({item.times.map(clock).join(", ")})</span>
                ) : null}
              </li>
            ))}
          </ol>
        </Section>

        {appeals.length ? (
          <Section title={t("report.printView.appeals")}>
            {appeals.map((a) => (
              <div key={a.id} className="mb-3 break-inside-avoid rounded border border-slate-200 p-3">
                <p className="font-semibold">
                  {a.eventTime != null ? `${clock(a.eventTime)} · ` : ""}
                  {t("report.printView.appealLine", {
                    label: a.eventLabel ?? t("report.appeals.wholeReport"),
                    status:
                      a.status === "open"
                        ? t("report.printView.appealStatus.pending")
                        : a.status === "accepted"
                          ? t("report.printView.appealStatus.accepted", {
                              value: `${a.scoreAdjustment > 0 ? "+" : ""}${a.scoreAdjustment}`,
                            })
                          : t("report.printView.appealStatus.rejected"),
                  })}
                </p>
                <p className="text-slate-600">
                  {t("report.printView.studentReason", {
                    reason: t(`report.printView.reasons.${a.reason}`, { defaultValue: a.reason }),
                    message: a.message,
                  })}
                </p>
                {a.decisionNote ? (
                  <p className="text-slate-600">
                    {a.decidedBy}: “{a.decisionNote}”
                  </p>
                ) : null}
              </div>
            ))}
          </Section>
        ) : null}

        {review ? (
          <Section title={t("report.printView.instructorReview")}>
            <p>
              <strong>{review.instructorName}</strong> · {fmtDate(review.completedAt, locale)} ·{" "}
              {t("report.printView.finalScore")} <strong>{review.finalScore}</strong>
              {t("report.printView.aiParen", { score: review.aiScore })}
            </p>
            {review.comment ? <p className="mt-1">{review.comment}</p> : null}
            {review.teachingFocus?.length ? (
              <p className="mt-1 text-slate-600">
                {t("report.printView.teachingFocus", {
                  items: review.teachingFocus.join(t("report.printView.listSeparator")),
                })}
              </p>
            ) : null}
          </Section>
        ) : null}

        {report.uncertainty?.length ? (
          <Section title={t("report.printView.limitations")}>
            <ul className="list-disc pl-5 text-slate-600">
              {report.uncertainty.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </Section>
        ) : null}

        <footer className="mt-8 border-t border-slate-200 pt-2 text-[11px] text-slate-400">
          {t("report.printView.footer", {
            date: fmtDate(new Date().toISOString(), locale),
            id: report.meta?.sessionId,
          })}
        </footer>
      </article>
    </div>
  );
}
