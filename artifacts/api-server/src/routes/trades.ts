import { and, desc, eq, gte, lte } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { getDb, tradesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();
router.use(requireAuth);

const sideEnum = z.enum(["BUY", "SELL"]);

const tradeInputSchema = z.object({
  ticket: z.string().min(1),
  symbol: z.string().min(1),
  side: sideEnum,
  volume: z.number().positive(),
  openPrice: z.number().nonnegative(),
  closePrice: z.number().nonnegative(),
  openTime: z.string().datetime({ offset: true }),
  closeTime: z.string().datetime({ offset: true }),
  profit: z.number(),
  commission: z.number().default(0),
  swap: z.number().default(0),
  mae: z.number().nullable().optional(),
  mfe: z.number().nullable().optional(),
  magicNumber: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const listQuerySchema = z.object({
  symbol: z.string().optional(),
  side: sideEnum.optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

router.get("/", async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query" });
      return;
    }
    const { symbol, side, from, to, limit = 100, offset = 0 } = parsed.data;
    const db = getDb();
    const conditions = [eq(tradesTable.userId, req.userId!)];
    if (symbol) conditions.push(eq(tradesTable.symbol, symbol));
    if (side) conditions.push(eq(tradesTable.side, side));
    if (from) conditions.push(gte(tradesTable.closeTime, new Date(from)));
    if (to) conditions.push(lte(tradesTable.closeTime, new Date(to)));
    const rows = await db
      .select()
      .from(tradesTable)
      .where(and(...conditions))
      .orderBy(desc(tradesTable.closeTime))
      .limit(limit)
      .offset(offset);
    res.json({ items: rows, limit, offset });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = tradeInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    const db = getDb();
    const inserted = await db
      .insert(tradesTable)
      .values({
        userId: req.userId!,
        ticket: parsed.data.ticket,
        symbol: parsed.data.symbol,
        side: parsed.data.side,
        volume: parsed.data.volume,
        openPrice: parsed.data.openPrice,
        closePrice: parsed.data.closePrice,
        openTime: new Date(parsed.data.openTime),
        closeTime: new Date(parsed.data.closeTime),
        profit: parsed.data.profit,
        commission: parsed.data.commission,
        swap: parsed.data.swap,
        mae: parsed.data.mae ?? null,
        mfe: parsed.data.mfe ?? null,
        magicNumber: parsed.data.magicNumber ?? null,
        notes: parsed.data.notes ?? null,
      })
      .onConflictDoNothing({
        target: [tradesTable.userId, tradesTable.ticket],
      })
      .returning();
    if (inserted.length === 0) {
      res.status(409).json({ error: "Duplicate ticket" });
      return;
    }
    res.status(201).json({ trade: inserted[0] });
  } catch (err) {
    next(err);
  }
});

router.post("/import", async (req, res, next) => {
  try {
    const parsed = z.array(tradeInputSchema).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    if (parsed.data.length === 0) {
      res.json({ inserted: 0, skipped: 0 });
      return;
    }
    const db = getDb();
    const inserted = await db
      .insert(tradesTable)
      .values(
        parsed.data.map((t) => ({
          userId: req.userId!,
          ticket: t.ticket,
          symbol: t.symbol,
          side: t.side,
          volume: t.volume,
          openPrice: t.openPrice,
          closePrice: t.closePrice,
          openTime: new Date(t.openTime),
          closeTime: new Date(t.closeTime),
          profit: t.profit,
          commission: t.commission,
          swap: t.swap,
          mae: t.mae ?? null,
          mfe: t.mfe ?? null,
          magicNumber: t.magicNumber ?? null,
          notes: t.notes ?? null,
        })),
      )
      .onConflictDoNothing({
        target: [tradesTable.userId, tradesTable.ticket],
      })
      .returning();
    res.json({
      inserted: inserted.length,
      skipped: parsed.data.length - inserted.length,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id ?? "", 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const db = getDb();
    const rows = await db
      .select()
      .from(tradesTable)
      .where(and(eq(tradesTable.id, id), eq(tradesTable.userId, req.userId!)))
      .limit(1);
    const trade = rows[0];
    if (!trade) {
      res.status(404).json({ error: "Trade not found" });
      return;
    }
    res.json({ trade });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id ?? "", 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const db = getDb();
    const deleted = await db
      .delete(tradesTable)
      .where(and(eq(tradesTable.id, id), eq(tradesTable.userId, req.userId!)))
      .returning();
    if (deleted.length === 0) {
      res.status(404).json({ error: "Trade not found" });
      return;
    }
    res.json({ deleted: deleted.length });
  } catch (err) {
    next(err);
  }
});

export default router;
