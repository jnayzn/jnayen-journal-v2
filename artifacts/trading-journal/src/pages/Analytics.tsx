import { useStatsBySymbol, useStatsInsights, useStatsSummary } from "@/api/hooks";
import { SymbolBarChart } from "@/components/charts/SymbolBarChart";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

const severityVariant: Record<string, BadgeProps["variant"]> = {
  info: "secondary",
  warn: "warning",
  critical: "destructive",
};

export function Analytics() {
  const summary = useStatsSummary();
  const symbols = useStatsBySymbol();
  const insights = useStatsInsights();

  const s = summary.data;
  const cards: { label: string; value: string }[] = s
    ? [
        { label: "Gross profit", value: formatCurrency(s.grossProfit) },
        { label: "Gross loss", value: formatCurrency(-s.grossLoss) },
        { label: "Average win", value: formatCurrency(s.averageWin) },
        { label: "Average loss", value: formatCurrency(-s.averageLoss) },
        { label: "Expectancy", value: formatCurrency(s.expectancy) },
        { label: "R/R ratio", value: formatNumber(s.riskReward) },
        { label: "Best trade", value: formatCurrency(s.bestTrade) },
        { label: "Worst trade", value: formatCurrency(s.worstTrade) },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Performance breakdown and behavioral signals.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Trader score{" "}
            {insights.data ? (
              <span className="ml-2 text-primary">
                {insights.data.traderScore}/100
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {insights.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {(insights.data?.flags ?? []).map((f) => (
                  <Badge key={f.id} variant={severityVariant[f.severity]}>
                    {f.label}
                  </Badge>
                ))}
              </div>
              <ul className="list-inside list-disc text-sm text-muted-foreground">
                {(insights.data?.notes ?? []).map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {summary.isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))
          : cards.map((c) => (
              <Card key={c.label}>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                    {c.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold">{c.value}</div>
                </CardContent>
              </Card>
            ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>P&L by symbol</CardTitle>
          </CardHeader>
          <CardContent>
            {symbols.isLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : (
              <SymbolBarChart data={symbols.data?.symbols ?? []} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Symbol breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {symbols.isLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead className="text-right">Trades</TableHead>
                    <TableHead className="text-right">Win rate</TableHead>
                    <TableHead className="text-right">P&amp;L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(symbols.data?.symbols ?? []).map((s) => (
                    <TableRow key={s.symbol}>
                      <TableCell className="font-medium">{s.symbol}</TableCell>
                      <TableCell className="text-right">{s.trades}</TableCell>
                      <TableCell className="text-right">
                        {formatPercent(s.winRate)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold ${s.pnl >= 0 ? "text-success" : "text-danger"}`}
                      >
                        {formatCurrency(s.pnl)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
