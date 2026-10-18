import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { DEMO_ACCOUNTS, homePathFor } from "../auth/demoAccounts.js";
import { useI18n } from "../i18n/index.js";

/** Dev-only floating switcher between seeded demo accounts. */
export default function DevUserSwitch() {
  const { user, devSwitchUser } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();
  if (!import.meta.env.DEV || !user) return null;

  async function onChange(e) {
    const next = await devSwitchUser(e.target.value);
    if (next) navigate(homePathFor(next), { replace: true });
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-md border border-line bg-white px-3 py-2 shadow-lift transition-colors duration-200 hover:border-mist">
      <span className="chip border-warn/50 text-warn">{t("devSwitch.badge")}</span>
      <label htmlFor="dev-user-switch" className="sr-only">
        {t("devSwitch.label")}
      </label>
      <select
        id="dev-user-switch"
        value={user.email}
        onChange={onChange}
        className="field-select px-2 py-1 text-xs"
      >
        {DEMO_ACCOUNTS.map((acc) => (
          <option key={acc.login} value={acc.login}>
            {acc.displayName} ({t(`login.demoNotes.${acc.login.split("@")[0]}`, { defaultValue: acc.note })})
          </option>
        ))}
      </select>
    </div>
  );
}
