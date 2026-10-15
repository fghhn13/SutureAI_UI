import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../api/client.js";
import {
  FeedbackStateBadge,
  InstructorShell,
  LoadError,
  ReviewStateBadge,
  formatDate,
  reportLink,
} from "./shared.jsx";

const TABS = [
  { key: "pending", label: "To review", empty: "Every report has been reviewed." },
  { key: "appeals", label: "Appeals", empty: "No open appeals." },
  { key: "completed", label: "Reviewed", empty: "No reviewed reports yet." },
];

export default function ReviewQueuePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = TABS.some((t) => t.key === searchParams.get("filter")) ? searchParams.get("filter") : "pending";
  const cohortId = searchParams.get("cohort") ?? "";
  const [cohorts, setCohorts] = useState([]);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api("/instructor/cohorts").then(setCohorts).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setError(null);
    const qs = new URLSearchParams({ filter });
    if (cohortId) qs.set("cohortId", cohortId);
    api(`/instructor/reviews?${qs}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [filter, cohortId]);

  useEffect(() => {
    load();
  }, [load]);

  function update(next) {
    const qs = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([k, v]) => (v ? qs.set(k, v) : qs.delete(k)));
    setSearchParams(qs, { replace: true });
  }

  const tab = TABS.find((t) => t.key === filter);

  return (
    <InstructorShell>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Review queue</h1>
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
          Cohort
          <select
            value={cohortId}
            onChange={(e) => update({ cohort: e.target.value })}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
          >
            <option value="">All my cohorts</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === filter}
            onClick={() => update({ filter: t.key === "pending" ? "" : t.key })}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              t.key === filter ? "bg-brand-600 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {t.label}
            {data ? <span className="ml-2 tabular-nums opacity-80">{data.counts[t.key]}</span> : null}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mt-6">
          <LoadError message={error} onRetry={load} />
        </div>
      ) : !data ? (
        <p className="py-16 text-center text-sm text-slate-500">Loading…</p>
      ) : (
        <section className="surface-card mt-4 p-6">
          {data.items.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="pb-3 pr-4">Student</th>
                    <th className="pb-3 pr-4">Task</th>
                    <th className="pb-3 pr-4">Recorded</th>
                    <th className="pb-3 pr-4">AI score</th>
                    <th className="pb-3 pr-4">Flags</th>
                    <th className="pb-3 pr-4">Review</th>
                    <th className="pb-3 pr-4">Student response</th>
                    <th className="pb-3" />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((i) => (
                    <tr key={i.sessionId} className="border-b border-slate-100 hover:bg-brand-50/50">
                      <td className="py-3 pr-4">
                        <Link to={`/instructor/students/${i.studentId}`} className="font-semibold text-slate-900 hover:underline">
                          {i.studentName}
                        </Link>
                        <p className="text-xs text-slate-500">{i.cohortName}</p>
                      </td>
                      <td className="py-3 pr-4 text-slate-800">{i.taskName}</td>
                      <td className="py-3 pr-4 text-slate-700">{formatDate(i.recordedAt)}</td>
                      <td className="py-3 pr-4 tabular-nums">
                        <span className="font-semibold">{i.aiScore}</span>
                        {i.finalScore != null && i.finalScore !== i.aiScore ? (
                          <span className="text-slate-500"> → {i.finalScore}</span>
                        ) : null}
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-600">
                        {i.issueCount} issue{i.issueCount === 1 ? "" : "s"} · {(i.reliability ?? "—").replace(" Confidence", "")} confidence
                      </td>
                      <td className="py-3 pr-4">
                        <ReviewStateBadge state={i.reviewState} />
                      </td>
                      <td className="py-3 pr-4">
                        <FeedbackStateBadge state={i.feedbackState} />
                      </td>
                      <td className="py-3 text-right">
                        <Link to={reportLink(i.sessionId)} className="btn-primary inline-flex px-3 py-1.5 text-xs">
                          {filter === "appeals" ? "Decide" : filter === "completed" ? "Open" : "Review"}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-slate-600">{tab.empty}</p>
          )}
          {filter !== "completed" && data.items.length ? (
            <p className="mt-3 text-xs text-slate-500">Oldest first.</p>
          ) : null}
        </section>
      )}
    </InstructorShell>
  );
}
