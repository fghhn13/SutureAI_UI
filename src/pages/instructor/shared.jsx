import { NavLink, useNavigate } from "react-router-dom";
import { Circle, CircleDot, LogOut, TriangleAlert } from "lucide-react";
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
  // Active tab: blue text with a blue rule under it, like a ledger tab.
  const navCls = ({ isActive }) =>
    `relative py-3 text-sm font-semibold transition-colors after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:transition-colors ${
      isActive ? "text-brand-700 after:bg-brand-500" : "text-ink-muted after:bg-transparent hover:text-ink"
    }`;

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div aria-hidden="true" className="h-1 bg-brand-500" />
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-1 px-4 md:px-8">
          <p className="py-3 font-display text-lg font-bold tracking-tight text-brand-800">
            {t("common.appName")}{" "}
            <span className="ml-1 font-sans text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
              {t("instructor.shell.role")}
            </span>
          </p>
          <nav className="flex gap-6" aria-label={t("instructor.shell.nav")}>
            <NavLink to="/instructor" end className={navCls}>
              {t("instructor.shell.overview")}
            </NavLink>
            <NavLink to="/instructor/reviews" className={navCls}>
              {t("instructor.shell.reviewQueue")}
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-4 py-2 text-sm">
            <LanguageSwitch />
            <span className="text-ink-muted">{user.displayName}</span>
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate("/login", { replace: true });
              }}
              className="btn-ghost text-sm"
            >
              <LogOut size={14} strokeWidth={1.75} />
              {t("common.logOut")}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 motion-safe:animate-fade-in-up-fast md:px-8 md:py-8">{children}</main>
      <DevUserSwitch />
    </div>
  );
}

const SEVERITY = {
  high: { icon: TriangleAlert, cls: "border-bad/50 text-bad" },
  medium: { icon: CircleDot, cls: "border-warn/50 text-warn" },
  low: { icon: Circle, cls: "border-mist text-ink-muted" },
};

/** Severity chip: icon + label, never colour alone. */
export function SeverityBadge({ severity }) {
  const { t } = useI18n();
  const level = SEVERITY[severity] ? severity : "low";
  const { icon: Icon, cls } = SEVERITY[level];
  return (
    <span className={`chip shrink-0 py-0.5 ${cls}`}>
      <Icon size={11} strokeWidth={2.25} aria-hidden />
      {t(`instructor.severity.${level}`)}
    </span>
  );
}

const REVIEW_STATE = {
  none: "border-warn/50 text-warn",
  draft: "border-mist text-ink-muted",
  completed: "border-good/50 text-good",
};

export function ReviewStateBadge({ state }) {
  const { t } = useI18n();
  const key = REVIEW_STATE[state] ? state : "none";
  return <span className={`chip py-0.5 ${REVIEW_STATE[key]}`}>{t(`instructor.reviewState.${key}`)}</span>;
}

const FEEDBACK_STATE = {
  accepted: "border-good/50 text-good",
  appeal_open: "border-bad/50 text-bad",
  appeal_decided: "border-mist text-ink-muted",
};

export function FeedbackStateBadge({ state }) {
  const { t } = useI18n();
  if (!state || !FEEDBACK_STATE[state]) return <span className="text-xs text-slate-400">—</span>;
  return <span className={`chip py-0.5 ${FEEDBACK_STATE[state]}`}>{t(`instructor.feedbackState.${state}`)}</span>;
}

export function LoadError({ message, onRetry }) {
  const { t } = useI18n();
  return (
    <div className="rounded-md border border-line border-l-2 border-l-bad bg-white p-6 text-ink">
      <p className="font-semibold">{t("common.couldNotLoadPage")}</p>
      <p className="mt-2 text-sm text-ink-soft">{message}</p>
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
