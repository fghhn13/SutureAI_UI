import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Bell, FileText, Loader, LogOut, TrendingDown, TrendingUp, Video } from "lucide-react";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import DevUserSwitch from "../components/DevUserSwitch";
import LanguageSwitch from "../components/LanguageSwitch.jsx";
import TrainingActivityCalendar from "../components/TrainingActivityCalendar";
import SutureLine from "../components/decor/SutureLine.jsx";
import { CountUp, Reveal, Stagger, StaggerItem } from "../components/motion/index.jsx";
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

/** Due date is stored as free text ("Nov 07, 2026"); reformat it when it parses as a date. */
function dueDateText(formatDate, text) {
  if (!text || !/^(\d{4}-\d{2}-\d{2}|[A-Z][a-z]{2} \d{1,2}, \d{4})$/.test(text)) return text;
  const d = new Date(text.length === 10 ? `${text}T12:00:00` : text);
  return Number.isNaN(d.getTime()) ? text : formatDate(d);
}

/** Label without its trailing colon, for leader rows where the dots do the separating. */
function bare(label) {
  return label.replace(/[:：]\s*$/, "");
}

function completionText(t, trends) {
  const secs = trends.completionSeconds;
  if (!secs) return trends.completionTime;
  return t("dashboard.trends.completionValue", { from: secs[0], to: secs[1] });
}

export default function StudentDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t, locale, formatDate } = useI18n();
  const [D, setD] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    api("/dashboard")
      .then(setD)
      .catch((err) => setError(err instanceof Error ? err.message : t("dashboard.loadFailed")));
  }, [t]);

  useEffect(() => {
    load();
    // Refetch on a language switch: report-derived text (strengths, next steps) comes from
    // the API in the requested Accept-Language.
  }, [load, user.id, locale]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <div className="rounded-md border border-line border-l-2 border-l-bad bg-white p-6 text-ink">
          <p className="font-semibold">{t("dashboard.loadFailedTitle")}</p>
          <p className="mt-2 text-sm text-ink-soft">{error}</p>
          <button type="button" onClick={load} className="btn-primary mt-4 px-4 py-2 text-sm">
            {t("common.retry")}
          </button>
        </div>
      </main>
    );
  }

  if (!D) {
    return (
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-8" aria-busy="true">
        <p className="sr-only" role="status">{t("dashboard.loading")}</p>
        <div className="skeleton h-44" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="skeleton h-72" />
          <div className="skeleton h-72" />
        </div>
      </main>
    );
  }

  const scoreDown = D.trends.scoreChange.startsWith("-");

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        {/* Top bar: brand on the left, account controls on the right. */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="font-display text-lg font-bold tracking-tight text-brand-800">{t("common.appName")}</p>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <LanguageSwitch />
            <span className="text-ink-muted" title={user.email}>
              {t("common.signedInAs")} <span className="font-semibold text-ink">{user.displayName}</span>
            </span>
            <button type="button" onClick={handleLogout} className="btn-ghost text-sm">
              <LogOut size={14} strokeWidth={1.75} />
              {t("common.logOut")}
            </button>
          </div>
        </div>

        {/* 1. Welcome */}
        <Reveal as="section" y={6} className="surface-card relative overflow-hidden p-6 md:p-8">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-brand-500" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="flex items-start gap-5">
              <img
                src={AVATAR_SRC}
                alt={t("dashboard.avatarAlt", { name: D.studentName })}
                className="h-16 w-16 shrink-0 rounded-full bg-[#f2efe9] object-contain object-center p-1 md:h-20 md:w-20"
              />
              <div className="min-w-0">
                <h1 className="title-display text-3xl">{t("dashboard.hello", { name: D.studentName })}</h1>
                <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                  <dt className="text-ink-muted">{bare(t("dashboard.course"))}</dt>
                  <dd className="font-medium text-ink">{D.courseName}</dd>
                  <dt className="text-ink-muted">{bare(t("dashboard.trainingFocus"))}</dt>
                  <dd className="font-medium text-ink">{D.trainingFocus}</dd>
                </dl>
                <SutureLine className="mt-5 hidden w-72 opacity-80 md:block" delay={0.5} />
              </div>
            </div>

            {/* Ready-to-start tile: the next task and the two ways forward. */}
            <div className="tile-dashed flex flex-col">
              <p className="tile-title">{t("dashboard.currentTask.title")}</p>
              {D.currentTask ? (
                <p className="mt-1.5 text-sm text-ink-soft">
                  <span className="font-semibold text-ink">{taskName(t, D.currentTask.id, D.currentTask.name)}</span>
                  <span className="text-ink-muted"> · {durationLabel(t, D.currentTask.estimatedDuration)}</span>
                </p>
              ) : (
                <p className="mt-1.5 text-sm text-ink-muted">{t("dashboard.currentTask.none")}</p>
              )}
              <div className="mt-auto flex flex-col gap-2 pt-4">
                <Link to={trainPath(D.currentTask?.id)} className="btn-primary inline-flex w-full items-center justify-center gap-2">
                  <Video size={16} strokeWidth={1.75} />
                  {t("dashboard.startTraining")}
                </Link>
                {D.lastReport ? (
                  <Link
                    to={{ pathname: "/report", search: reportSearch(D.lastReport.sessionId) }}
                    className="btn-secondary w-full justify-center"
                  >
                    <FileText size={16} strokeWidth={1.75} />
                    {t("dashboard.openLatestReport")}
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </Reveal>

        {D.inProgress.length > 0 ? (
          <Reveal as="section" className="mt-6 rounded-md border border-brand-200 border-l-2 border-l-brand-500 bg-brand-50/60 p-5">
            <p className="pill-header">{t("dashboard.inProgress.title")}</p>
            <ul className="mt-2">
              {D.inProgress.map((s) => (
                <li
                  key={s.sessionId}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 py-2.5 text-sm last:border-0"
                >
                  <span className="flex items-center gap-2 font-medium text-ink">
                    <Loader size={14} strokeWidth={1.75} className="text-brand-500 motion-safe:animate-spin [animation-duration:2.5s]" />
                    {taskName(t, s.taskName)}
                  </span>
                  <span className="text-ink-muted">{statusLabel(t, s.status)}</span>
                  <Link to={`/train/${s.sessionId}`} className="btn-ghost text-sm">
                    {s.status === "created"
                      ? t("dashboard.inProgress.continueUpload")
                      : s.status === "failed"
                        ? t("dashboard.inProgress.retry")
                        : t("dashboard.inProgress.viewProgress")}
                    <ArrowRight size={14} strokeWidth={1.75} />
                  </Link>
                </li>
              ))}
            </ul>
          </Reveal>
        ) : null}

        {/* 2. Current task + Last report */}
        <Stagger className="mt-6 grid gap-6 lg:grid-cols-2">
          <StaggerItem as="section" className="surface-card surface-card-lift p-6">
            <h2 className="section-title"><span className="section-num">01</span>{t("dashboard.currentTask.detailsTitle")}</h2>
            <p className="mt-1 text-sm text-ink-muted">{t("dashboard.currentTask.subtitle")}</p>
            {D.currentTask ? (
              <>
                <ul className="mt-4 text-sm">
                  <li className="leader">
                    <span className="text-ink-muted">{t("dashboard.currentTask.task")}</span>
                    <span className="font-semibold text-ink">{taskName(t, D.currentTask.id, D.currentTask.name)}</span>
                  </li>
                  <li className="leader">
                    <span className="text-ink-muted">{t("dashboard.currentTask.status")}</span>
                    <span className="chip border-warn/50 text-warn">
                      {D.currentTask.attempts == null
                        ? D.currentTask.status
                        : D.currentTask.attempts
                          ? t("dashboard.currentTask.inProgress", { count: D.currentTask.attempts })
                          : t("dashboard.currentTask.notStarted")}
                    </span>
                  </li>
                  <li className="leader">
                    <span className="text-ink-muted">{t("dashboard.currentTask.due")}</span>
                    <span className="text-ink">{dueDateText(formatDate, D.currentTask.dueDate)}</span>
                  </li>
                  <li className="leader">
                    <span className="text-ink-muted">{t("dashboard.currentTask.duration")}</span>
                    <span className="text-ink">{durationLabel(t, D.currentTask.estimatedDuration)}</span>
                  </li>
                </ul>
                <p className="eyebrow mt-4">{t("dashboard.currentTask.dimensions")}</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {D.currentTask.dimensions.map((d) => (
                    <li key={d} className="chip border-brand-200 py-0.5 text-brand-600">
                      {dimensionName(t, d)}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-4 text-sm text-ink-muted">{t("dashboard.currentTask.none")}</p>
            )}
          </StaggerItem>

          <StaggerItem as="section" className="surface-card surface-card-lift p-6">
            <h2 className="section-title"><span className="section-num">02</span>{t("dashboard.lastReport.title")}</h2>
            <p className="mt-1 text-sm text-ink-muted">{t("dashboard.lastReport.subtitle")}</p>
            {D.lastReport ? (
              <>
                <div className="mt-4 flex items-end gap-3 border-b border-line pb-4">
                  <CountUp value={D.lastReport.score} className="font-display text-5xl font-bold leading-none text-brand-700" />
                  <span className="pb-1 text-sm text-ink-muted">{t("common.outOf100")}</span>
                  <span className="ml-auto pb-1 text-right text-sm font-medium text-ink">{taskName(t, D.lastReport.taskName)}</span>
                </div>
                <ul className="mt-2 text-sm">
                  <li className="leader">
                    <span className="text-ink-muted">{bare(t("dashboard.lastReport.reliability"))}</span>
                    <span className="text-ink">{reliabilityLabel(t, D.lastReport.reliability)}</span>
                  </li>
                  <li className="leader">
                    <span className="text-ink-muted">{bare(t("dashboard.lastReport.strength"))}</span>
                    <span className="text-good">{D.lastReport.mainStrength}</span>
                  </li>
                  <li className="leader">
                    <span className="text-ink-muted">{bare(t("dashboard.lastReport.issue"))}</span>
                    <span className="text-bad">{D.lastReport.mainIssue}</span>
                  </li>
                  <li className="leader">
                    <span className="text-ink-muted">{bare(t("dashboard.lastReport.instructorReview"))}</span>
                    <span className="text-ink">{reviewStatusLabel(t, D.lastReport.instructorStatus)}</span>
                  </li>
                </ul>
                <Link
                  to={{ pathname: "/report", search: reportSearch(D.lastReport.sessionId) }}
                  className="btn-primary mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm"
                >
                  {t("dashboard.lastReport.viewFull")}
                  <ArrowRight size={15} strokeWidth={1.75} />
                </Link>
              </>
            ) : (
              <p className="mt-4 text-sm text-ink-muted">{t("dashboard.lastReport.none")}</p>
            )}
          </StaggerItem>
        </Stagger>

        {/* 3. Trends + Next steps (emphasis) */}
        <Stagger className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-start">
          <StaggerItem as="section" className="surface-card surface-card-lift p-6">
            <h2 className="section-title"><span className="section-num">03</span>{t("dashboard.trends.title")}</h2>
            <p className="mt-1 text-sm text-ink-muted">{t("dashboard.trends.subtitle")}</p>
            <ul className="mt-4 text-sm">
              <li className="leader">
                <span className="text-ink-muted">{t("dashboard.trends.sessions")}</span>
                <span className="font-display text-base font-semibold text-ink">{D.trends.sessionsCount}</span>
              </li>
              <li className="leader">
                <span className="text-ink-muted">{t("dashboard.trends.scoreChange")}</span>
                <span className={`inline-flex items-center gap-1 font-semibold ${scoreDown ? "text-bad" : "text-good"}`}>
                  {scoreDown ? <TrendingDown size={15} strokeWidth={1.75} /> : <TrendingUp size={15} strokeWidth={1.75} />}
                  {scoreChangeText(t, D.trends)}
                </span>
              </li>
              <li className="leader">
                <span className="text-ink-muted">{t("dashboard.trends.completionTime")}</span>
                <span className="font-medium text-ink">{completionText(t, D.trends)}</span>
              </li>
              <li className="leader">
                <span className="text-ink-muted">{t("dashboard.trends.flaggedIssues")}</span>
                <span className="font-display text-base font-semibold text-ink">{D.trends.errorCount}</span>
              </li>
              <li className="leader">
                <span className="text-ink-muted">{t("dashboard.trends.weakest")}</span>
                <span className="font-semibold text-bad">{dimensionName(t, D.trends.weakestDimension)}</span>
              </li>
            </ul>
          </StaggerItem>

          {/* The one blue-washed block on the page: what to practise next. */}
          <StaggerItem as="section" className="relative overflow-hidden rounded-md bg-brand-50 p-6">
            <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-brand-500" />
            <h2 className="section-title"><span className="section-num">04</span>{t("dashboard.next.title")}</h2>
            <p className="mt-1 text-sm text-brand-700">{t("dashboard.next.subtitle")}</p>
            <ol className="mt-4 text-sm leading-6 text-ink">
              {(D.nextSteps.length ? D.nextSteps : [t("dashboard.next.empty")]).map((step, i) => (
                <li key={step} className="flex gap-3 border-b border-brand-100 py-2.5 last:border-0">
                  <span className="section-num w-5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                  <span className="font-medium">{step}</span>
                </li>
              ))}
            </ol>
          </StaggerItem>
        </Stagger>

        {/* 4. Notifications */}
        <Reveal as="section" className="surface-card mt-6 p-6">
          <h2 className="section-title"><span className="section-num">05</span>{t("dashboard.notices.title")}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t("dashboard.notices.subtitle")}</p>
          <ul className="mt-3">
            {(D.notificationItems ?? D.notifications).map((note, i) => (
              <li
                key={note.code ?? i}
                className="flex gap-3 border-b border-line py-2.5 text-sm text-ink-soft last:border-0"
              >
                <Bell size={14} strokeWidth={1.75} className="mt-1 shrink-0 text-brand-400" />
                {notificationText(t, note)}
              </li>
            ))}
          </ul>
        </Reveal>

        {/* Training activity heatmap (above history) */}
        <Reveal className="mt-6">
          <TrainingActivityCalendar
            number="06"
            activityByDate={D.trainingActivityCalendar.activityByDate}
            years={D.trainingActivityCalendar.years}
            defaultYear={D.trainingActivityCalendar.defaultYear}
          />
        </Reveal>

        {/* 5. History */}
        <Reveal as="section" className="surface-card mt-6 p-6">
          <h2 className="section-title"><span className="section-num">07</span>{t("dashboard.history.title")}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t("dashboard.history.subtitle")}</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-mist text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                  <th className="pb-3 pr-4 font-semibold">{t("dashboard.history.date")}</th>
                  <th className="pb-3 pr-4 font-semibold">{t("dashboard.history.task")}</th>
                  <th className="pb-3 pr-4 font-semibold">{t("dashboard.history.score")}</th>
                  <th className="pb-3 pr-4 font-semibold">{t("dashboard.history.confidence")}</th>
                  <th className="pb-3 pr-4 font-semibold">{t("dashboard.history.instructor")}</th>
                  <th className="pb-3 font-semibold">{t("dashboard.history.report")}</th>
                </tr>
              </thead>
              <tbody>
                {D.history.map((row) => (
                  <tr key={row.sessionId} className="border-b border-line transition-colors duration-150 hover:bg-paper">
                    <td className="py-3 pr-4 font-mono text-xs text-ink-muted">
                      {row.recordedAt ? formatDate(row.recordedAt) : row.date}
                    </td>
                    <td className="py-3 pr-4 font-medium text-ink">{taskName(t, row.task)}</td>
                    <td className="py-3 pr-4 font-display text-base font-semibold text-brand-700">{row.score}</td>
                    <td className="py-3 pr-4 text-ink-soft">{reliabilityLabel(t, row.reliability)}</td>
                    <td className="py-3 pr-4 text-ink-soft">{reviewStatusLabel(t, row.instructorStatus)}</td>
                    <td className="py-3">
                      <Link
                        to={{ pathname: "/report", search: reportSearch(row.sessionId) }}
                        className="btn-ghost text-sm"
                      >
                        {t("dashboard.history.view")}
                        <ArrowRight size={13} strokeWidth={1.75} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </main>

      <DevUserSwitch />
    </div>
  );
}
