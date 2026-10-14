import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { DEMO_ACCOUNTS, homePathFor } from "../auth/demoAccounts.js";

/** Dev-only floating switcher between seeded demo accounts. */
export default function DevUserSwitch() {
  const { user, devSwitchUser } = useAuth();
  const navigate = useNavigate();
  if (!import.meta.env.DEV || !user) return null;

  async function onChange(e) {
    const next = await devSwitchUser(e.target.value);
    if (next) navigate(homePathFor(next), { replace: true });
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 shadow-lg transition-all duration-200 hover:border-amber-300 hover:shadow-xl">
      <span className="text-xs font-semibold uppercase tracking-wide text-amber-900">Dev</span>
      <label htmlFor="dev-user-switch" className="sr-only">
        Switch demo user
      </label>
      <select
        id="dev-user-switch"
        value={user.email}
        onChange={onChange}
        className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-slate-800"
      >
        {DEMO_ACCOUNTS.map((acc) => (
          <option key={acc.login} value={acc.login}>
            {acc.displayName} ({acc.note})
          </option>
        ))}
      </select>
    </div>
  );
}
