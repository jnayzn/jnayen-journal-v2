import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb, tradesTable, usersTable } from "@workspace/db";
import { generateToken, hashPassword } from "./lib/auth";
import { logger } from "./lib/logger";

const DEMO_USERNAME = "demo";
const DEMO_PASSWORD = "demo1234";

type SeedTrade = {
  ticket: string;
  symbol: string;
  side: "BUY" | "SELL";
  volume: number;
  openPrice: number;
  closePrice: number;
  hoursAgo: number;
  durationHours: number;
  profit: number;
  commission?: number;
  swap?: number;
  notes?: string;
};

const SEED: SeedTrade[] = [
  { ticket: "1001", symbol: "EURUSD", side: "BUY", volume: 0.5, openPrice: 1.085, closePrice: 1.092, hoursAgo: 24 * 21, durationHours: 4, profit: 350, notes: "London breakout" },
  { ticket: "1002", symbol: "EURUSD", side: "SELL", volume: 0.3, openPrice: 1.094, closePrice: 1.089, hoursAgo: 24 * 19, durationHours: 2, profit: 150 },
  { ticket: "1003", symbol: "GBPUSD", side: "BUY", volume: 0.4, openPrice: 1.265, closePrice: 1.258, hoursAgo: 24 * 18, durationHours: 6, profit: -280, notes: "Stop hit on NFP" },
  { ticket: "1004", symbol: "XAUUSD", side: "BUY", volume: 0.1, openPrice: 2310, closePrice: 2335, hoursAgo: 24 * 16, durationHours: 8, profit: 250 },
  { ticket: "1005", symbol: "USDJPY", side: "SELL", volume: 0.6, openPrice: 158.2, closePrice: 157.4, hoursAgo: 24 * 15, durationHours: 3, profit: 305, commission: -6 },
  { ticket: "1006", symbol: "EURUSD", side: "BUY", volume: 0.5, openPrice: 1.088, closePrice: 1.085, hoursAgo: 24 * 14, durationHours: 1, profit: -150, notes: "Premature exit" },
  { ticket: "1007", symbol: "GBPUSD", side: "SELL", volume: 0.5, openPrice: 1.272, closePrice: 1.265, hoursAgo: 24 * 13, durationHours: 5, profit: 350 },
  { ticket: "1008", symbol: "XAUUSD", side: "SELL", volume: 0.05, openPrice: 2340, closePrice: 2348, hoursAgo: 24 * 12, durationHours: 10, profit: -40 },
  { ticket: "1009", symbol: "EURUSD", side: "SELL", volume: 0.4, openPrice: 1.090, closePrice: 1.082, hoursAgo: 24 * 11, durationHours: 7, profit: 320 },
  { ticket: "1010", symbol: "USDJPY", side: "BUY", volume: 0.5, openPrice: 156.8, closePrice: 157.6, hoursAgo: 24 * 10, durationHours: 4, profit: 254, commission: -5 },
  { ticket: "1011", symbol: "EURUSD", side: "BUY", volume: 0.3, openPrice: 1.084, closePrice: 1.088, hoursAgo: 24 * 9, durationHours: 2, profit: 120 },
  { ticket: "1012", symbol: "GBPUSD", side: "BUY", volume: 0.4, openPrice: 1.260, closePrice: 1.255, hoursAgo: 24 * 8, durationHours: 6, profit: -200, notes: "Failed retest" },
  { ticket: "1013", symbol: "XAUUSD", side: "BUY", volume: 0.1, openPrice: 2330, closePrice: 2360, hoursAgo: 24 * 7, durationHours: 12, profit: 300, notes: "Trend day" },
  { ticket: "1014", symbol: "EURUSD", side: "SELL", volume: 0.5, openPrice: 1.092, closePrice: 1.088, hoursAgo: 24 * 6, durationHours: 4, profit: 200 },
  { ticket: "1015", symbol: "USDJPY", side: "SELL", volume: 0.4, openPrice: 158.0, closePrice: 158.5, hoursAgo: 24 * 5, durationHours: 1, profit: -127 },
  { ticket: "1016", symbol: "GBPUSD", side: "BUY", volume: 0.3, openPrice: 1.258, closePrice: 1.270, hoursAgo: 24 * 4, durationHours: 8, profit: 360, notes: "BoE hawkish" },
  { ticket: "1017", symbol: "XAUUSD", side: "SELL", volume: 0.08, openPrice: 2370, closePrice: 2362, hoursAgo: 24 * 3, durationHours: 5, profit: 64 },
  { ticket: "1018", symbol: "EURUSD", side: "BUY", volume: 0.6, openPrice: 1.086, closePrice: 1.082, hoursAgo: 24 * 2, durationHours: 3, profit: -240, notes: "Stopped out at PMI" },
  { ticket: "1019", symbol: "USDJPY", side: "BUY", volume: 0.5, openPrice: 157.2, closePrice: 158.6, hoursAgo: 24, durationHours: 12, profit: 446, commission: -4 },
  { ticket: "1020", symbol: "EURUSD", side: "BUY", volume: 0.4, openPrice: 1.083, closePrice: 1.090, hoursAgo: 6, durationHours: 4, profit: 280, notes: "Asian breakout" },
];

async function seed() {
  const db = getDb();

  let demo = (await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, DEMO_USERNAME))
    .limit(1))[0];

  if (!demo) {
    const passwordHash = await hashPassword(DEMO_PASSWORD);
    const inserted = await db
      .insert(usersTable)
      .values({
        username: DEMO_USERNAME,
        passwordHash,
        token: generateToken(),
      })
      .returning();
    demo = inserted[0];
    logger.info({ username: DEMO_USERNAME }, "created demo user");
  } else {
    logger.info({ username: DEMO_USERNAME }, "demo user already exists");
  }

  if (!demo) throw new Error("Failed to upsert demo user");

  const now = Date.now();
  const rows = SEED.map((t) => {
    const closeTime = new Date(now - t.hoursAgo * 3_600_000);
    const openTime = new Date(closeTime.getTime() - t.durationHours * 3_600_000);
    return {
      userId: demo!.id,
      ticket: t.ticket,
      symbol: t.symbol,
      side: t.side,
      volume: t.volume,
      openPrice: t.openPrice,
      closePrice: t.closePrice,
      openTime,
      closeTime,
      profit: t.profit,
      commission: t.commission ?? 0,
      swap: t.swap ?? 0,
      notes: t.notes ?? null,
    };
  });

  const inserted = await db
    .insert(tradesTable)
    .values(rows)
    .onConflictDoNothing({
      target: [tradesTable.userId, tradesTable.ticket],
    })
    .returning();
  logger.info(
    { inserted: inserted.length, skipped: rows.length - inserted.length },
    "seed complete",
  );
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        demo: { username: DEMO_USERNAME, password: DEMO_PASSWORD, token: demo.token },
        inserted: inserted.length,
      },
      null,
      2,
    ),
  );
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, "seed failed");
    process.exit(1);
  });
