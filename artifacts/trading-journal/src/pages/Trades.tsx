import { Plus, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import {
  useCreateTrade,
  useDeleteTrade,
  useImportTrades,
  useTradesList,
} from "@/api/hooks";
import type { Trade } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDateTime } from "@/lib/utils";

type FormState = {
  ticket: string;
  symbol: string;
  side: "BUY" | "SELL";
  volume: string;
  openPrice: string;
  closePrice: string;
  openTime: string;
  closeTime: string;
  profit: string;
  commission: string;
  swap: string;
  notes: string;
};

const initialForm: FormState = {
  ticket: "",
  symbol: "EURUSD",
  side: "BUY",
  volume: "0.1",
  openPrice: "0",
  closePrice: "0",
  openTime: new Date(Date.now() - 3_600_000).toISOString().slice(0, 16),
  closeTime: new Date().toISOString().slice(0, 16),
  profit: "0",
  commission: "0",
  swap: "0",
  notes: "",
};

export function Trades() {
  const list = useTradesList({ limit: 200 });
  const createTrade = useCreateTrade();
  const deleteTrade = useDeleteTrade();
  const importTrades = useImportTrades();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);
  const fileRef = useRef<HTMLInputElement>(null);

  const items = list.data?.items ?? [];

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createTrade.mutateAsync({
      ticket: form.ticket,
      symbol: form.symbol,
      side: form.side,
      volume: Number(form.volume),
      openPrice: Number(form.openPrice),
      closePrice: Number(form.closePrice),
      openTime: new Date(form.openTime).toISOString(),
      closeTime: new Date(form.closeTime).toISOString(),
      profit: Number(form.profit),
      commission: Number(form.commission),
      swap: Number(form.swap),
      mae: null,
      mfe: null,
      magicNumber: null,
      notes: form.notes || null,
    });
    setForm(initialForm);
    setOpen(false);
  };

  const onImport = async (file: File) => {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) {
      throw new Error("Import file must be a JSON array of trades.");
    }
    await importTrades.mutateAsync(
      data.map((t: Record<string, unknown>) => ({
        ticket: String(t.ticket),
        symbol: String(t.symbol),
        side: (t.side === "SELL" ? "SELL" : "BUY") as "BUY" | "SELL",
        volume: Number(t.volume ?? 0),
        openPrice: Number(t.openPrice ?? t.open_price ?? 0),
        closePrice: Number(t.closePrice ?? t.close_price ?? 0),
        openTime: new Date(String(t.openTime ?? t.open_time)).toISOString(),
        closeTime: new Date(String(t.closeTime ?? t.close_time)).toISOString(),
        profit: Number(t.profit ?? 0),
        commission: Number(t.commission ?? 0),
        swap: Number(t.swap ?? 0),
        mae: t.mae == null ? null : Number(t.mae),
        mfe: t.mfe == null ? null : Number(t.mfe),
        magicNumber:
          t.magicNumber == null && t.magic_number == null
            ? null
            : Number(t.magicNumber ?? t.magic_number),
        notes: typeof t.notes === "string" ? t.notes : null,
      })),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trades</h1>
          <p className="text-sm text-muted-foreground">
            Manage your trade history. Bulk import JSON or add manually.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) await onImport(f);
              if (fileRef.current) fileRef.current.value = "";
            }}
          />
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={importTrades.isPending}
          >
            <Upload className="h-4 w-4" /> Import JSON
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add trade
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{items.length} trades</CardTitle>
        </CardHeader>
        <CardContent>
          {list.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : items.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No trades yet. Use “Add trade” or import a JSON file.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">P&amp;L</TableHead>
                  <TableHead>Closed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((t: Trade) => {
                  const net = t.profit + t.commission + t.swap;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.ticket}</TableCell>
                      <TableCell>{t.symbol}</TableCell>
                      <TableCell>
                        <Badge
                          variant={t.side === "BUY" ? "success" : "danger"}
                        >
                          {t.side}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{t.volume}</TableCell>
                      <TableCell
                        className={`text-right font-semibold ${
                          net >= 0 ? "text-success" : "text-danger"
                        }`}
                      >
                        {formatCurrency(net)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(t.closeTime)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteTrade.mutate(t.id)}
                          disabled={deleteTrade.isPending}
                          aria-label="Delete trade"
                        >
                          <Trash2 className="h-4 w-4 text-danger" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add trade</DialogTitle>
            <DialogDescription>
              Fill in the trade details. Ticket must be unique per user.
            </DialogDescription>
          </DialogHeader>
          <form className="grid grid-cols-2 gap-3" onSubmit={onCreate}>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="ticket">Ticket</Label>
              <Input
                id="ticket"
                value={form.ticket}
                onChange={(e) => setForm({ ...form, ticket: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                value={form.symbol}
                onChange={(e) =>
                  setForm({ ...form, symbol: e.target.value.toUpperCase() })
                }
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="side">Side</Label>
              <select
                id="side"
                className="flex h-9 w-full rounded-md border border-border bg-input px-3 text-sm"
                value={form.side}
                onChange={(e) =>
                  setForm({
                    ...form,
                    side: e.target.value as "BUY" | "SELL",
                  })
                }
              >
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="volume">Volume (lots)</Label>
              <Input
                id="volume"
                type="number"
                step="0.01"
                value={form.volume}
                onChange={(e) => setForm({ ...form, volume: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="profit">Profit</Label>
              <Input
                id="profit"
                type="number"
                step="0.01"
                value={form.profit}
                onChange={(e) => setForm({ ...form, profit: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="openPrice">Open price</Label>
              <Input
                id="openPrice"
                type="number"
                step="0.0001"
                value={form.openPrice}
                onChange={(e) =>
                  setForm({ ...form, openPrice: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="closePrice">Close price</Label>
              <Input
                id="closePrice"
                type="number"
                step="0.0001"
                value={form.closePrice}
                onChange={(e) =>
                  setForm({ ...form, closePrice: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="openTime">Open time</Label>
              <Input
                id="openTime"
                type="datetime-local"
                value={form.openTime}
                onChange={(e) => setForm({ ...form, openTime: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="closeTime">Close time</Label>
              <Input
                id="closeTime"
                type="datetime-local"
                value={form.closeTime}
                onChange={(e) =>
                  setForm({ ...form, closeTime: e.target.value })
                }
                required
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            {createTrade.error && (
              <p className="col-span-2 text-sm text-destructive">
                {(createTrade.error as Error).message}
              </p>
            )}
            <DialogFooter className="col-span-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createTrade.isPending}>
                {createTrade.isPending ? "Saving…" : "Save trade"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
