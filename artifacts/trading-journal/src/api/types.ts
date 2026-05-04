export type ApiUser = {
  id: number;
  username: string;
  createdAt: string;
};

export type AuthResponse = {
  token: string;
  user: ApiUser;
};

export type Trade = {
  id: number;
  userId: number;
  ticket: string;
  symbol: string;
  side: "BUY" | "SELL";
  volume: number;
  openPrice: number;
  closePrice: number;
  openTime: string;
  closeTime: string;
  profit: number;
  commission: number;
  swap: number;
  mae: number | null;
  mfe: number | null;
  magicNumber: number | null;
  notes: string | null;
  createdAt: string;
};

export type StatsSummary = {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnl: number;
  grossProfit: number;
  grossLoss: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
  averageWin: number;
  averageLoss: number;
  riskReward: number;
  maxDrawdownPct: number;
  bestTrade: number;
  worstTrade: number;
};

export type EquityPoint = {
  index: number;
  ticket: string;
  symbol: string;
  closeTime: string;
  profit: number;
  equity: number;
  drawdownPct: number;
};

export type SymbolStats = {
  symbol: string;
  trades: number;
  pnl: number;
  winRate: number;
  averagePnl: number;
};

export type CalendarDay = {
  date: string;
  pnl: number;
  trades: number;
};

export type CalendarMonth = {
  year: number;
  month: number;
  totalPnl: number;
  totalTrades: number;
  days: CalendarDay[];
};

export type Insights = {
  traderScore: number;
  flags: { id: string; label: string; severity: "info" | "warn" | "critical" }[];
  notes: string[];
};
