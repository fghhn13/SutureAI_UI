import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, ApiError } from "../api/client.js";
import { DEMO_PASSWORD } from "./demoAccounts.js";

/** @typedef {{ id: number, email: string, displayName: string, role: string }} AuthUser */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  /** @type {[AuthUser | null, Function]} */
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore the session from the httpOnly cookie on first load.
  useEffect(() => {
    let cancelled = false;
    api("/auth/me")
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 401)) console.error(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const u = await api("/auth/login", { method: "POST", body: { email, password } });
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
    }
  }, []);

  /** Dev-only: sign in as another seeded demo account. */
  const devSwitchUser = useCallback(
    async (email) => {
      if (!import.meta.env.DEV) return null;
      return login(email, DEMO_PASSWORD);
    },
    [login],
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      devSwitchUser,
      isAuthenticated: Boolean(user),
    }),
    [user, loading, login, logout, devSwitchUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
