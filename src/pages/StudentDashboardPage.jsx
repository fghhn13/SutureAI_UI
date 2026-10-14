import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import DevUserSwitch from "../components/DevUserSwitch";
import TrainingActivityCalendar from "../components/TrainingActivityCalendar";
import { STATUS_LABELS } from "../api/sessionStatus.js";

/** Served from `public/picture/` so `<img src>` always resolves (incl. subpath `base`). */
const AVATAR_SRC = `${(import.meta.env.BASE_URL ?? "/").replace(/\/?$/, "/")}picture/avatar-placeholder.svg`;

function reportSearch(sessionId) {
  return `?session=${encodeURIComponent(sessionId)}`;
}

function trainPath(taskId) {
  return taskId ? `/train?task=${encodeURIComponent(taskId)}` : "/train";
}

export default function StudentDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [D, setD] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    api("/dashboard")
      .then(setD)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard"));
  }, []);

  useEffect(() => {
    load();
  }, [load, user.id]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
          <p className="font-semibold">Could not load your dashboard</p>
          <p className="mt-2 text-sm">{error}</p>
          <button type="button" onClick={load} className="btn-primary mt-4 px-4 py-2 text-sm">
            Retry
          </button>
        </div>
      </main>
    );
  }

  if (!D) {
    return <p className="py-24 text-center text-sm text-slate-500">Loading dashboard…</p>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-brand-50/20">
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        {/* 1. Welcome */}
        <section className="surface-card surface-card-lift p-6 md:p-8 motion-safe:animate-fade-in-up">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="group/avatar flex items-start gap-4">
              <div className="relative shrink-0 transition-transform duration-300 ease-smooth motion-safe:group-hover/avatar:scale-[1.04]">
                <img
                  src={AVATAR_SRC}
                  alt={`${D.studentName} — profile photo (prototype)`}
                  className="h-16 w-16 rounded-full border-2 border-white bg-slate-100 object-contain object-center p-1 shadow-md ring-2 ring-slate-200/90 ring-offset-2 ring-offset-white transition-[box-shadow] duration-300 group-hover/avatar:ring-brand-200 md:h-[5.25rem] md:w-[5.25rem]"
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-wide text-brand-700">SutureAI</p>
                <h1 className="mt-1 text-2xl font-bold text-slate-900">
                  Hello, {D.studentName}
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  <span className="font-medium text-slate-800">Course: </span>
                  {D.courseName}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-800">Training focus: </span>
                  {D.trainingFocus}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="order-last flex flex-wrap items-center gap-2 sm:order-first">
                <span className="text-sm text-slate-600" title={user.email}>
                  Signed in as <span className="font-medium text-slate-800">{user.displayName}</span>
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-all duration-200 hover:bg-slate-50 active:scale-[0.98]"
                >
                  Log out
                </button>
              </div>
              <Link
                to={trainPath(D.currentTask?.id)}
                className="btn-primary inline-flex items-center justify-center"
              >
                Start training
              </Link>
              {D.lastReport ? (
                <Link
                  to={{ pathname: "/report", search: reportSearch(D.lastReport.sessionId) }}
                  className="btn-secondary inline-flex items-center justify-center"
                >
                  Open latest report
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        {D.inProgress.length > 0 ? (
          <section className="mt-6 rounded-2xl border border-brand-200 bg-brand-50/60 p-5 motion-safe:animate-fade-in-up">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-700">
              Recordings in progress
            </h2>
            <ul className="mt-3 space-y-2">
              {D.inProgress.map((s) => (
                <li
                  key={s.sessionId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white bg-white px-3 py-2 text-sm shadow-sm"
                >
                  <span className="font-medium text-slate-900">{s.taskName}</span>
                  <span className="text-slate-500">{STATUS_LABELS[s.status] ?? s.status}</span>
                  <Link to={`/train/${s.sessionId}`} className="link-brand text-sm">
                    {s.status === "created" ? "Continue upload" : s.status === "failed" ? "Retry" : "View progress"}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* 2. Current task + Last report */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2 motion-safe:animate-fade-in-up motion-safe:[animation-delay:70ms]">
          <section className="surface-card surface-card-lift p-6">
            <h2 className="text-lg font-semibold text-slate-900">Current training task</h2>
            <p className="mt-1 text-sm text-slate-600">
              What you are expected to complete next in this course.
            </p>
            {D.currentTask ? (
            <>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-2">
                <span className="text-slate-500">Task</span>
                <span className="font-medium text-slate-900">{D.currentTask.name}</span>
              </div>
              <div className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-2">
                <span className="text-slate-500">Status</span>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  {D.currentTask.status}
                </span>
              </div>
              <div className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-2">
                <span className="text-slate-500">Due</span>
                <span className="text-slate-800">{D.currentTask.dueDate}</span>
              </div>
              <div className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-2">
                <span className="text-slate-500">Estimated duration</span>
                <span className="text-slate-800">{D.currentTask.estimatedDuration}</span>
              </div>
              <div>
                <p className="text-slate-500">Score dimensions</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {D.currentTask.dimensions.map((d) => (
                    <li
                      key={d}
                      className="rounded-md border border-brand-100 bg-brand-50 px-2 py-1 text-xs font-medium text-brand-800 transition-colors duration-200 hover:border-brand-200 hover:bg-brand-100"
                    >
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to={trainPath(D.currentTask.id)} className="btn-primary inline-flex px-4 py-2 text-sm">
                Start this task
              </Link>
            </div>
            </>
            ) : (
              <p className="mt-4 text-sm text-slate-600">No task assigned yet.</p>
            )}
          </section>

          <section className="surface-card surface-card-lift p-6">
            <h2 className="text-lg font-semibold text-slate-900">Latest report snapshot</h2>
            <p className="mt-1 text-sm text-slate-600">Your most recent session at a glance.</p>
            {D.lastReport ? (
            <>
            <div className="mt-4 space-y-2 text-sm">
              <p>
                <span className="text-slate-500">Task: </span>
                <span className="font-medium text-slate-900">{D.lastReport.taskName}</span>
              </p>
              <p>
                <span className="text-slate-500">Score: </span>
                <span className="text-lg font-bold text-brand-700">
                  {D.lastReport.score}
                </span>
                <span className="text-slate-500"> / 100</span>
              </p>
              <p>
                <span className="text-slate-500">Reliability: </span>
                {D.lastReport.reliability}
              </p>
              <p>
                <span className="text-slate-500">Main strength: </span>
                {D.lastReport.mainStrength}
              </p>
              <p>
                <span className="text-slate-500">Main issue: </span>
                {D.lastReport.mainIssue}
              </p>
              <p>
                <span className="text-slate-500">Instructor review: </span>
                {D.lastReport.instructorStatus}
              </p>
            </div>
            <Link
              to={{ pathname: "/report", search: reportSearch(D.lastReport.sessionId) }}
              className="btn-primary mt-5 inline-flex px-4 py-2 text-sm"
            >
              View full report
            </Link>
            </>
            ) : (
              <p className="mt-4 text-sm text-slate-600">
                No reports yet — record your first session to get one.
              </p>
            )}
          </section>
        </div>

        {/* 3. Trends + Next steps (emphasis) */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-start motion-safe:animate-fade-in-up motion-safe:[animation-delay:100ms]">
          <section className="surface-card surface-card-lift p-6">
            <h2 className="text-lg font-semibold text-slate-900">Recent training trend</h2>
            <p className="mt-1 text-sm text-slate-600">Short-term patterns from your last sessions.</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-800">
              <li className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                <span className="text-slate-500">Sessions</span>
                <span className="font-semibold">{D.trends.sessionsCount}</span>
              </li>
              <li className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                <span className="text-slate-500">Score change</span>
                <span
                  className={`font-semibold ${
                    D.trends.scoreChange.startsWith("-") ? "text-rose-700" : "text-emerald-700"
                  }`}
                >
                  {D.trends.scoreChange}
                </span>
              </li>
              <li className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                <span className="text-slate-500">Completion time</span>
                <span className="font-medium">{D.trends.completionTime}</span>
              </li>
              <li className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                <span className="text-slate-500">Flagged issues</span>
                <span className="font-medium">{D.trends.errorCount}</span>
              </li>
              <li className="flex justify-between gap-4">
                <span className="text-slate-500">Weakest dimension</span>
                <span className="font-semibold text-rose-700">{D.trends.weakestDimension}</span>
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border-2 border-brand-300 bg-gradient-to-b from-brand-50 to-white p-6 shadow-soft ring-1 ring-brand-200 transition-all duration-300 ease-smooth motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-lift motion-safe:hover:ring-brand-300/80">
            <h2 className="text-lg font-semibold text-brand-700">Next practice priorities</h2>
            <p className="mt-1 text-sm text-brand-700">
              Focus on these before your next recording — highest impact for your progress.
            </p>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm font-medium leading-6 text-slate-800">
              {(D.nextSteps.length
                ? D.nextSteps
                : ["Record a session to get personalised practice priorities."]
              ).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
        </div>

        {/* 4. Notifications */}
        <section className="surface-card surface-card-lift mt-6 p-6 motion-safe:animate-fade-in-up motion-safe:[animation-delay:120ms]">
          <h2 className="text-lg font-semibold text-slate-900">Instructor &amp; system notices</h2>
          <p className="mt-1 text-sm text-slate-600">
            Feedback status, new tasks, ready reports, or upload/analysis notes.
          </p>
          <ul className="mt-4 space-y-2">
            {D.notifications.map((note) => (
              <li
                key={note}
                className="flex gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-800 transition-all duration-200 hover:border-brand-100 hover:bg-white hover:shadow-sm"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
                {note}
              </li>
            ))}
          </ul>
        </section>

        {/* Training activity heatmap (above history) */}
        <div className="mt-6 motion-safe:animate-fade-in-up motion-safe:[animation-delay:140ms]">
          <TrainingActivityCalendar
            activityByDate={D.trainingActivityCalendar.activityByDate}
            years={D.trainingActivityCalendar.years}
            defaultYear={D.trainingActivityCalendar.defaultYear}
          />
        </div>

        {/* 5. History */}
        <section className="surface-card surface-card-lift mt-6 p-6 motion-safe:animate-fade-in-up motion-safe:[animation-delay:160ms]">
          <h2 className="text-lg font-semibold text-slate-900">Training history</h2>
          <p className="mt-1 text-sm text-slate-600">Open any session report.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4">Task</th>
                  <th className="pb-3 pr-4">Score</th>
                  <th className="pb-3 pr-4">Confidence</th>
                  <th className="pb-3 pr-4">Instructor</th>
                  <th className="pb-3">Report</th>
                </tr>
              </thead>
              <tbody>
                {D.history.map((row) => (
                  <tr
                    key={row.sessionId}
                    className="border-b border-slate-100 transition-colors duration-150 hover:bg-brand-50/60"
                  >
                    <td className="py-3 pr-4 text-slate-800">{row.date}</td>
                    <td className="py-3 pr-4 font-medium text-slate-900">{row.task}</td>
                    <td className="py-3 pr-4">{row.score}</td>
                    <td className="py-3 pr-4">{row.reliability}</td>
                    <td className="py-3 pr-4">{row.instructorStatus}</td>
                    <td className="py-3">
                      <Link
                        to={{ pathname: "/report", search: reportSearch(row.sessionId) }}
                        className="link-brand text-sm"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <DevUserSwitch />
    </div>
  );
}
