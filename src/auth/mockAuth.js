import { MOCK_ACCOUNTS } from "./mockAccounts.js";

/** @typedef {{ id: string, login: string, displayName: string, role: string }} AuthUser */

/**
 * Mock login — swap for `fetch('/api/auth/login')` later; keep the same return shape.
 * @param {string} loginEmail
 * @param {string} password
 * @returns {{ user: AuthUser, token: string } | null}
 */
export function loginWithMockCredentials(loginEmail, password) {
  const normalized = loginEmail.trim().toLowerCase();
  const acc = MOCK_ACCOUNTS.find((a) => a.login.toLowerCase() === normalized);
  if (!acc || acc.password !== password) return null;
  const user = {
    id: acc.id,
    login: acc.login,
    displayName: acc.displayName,
    role: acc.role,
  };
  return { user, token: `mock.${acc.id}` };
}
