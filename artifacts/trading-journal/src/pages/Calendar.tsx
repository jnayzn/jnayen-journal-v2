import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useStatsCalendar } from "@/api/hooks";
import type { CalendarDay } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function colorFor(pnl: number, peak: number): string {
  if (pnl === 0) return "bg-muted/40";
  const pct = peak > 0 ? Math.min(1, Math.abs(pnl) / peak) : 0;
  const intensity = 0.15 + pct * 0.6;
  return pnl > 0
    ? `bg-success/${Math.round(intensity * 100)}`
    : `bg-danger/${Math.round(intensity * 100)}`;
}

export function Calendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const cal = useStatsCalendar(year, month);

  const days = cal.data?.days ?? [];
  const peak = Math.max(...days.map((d: CalendarDay) => Math.abs(d.pnl)), 1);
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const startOffset = (firstDay.getUTCDay() + 6) % 7;

  const navMonth = (delta: number) => {
    const dt = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(dt.getUTCFullYear());
    setMonth(dt.getUTCMonth() + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Daily P&L heatmap.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[10rem] text-center text-sm font-medium">
            {firstDay.toLocaleString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </span>
          <Button variant="outline" size="icon" onClick={() => navMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {cal.data
              ? `Total P&L: ${formatCurrency(cal.data.totalPnl)} (${cal.data.totalTrades} trades)`
              : "Loading…"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cal.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="grid grid-cols-7 gap-2 text-xs">
              {WEEKDAYS.map((w) => (
                <div
                  key={w}
                  className="px-2 py-1 text-center text-muted-foreground"
                >
                  {w}
                </div>
              ))}
              {Array.from({ length: startOffset }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {days.map((d: CalendarDay) => {
                const day = new Date(`${d.date}T00:00:00Z`).getUTCDate();
                return (
                  <div
                    key={d.date}
                    className={cn(
                      "rounded-md border border-border p-2 text-left",
                      colorFor(d.pnl, peak),
                    )}
                    title={`${d.date}: ${formatCurrency(d.pnl)} (${d.trades} trades)`}
                  >
                    <div className="text-xs text-muted-foreground">{day}</div>
                    {d.trades > 0 && (
                      <div
                        className={cn(
                          "text-xs font-semibold",
                          d.pnl >= 0 ? "text-success" : "text-danger",
                        )}
                      >
                        {formatCurrency(d.pnl, "USD", 0)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
