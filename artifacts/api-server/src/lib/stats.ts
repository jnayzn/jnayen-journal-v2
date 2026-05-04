import type { Trade } from "@workspace/db";

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

function netProfit(t: Trade): number {
  return (t.profit ?? 0) + (t.commission ?? 0) + (t.swap ?? 0);
}

export function sortByCloseTime(trades: Trade[]): Trade[] {
  return [...trades].sort(
    (a, b) =>
      new Date(a.closeTime).getTime() - new Date(b.closeTime).getTime(),
  );
}

export function computeSummary(trades: Trade[]): StatsSummary {
  const total = trades.length;
  if (total === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      totalPnl: 0,
      grossProfit: 0,
      grossLoss: 0,
      winRate: 0,
      profitFactor: 0,
      expectancy: 0,
      averageWin: 0,
      averageLoss: 0,
      riskReward: 0,
      maxDrawdownPct: 0,
      bestTrade: 0,
      worstTrade: 0,
    };
  }
  const wins = trades.filter((t) => netProfit(t) > 0);
  const losses = trades.filter((t) => netProfit(t) < 0);
  const grossProfit = wins.reduce((acc, t) => acc + netProfit(t), 0);
  const grossLoss = Math.abs(losses.reduce((acc, t) => acc + netProfit(t), 0));
  const totalPnl = trades.reduce((acc, t) => acc + netProfit(t), 0);
  const averageWin = wins.length ? grossProfit / wins.length : 0;
  const averageLoss = losses.length ? grossLoss / losses.length : 0;
  const winRate = wins.length / total;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
  const expectancy = winRate * averageWin - (1 - winRate) * averageLoss;
  const riskReward = averageLoss > 0 ? averageWin / averageLoss : 0;

  const equity = computeEquity(trades);
  const maxDrawdownPct = equity.reduce(
    (acc, p) => Math.min(acc, p.drawdownPct),
    0,
  );
  const profits = trades.map(netProfit);
  return {
    totalTrades: total,
    winningTrades: wins.length,
    losingTrades: losses.length,
    totalPnl,
    grossProfit,
    grossLoss,
    winRate,
    profitFactor,
    expectancy,
    averageWin,
    averageLoss,
    riskReward,
    maxDrawdownPct,
    bestTrade: Math.max(...profits, 0),
    worstTrade: Math.min(...profits, 0),
  };
}

export function computeEquity(trades: Trade[]): EquityPoint[] {
  const sorted = sortByCloseTime(trades);
  let equity = 0;
  let peak = 0;
  return sorted.map((t, idx) => {
    const profit = netProfit(t);
    equity += profit;
    if (equity > peak) peak = equity;
    const drawdownPct = peak > 0 ? ((equity - peak) / peak) * 100 : 0;
    return {
      index: idx + 1,
      ticket: t.ticket,
      symbol: t.symbol,
      closeTime: new Date(t.closeTime).toISOString(),
      profit,
      equity,
      drawdownPct,
    };
  });
}

export function computeBySymbol(trades: Trade[]): SymbolStats[] {
  const byKey = new Map<string, Trade[]>();
  for (const t of trades) {
    const list = byKey.get(t.symbol) ?? [];
    list.push(t);
    byKey.set(t.symbol, list);
  }
  return Array.from(byKey.entries())
    .map(([symbol, ts]) => {
      const pnl = ts.reduce((acc, t) => acc + netProfit(t), 0);
      const wins = ts.filter((t) => netProfit(t) > 0).length;
      return {
        symbol,
        trades: ts.length,
        pnl,
        winRate: ts.length ? wins / ts.length : 0,
        averagePnl: ts.length ? pnl / ts.length : 0,
      };
    })
    .sort((a, b) => b.pnl - a.pnl);
}

export function computeCalendar(
  trades: Trade[],
  year: number,
  month: number,
): CalendarMonth {
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const lastDay = new Date(Date.UTC(year, month, 0));
  const filtered = trades.filter((t) => {
    const d = new Date(t.closeTime);
    return d >= firstDay && d <= new Date(lastDay.getTime() + 86_400_000 - 1);
  });
  const byDay = new Map<string, { pnl: number; trades: number }>();
  for (const t of filtered) {
    const d = new Date(t.closeTime);
    const key = d.toISOString().slice(0, 10);
    const cur = byDay.get(key) ?? { pnl: 0, trades: 0 };
    cur.pnl += netProfit(t);
    cur.trades += 1;
    byDay.set(key, cur);
  }
  const days: CalendarDay[] = [];
  for (let day = 1; day <= lastDay.getUTCDate(); day += 1) {
    const date = new Date(Date.UTC(year, month - 1, day))
      .toISOString()
      .slice(0, 10);
    const cur = byDay.get(date);
    days.push({ date, pnl: cur?.pnl ?? 0, trades: cur?.trades ?? 0 });
  }
  return {
    year,
    month,
    totalPnl: days.reduce((acc, d) => acc + d.pnl, 0),
    totalTrades: days.reduce((acc, d) => acc + d.trades, 0),
    days,
  };
}

export function computeInsights(trades: Trade[]): Insights {
  const summary = computeSummary(trades);
  const flags: Insights["flags"] = [];
  const notes: string[] = [];

  if (summary.totalTrades === 0) {
    return {
      traderScore: 0,
      flags: [
        { id: "no-trades", label: "No trades yet", severity: "info" },
      ],
      notes: ["Import your MT5 history or add trades manually to see insights."],
    };
  }

  if (summary.profitFactor >= 1.5) {
    notes.push(`Strong profit factor of ${summary.profitFactor.toFixed(2)}.`);
  } else if (summary.profitFactor < 1) {
    flags.push({
      id: "negative-edge",
      label: "Profit factor below 1.0 — losses outweigh gains.",
      severity: "critical",
    });
  }

  if (summary.maxDrawdownPct < -25) {
    flags.push({
      id: "deep-drawdown",
      label: `Max drawdown ${summary.maxDrawdownPct.toFixed(1)}%`,
      severity: "warn",
    });
  }

  if (summary.winRate < 0.4) {
    flags.push({
      id: "low-winrate",
      label: `Win rate only ${(summary.winRate * 100).toFixed(0)}%`,
      severity: "warn",
    });
  }

  // Revenge trading heuristic: closing within 5 minutes of a loss with double size.
  const sorted = sortByCloseTime(trades);
  let revenge = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (!prev || !cur) continue;
    const prevProfit = netProfit(prev);
    if (prevProfit >= 0) continue;
    const gapMinutes =
      (new Date(cur.openTime).getTime() - new Date(prev.closeTime).getTime()) /
      60000;
    if (gapMinutes <= 5 && cur.volume >= prev.volume * 1.5) revenge += 1;
  }
  if (revenge > 0) {
    flags.push({
      id: "revenge-trading",
      label: `${revenge} likely revenge trade(s) detected`,
      severity: "warn",
    });
  }

  // Trader score 0-100: weighted blend.
  const pfScore = Math.min(50, Math.max(0, (summary.profitFactor - 1) * 25));
  const wrScore = Math.min(25, summary.winRate * 50);
  const ddScore = Math.max(0, 25 + summary.maxDrawdownPct);
  const traderScore = Math.round(
    Math.min(100, Math.max(0, pfScore + wrScore + ddScore)),
  );
  notes.push(
    `Total of ${summary.totalTrades} trades, net P&L ${summary.totalPnl.toFixed(2)}.`,
  );
  return { traderScore, flags, notes };
}
