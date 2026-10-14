/**
 * Demo accounts created by the backend seed (server/app/seed.py). Shown on the login page
 * and used by the dev-only user switcher; the backend is the source of truth.
 * Use a non-trivial password so Chrome does not flag it as a known leaked password ("demo").
 */
export const DEMO_PASSWORD = "suture-local-demo";

export const DEMO_ACCOUNTS = [
  { login: "chen@demo.local", displayName: "Dr. Chen", note: "instructor · Groups A & B" },
  { login: "patel@demo.local", displayName: "Dr. Patel", note: "instructor · Group B" },
  { login: "alex@demo.local", displayName: "Alex Rivera", note: "student · Group A" },
  { login: "sam@demo.local", displayName: "Sam Taylor", note: "student · improving" },
  { login: "priya@demo.local", displayName: "Priya Shah", note: "student · declining" },
  { login: "jordan@demo.local", displayName: "Jordan Kim", note: "student · Group B" },
];

/** Where each role lands after signing in. */
export function homePathFor(user) {
  return user && user.role !== "student" ? "/instructor" : "/";
}
