import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "../auth/demoAccounts.js";
import { useAuth } from "../auth/AuthContext.jsx";

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromLoc = location.state?.from;
  const from = fromLoc ? `${fromLoc.pathname}${fromLoc.search ?? ""}` : "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-slate-100 via-white to-brand-50/50">
      <div
        className="pointer-events-none absolute -left-32 top-0 h-80 w-80 rounded-full bg-brand-300/30 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-brand-400/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-brand-200/25 blur-3xl"
        aria-hidden
      />

      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        <div className="motion-safe:animate-scale-in">
          <div className="surface-card relative overflow-hidden p-8 ring-1 ring-slate-200/60">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-400 via-brand-500 to-brand-600" />
            <p className="text-sm font-semibold tracking-wide text-brand-700">SutureAI</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Sign in</h1>
            <p className="mt-1 text-sm text-slate-600">
              Local prototype only — do not save these credentials in your browser.
            </p>

            <form
              onSubmit={handleSubmit}
              className="mt-8 space-y-4"
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

              <div className="motion-safe:animate-fade-in-up-fast motion-safe:[animation-delay:40ms]">
                <label
                  htmlFor="login-email"
                  className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Email
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
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
                  placeholder="alex@demo.local"
                  required
                />
              </div>
              <div className="motion-safe:animate-fade-in-up-fast motion-safe:[animation-delay:90ms]">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Password
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
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
                  placeholder={DEMO_PASSWORD}
                  required
                />
              </div>

              {error ? (
                <p
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-900 motion-safe:animate-shake"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              <button type="submit" disabled={submitting} className="btn-primary w-full rounded-xl py-3">
                {submitting ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <p className="mt-4 rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
              If Chrome still warns about a saved password, remove the old entry for this site under{" "}
              <strong>Settings → Password Manager</strong> (the previous demo password was{" "}
              <code className="font-mono">demo</code>).
            </p>

            <div className="mt-4 rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50/90 to-slate-50 p-4 text-xs text-slate-600 transition-colors duration-200 hover:border-brand-100">
              <p className="font-semibold text-slate-800">Demo accounts</p>
              <ul className="mt-2 space-y-1.5 font-mono text-[11px] leading-relaxed">
                {DEMO_ACCOUNTS.map((acc) => (
                  <li key={acc.login} className="transition-colors hover:text-slate-900">
                    {acc.login} / {DEMO_PASSWORD}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-500 motion-safe:animate-fade-in-up motion-safe:[animation-delay:200ms]">
          Student dashboard and reports require sign-in.
        </p>
      </main>
    </div>
  );
}
