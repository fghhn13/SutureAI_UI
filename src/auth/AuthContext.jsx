import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { SESSION_STORAGE_KEY } from "./constants.js";
import { MOCK_ACCOUNTS } from "./mockAccounts.js";
import { loginWithMockCredentials } from "./mockAuth.js";

const AuthContext = createContext(null);

function readStoredSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => readStoredSession());

  useEffect(() => {
    if (session) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, [session]);

  const login = useCallback(async (loginEmail, password) => {
    const result = loginWithMockCredentials(loginEmail, password);
    if (!result) {
      throw new Error("Invalid email or password.");
    }
    setSession(result);
    return result.user;
  }, []);

  const logout = useCallback(() => {
    setSession(null);
  }, []);

  const devSwitchUser = useCallback((userId) => {
    if (!import.meta.env.DEV) return;
    const acc = MOCK_ACCOUNTS.find((a) => a.id === userId);
    if (!acc) return;
    const user = {
      id: acc.id,
      login: acc.login,
      displayName: acc.displayName,
      role: acc.role,
    };
    setSession({ user, token: `mock.${acc.id}` });
  }, []);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      login,
      logout,
      devSwitchUser,
      isAuthenticated: Boolean(session?.user),
    }),
    [session, login, logout, devSwitchUser],
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
