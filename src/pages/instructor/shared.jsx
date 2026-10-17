import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext.jsx";
import DevUserSwitch from "../../components/DevUserSwitch";
import LanguageSwitch from "../../components/LanguageSwitch.jsx";
import { formatDate as formatLocaleDate, useI18n } from "../../i18n/index.js";

/** Date in the active UI locale ("—" when missing). */
export function formatDate(iso, opts = { dateStyle: "medium" }) {
  return formatLocaleDate(iso, opts);
}

/** "Today" / "3 days ago" using the `t` from useI18n(). */
export function relativeDays(t, days) {
  if (days == null) return t("instructor.relative.never");
  if (days === 0) return t("instructor.relative.today");
  if (days === 1) return t("instructor.relative.yesterday");
  return t("instructor.relative.daysAgo", { count: days });
}

export function signed(n) {
  if (n == null) return "—";
  return n > 0 ? `+${n}` : String(n);
}

/** Header + nav for every instructor page. */
export function InstructorShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();
  const navCls = ({ isActive }) =>
    `rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
      isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 md:px-8">
          <p className="text-sm font-semibold tracking-wide text-brand-700">
            {t("common.appName")} <span className="font-normal text-slate-400">· {t("instructor.shell.role")}</span>
          </p>
          <nav className="flex gap-1" aria-label={t("instructor.shell.nav")}>
            <NavLink to="/instructor" end className={navCls}>
              {t("instructor.shell.overview")}
            </NavLink>
            <NavLink to="/instructor/reviews" className={navCls}>
              {t("instructor.shell.reviewQueue")}
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <LanguageSwitch />
            <span className="text-slate-600">{user.displayName}</span>
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate("/login", { replace: true });
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
            >
              {t("common.logOut")}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-8">{children}</main>
      <DevUserSwitch />
    </div>
  );
}

const SEVERITY = {
  high: { icon: "▲", cls: "border-rose-200 bg-rose-50 text-rose-800" },
  medium: { icon: "●", cls: "border-amber-200 bg-amber-50 text-amber-900" },
  low: { icon: "○", cls: "border-slate-200 bg-slate-50 text-slate-700" },
};

/** Severity chip: icon + label, never colour alone. */
export function SeverityBadge({ severity }) {
  const { t } = useI18n();
  const level = SEVERITY[severity] ? severity : "low";
  const s = SEVERITY[level];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${s.cls}`}>
      <span aria-hidden>{s.icon}</span>
      {t(`instructor.severity.${level}`)}
    </span>
  );
}

const REVIEW_STATE = {
  none: "bg-amber-50 text-amber-900 border-amber-200",
  draft: "bg-slate-50 text-slate-700 border-slate-300",
  completed: "bg-emerald-50 text-emerald-800 border-emerald-200",
};

export function ReviewStateBadge({ state }) {
  const { t } = useI18n();
  const key = REVIEW_STATE[state] ? state : "none";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${REVIEW_STATE[key]}`}>
      {t(`instructor.reviewState.${key}`)}
    </span>
  );
}

const FEEDBACK_STATE = {
  accepted: "bg-emerald-50 text-emerald-800 border-emerald-200",
  appeal_open: "bg-rose-50 text-rose-800 border-rose-200",
  appeal_decided: "bg-slate-50 text-slate-700 border-slate-300",
};

export function FeedbackStateBadge({ state }) {
  const { t } = useI18n();
  if (!state || !FEEDBACK_STATE[state]) return <span className="text-xs text-slate-400">—</span>;
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${FEEDBACK_STATE[state]}`}>
      {t(`instructor.feedbackState.${state}`)}
    </span>
  );
}

export function LoadError({ message, onRetry }) {
  const { t } = useI18n();
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
      <p className="font-semibold">{t("common.couldNotLoadPage")}</p>
      <p className="mt-2 text-sm">{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn-primary mt-4 px-4 py-2 text-sm">
          {t("common.retry")}
        </button>
      ) : null}
    </div>
  );
}

export function reportLink(sessionId) {
  return { pathname: "/report", search: `?session=${encodeURIComponent(sessionId)}` };
}
