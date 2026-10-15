import { useEffect, useState } from "react";
import { api } from "../../api/client.js";

function fmt(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const ALIGNMENT = {
  agree: "Agrees with AI",
  adjusted: "Adjusted (≤10 pts)",
  override: "Override (>10 pts)",
};

function alignmentOf(ai, final) {
  const diff = Math.abs(final - ai);
  return diff === 0 ? "agree" : diff <= 10 ? "adjusted" : "override";
}

function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function run(fn) {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}

function ErrorLine({ error }) {
  return error ? (
    <p className="mt-2 text-sm text-rose-700" role="alert">
      {error}
    </p>
  ) : null;
}

function FocusChips({ value, onChange, suggestions }) {
  const [draft, setDraft] = useState("");
  function add(text) {
    const t = text.trim();
    if (t && !value.includes(t) && value.length < 10) onChange([...value, t]);
    setDraft("");
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {value.map((f) => (
          <span key={f} className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            {f}
            <button type="button" aria-label={`Remove ${f}`} onClick={() => onChange(value.filter((x) => x !== f))} className="text-brand-700/70 hover:text-brand-700">
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            }
          }}
          onBlur={() => draft && add(draft)}
          placeholder="Add focus, press Enter"
          className="min-w-[160px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm"
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {suggestions
          .filter((s) => !value.includes(s))
          .map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:border-brand-300 hover:text-brand-700">
              + {s}
            </button>
          ))}
      </div>
    </div>
  );
}

/** Instructor: score confirmation/adjustment, comment, teaching focus; draft or complete. */
export function InstructorReviewPanel({ report, onUpdated }) {
  const ai = report.meta.aiScore;
  const review = report.review;
  const startScore = review?.finalScore ?? report.scores?.current ?? ai;
  const [finalScore, setFinalScore] = useState(startScore);
  const [comment, setComment] = useState(review?.comment ?? "");
  const [focus, setFocus] = useState(review?.teachingFocus ?? []);
  const [savedMsg, setSavedMsg] = useState(null);
  const { busy, error, run } = useAction();

  useEffect(() => {
    setFinalScore(startScore);
    setComment(review?.comment ?? "");
    setFocus(review?.teachingFocus ?? []);
    setSavedMsg(null);
  }, [report.meta.sessionId]);

  // Until a review exists, follow score changes from decided appeals so that completing
  // the review doesn't silently undo an accepted appeal.
  const current = report.scores?.current;
  useEffect(() => {
    if (!review && current != null) setFinalScore(current);
  }, [current, review]);

  const scoreValid = Number.isInteger(finalScore) && finalScore >= 0 && finalScore <= 100;
  const completed = review?.status === "completed";

  async function save(complete) {
    const updated = await run(() =>
      api(`/reports/${report.meta.sessionId}/review`, {
        method: "PUT",
        body: { finalScore, comment, teachingFocus: focus, complete },
      }),
    );
    if (updated) {
      onUpdated(updated);
      setSavedMsg(complete ? "Review sent to the student." : "Draft saved — not visible to the student yet.");
    }
  }

  const suggestions = [
    report.assessmentHighlights?.practiceFocus,
    ...(report.dimensions ?? []).filter((d) => d.score < 70).map((d) => d.name),
  ]
    .filter(Boolean)
    .map((s) => s.toLowerCase())
    .filter((s, i, a) => a.indexOf(s) === i);

  return (
    <article className="rounded-xl border border-indigo-100 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-700">Instructor review</h3>
        <span className="text-xs text-slate-500">
          {completed
            ? `Sent ${fmt(review.completedAt)} by ${review.instructorName}`
            : review
              ? `Draft saved ${fmt(review.updatedAt)}`
              : "Not reviewed yet"}
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-500">AI score</p>
          <p className="text-2xl font-semibold text-slate-900">{ai}</p>
        </div>
        <label className="text-sm">
          <span className="text-xs text-slate-500">Final score</span>
          <input
            type="number"
            min={0}
            max={100}
            value={Number.isNaN(finalScore) ? "" : finalScore}
            onChange={(e) => setFinalScore(e.target.value === "" ? NaN : Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-lg font-semibold"
          />
        </label>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-500">Alignment</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">
            {scoreValid ? ALIGNMENT[alignmentOf(ai, finalScore)] : "—"}
          </p>
        </div>
      </div>

      <label className="mt-4 block text-sm">
        <span className="font-medium text-slate-700">Comment to the student</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What went well, what to change, and why you adjusted the score (if you did)."
          className="mt-1 h-28 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
      </label>

      <div className="mt-4">
        <p className="text-sm font-medium text-slate-700">Teaching focus</p>
        <div className="mt-2">
          <FocusChips value={focus} onChange={setFocus} suggestions={suggestions} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {!completed ? (
          <button type="button" disabled={busy || !scoreValid} onClick={() => save(false)} className="btn-secondary px-4 py-2">
            Save draft
          </button>
        ) : null}
        <button type="button" disabled={busy || !scoreValid} onClick={() => save(true)} className="btn-primary px-4 py-2">
          {completed ? "Update review" : "Complete review"}
        </button>
        {!scoreValid ? <span className="text-sm text-rose-700">Final score must be 0–100.</span> : null}
        {savedMsg ? <span className="text-sm text-emerald-700">{savedMsg}</span> : null}
      </div>
      <ErrorLine error={error} />
    </article>
  );
}

export const APPEAL_REASONS = [
  { value: "misdetected", label: "This didn't happen" },
  { value: "occluded", label: "The view was blocked" },
  { value: "timing", label: "Intentional / wrong moment" },
  { value: "other", label: "Other" },
];

const REASON_LABEL = Object.fromEntries(APPEAL_REASONS.map((r) => [r.value, r.label]));

function clock(seconds) {
  if (seconds == null) return null;
  const t = Math.round(seconds);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

/** Status chip for an appeal: icon + text, never colour alone. */
export function AppealBadge({ status, adjustment }) {
  const styles = {
    open: ["border-amber-200 bg-amber-50 text-amber-900", "●", "Appeal pending"],
    accepted: [
      "border-emerald-200 bg-emerald-50 text-emerald-800",
      "✓",
      `Appeal accepted${adjustment ? ` · ${adjustment > 0 ? "+" : ""}${adjustment}` : ""}`,
    ],
    rejected: ["border-slate-300 bg-slate-50 text-slate-700", "✕", "Appeal rejected"],
  };
  const [cls, icon, text] = styles[status] ?? styles.open;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>
      <span aria-hidden>{icon}</span>
      {text}
    </span>
  );
}

/** Student: dispute one timeline event (eventId) or, with eventId null, the whole report. */
export function AppealForm({ report, eventId, onUpdated, onCancel }) {
  const [reason, setReason] = useState(eventId ? "misdetected" : "other");
  const [message, setMessage] = useState("");
  const { busy, error, run } = useAction();

  async function submit() {
    const updated = await run(() =>
      api(`/reports/${report.meta.sessionId}/appeals`, {
        method: "POST",
        body: { eventId: eventId ?? null, reason, message },
      }),
    );
    if (updated) onUpdated(updated);
  }

  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm">
      <p className="font-semibold text-slate-800">
        {eventId ? "Appeal this finding" : "Appeal the whole report"}
      </p>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Reason">
        {APPEAL_REASONS.filter((r) => eventId || r.value === "other" || r.value === "occluded").map((r) => (
          <button
            key={r.value}
            type="button"
            role="radio"
            aria-checked={reason === r.value}
            onClick={() => setReason(r.value)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              reason === r.value
                ? "border-brand-500 bg-brand-600 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-brand-300"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Explain what really happened at this moment."
        className="mt-2 h-20 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2"
      />
      <div className="mt-2 flex gap-2">
        <button type="button" disabled={busy || !message.trim()} onClick={submit} className="btn-primary px-4 py-1.5">
          Send appeal
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary px-4 py-1.5">
          Cancel
        </button>
      </div>
      <ErrorLine error={error} />
    </div>
  );
}

/** Instructor: decide each appeal (accept → event overturned + score adjusted, or reject). */
export function AppealsPanel({ report, onUpdated, onSeek }) {
  const appeals = [...(report.appeals ?? [])].sort(
    (a, b) => (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1),
  );
  const fb = report.feedback;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Student appeals</h3>
      {fb?.kind === "accept" ? (
        <p className="mt-3 text-sm text-slate-700">
          <span className="font-semibold text-emerald-700">✓ Accepted</span> the report on {fmt(fb.createdAt)}.
          {fb.message ? <span className="mt-1 block text-slate-600">“{fb.message}”</span> : null}
        </p>
      ) : null}
      {!appeals.length && !fb ? (
        <p className="mt-3 text-sm text-slate-600">The student has not responded to this report yet.</p>
      ) : null}
      <ul className="mt-3 space-y-3">
        {appeals.map((a) => (
          <AppealDecisionItem key={a.id} report={report} appeal={a} onUpdated={onUpdated} onSeek={onSeek} />
        ))}
      </ul>
    </article>
  );
}

function AppealDecisionItem({ report, appeal: a, onUpdated, onSeek }) {
  const [decision, setDecision] = useState("accept");
  const [adjustment, setAdjustment] = useState(a.suggestedAdjustment);
  const [note, setNote] = useState("");
  const { busy, error, run } = useAction();

  async function submit() {
    const updated = await run(() =>
      api(`/reports/${report.meta.sessionId}/appeals/${a.id}/decision`, {
        method: "POST",
        body: { decision, note, scoreAdjustment: decision === "accept" ? adjustment : null },
      }),
    );
    if (updated) onUpdated(updated);
  }

  return (
    <li className="rounded-lg border border-slate-200 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {a.eventTime != null && onSeek ? (
          <button
            type="button"
            onClick={() => onSeek(a.eventTime)}
            className="rounded-md border border-brand-200 px-2 py-0.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"
            title="Play the recording from this moment"
          >
            ▶ {clock(a.eventTime)}
          </button>
        ) : null}
        <span className="font-semibold text-slate-900">{a.eventLabel ?? "Whole report"}</span>
        <AppealBadge status={a.status} adjustment={a.scoreAdjustment} />
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {REASON_LABEL[a.reason] ?? a.reason} · {fmt(a.createdAt)}
      </p>
      <blockquote className="mt-2 rounded-md border-l-4 border-slate-300 bg-slate-50 px-3 py-2 text-slate-800">
        {a.message}
      </blockquote>

      {a.status === "open" ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            {["accept", "reject"].map((d) => (
              <label key={d} className="flex items-center gap-1.5 text-sm">
                <input type="radio" name={`decision-${a.id}`} checked={decision === d} onChange={() => setDecision(d)} />
                {d === "accept" ? "Accept — overturn this finding" : "Reject — keep the finding"}
              </label>
            ))}
          </div>
          {decision === "accept" ? (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              Score adjustment
              <input
                type="number"
                min={-20}
                max={20}
                value={Number.isNaN(adjustment) ? "" : adjustment}
                onChange={(e) => setAdjustment(e.target.value === "" ? NaN : Number(e.target.value))}
                className="w-20 rounded-md border border-slate-300 px-2 py-1"
              />
              <span className="text-xs text-slate-500">suggested {a.suggestedAdjustment >= 0 ? "+" : ""}{a.suggestedAdjustment}</span>
            </label>
          ) : null}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Explain your decision to the student."
            className="h-20 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2"
          />
          <button
            type="button"
            disabled={busy || !note.trim() || (decision === "accept" && !Number.isInteger(adjustment))}
            onClick={submit}
            className="btn-primary px-4 py-1.5"
          >
            Send decision
          </button>
        </div>
      ) : (
        <div className="mt-2 rounded-md bg-indigo-50 px-3 py-2">
          <p className="text-xs text-indigo-700">
            {a.decidedBy} · {fmt(a.decidedAt)}
          </p>
          <p className="mt-1 text-slate-800">{a.decisionNote}</p>
        </div>
      )}
      <ErrorLine error={error} />
    </li>
  );
}

/** Student: the instructor's completed review, if any. */
export function ReviewResultCard({ review }) {
  return (
    <article className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-700">Instructor evaluation</h3>
      {review ? (
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <p>
            <span className="font-medium text-slate-900">{review.instructorName}</span>
            <span className="text-xs text-slate-500"> · {fmt(review.completedAt)}</span>
          </p>
          <p>
            Final score <span className="text-xl font-semibold text-slate-900">{review.finalScore}</span>
            {review.finalScore !== review.aiScore ? <span className="text-slate-500"> (AI: {review.aiScore})</span> : null}
          </p>
          {review.comment ? <p className="rounded-lg bg-white px-3 py-2 leading-6">{review.comment}</p> : null}
          {review.teachingFocus?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {review.teachingFocus.map((f) => (
                <span key={f} className="rounded-full border border-brand-200 bg-white px-2 py-0.5 text-xs font-semibold text-brand-700">
                  {f}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm italic text-slate-500">Your instructor has not reviewed this report yet.</p>
      )}
    </article>
  );
}

/** Student: accept the report, track appeals, or appeal the report as a whole. */
export function StudentResponseCard({ report, onUpdated }) {
  const fb = report.feedback;
  const appeals = report.appeals ?? [];
  const openCount = appeals.filter((a) => a.status === "open").length;
  const canAppealMore = appeals.length < (report.meta.maxAppeals ?? 5);
  const wholeAppealed = appeals.some((a) => a.eventId == null);
  const [appealing, setAppealing] = useState(false);
  const { busy, error, run } = useAction();

  async function accept() {
    const updated = await run(() => api(`/reports/${report.meta.sessionId}/accept`, { method: "POST", body: {} }));
    if (updated) onUpdated(updated);
  }

  async function withdraw(id) {
    const updated = await run(() =>
      api(`/reports/${report.meta.sessionId}/appeals/${id}`, { method: "DELETE" }),
    );
    if (updated) onUpdated(updated);
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50/80 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Your response</h3>

      {fb?.kind === "accept" ? (
        <p className="mt-3 text-sm">
          <span className="font-semibold text-emerald-700">✓ You accepted this report</span>{" "}
          <span className="text-xs text-slate-500">{fmt(fb.createdAt)}</span>
        </p>
      ) : (
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Agree with the report? Accept it. Think a finding is wrong? Use <strong>Appeal</strong> on that
          moment in the timeline — your instructor will review the clip and decide.
        </p>
      )}

      {appeals.length ? (
        <ul className="mt-3 space-y-2">
          {appeals.map((a) => (
            <li key={a.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                {a.eventTime != null ? (
                  <span className="text-xs font-semibold text-brand-700">{clock(a.eventTime)}</span>
                ) : null}
                <span className="font-medium text-slate-900">{a.eventLabel ?? "Whole report"}</span>
                <AppealBadge status={a.status} adjustment={a.scoreAdjustment} />
              </div>
              <p className="mt-1 text-slate-600">“{a.message}”</p>
              {a.status === "open" ? (
                <button type="button" disabled={busy} onClick={() => withdraw(a.id)} className="link-brand mt-1 text-xs">
                  Withdraw
                </button>
              ) : (
                <div className="mt-2 rounded-md bg-indigo-50 px-3 py-2">
                  <p className="text-xs text-indigo-700">
                    {a.decidedBy} · {fmt(a.decidedAt)}
                  </p>
                  <p className="mt-1 text-slate-800">{a.decisionNote}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {appealing ? (
        <AppealForm
          report={report}
          eventId={null}
          onCancel={() => setAppealing(false)}
          onUpdated={(r) => {
            setAppealing(false);
            onUpdated(r);
          }}
        />
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {fb?.kind !== "accept" ? (
            <button
              type="button"
              disabled={busy || openCount > 0}
              onClick={accept}
              className="btn-primary px-4 py-2"
              title={openCount ? "Wait for your open appeals to be decided first" : undefined}
            >
              Accept report
            </button>
          ) : null}
          {canAppealMore && !wholeAppealed ? (
            <button type="button" onClick={() => setAppealing(true)} className="btn-secondary px-4 py-2">
              Appeal the whole report
            </button>
          ) : null}
        </div>
      )}
      <ErrorLine error={error} />
    </article>
  );
}

/** Student: private reflection saved with the report. */
export function PersonalNoteCard({ report, onUpdated }) {
  const [note, setNote] = useState(report.personalNote ?? "");
  const [saved, setSaved] = useState(true);
  const { busy, error, run } = useAction();

  useEffect(() => {
    setNote(report.personalNote ?? "");
    setSaved(true);
  }, [report.meta.sessionId]);

  async function save() {
    const updated = await run(() => api(`/reports/${report.meta.sessionId}/note`, { method: "PUT", body: { note } }));
    if (updated) {
      onUpdated(updated);
      setSaved(true);
    }
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50/80 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Personal note</h3>
      <p className="mt-1 text-xs text-slate-500">Private — your instructor can't see it.</p>
      <textarea
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setSaved(false);
        }}
        placeholder="Write your reflection here..."
        className="mt-3 h-28 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      />
      <div className="mt-2 flex items-center gap-3">
        <button type="button" disabled={busy || saved} onClick={save} className="btn-secondary px-4 py-1.5">
          Save note
        </button>
        <span className="text-xs text-slate-500">{saved ? "Saved" : "Unsaved changes"}</span>
      </div>
      <ErrorLine error={error} />
    </article>
  );
}
