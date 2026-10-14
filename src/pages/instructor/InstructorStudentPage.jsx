import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client.js";
import { STATUS_LABELS } from "../../api/sessionStatus.js";
import LineChart from "../../components/charts/LineChart.jsx";
import StatTile from "../../components/charts/StatTile.jsx";
import TrainingActivityCalendar from "../../components/TrainingActivityCalendar";
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
        <p className="py-16 text-center text-sm text-slate-500">Loading student…</p>
      </InstructorShell>
    );
  }

  const { student, stats } = d;
  const openReport = (p) => navigate(reportLink(p.key));
  const series = d.scoreSeries.map((s) => ({
    key: s.sessionId,
    value: s.score,
    label: formatDate(s.recordedAt),
    detail: s.finalScore != null ? `${s.taskName} · confirmed ${s.finalScore}` : s.taskName,
  }));

  return (
    <InstructorShell>
      <Link
        to={student.cohort ? `/instructor?cohort=${encodeURIComponent(student.cohort.id)}` : "/instructor"}
        className="link-brand text-sm"
      >
        ← {student.cohort ? student.cohort.name : "Overview"}
      </Link>

      <header className="surface-card mt-3 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{student.name}</h1>
            <p className="text-sm text-slate-500">{student.email}</p>
            <p className="mt-2 text-sm text-slate-700">
              {student.cohort ? `${student.cohort.name} · ${student.cohort.courseName}` : "No cohort"}
            </p>
            <p className="text-sm text-slate-600">
              Current task: <span className="font-medium text-slate-800">{student.currentTask ?? "—"}</span> · Focus:{" "}
              <span className="font-medium text-slate-800">{student.trainingFocus ?? "—"}</span>
            </p>
          </div>
          <p className="text-sm text-slate-600">Last active: {relativeDays(stats.daysSinceActive)}</p>
        </div>
        {d.attention.length ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {d.attention.map((a, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-1.5 text-sm">
                <SeverityBadge severity={a.severity} />
                <span className="text-slate-700">{a.message}</span>
                {a.sessionId ? (
                  <Link to={reportLink(a.sessionId)} className="link-brand text-xs">
                    Open
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Latest score"
          value={stats.latestScore}
          delta={stats.recentChange}
          deltaLabel="last 3 vs previous 3"
          hint="No reports yet"
        />
        <StatTile label="Reports" value={stats.totalReports} hint={`${stats.sessions30d} sessions in 30 days`} />
        <StatTile label="Weakest dimension" value={<span className="text-xl">{stats.weakestDimension ?? "—"}</span>} hint="Average of last 5 reports" />
        <StatTile
          label="Waiting on you"
          value={stats.pendingReviews + stats.openClarifications}
          hint={`${stats.pendingReviews} to review · ${stats.openClarifications} question(s)`}
        />
      </div>

      <section className="surface-card mt-6 p-6">
        <h2 className="text-lg font-semibold text-slate-900">Overall score by session</h2>
        <p className="text-sm text-slate-600">AI score per report. Click a point to open that report.</p>
        <div className="mt-4">
          {series.length ? (
            <LineChart points={series} ariaLabel={`${student.name} overall score by session`} onSelect={openReport} />
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">No reports yet.</p>
          )}
        </div>
      </section>

      {series.length ? (
        <section className="surface-card mt-6 p-6">
          <h2 className="text-lg font-semibold text-slate-900">Dimensions over time</h2>
          <p className="text-sm text-slate-600">One panel per dimension, same 30–100 scale.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {d.dimensions.map((dim) => {
              const pts = d.scoreSeries
                .filter((s) => s.dimensions[dim] != null)
                .map((s) => ({
                  key: s.sessionId,
                  value: s.dimensions[dim],
                  label: formatDate(s.recordedAt),
                  detail: s.taskName,
                }));
              const avg = stats.dimensionAverages[dim];
              return (
                <div key={dim} className="rounded-xl border border-slate-100 p-3">
                  <p className="text-sm font-semibold text-slate-800">{dim}</p>
                  <p className="text-xs text-slate-500">Recent avg {avg != null ? Math.round(avg) : "—"}</p>
                  {pts.length ? (
                    <LineChart points={pts} height={90} compact ariaLabel={`${dim} score by session`} valueLabel={dim} onSelect={openReport} />
                  ) : (
                    <p className="py-6 text-center text-xs text-slate-400">No data</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="surface-card mt-6 p-6">
        <h2 className="text-lg font-semibold text-slate-900">Sessions</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3 pr-4">Task</th>
                <th className="pb-3 pr-4">Score</th>
                <th className="pb-3 pr-4">Review</th>
                <th className="pb-3 pr-4">Student response</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody>
              {d.sessions.map((s) => (
                <tr key={s.sessionId} className="border-b border-slate-100 hover:bg-brand-50/50">
                  <td className="py-3 pr-4 text-slate-700">{formatDate(s.recordedAt)}</td>
                  <td className="py-3 pr-4 font-medium text-slate-900">{s.taskName}</td>
                  <td className="py-3 pr-4 tabular-nums">
                    {s.score == null ? (
                      <span className="text-xs text-slate-500" title={s.error ?? undefined}>
                        {STATUS_LABELS[s.status] ?? s.status}
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
                        {s.reviewState === "completed" && s.feedbackState !== "clarify_open" ? "Open" : "Review"}
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!d.sessions.length ? <p className="py-6 text-center text-sm text-slate-500">No sessions yet.</p> : null}
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
