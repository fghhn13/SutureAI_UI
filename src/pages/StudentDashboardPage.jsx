import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import DevUserSwitch from "../components/DevUserSwitch";
import LanguageSwitch from "../components/LanguageSwitch.jsx";
import TrainingActivityCalendar from "../components/TrainingActivityCalendar";
import {
  dimensionName,
  durationLabel,
  notificationText,
  reliabilityLabel,
  reviewStatusLabel,
  statusLabel,
  taskName,
  useI18n,
} from "../i18n/index.js";

/** Served from `public/picture/` so `<img src>` always resolves (incl. subpath `base`). */
const AVATAR_SRC = `${(import.meta.env.BASE_URL ?? "/").replace(/\/?$/, "/")}picture/avatar-placeholder.svg`;

function reportSearch(sessionId) {
  return `?session=${encodeURIComponent(sessionId)}`;
}

function trainPath(taskId) {
  return taskId ? `/train?task=${encodeURIComponent(taskId)}` : "/train";
}

/** "+5 pts over last 5" from the raw trend values (falls back to the server string). */
function scoreChangeText(t, trends) {
  if (trends.scoreDelta == null) return trends.scoreChange;
  const delta = trends.scoreDelta > 0 ? `+${trends.scoreDelta}` : String(trends.scoreDelta);
  return t("dashboard.trends.scoreChangeValue", { delta, count: trends.trendWindow });
}

function completionText(t, trends) {
  const secs = trends.completionSeconds;
  if (!secs) return trends.completionTime;
  return t("dashboard.trends.completionValue", { from: secs[0], to: secs[1] });
}

export default function StudentDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t, formatDate } = useI18n();
  const [D, setD] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    api("/dashboard")
      .then(setD)
      .catch((err) => setError(err instanceof Error ? err.message : t("dashboard.loadFailed")));
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
          <p className="font-semibold">{t("dashboard.loadFailedTitle")}</p>
          <p className="mt-2 text-sm">{error}</p>
          <button type="button" onClick={load} className="btn-primary mt-4 px-4 py-2 text-sm">
            {t("common.retry")}
          </button>
        </div>
      </main>
    );
  }

  if (!D) {
    return <p className="py-24 text-center text-sm text-slate-500">{t("dashboard.loading")}</p>;
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
                  alt={t("dashboard.avatarAlt", { name: D.studentName })}
                  className="h-16 w-16 rounded-full border-2 border-white bg-slate-100 object-contain object-center p-1 shadow-md ring-2 ring-slate-200/90 ring-offset-2 ring-offset-white transition-[box-shadow] duration-300 group-hover/avatar:ring-brand-200 md:h-[5.25rem] md:w-[5.25rem]"
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-wide text-brand-700">{t("common.appName")}</p>
                <h1 className="mt-1 text-2xl font-bold text-slate-900">
                  {t("dashboard.hello", { name: D.studentName })}
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  <span className="font-medium text-slate-800">{t("dashboard.course")} </span>
                  {D.courseName}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-800">{t("dashboard.trainingFocus")} </span>
                  {D.trainingFocus}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="order-last flex flex-wrap items-center gap-2 sm:order-first">
                <LanguageSwitch />
                <span className="text-sm text-slate-600" title={user.email}>
                  {t("common.signedInAs")} <span className="font-medium text-slate-800">{user.displayName}</span>
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-all duration-200 hover:bg-slate-50 active:scale-[0.98]"
                >
                  {t("common.logOut")}
                </button>
              </div>
              <Link
                to={trainPath(D.currentTask?.id)}
                className="btn-primary inline-flex items-center justify-center"
              >
                {t("dashboard.startTraining")}
              </Link>
              {D.lastReport ? (
                <Link
                  to={{ pathname: "/report", search: reportSearch(D.lastReport.sessionId) }}
                  className="btn-secondary inline-flex items-center justify-center"
                >
                  {t("dashboard.openLatestReport")}
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        {D.inProgress.length > 0 ? (
          <section className="mt-6 rounded-2xl border border-brand-200 bg-brand-50/60 p-5 motion-safe:animate-fade-in-up">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-700">
              {t("dashboard.inProgress.title")}
            </h2>
            <ul className="mt-3 space-y-2">
              {D.inProgress.map((s) => (
                <li
                  key={s.sessionId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white bg-white px-3 py-2 text-sm shadow-sm"
                >
                  <span className="font-medium text-slate-900">{taskName(t, s.taskName)}</span>
                  <span className="text-slate-500">{statusLabel(t, s.status)}</span>
                  <Link to={`/train/${s.sessionId}`} className="link-brand text-sm">
                    {s.status === "created"
                      ? t("dashboard.inProgress.continueUpload")
                      : s.status === "failed"
                        ? t("dashboard.inProgress.retry")
                        : t("dashboard.inProgress.viewProgress")}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* 2. Current task + Last report */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2 motion-safe:animate-fade-in-up motion-safe:[animation-delay:70ms]">
          <section className="surface-card surface-card-lift p-6">
            <h2 className="text-lg font-semibold text-slate-900">{t("dashboard.currentTask.title")}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("dashboard.currentTask.subtitle")}
            </p>
            {D.currentTask ? (
            <>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-2">
                <span className="text-slate-500">{t("dashboard.currentTask.task")}</span>
                <span className="font-medium text-slate-900">{taskName(t, D.currentTask.id, D.currentTask.name)}</span>
              </div>
              <div className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-2">
                <span className="text-slate-500">{t("dashboard.currentTask.status")}</span>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  {D.currentTask.attempts == null
                    ? D.currentTask.status
                    : D.currentTask.attempts
                      ? t("dashboard.currentTask.inProgress", { count: D.currentTask.attempts })
                      : t("dashboard.currentTask.notStarted")}
                </span>
              </div>
              <div className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-2">
                <span className="text-slate-500">{t("dashboard.currentTask.due")}</span>
                <span className="text-slate-800">{D.currentTask.dueDate}</span>
              </div>
              <div className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-2">
                <span className="text-slate-500">{t("dashboard.currentTask.duration")}</span>
                <span className="text-slate-800">{durationLabel(t, D.currentTask.estimatedDuration)}</span>
              </div>
              <div>
                <p className="text-slate-500">{t("dashboard.currentTask.dimensions")}</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {D.currentTask.dimensions.map((d) => (
                    <li
                      key={d}
                      className="rounded-md border border-brand-100 bg-brand-50 px-2 py-1 text-xs font-medium text-brand-800 transition-colors duration-200 hover:border-brand-200 hover:bg-brand-100"
                    >
                      {dimensionName(t, d)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to={trainPath(D.currentTask.id)} className="btn-primary inline-flex px-4 py-2 text-sm">
                {t("dashboard.currentTask.start")}
              </Link>
            </div>
            </>
            ) : (
              <p className="mt-4 text-sm text-slate-600">{t("dashboard.currentTask.none")}</p>
            )}
          </section>

          <section className="surface-card surface-card-lift p-6">
            <h2 className="text-lg font-semibold text-slate-900">{t("dashboard.lastReport.title")}</h2>
            <p className="mt-1 text-sm text-slate-600">{t("dashboard.lastReport.subtitle")}</p>
            {D.lastReport ? (
            <>
            <div className="mt-4 space-y-2 text-sm">
              <p>
                <span className="text-slate-500">{t("dashboard.lastReport.task")} </span>
                <span className="font-medium text-slate-900">{taskName(t, D.lastReport.taskName)}</span>
              </p>
              <p>
                <span className="text-slate-500">{t("dashboard.lastReport.score")} </span>
                <span className="text-lg font-bold text-brand-700">
                  {D.lastReport.score}
                </span>
                <span className="text-slate-500"> {t("common.outOf100")}</span>
              </p>
              <p>
                <span className="text-slate-500">{t("dashboard.lastReport.reliability")} </span>
                {reliabilityLabel(t, D.lastReport.reliability)}
              </p>
              <p>
                <span className="text-slate-500">{t("dashboard.lastReport.strength")} </span>
                {D.lastReport.mainStrength}
              </p>
              <p>
                <span className="text-slate-500">{t("dashboard.lastReport.issue")} </span>
                {D.lastReport.mainIssue}
              </p>
              <p>
                <span className="text-slate-500">{t("dashboard.lastReport.instructorReview")} </span>
                {reviewStatusLabel(t, D.lastReport.instructorStatus)}
              </p>
            </div>
            <Link
              to={{ pathname: "/report", search: reportSearch(D.lastReport.sessionId) }}
              className="btn-primary mt-5 inline-flex px-4 py-2 text-sm"
            >
              {t("dashboard.lastReport.viewFull")}
            </Link>
            </>
            ) : (
              <p className="mt-4 text-sm text-slate-600">
                {t("dashboard.lastReport.none")}
              </p>
            )}
          </section>
        </div>

        {/* 3. Trends + Next steps (emphasis) */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-start motion-safe:animate-fade-in-up motion-safe:[animation-delay:100ms]">
          <section className="surface-card surface-card-lift p-6">
            <h2 className="text-lg font-semibold text-slate-900">{t("dashboard.trends.title")}</h2>
            <p className="mt-1 text-sm text-slate-600">{t("dashboard.trends.subtitle")}</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-800">
              <li className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                <span className="text-slate-500">{t("dashboard.trends.sessions")}</span>
                <span className="font-semibold">{D.trends.sessionsCount}</span>
              </li>
              <li className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                <span className="text-slate-500">{t("dashboard.trends.scoreChange")}</span>
                <span
                  className={`font-semibold ${
                    D.trends.scoreChange.startsWith("-") ? "text-rose-700" : "text-emerald-700"
                  }`}
                >
                  {scoreChangeText(t, D.trends)}
                </span>
              </li>
              <li className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                <span className="text-slate-500">{t("dashboard.trends.completionTime")}</span>
                <span className="font-medium">{completionText(t, D.trends)}</span>
              </li>
              <li className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                <span className="text-slate-500">{t("dashboard.trends.flaggedIssues")}</span>
                <span className="font-medium">{D.trends.errorCount}</span>
              </li>
              <li className="flex justify-between gap-4">
                <span className="text-slate-500">{t("dashboard.trends.weakest")}</span>
                <span className="font-semibold text-rose-700">{dimensionName(t, D.trends.weakestDimension)}</span>
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border-2 border-brand-300 bg-gradient-to-b from-brand-50 to-white p-6 shadow-soft ring-1 ring-brand-200 transition-all duration-300 ease-smooth motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-lift motion-safe:hover:ring-brand-300/80">
            <h2 className="text-lg font-semibold text-brand-700">{t("dashboard.next.title")}</h2>
            <p className="mt-1 text-sm text-brand-700">
              {t("dashboard.next.subtitle")}
            </p>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm font-medium leading-6 text-slate-800">
              {(D.nextSteps.length
                ? D.nextSteps
                : [t("dashboard.next.empty")]
              ).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
        </div>

        {/* 4. Notifications */}
        <section className="surface-card surface-card-lift mt-6 p-6 motion-safe:animate-fade-in-up motion-safe:[animation-delay:120ms]">
          <h2 className="text-lg font-semibold text-slate-900">{t("dashboard.notices.title")}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {t("dashboard.notices.subtitle")}
          </p>
          <ul className="mt-4 space-y-2">
            {(D.notificationItems ?? D.notifications).map((note, i) => (
              <li
                key={note.code ?? i}
                className="flex gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-800 transition-all duration-200 hover:border-brand-100 hover:bg-white hover:shadow-sm"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
                {notificationText(t, note)}
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
          <h2 className="text-lg font-semibold text-slate-900">{t("dashboard.history.title")}</h2>
          <p className="mt-1 text-sm text-slate-600">{t("dashboard.history.subtitle")}</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="pb-3 pr-4">{t("dashboard.history.date")}</th>
                  <th className="pb-3 pr-4">{t("dashboard.history.task")}</th>
                  <th className="pb-3 pr-4">{t("dashboard.history.score")}</th>
                  <th className="pb-3 pr-4">{t("dashboard.history.confidence")}</th>
                  <th className="pb-3 pr-4">{t("dashboard.history.instructor")}</th>
                  <th className="pb-3">{t("dashboard.history.report")}</th>
                </tr>
              </thead>
              <tbody>
                {D.history.map((row) => (
                  <tr
                    key={row.sessionId}
                    className="border-b border-slate-100 transition-colors duration-150 hover:bg-brand-50/60"
                  >
                    <td className="py-3 pr-4 text-slate-800">
                      {row.recordedAt ? formatDate(row.recordedAt) : row.date}
                    </td>
                    <td className="py-3 pr-4 font-medium text-slate-900">{taskName(t, row.task)}</td>
                    <td className="py-3 pr-4">{row.score}</td>
                    <td className="py-3 pr-4">{reliabilityLabel(t, row.reliability)}</td>
                    <td className="py-3 pr-4">{reviewStatusLabel(t, row.instructorStatus)}</td>
                    <td className="py-3">
                      <Link
                        to={{ pathname: "/report", search: reportSearch(row.sessionId) }}
                        className="link-brand text-sm"
                      >
                        {t("dashboard.history.view")}
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
