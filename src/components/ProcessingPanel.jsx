import { useEffect, useRef, useState } from "react";
import { STAGES, activeStageIndex } from "../api/sessionStatus.js";

const FEED_LINES = 6;

function fmtClock(s) {
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

/** Fill a detail template with plausible values for this recording. */
function fillTemplate(text, { progress, durationS, sizeBytes }) {
  const frames = Math.max(300, Math.round((durationS || 116) * 30));
  const frame = Math.min(frames, Math.round(frames * (0.08 + 0.9 * progress) + Math.random() * 40));
  return text
    .replace("{frames}", frames.toLocaleString("en-US"))
    .replace("{frame}", frame.toLocaleString("en-US"))
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
    const ctx = { progress: serverProgress, durationS: session.video?.durationS, sizeBytes: session.video?.sizeBytes };
    const push = (text, kind = "work") =>
      setFeed((f) => [...f, { id: `${Date.now()}-${Math.random()}`, text, kind }].slice(-FEED_LINES));

    if (lastStageRef.current !== stageIdx) {
      for (let i = lastStageRef.current; i < stageIdx; i += 1) {
        if (STAGES[i]) push(`${STAGES[i].label} — done`, "done");
      }
      lastStageRef.current = stageIdx;
    }
    let n = 0;
    const tick = () => {
      push(fillTemplate(stage.details[n % stage.details.length], ctx));
      n += 1;
    };
    tick();
    const id = setInterval(tick, 650 + Math.random() * 450);
    return () => clearInterval(id);
  }, [stageIdx, running]);

  const elapsed = (Date.now() - startRef.current.t) / 1000;
  const gained = shown - startRef.current.p;
  const eta = running && gained > 0.04 ? (elapsed / gained) * (1 - shown) : null;
  const pct = Math.round(shown * 100);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div>
        <div className="flex items-end justify-between gap-4">
          <p className="text-5xl font-semibold tabular-nums text-slate-900">
            {pct}
            <span className="text-2xl text-slate-400">%</span>
          </p>
          <p className="pb-1 text-sm text-slate-500">
            {session.status === "ready"
              ? "Complete"
              : session.status === "failed"
                ? "Stopped"
                : eta != null
                  ? `About ${Math.max(1, Math.round(eta))} s left`
                  : "Estimating time…"}
          </p>
        </div>
        <div
          className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-150 ${
              session.status === "failed" ? "bg-rose-500" : "bg-brand-600"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <ol className="mt-6 space-y-2">
          {STAGES.map((s, i) => {
            const done = i < stageIdx;
            const active = i === stageIdx && running;
            const failedHere = i === stageIdx && session.status === "failed";
            return (
              <li key={s.key} className="flex items-center gap-3 text-sm">
                <span
                  aria-hidden
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    done
                      ? "bg-emerald-600 text-white"
                      : active
                        ? "border-2 border-brand-500 border-t-transparent motion-safe:animate-spin"
                        : failedHere
                          ? "bg-rose-600 text-white"
                          : "border border-slate-300"
                  }`}
                >
                  {done ? "✓" : failedHere ? "!" : ""}
                </span>
                <span
                  className={
                    done ? "text-slate-700" : active ? "font-semibold text-brand-700" : failedHere ? "font-semibold text-rose-700" : "text-slate-400"
                  }
                >
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="flex min-h-[220px] flex-col rounded-xl bg-slate-900 p-4 font-mono text-[12.5px] leading-6 text-slate-300">
        <p className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">Activity</p>
        <ul className="flex-1 space-y-0.5" aria-live="polite">
          {feed.map((line, i) => {
            const latest = i === feed.length - 1 && running;
            return (
              <li
                key={line.id}
                className={`flex gap-2 motion-safe:animate-fade-in-up-fast ${
                  latest ? "text-white" : line.kind === "done" ? "text-emerald-400" : "text-slate-400"
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
            <li className="flex gap-2 text-emerald-400">
              <span className="w-3">✓</span>
              <span>Report ready.</span>
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
