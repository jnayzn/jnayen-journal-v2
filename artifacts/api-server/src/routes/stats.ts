import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { getDb, tradesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import {
  computeBySymbol,
  computeCalendar,
  computeEquity,
  computeInsights,
  computeSummary,
} from "../lib/stats";

const router = Router();
router.use(requireAuth);

async function loadTrades(userId: number) {
  const db = getDb();
  return db.select().from(tradesTable).where(eq(tradesTable.userId, userId));
}

router.get("/summary", async (req, res, next) => {
  try {
    const trades = await loadTrades(req.userId!);
    res.json(computeSummary(trades));
  } catch (err) {
    next(err);
  }
});

router.get("/equity", async (req, res, next) => {
  try {
    const trades = await loadTrades(req.userId!);
    res.json({ points: computeEquity(trades) });
  } catch (err) {
    next(err);
  }
});

router.get("/by-symbol", async (req, res, next) => {
  try {
    const trades = await loadTrades(req.userId!);
    res.json({ symbols: computeBySymbol(trades) });
  } catch (err) {
    next(err);
  }
});

const calendarQuery = z.object({
  year: z.coerce.number().int().min(1970).max(9999),
  month: z.coerce.number().int().min(1).max(12),
});

router.get("/calendar", async (req, res, next) => {
  try {
    const parsed = calendarQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid year/month" });
      return;
    }
    const trades = await loadTrades(req.userId!);
    res.json(computeCalendar(trades, parsed.data.year, parsed.data.month));
  } catch (err) {
    next(err);
  }
});

router.get("/insights", async (req, res, next) => {
  try {
    const trades = await loadTrades(req.userId!);
    res.json(computeInsights(trades));
  } catch (err) {
    next(err);
  }
});

export default router;
