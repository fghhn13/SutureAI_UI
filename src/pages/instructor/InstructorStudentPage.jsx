import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client.js";
import LineChart from "../../components/charts/LineChart.jsx";
import StatTile from "../../components/charts/StatTile.jsx";
import TrainingActivityCalendar from "../../components/TrainingActivityCalendar";
import { attentionText, dimensionName, statusLabel, taskName, useI18n } from "../../i18n/index.js";
import {
  FeedbackStateBadge,
  InstructorShell,
  LoadError,
  ReviewStateBadge,
  SeverityBadge,
  formatDate,
  relativeDays,
  reportLink,
} from "./shared.jsx";

export default function InstructorStudentPage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    api(`/instructor/students/${encodeURIComponent(studentId)}`)
      .then(setD)
      .catch((e) => setError(e.message));
  }, [studentId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <InstructorShell>
        <LoadError message={error} onRetry={load} />
      </InstructorShell>
    );
  }
  if (!d) {
    return (
      <InstructorShell>
        <p className="py-16 text-center text-sm text-slate-500">{t("instructor.student.loading")}</p>
      </InstructorShell>
    );
  }

  const { student, stats } = d;
  const openReport = (p) => navigate(reportLink(p.key));
  const series = d.scoreSeries.map((s) => ({
    key: s.sessionId,
    value: s.score,
    label: formatDate(s.recordedAt),
    detail:
      s.finalScore != null
        ? t("instructor.student.confirmed", { task: taskName(t, s.taskName), score: s.finalScore })
        : taskName(t, s.taskName),
  }));

  return (
    <InstructorShell>
      <Link
        to={student.cohort ? `/instructor?cohort=${encodeURIComponent(student.cohort.id)}` : "/instructor"}
        className="link-brand text-sm"
      >
        ← {student.cohort ? student.cohort.name : t("instructor.student.overview")}
      </Link>

      <header className="surface-card relative mt-3 overflow-hidden p-6">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-brand-500" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="title-display text-3xl">{student.name}</h1>
            <p className="text-sm text-slate-500">{student.email}</p>
            <p className="mt-2 text-sm text-slate-700">
              {student.cohort ? `${student.cohort.name} · ${student.cohort.courseName}` : t("instructor.student.noCohort")}
            </p>
            <p className="text-sm text-slate-600">
              {t("instructor.student.currentTask")}{" "}
              <span className="font-medium text-slate-800">{taskName(t, student.currentTask)}</span> ·{" "}
              {t("instructor.student.focus")}{" "}
              <span className="font-medium text-slate-800">{student.trainingFocus ?? "—"}</span>
            </p>
          </div>
          <p className="text-sm text-slate-600">
            {t("instructor.student.lastActive", { when: relativeDays(t, stats.daysSinceActive) })}
          </p>
        </div>
        {d.attention.length ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {d.attention.map((a, i) => (
              <li key={i} className="flex items-center gap-2 border-b border-line py-2 text-sm last:border-0">
                <SeverityBadge severity={a.severity} />
                <span className="text-slate-700">{attentionText(t, a)}</span>
                {a.sessionId ? (
                  <Link to={reportLink(a.sessionId)} className="link-brand text-xs">
                    {t("instructor.student.open")}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={t("instructor.student.latestScore")}
          value={stats.latestScore}
          delta={stats.recentChange}
          deltaLabel={t("instructor.student.latestScoreDelta")}
          hint={t("instructor.student.noReports")}
        />
        <StatTile
          label={t("instructor.student.reports")}
          value={stats.totalReports}
          hint={t("instructor.student.sessions30d", { count: stats.sessions30d })}
        />
        <StatTile
          label={t("instructor.student.weakest")}
          value={<span className="text-xl">{dimensionName(t, stats.weakestDimension)}</span>}
          hint={t("instructor.student.weakestHint")}
        />
        <StatTile
          label={t("instructor.student.waiting")}
          value={stats.pendingReviews + stats.openAppeals}
          hint={t("instructor.student.waitingHint", {
            pending: stats.pendingReviews,
            appeals: t("instructor.counts.appeals", { count: stats.openAppeals }),
          })}
        />
      </div>

      <section className="surface-card mt-6 p-6">
        <h2 className="section-title">{t("instructor.student.scoreTitle")}</h2>
        <p className="text-sm text-slate-600">{t("instructor.student.scoreSubtitle")}</p>
        <div className="mt-4">
          {series.length ? (
            <LineChart points={series} ariaLabel={t("instructor.student.scoreAria", { name: student.name })} onSelect={openReport} />
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">{t("instructor.student.noReportsYet")}</p>
          )}
        </div>
      </section>

      {series.length ? (
        <section className="surface-card mt-6 p-6">
          <h2 className="section-title">{t("instructor.student.dimsTitle")}</h2>
          <p className="text-sm text-slate-600">{t("instructor.student.dimsSubtitle")}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {d.dimensions.map((dim) => {
              const pts = d.scoreSeries
                .filter((s) => s.dimensions[dim] != null)
                .map((s) => ({
                  key: s.sessionId,
                  value: s.dimensions[dim],
                  label: formatDate(s.recordedAt),
                  detail: taskName(t, s.taskName),
                }));
              const avg = stats.dimensionAverages[dim];
              const dimLabel = dimensionName(t, dim);
              return (
                <div key={dim} className="rounded-md border border-line p-3">
                  <p className="text-sm font-semibold text-slate-800">{dimLabel}</p>
                  <p className="text-xs text-slate-500">
                    {t("instructor.student.recentAvg", { value: avg != null ? Math.round(avg) : "—" })}
                  </p>
                  {pts.length ? (
                    <LineChart
                      points={pts}
                      height={90}
                      compact
                      ariaLabel={t("instructor.student.dimAria", { dimension: dimLabel })}
                      valueLabel={dimLabel}
                      onSelect={openReport}
                    />
                  ) : (
                    <p className="py-6 text-center text-xs text-slate-400">{t("instructor.student.noData")}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="surface-card mt-6 p-6">
        <h2 className="section-title">{t("instructor.student.sessionsTitle")}</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-mist text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                <th className="pb-3 pr-4">{t("instructor.student.columns.date")}</th>
                <th className="pb-3 pr-4">{t("instructor.student.columns.task")}</th>
                <th className="pb-3 pr-4">{t("instructor.student.columns.score")}</th>
                <th className="pb-3 pr-4">{t("instructor.student.columns.review")}</th>
                <th className="pb-3 pr-4">{t("instructor.student.columns.response")}</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody>
              {d.sessions.map((s) => (
                <tr key={s.sessionId} className="border-b border-slate-100 hover:bg-paper">
                  <td className="py-3 pr-4 text-slate-700">{formatDate(s.recordedAt)}</td>
                  <td className="py-3 pr-4 font-medium text-ink">{taskName(t, s.taskName)}</td>
                  <td className="py-3 pr-4 tabular-nums">
                    {s.score == null ? (
                      <span className="text-xs text-slate-500" title={s.error ?? undefined}>
                        {statusLabel(t, s.status)}
                      </span>
                    ) : s.finalScore != null && s.finalScore !== s.score ? (
                      <span>
                        <span className="text-slate-400 line-through">{s.score}</span>{" "}
                        <span className="font-semibold">{s.finalScore}</span>
                      </span>
                    ) : (
                      <span className="font-semibold">{s.score}</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">{s.score != null ? <ReviewStateBadge state={s.reviewState} /> : null}</td>
                  <td className="py-3 pr-4">
                    <FeedbackStateBadge state={s.feedbackState} />
                  </td>
                  <td className="py-3 text-right">
                    {s.score != null ? (
                      <Link to={reportLink(s.sessionId)} className="link-brand text-sm">
                        {s.reviewState === "completed" && s.feedbackState !== "appeal_open" ? t("common.open") : t("common.review")}
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!d.sessions.length ? <p className="py-6 text-center text-sm text-slate-500">{t("instructor.student.noSessions")}</p> : null}
        </div>
      </section>

      <div className="mt-6">
        <TrainingActivityCalendar
          activityByDate={d.trainingActivityCalendar.activityByDate}
          years={d.trainingActivityCalendar.years}
          defaultYear={d.trainingActivityCalendar.defaultYear}
        />
      </div>
    </InstructorShell>
  );
}
