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
  const [finalScore, setFinalScore] = useState(review?.finalScore ?? ai);
  const [comment, setComment] = useState(review?.comment ?? "");
  const [focus, setFocus] = useState(review?.teachingFocus ?? []);
  const [savedMsg, setSavedMsg] = useState(null);
  const { busy, error, run } = useAction();

  useEffect(() => {
    setFinalScore(review?.finalScore ?? ai);
    setComment(review?.comment ?? "");
    setFocus(review?.teachingFocus ?? []);
    setSavedMsg(null);
  }, [report.meta.sessionId]);

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

/** Instructor: the student's accept/clarify response and the reply box. */
export function ClarificationPanel({ report, onUpdated }) {
  const fb = report.feedback;
  const [response, setResponse] = useState("");
  const { busy, error, run } = useAction();

  async function send() {
    const updated = await run(() =>
      api(`/reports/${report.meta.sessionId}/feedback/response`, { method: "POST", body: { response } }),
    );
    if (updated) {
      onUpdated(updated);
      setResponse("");
    }
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Student response</h3>
      {!fb ? (
        <p className="mt-3 text-sm text-slate-600">The student has not responded to this report yet.</p>
      ) : fb.kind === "accept" ? (
        <p className="mt-3 text-sm text-slate-700">
          <span className="font-semibold text-emerald-700">✓ Accepted</span> the feedback on {fmt(fb.createdAt)}.
          {fb.message ? <span className="mt-1 block text-slate-600">“{fb.message}”</span> : null}
        </p>
      ) : (
        <div className="mt-3 space-y-3 text-sm">
          <p>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${fb.status === "open" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-slate-300 bg-slate-50 text-slate-700"}`}>
              {fb.status === "open" ? "Clarification requested" : "Answered"}
            </span>{" "}
            <span className="text-xs text-slate-500">{fmt(fb.createdAt)}</span>
          </p>
          <blockquote className="rounded-lg border-l-4 border-slate-300 bg-slate-50 px-3 py-2 text-slate-800">{fb.message}</blockquote>
          {fb.referencedClip ? (
            <p className="text-xs text-slate-600">
              Referenced clip: <span className="font-medium">{fb.referencedClip}</span>
            </p>
          ) : null}
          {fb.response ? (
            <div className="rounded-lg bg-indigo-50 px-3 py-2">
              <p className="text-xs text-indigo-700">
                {fb.respondedBy} replied {fmt(fb.respondedAt)}
              </p>
              <p className="mt-1 text-slate-800">{fb.response}</p>
            </div>
          ) : (
            <>
              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Explain what the system saw, and whether you adjusted the score."
                className="h-24 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
              <button type="button" disabled={busy || !response.trim()} onClick={send} className="btn-primary px-4 py-2">
                Send response
              </button>
            </>
          )}
        </div>
      )}
      <ErrorLine error={error} />
    </article>
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

/** Student: accept the report or ask for clarification on a clip. */
export function StudentResponseCard({ report, onUpdated }) {
  const fb = report.feedback;
  const [mode, setMode] = useState(null); // null | "clarify"
  const [message, setMessage] = useState("");
  const [clip, setClip] = useState("");
  const { busy, error, run } = useAction();
  const locked = Boolean(fb?.response);

  async function submit(kind) {
    const updated = await run(() =>
      api(`/reports/${report.meta.sessionId}/feedback`, {
        method: "POST",
        body: { kind, message: kind === "clarify" ? message : "", referencedClip: kind === "clarify" ? clip || null : null },
      }),
    );
    if (updated) {
      onUpdated(updated);
      setMode(null);
    }
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50/80 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Your response</h3>
      {fb && mode == null ? (
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          {fb.kind === "accept" ? (
            <p>
              <span className="font-semibold text-emerald-700">✓ You accepted this feedback</span>{" "}
              <span className="text-xs text-slate-500">{fmt(fb.createdAt)}</span>
            </p>
          ) : (
            <>
              <p className="font-semibold text-slate-800">
                You asked for clarification{" "}
                <span className="text-xs font-normal text-slate-500">{fmt(fb.createdAt)}</span>
              </p>
              <blockquote className="rounded-lg border-l-4 border-slate-300 bg-white px-3 py-2">{fb.message}</blockquote>
              {fb.referencedClip ? <p className="text-xs text-slate-500">Clip: {fb.referencedClip}</p> : null}
              {fb.response ? (
                <div className="rounded-lg bg-indigo-50 px-3 py-2">
                  <p className="text-xs text-indigo-700">{fb.respondedBy} replied {fmt(fb.respondedAt)}</p>
                  <p className="mt-1 text-slate-800">{fb.response}</p>
                </div>
              ) : (
                <p className="text-xs text-amber-800">Waiting for your instructor to respond.</p>
              )}
            </>
          )}
          {!locked ? (
            <button type="button" onClick={() => setMode(fb.kind === "clarify" ? "clarify" : "choose")} className="link-brand text-xs">
              Change response
            </button>
          ) : null}
        </div>
      ) : mode === "clarify" ? (
        <div className="mt-3 space-y-3 text-sm">
          <label className="block">
            <span className="text-slate-700">Which moment?</span>
            <select value={clip} onChange={(e) => setClip(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
              <option value="">Whole report</option>
              {(report.clips ?? []).map((c) => (
                <option key={c.id} value={`${c.time} - ${c.label}`}>
                  {c.time} · {c.label}
                </option>
              ))}
            </select>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What do you think was misread, and why?"
            className="h-24 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2"
          />
          <div className="flex gap-2">
            <button type="button" disabled={busy || !message.trim()} onClick={() => submit("clarify")} className="btn-primary px-4 py-2">
              Send to instructor
            </button>
            <button type="button" onClick={() => setMode(null)} className="btn-secondary px-4 py-2">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            If you think a segment was misinterpreted, ask your instructor to take another look.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => submit("accept")} className="btn-primary px-4 py-2">
              Accept feedback
            </button>
            <button type="button" onClick={() => setMode("clarify")} className="btn-secondary px-4 py-2">
              Request clarification
            </button>
          </div>
        </>
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
