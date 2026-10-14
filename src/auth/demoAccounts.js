/**
 * Demo accounts created by the backend seed (server/app/seed.py). Shown on the login page
 * and used by the dev-only user switcher; the backend is the source of truth.
 * Use a non-trivial password so Chrome does not flag it as a known leaked password ("demo").
 */
export const DEMO_PASSWORD = "suture-local-demo";

export const DEMO_ACCOUNTS = [
  { login: "alex@demo.local", displayName: "Alex Rivera" },
  { login: "jordan@demo.local", displayName: "Jordan Kim" },
];
