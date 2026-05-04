import { motion } from "framer-motion";
import { TrendingDown, TrendingUp } from "lucide-react";
import {
  useStatsBySymbol,
  useStatsEquity,
  useStatsSummary,
} from "@/api/hooks";
import { EquityChart } from "@/components/charts/EquityChart";
import { SymbolBarChart } from "@/components/charts/SymbolBarChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string;
  delta?: number;
  loading?: boolean;
  positive?: boolean;
};

function StatCard({ label, value, delta, loading, positive }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
            {label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-7 w-24" />
          ) : (
            <div
              className={cn(
                "text-2xl font-bold",
                positive === true && "text-success",
                positive === false && "text-danger",
              )}
            >
              {value}
            </div>
          )}
          {delta !== undefined && !loading && (
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              {delta >= 0 ? (
                <TrendingUp className="h-3 w-3 text-success" />
              ) : (
                <TrendingDown className="h-3 w-3 text-danger" />
              )}
              <span>{formatPercent(delta)}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function Dashboard() {
  const summary = useStatsSummary();
  const equity = useStatsEquity();
  const bySymbol = useStatsBySymbol();

  const s = summary.data;
  const totalPnlColor = s ? s.totalPnl >= 0 : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of your trading performance.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Total P&L"
          value={s ? formatCurrency(s.totalPnl) : "—"}
          loading={summary.isLoading}
          positive={totalPnlColor}
        />
        <StatCard
          label="Win Rate"
          value={s ? formatPercent(s.winRate) : "—"}
          loading={summary.isLoading}
          positive={s ? s.winRate >= 0.5 : undefined}
        />
        <StatCard
          label="Profit Factor"
          value={s ? formatNumber(s.profitFactor) : "—"}
          loading={summary.isLoading}
          positive={s ? s.profitFactor >= 1.2 : undefined}
        />
        <StatCard
          label="Total Trades"
          value={s ? String(s.totalTrades) : "—"}
          loading={summary.isLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Equity Curve</CardTitle>
          </CardHeader>
          <CardContent>
            {equity.isLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : (
              <EquityChart points={equity.data?.points ?? []} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By Symbol</CardTitle>
          </CardHeader>
          <CardContent>
            {bySymbol.isLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : (
              <SymbolBarChart data={bySymbol.data?.symbols ?? []} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
