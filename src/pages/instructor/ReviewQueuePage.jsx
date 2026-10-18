import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../api/client.js";
import { reliabilityLabel, taskName, useI18n } from "../../i18n/index.js";
import {
  FeedbackStateBadge,
  InstructorShell,
  LoadError,
  ReviewStateBadge,
  formatDate,
  reportLink,
} from "./shared.jsx";

/** Labels: instructor.queue.tabs.<key>; empty states: instructor.queue.empty.<key>. */
const TABS = [{ key: "pending" }, { key: "appeals" }, { key: "completed" }];

export default function ReviewQueuePage() {
  const { t } = useI18n();
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


  return (
    <InstructorShell>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="title-display text-3xl">{t("instructor.queue.title")}</h1>
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
          {t("instructor.queue.cohort")}
          <select
            value={cohortId}
            onChange={(e) => update({ cohort: e.target.value })}
            className="field-select py-2"
          >
            <option value="">{t("instructor.queue.allCohorts")}</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={tab.key === filter}
            onClick={() => update({ filter: tab.key === "pending" ? "" : tab.key })}
            className={`rounded-md border px-4 py-2 text-sm font-semibold transition-colors ${
              tab.key === filter
                ? "border-brand-500 bg-brand-500 text-white"
                : "border-line bg-white text-ink-soft hover:border-brand-200 hover:text-brand-700"
            }`}
          >
            {t(`instructor.queue.tabs.${tab.key}`)}
            {data ? <span className="ml-2 tabular-nums opacity-80">{data.counts[tab.key]}</span> : null}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mt-6">
          <LoadError message={error} onRetry={load} />
        </div>
      ) : !data ? (
        <p className="py-16 text-center text-sm text-slate-500">{t("instructor.queue.loading")}</p>
      ) : (
        <section className="surface-card mt-4 p-6">
          {data.items.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b border-mist text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                    <th className="pb-3 pr-4">{t("instructor.queue.columns.student")}</th>
                    <th className="pb-3 pr-4">{t("instructor.queue.columns.task")}</th>
                    <th className="pb-3 pr-4">{t("instructor.queue.columns.recorded")}</th>
                    <th className="pb-3 pr-4">{t("instructor.queue.columns.aiScore")}</th>
                    <th className="pb-3 pr-4">{t("instructor.queue.columns.flags")}</th>
                    <th className="pb-3 pr-4">{t("instructor.queue.columns.review")}</th>
                    <th className="pb-3 pr-4">{t("instructor.queue.columns.response")}</th>
                    <th className="pb-3" />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((i) => (
                    <tr key={i.sessionId} className="border-b border-slate-100 hover:bg-paper">
                      <td className="py-3 pr-4">
                        <Link to={`/instructor/students/${i.studentId}`} className="font-semibold text-ink hover:underline">
                          {i.studentName}
                        </Link>
                        <p className="text-xs text-slate-500">{i.cohortName}</p>
                      </td>
                      <td className="py-3 pr-4 text-slate-800">{taskName(t, i.taskName)}</td>
                      <td className="py-3 pr-4 text-slate-700">{formatDate(i.recordedAt)}</td>
                      <td className="py-3 pr-4 tabular-nums">
                        <span className="font-semibold">{i.aiScore}</span>
                        {i.finalScore != null && i.finalScore !== i.aiScore ? (
                          <span className="text-slate-500"> → {i.finalScore}</span>
                        ) : null}
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-600">
                        {t("instructor.counts.issues", { count: i.issueCount })} ·{" "}
                        {t("instructor.queue.confidence", {
                          level: reliabilityLabel(t, (i.reliability ?? "—").replace(" Confidence", "")),
                        })}
                      </td>
                      <td className="py-3 pr-4">
                        <ReviewStateBadge state={i.reviewState} />
                      </td>
                      <td className="py-3 pr-4">
                        <FeedbackStateBadge state={i.feedbackState} />
                      </td>
                      <td className="py-3 text-right">
                        <Link to={reportLink(i.sessionId)} className="btn-primary inline-flex px-3 py-1.5 text-xs">
                          {t(`instructor.queue.actions.${filter}`)}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-slate-600">{t(`instructor.queue.empty.${filter}`)}</p>
          )}
          {filter !== "completed" && data.items.length ? (
            <p className="mt-3 text-xs text-slate-500">{t("instructor.queue.oldestFirst")}</p>
          ) : null}
        </section>
      )}
    </InstructorShell>
  );
}
