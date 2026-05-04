import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch, getStoredToken, setStoredToken } from "@/api/client";
import type { ApiUser, AuthResponse } from "@/api/types";

type AuthContextValue = {
  token: string | null;
  user: ApiUser | null;
  status: "loading" | "authenticated" | "unauthenticated";
  login: (response: AuthResponse) => void;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<ApiUser | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">(
    () => (getStoredToken() ? "loading" : "unauthenticated"),
  );

  const refresh = useCallback(async () => {
    const t = getStoredToken();
    if (!t) {
      setUser(null);
      setStatus("unauthenticated");
      return;
    }
    try {
      const res = await apiFetch<{ user: ApiUser; token: string }>("/auth/me");
      setUser(res.user);
      setStatus("authenticated");
    } catch {
      setStoredToken(null);
      setToken(null);
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    (response: AuthResponse) => {
      setStoredToken(response.token);
      setToken(response.token);
      setUser(response.user);
      setStatus("authenticated");
      qc.invalidateQueries();
    },
    [qc],
  );

  const logout = useCallback(() => {
    setStoredToken(null);
    setToken(null);
    setUser(null);
    setStatus("unauthenticated");
    qc.clear();
  }, [qc]);

  const value = useMemo<AuthContextValue>(
    () => ({ token, user, status, login, logout, refresh }),
    [token, user, status, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
