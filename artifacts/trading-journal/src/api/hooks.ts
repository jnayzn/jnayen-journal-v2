import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { apiFetch, setStoredToken } from "./client";
import type {
  AuthResponse,
  CalendarMonth,
  EquityPoint,
  Insights,
  StatsSummary,
  SymbolStats,
  Trade,
} from "./types";

// ---------- Auth ----------
export function useLogin() {
  return useMutation({
    mutationFn: (credentials: { username: string; password: string }) =>
      apiFetch<AuthResponse>("/auth/login", {
        method: "POST",
        body: credentials,
      }),
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (credentials: { username: string; password: string }) =>
      apiFetch<AuthResponse>("/auth/register", {
        method: "POST",
        body: credentials,
      }),
  });
}

export function useMe(enabled = true) {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiFetch<{ token: string; user: AuthResponse["user"] }>("/auth/me"),
    enabled,
    retry: false,
  });
}

export function useRegenerateToken(qc: QueryClient = useQueryClient()) {
  return useMutation({
    mutationFn: () =>
      apiFetch<AuthResponse>("/auth/regenerate-token", { method: "POST" }),
    onSuccess: (data) => {
      setStoredToken(data.token);
      qc.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });
}

// ---------- Trades ----------
export function useTradesList(params: {
  symbol?: string;
  side?: "BUY" | "SELL";
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const sp = new URLSearchParams();
  if (params.symbol) sp.set("symbol", params.symbol);
  if (params.side) sp.set("side", params.side);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.limit !== undefined) sp.set("limit", String(params.limit));
  if (params.offset !== undefined) sp.set("offset", String(params.offset));
  const qs = sp.toString();
  return useQuery({
    queryKey: ["trades", "list", params],
    queryFn: () =>
      apiFetch<{ items: Trade[]; limit: number; offset: number }>(
        `/trades${qs ? `?${qs}` : ""}`,
      ),
  });
}

export function useCreateTrade(qc: QueryClient = useQueryClient()) {
  return useMutation({
    mutationFn: (trade: Omit<Trade, "id" | "userId" | "createdAt">) =>
      apiFetch<{ trade: Trade }>("/trades", {
        method: "POST",
        body: trade,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trades"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

export function useImportTrades(qc: QueryClient = useQueryClient()) {
  return useMutation({
    mutationFn: (trades: Array<Omit<Trade, "id" | "userId" | "createdAt">>) =>
      apiFetch<{ inserted: number; skipped: number }>("/trades/import", {
        method: "POST",
        body: trades,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trades"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

export function useDeleteTrade(qc: QueryClient = useQueryClient()) {
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ deleted: number }>(`/trades/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trades"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

// ---------- Stats ----------
export function useStatsSummary() {
  return useQuery({
    queryKey: ["stats", "summary"],
    queryFn: () => apiFetch<StatsSummary>("/stats/summary"),
  });
}

export function useStatsEquity() {
  return useQuery({
    queryKey: ["stats", "equity"],
    queryFn: () => apiFetch<{ points: EquityPoint[] }>("/stats/equity"),
  });
}

export function useStatsBySymbol() {
  return useQuery({
    queryKey: ["stats", "by-symbol"],
    queryFn: () => apiFetch<{ symbols: SymbolStats[] }>("/stats/by-symbol"),
  });
}

export function useStatsCalendar(year: number, month: number) {
  return useQuery({
    queryKey: ["stats", "calendar", year, month],
    queryFn: () =>
      apiFetch<CalendarMonth>(`/stats/calendar?year=${year}&month=${month}`),
  });
}

export function useStatsInsights() {
  return useQuery({
    queryKey: ["stats", "insights"],
    queryFn: () => apiFetch<Insights>("/stats/insights"),
  });
}
