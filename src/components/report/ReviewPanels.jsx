import { useEffect, useState } from "react";
import { api } from "../../api/client.js";
import { formatDateTime, useI18n } from "../../i18n/index.js";

/** Date + time in the active locale; "" for empty/invalid input. */
function useFmt() {
  const { locale } = useI18n();
  return (iso) => formatDateTime(iso, undefined, locale, "");
}

/** Labels: report.review.alignmentValues.<key>. */
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
  const { t: tr } = useI18n();
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
            <button type="button" aria-label={tr("report.review.removeFocus", { focus: f })} onClick={() => onChange(value.filter((x) => x !== f))} className="text-brand-700/70 hover:text-brand-700">
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
          placeholder={tr("report.review.focusPlaceholder")}
          className="min-w-[160px] flex-1 field-input py-1 text-sm"
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
  const { t } = useI18n();
  const fmt = useFmt();
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
      setSavedMsg(complete ? "sent" : "draftSaved");
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
    <article className="rounded-md border border-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="pill-header">{t("report.instructorReview")}</h3>
        <span className="text-xs text-slate-500">
          {completed
            ? t("report.review.sentBy", { date: fmt(review.completedAt), name: review.instructorName })
            : review
              ? t("report.review.draftSavedAt", { date: fmt(review.updatedAt) })
              : t("report.review.notReviewed")}
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-md bg-paper px-3 py-2">
          <p className="text-xs text-slate-500">{t("report.aiScore")}</p>
          <p className="text-2xl font-semibold text-slate-900">{ai}</p>
        </div>
        <label className="text-sm">
          <span className="text-xs text-slate-500">{t("report.finalScore")}</span>
          <input
            type="number"
            min={0}
            max={100}
            value={Number.isNaN(finalScore) ? "" : finalScore}
            onChange={(e) => setFinalScore(e.target.value === "" ? NaN : Number(e.target.value))}
            className="mt-1 w-full field-input py-2 text-lg font-semibold"
          />
        </label>
        <div className="rounded-md bg-paper px-3 py-2">
          <p className="text-xs text-slate-500">{t("report.review.alignment")}</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">
            {scoreValid ? t(`report.review.alignmentValues.${alignmentOf(ai, finalScore)}`) : "—"}
          </p>
        </div>
      </div>

      <label className="mt-4 block text-sm">
        <span className="font-medium text-slate-700">{t("report.review.commentLabel")}</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t("report.review.commentPlaceholder")}
          className="mt-1 h-28 w-full resize-y field-input py-2 text-sm"
        />
      </label>

      <div className="mt-4">
        <p className="text-sm font-medium text-slate-700">{t("report.teachingFocus")}</p>
        <div className="mt-2">
          <FocusChips value={focus} onChange={setFocus} suggestions={suggestions} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {!completed ? (
          <button type="button" disabled={busy || !scoreValid} onClick={() => save(false)} className="btn-secondary px-4 py-2">
            {t("report.saveDraft")}
          </button>
        ) : null}
        <button type="button" disabled={busy || !scoreValid} onClick={() => save(true)} className="btn-primary px-4 py-2">
          {completed ? t("report.review.updateReview") : t("report.completeReview")}
        </button>
        {!scoreValid ? <span className="text-sm text-rose-700">{t("report.review.scoreRange")}</span> : null}
        {savedMsg ? <span className="text-sm text-emerald-700">{t(`report.review.${savedMsg}`)}</span> : null}
      </div>
      <ErrorLine error={error} />
    </article>
  );
}

/** `label` is the English fallback; shown text comes from report.appeals.reasons.<value>. */
export const APPEAL_REASONS = [
  { value: "misdetected", label: "This didn't happen" },
  { value: "occluded", label: "The view was blocked" },
  { value: "timing", label: "Intentional / wrong moment" },
  { value: "other", label: "Other" },
];

function clock(seconds) {
  if (seconds == null) return null;
  const t = Math.round(seconds);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

/** Status chip for an appeal: icon + text, never colour alone. */
export function AppealBadge({ status, adjustment }) {
  const { t } = useI18n();
  const accepted = t("report.appealAccepted");
  const styles = {
    open: ["border-amber-200 bg-amber-50 text-amber-900", "●", t("report.appealPending")],
    accepted: [
      "border-emerald-200 bg-emerald-50 text-emerald-800",
      "✓",
      adjustment
        ? t("report.appeals.acceptedWithAdjustment", {
            label: accepted,
            value: `${adjustment > 0 ? "+" : ""}${adjustment}`,
          })
        : accepted,
    ],
    rejected: ["border-slate-300 bg-slate-50 text-slate-700", "✕", t("report.appealRejected")],
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
  const { t } = useI18n();
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
    <div className="mt-3 border-l-2 border-warn bg-paper p-3 text-sm">
      <p className="font-semibold text-slate-800">
        {eventId ? t("report.appealFinding") : t("report.appeals.appealWhole")}
      </p>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={t("report.appealReason")}>
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
            {t(`report.appeals.reasons.${r.value}`, { defaultValue: r.label })}
          </button>
        ))}
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t("report.appeals.formPlaceholder")}
        className="mt-2 h-20 w-full resize-y field-input py-2"
      />
      <div className="mt-2 flex gap-2">
        <button type="button" disabled={busy || !message.trim()} onClick={submit} className="btn-primary px-4 py-1.5">
          {t("report.appeals.send")}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary px-4 py-1.5">
          {t("report.appeals.cancel")}
        </button>
      </div>
      <ErrorLine error={error} />
    </div>
  );
}

/** Instructor: decide each appeal (accept → event overturned + score adjusted, or reject). */
export function AppealsPanel({ report, onUpdated, onSeek }) {
  const { t } = useI18n();
  const fmt = useFmt();
  const appeals = [...(report.appeals ?? [])].sort(
    (a, b) => (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1),
  );
  const fb = report.feedback;

  return (
    <article className="tile p-5">
      <h3 className="pill-header">{t("report.appeals.panelTitle")}</h3>
      {fb?.kind === "accept" ? (
        <p className="mt-3 text-sm text-slate-700">
          <span className="font-semibold text-emerald-700">{t("report.appeals.acceptedBadge")}</span>
          {t("report.appeals.acceptedOn", { date: fmt(fb.createdAt) })}
          {fb.message ? <span className="mt-1 block text-slate-600">“{fb.message}”</span> : null}
        </p>
      ) : null}
      {!appeals.length && !fb ? (
        <p className="mt-3 text-sm text-slate-600">{t("report.appeals.noResponse")}</p>
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
  const { t } = useI18n();
  const fmt = useFmt();
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
    <li className="rounded-md border border-line p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {a.eventTime != null && onSeek ? (
          <button
            type="button"
            onClick={() => onSeek(a.eventTime)}
            className="rounded-md border border-brand-200 px-2 py-0.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"
            title={t("report.appeals.playFrom")}
          >
            ▶ {clock(a.eventTime)}
          </button>
        ) : null}
        <span className="font-semibold text-slate-900">{a.eventLabel ?? t("report.appeals.wholeReport")}</span>
        <AppealBadge status={a.status} adjustment={a.scoreAdjustment} />
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {t(`report.appeals.reasons.${a.reason}`, { defaultValue: a.reason })} · {fmt(a.createdAt)}
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
                {d === "accept" ? t("report.appeals.decisionAccept") : t("report.appeals.decisionReject")}
              </label>
            ))}
          </div>
          {decision === "accept" ? (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              {t("report.appeals.scoreAdjustment")}
              <input
                type="number"
                min={-20}
                max={20}
                value={Number.isNaN(adjustment) ? "" : adjustment}
                onChange={(e) => setAdjustment(e.target.value === "" ? NaN : Number(e.target.value))}
                className="w-20 rounded-md border border-slate-300 px-2 py-1"
              />
              <span className="text-xs text-slate-500">
                {t("report.appeals.suggested", {
                  value: `${a.suggestedAdjustment >= 0 ? "+" : ""}${a.suggestedAdjustment}`,
                })}
              </span>
            </label>
          ) : null}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("report.appeals.decisionPlaceholder")}
            className="h-20 w-full resize-y field-input py-2"
          />
          <button
            type="button"
            disabled={busy || !note.trim() || (decision === "accept" && !Number.isInteger(adjustment))}
            onClick={submit}
            className="btn-primary px-4 py-1.5"
          >
            {t("report.appeals.sendDecision")}
          </button>
        </div>
      ) : (
        <div className="mt-2 rounded-md bg-brand-50 px-3 py-2">
          <p className="text-xs text-brand-700">
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
  const { t } = useI18n();
  const fmt = useFmt();
  return (
    <article className="tile-blue p-5">
      <h3 className="pill-header">{t("report.evaluation.title")}</h3>
      {review ? (
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <p>
            <span className="font-medium text-slate-900">{review.instructorName}</span>
            <span className="text-xs text-slate-500"> · {fmt(review.completedAt)}</span>
          </p>
          <p>
            {t("report.evaluation.finalScore")}
            <span className="text-xl font-semibold text-slate-900">{review.finalScore}</span>
            {review.finalScore !== review.aiScore ? (
              <span className="text-slate-500">{t("report.evaluation.aiSuffix", { score: review.aiScore })}</span>
            ) : null}
          </p>
          {review.comment ? <p className="border-b border-brand-100 py-2 leading-6 last:border-0">{review.comment}</p> : null}
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
        <p className="mt-3 text-sm italic text-slate-500">{t("report.evaluation.notYet")}</p>
      )}
    </article>
  );
}

/** Student: accept the report, track appeals, or appeal the report as a whole. */
export function StudentResponseCard({ report, onUpdated }) {
  const { t } = useI18n();
  const fmt = useFmt();
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
    <article className="tile p-5">
      <h3 className="pill-header">{t("report.response.title")}</h3>

      {fb?.kind === "accept" ? (
        <p className="mt-3 text-sm">
          <span className="font-semibold text-emerald-700">{t("report.response.youAccepted")}</span>{" "}
          <span className="text-xs text-slate-500">{fmt(fb.createdAt)}</span>
        </p>
      ) : (
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {t("report.response.intro.before")}
          <strong>{t("report.response.intro.strong")}</strong>
          {t("report.response.intro.after")}
        </p>
      )}

      {appeals.length ? (
        <ul className="mt-3 space-y-2">
          {appeals.map((a) => (
            <li key={a.id} className="rounded-md border border-line bg-white p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                {a.eventTime != null ? (
                  <span className="text-xs font-semibold text-brand-700">{clock(a.eventTime)}</span>
                ) : null}
                <span className="font-medium text-slate-900">{a.eventLabel ?? t("report.appeals.wholeReport")}</span>
                <AppealBadge status={a.status} adjustment={a.scoreAdjustment} />
              </div>
              <p className="mt-1 text-slate-600">“{a.message}”</p>
              {a.status === "open" ? (
                <button type="button" disabled={busy} onClick={() => withdraw(a.id)} className="link-brand mt-1 text-xs">
                  {t("report.response.withdraw")}
                </button>
              ) : (
                <div className="mt-2 rounded-md bg-brand-50 px-3 py-2">
                  <p className="text-xs text-brand-700">
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
              title={openCount ? t("report.response.waitForAppeals") : undefined}
            >
              {t("report.accept")}
            </button>
          ) : null}
          {canAppealMore && !wholeAppealed ? (
            <button type="button" onClick={() => setAppealing(true)} className="btn-secondary px-4 py-2">
              {t("report.appeals.appealWhole")}
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
  const { t } = useI18n();
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
    <article className="tile-dashed p-5">
      <h3 className="pill-header">{t("report.personalNote")}</h3>
      <p className="mt-1 text-xs text-slate-500">{t("report.note.private")}</p>
      <textarea
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setSaved(false);
        }}
        placeholder={t("report.note.placeholder")}
        className="mt-3 h-28 w-full resize-y field-input py-2 text-sm"
      />
      <div className="mt-2 flex items-center gap-3">
        <button type="button" disabled={busy || saved} onClick={save} className="btn-secondary px-4 py-1.5">
          {t("report.note.save")}
        </button>
        <span className="text-xs text-slate-500">{saved ? t("report.note.saved") : t("report.note.unsaved")}</span>
      </div>
      <ErrorLine error={error} />
    </article>
  );
}
