import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { STAGES, activeStageIndex } from "../api/sessionStatus.js";
import { intlLocale, useI18n } from "../i18n/index.js";

const FEED_LINES = 6;
const STITCHES = 20;

/**
 * Progress drawn as an incision being sutured: the cut fills in blue as work advances and a
 * stitch crosses it at every 5%. Stitch marks pop in as they are passed.
 */
function StitchProgress({ pct, failed }) {
  const done = failed ? "#a24e36" : "#4f69c2";
  const reached = Math.floor((pct / 100) * STITCHES);
  return (
    <svg viewBox="0 0 400 28" preserveAspectRatio="none" className="h-7 w-full" aria-hidden="true">
      <line x1="2" y1="14" x2="398" y2="14" stroke="#d9d3c6" strokeWidth="1.5" strokeDasharray="3 4" />
      <line
        x1="2"
        y1="14"
        x2={2 + (396 * pct) / 100}
        y2="14"
        stroke={done}
        strokeWidth="2"
        strokeLinecap="round"
        className="transition-[x2] duration-150"
      />
      {Array.from({ length: STITCHES }, (_, i) => {
        const x = 2 + (396 * (i + 0.5)) / STITCHES;
        const on = i < reached;
        return (
          <line
            key={i}
            x1={x - 3}
            y1="6"
            x2={x + 3}
            y2="22"
            stroke={on ? done : "#e8e3d8"}
            strokeWidth={on ? 2 : 1.5}
            strokeLinecap="round"
            style={{
              transformOrigin: `${x}px 14px`,
              transform: on ? "scaleY(1)" : "scaleY(0.55)",
              transition: "transform 300ms cubic-bezier(0.2, 1.4, 0.4, 1), stroke 300ms",
            }}
          />
        );
      })}
    </svg>
  );
}

function fmtClock(s) {
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

/** Fill a detail template with plausible values for this recording. */
function fillTemplate(text, { progress, durationS, sizeBytes, locale }) {
  const frames = Math.max(300, Math.round((durationS || 116) * 30));
  const frame = Math.min(frames, Math.round(frames * (0.08 + 0.9 * progress) + Math.random() * 40));
  return text
    .replace("{frames}", frames.toLocaleString(intlLocale(locale)))
    .replace("{frame}", frame.toLocaleString(intlLocale(locale)))
    .replace("{conf}", (0.86 + Math.random() * 0.12).toFixed(2))
    .replace("{hz}", (4 + Math.random() * 3.5).toFixed(1))
    .replace("{mb}", ((sizeBytes || 0) / 1024 / 1024).toFixed(1))
    .replace("{time}", fmtClock(Math.random() * (durationS || 116)));
}

/**
 * Live view of a session being analysed: overall progress with ETA, the stage checklist,
 * and a rolling activity feed so the wait never looks frozen.
 */
export default function ProcessingPanel({ session }) {
  const { t, tRaw, locale } = useI18n();
  const stageLabel = (key) => t(`processing.stages.${key}.label`);
  const serverProgress = session.status === "ready" ? 1 : session.progress ?? 0;
  const stageIdx = activeStageIndex(session);
  const running = !["ready", "failed"].includes(session.status);

  // Displayed progress eases toward the server value and creeps slightly between polls.
  const [shown, setShown] = useState(serverProgress);
  const startRef = useRef({ t: Date.now(), p: serverProgress });
  useEffect(() => {
    const id = setInterval(() => {
      setShown((cur) => {
        if (!running) return serverProgress;
        const target = Math.min(0.99, serverProgress + 0.03);
        const next = cur < serverProgress ? cur + (serverProgress - cur) * 0.35 : cur + 0.0015;
        return Math.min(Math.max(next, cur), target);
      });
    }, 120);
    return () => clearInterval(id);
  }, [serverProgress, running]);

  // Rolling activity feed for the current stage.
  const [feed, setFeed] = useState([]);
  const lastStageRef = useRef(stageIdx);
  useEffect(() => {
    if (!running) return undefined;
    const stage = STAGES[Math.min(stageIdx, STAGES.length - 1)];
    const details = tRaw(`processing.stages.${stage.key}.details`) ?? [];
    const ctx = {
      progress: serverProgress,
      durationS: session.video?.durationS,
      sizeBytes: session.video?.sizeBytes,
      locale,
    };
    const push = (text, kind = "work") =>
      setFeed((f) => [...f, { id: `${Date.now()}-${Math.random()}`, text, kind }].slice(-FEED_LINES));

    if (lastStageRef.current !== stageIdx) {
      for (let i = lastStageRef.current; i < stageIdx; i += 1) {
        if (STAGES[i]) push(t("processing.stageDone", { stage: stageLabel(STAGES[i].key) }), "done");
      }
      lastStageRef.current = stageIdx;
    }
    let n = 0;
    const tick = () => {
      if (details.length) push(fillTemplate(details[n % details.length], ctx));
      n += 1;
    };
    tick();
    const id = setInterval(tick, 650 + Math.random() * 450);
    return () => clearInterval(id);
    // Restarting on a language switch makes new lines appear in the chosen language.
  }, [stageIdx, running, locale]);

  const elapsed = (Date.now() - startRef.current.t) / 1000;
  const gained = shown - startRef.current.p;
  const eta = running && gained > 0.04 ? (elapsed / gained) * (1 - shown) : null;
  const pct = Math.round(shown * 100);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div>
        <div className="flex items-end justify-between gap-4">
          <p className="font-display text-6xl font-bold tabular-nums leading-none text-brand-800">
            {pct}
            <span className="ml-0.5 text-2xl font-semibold text-slate-400">%</span>
          </p>
          <p className="pb-1 text-sm text-slate-500">
            {session.status === "ready"
              ? t("processing.complete")
              : session.status === "failed"
                ? t("processing.stopped")
                : eta != null
                  ? t("processing.eta", { seconds: Math.max(1, Math.round(eta)) })
                  : t("processing.estimating")}
          </p>
        </div>
        <div
          className="mt-4"
          role="progressbar"
          aria-label={t("processing.progressLabel")}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <StitchProgress pct={pct} failed={session.status === "failed"} />
        </div>

        <ol className="mt-6 border-t border-line">
          {STAGES.map((s, i) => {
            const done = i < stageIdx;
            const active = i === stageIdx && running;
            const failedHere = i === stageIdx && session.status === "failed";
            return (
              <li key={s.key} className="flex items-center gap-3 border-b border-line py-2.5 text-sm">
                <span
                  aria-hidden
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    done
                      ? "bg-brand-500 text-white"
                      : active
                        ? "border-[1.5px] border-brand-500 border-t-transparent motion-safe:animate-spin"
                        : failedHere
                          ? "bg-bad text-white"
                          : "border border-mist"
                  }`}
                >
                  {done ? <Check size={12} strokeWidth={3} /> : failedHere ? <X size={12} strokeWidth={3} /> : null}
                </span>
                <span
                  className={
                    done ? "text-ink-soft" : active ? "font-semibold text-brand-700" : failedHere ? "font-semibold text-bad" : "text-slate-400"
                  }
                >
                  {stageLabel(s.key)}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="flex min-h-[220px] flex-col rounded-md bg-brand-900 p-4 font-mono text-[12.5px] leading-6 text-brand-100">
        <p className="mb-2 text-[11px] uppercase tracking-wider text-brand-300">{t("processing.activity")}</p>
        <ul className="flex-1 space-y-0.5" aria-live="polite">
          {feed.map((line, i) => {
            const latest = i === feed.length - 1 && running;
            return (
              <li
                key={line.id}
                className={`flex gap-2 motion-safe:animate-fade-in-up-fast ${
                  latest ? "text-white" : line.kind === "done" ? "text-emerald-300" : "text-brand-200/70"
                }`}
              >
                <span aria-hidden className="w-3 shrink-0">
                  {line.kind === "done" ? "✓" : latest ? "›" : "·"}
                </span>
                <span>{line.text}</span>
              </li>
            );
          })}
          {session.status === "ready" ? (
            <li className="flex gap-2 text-emerald-300">
              <span className="w-3">✓</span>
              <span>{t("processing.reportReady")}</span>
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
