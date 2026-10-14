import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext.jsx";
import DevUserSwitch from "../../components/DevUserSwitch";

export function formatDate(iso, opts = { dateStyle: "medium" }) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, opts);
}

export function relativeDays(days) {
  if (days == null) return "Never";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export function signed(n) {
  if (n == null) return "—";
  return n > 0 ? `+${n}` : String(n);
}

/** Header + nav for every instructor page. */
export function InstructorShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const navCls = ({ isActive }) =>
    `rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
      isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 md:px-8">
          <p className="text-sm font-semibold tracking-wide text-brand-700">
            SutureAI <span className="font-normal text-slate-400">· Instructor</span>
          </p>
          <nav className="flex gap-1">
            <NavLink to="/instructor" end className={navCls}>
              Overview
            </NavLink>
            <NavLink to="/instructor/reviews" className={navCls}>
              Review queue
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-slate-600">{user.displayName}</span>
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate("/login", { replace: true });
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Log out
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
  high: { icon: "▲", label: "High", cls: "border-rose-200 bg-rose-50 text-rose-800" },
  medium: { icon: "●", label: "Medium", cls: "border-amber-200 bg-amber-50 text-amber-900" },
  low: { icon: "○", label: "Low", cls: "border-slate-200 bg-slate-50 text-slate-700" },
};

/** Severity chip: icon + label, never colour alone. */
export function SeverityBadge({ severity }) {
  const s = SEVERITY[severity] ?? SEVERITY.low;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${s.cls}`}>
      <span aria-hidden>{s.icon}</span>
      {s.label}
    </span>
  );
}

const REVIEW_STATE = {
  none: { label: "Not reviewed", cls: "bg-amber-50 text-amber-900 border-amber-200" },
  draft: { label: "Draft", cls: "bg-slate-50 text-slate-700 border-slate-300" },
  completed: { label: "Reviewed", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
};

export function ReviewStateBadge({ state }) {
  const s = REVIEW_STATE[state] ?? REVIEW_STATE.none;
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}

const FEEDBACK_STATE = {
  accepted: { label: "Accepted", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  clarify_open: { label: "Clarification asked", cls: "bg-rose-50 text-rose-800 border-rose-200" },
  clarify_resolved: { label: "Clarified", cls: "bg-slate-50 text-slate-700 border-slate-300" },
};

export function FeedbackStateBadge({ state }) {
  if (!state) return <span className="text-xs text-slate-400">—</span>;
  const s = FEEDBACK_STATE[state];
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}

export function LoadError({ message, onRetry }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
      <p className="font-semibold">Could not load this page</p>
      <p className="mt-2 text-sm">{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn-primary mt-4 px-4 py-2 text-sm">
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function reportLink(sessionId) {
  return { pathname: "/report", search: `?session=${encodeURIComponent(sessionId)}` };
}
