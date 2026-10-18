import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, homePathFor } from "../auth/demoAccounts.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { ApiError } from "../api/client.js";
import LanguageSwitch from "../components/LanguageSwitch.jsx";
import SutureLine from "../components/decor/SutureLine.jsx";
import { Reveal, Stagger, StaggerItem } from "../components/motion/index.jsx";
import { useI18n } from "../i18n/index.js";

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, tRaw } = useI18n();
  const fromLoc = location.state?.from;
  const from = fromLoc ? `${fromLoc.pathname}${fromLoc.search ?? ""}` : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to={homePathFor(user)} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const u = await login(email, password);
      navigate(from ?? homePathFor(u), { replace: true });
    } catch (err) {
      // The API's 401 message is English; show our own wording for the common case.
      if (err instanceof ApiError && err.status === 401) setError(t("login.invalid"));
      else setError(err instanceof Error ? err.message : t("login.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-4 py-12 md:grid-cols-[1.05fr_1fr] md:px-8">
        {/* Brand side: the deck's title treatment, drawn on the paper. */}
        <Reveal className="hidden md:block">
          <h2 className="title-display text-5xl leading-[1.05]">{t("common.appName")}</h2>
          <p className="mt-3 max-w-sm text-lg text-ink-soft">{t("login.brand.tagline")}</p>
          <SutureLine className="mt-8 w-full max-w-md" delay={0.4} />
          <Stagger as="ul" className="mt-8 max-w-sm" delay={1.4} gap={0.12}>
            {(tRaw("login.brand.points") ?? []).map((point, i) => (
              <StaggerItem as="li" key={point} className="flex items-center gap-3 border-t border-line py-3 text-sm text-ink-soft">
                <span className="section-num w-6">{String(i + 1).padStart(2, "0")}</span>
                {point}
              </StaggerItem>
            ))}
          </Stagger>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="surface-card relative overflow-hidden p-8">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-brand-500" />
            <div className="flex items-center justify-between gap-3">
              <p className="pill-header flex-1">{t("common.appName")}</p>
              <LanguageSwitch />
            </div>
            <h1 className="title-display mt-4 text-3xl">{t("login.title")}</h1>
            <p className="mt-1.5 text-sm text-ink-muted">{t("login.subtitle")}</p>

            <form
              onSubmit={handleSubmit}
              className="mt-7 space-y-4"
              autoComplete="off"
              data-form-type="other"
              data-lpignore="true"
              data-1p-ignore
            >
              {/* Decoy fields so Chrome is less likely to treat this as a real sign-in to save */}
              <input
                type="text"
                name="prevent_autofill_username"
                tabIndex={-1}
                autoComplete="username"
                className="pointer-events-none absolute h-0 w-0 opacity-0"
                aria-hidden
                readOnly
              />
              <input
                type="password"
                name="prevent_autofill_password"
                tabIndex={-1}
                autoComplete="current-password"
                className="pointer-events-none absolute h-0 w-0 opacity-0"
                aria-hidden
                readOnly
              />

              <div>
                <label htmlFor="login-email" className="field-label">
                  {t("login.email")}
                </label>
                <input
                  id="login-email"
                  name="suture_demo_login"
                  type="email"
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field-input mt-1.5"
                  placeholder="alex@demo.local"
                  required
                />
              </div>
              <div>
                <label htmlFor="login-password" className="field-label">
                  {t("login.password")}
                </label>
                <input
                  id="login-password"
                  name="suture_demo_secret"
                  type="password"
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-1p-ignore
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field-input mt-1.5"
                  placeholder={DEMO_PASSWORD}
                  required
                />
              </div>

              {error ? (
                <p
                  className="border-l-2 border-bad bg-paper px-3 py-2.5 text-sm text-bad motion-safe:animate-shake"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              <button type="submit" disabled={submitting} className="btn-primary w-full py-3">
                {submitting ? t("login.submitting") : t("login.submit")}
              </button>
            </form>

            <p className="tile-dashed mt-4 px-3 py-2 text-xs leading-5 text-ink-soft">
              {t("login.chromeHint.before")} <strong>{t("login.chromeHint.path")}</strong>{" "}
              {t("login.chromeHint.middle")} <code className="font-mono">demo</code>
              {t("login.chromeHint.after")}
            </p>

            <div className="tile mt-5 text-xs text-ink-muted">
              <p className="font-semibold text-ink">
                {t("login.demoAccounts")}{" "}
                <span className="font-normal text-ink-muted">
                  {t("login.demoPassword", { password: DEMO_PASSWORD })}
                </span>
              </p>
              <ul className="mt-2 space-y-1 font-mono text-[11px] leading-relaxed">
                {DEMO_ACCOUNTS.map((acc) => (
                  <li key={acc.login} className="leader py-0.5 text-[11px]">
                    <span className="text-ink-soft">{acc.login}</span>
                    <span className="font-sans text-ink-muted">
                      {t(`login.demoNotes.${acc.login.split("@")[0]}`, { defaultValue: acc.note })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-ink-muted">{t("login.footer")}</p>
        </Reveal>
      </main>
    </div>
  );
}
