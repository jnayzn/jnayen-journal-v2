import {
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { usersTable } from "./users";

export const tradesTable = pgTable(
  "trades",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    ticket: text("ticket").notNull(),
    symbol: text("symbol").notNull(),
    side: text("side").notNull(),
    volume: real("volume").notNull(),
    openPrice: real("open_price").notNull(),
    closePrice: real("close_price").notNull(),
    openTime: timestamp("open_time", { withTimezone: true }).notNull(),
    closeTime: timestamp("close_time", { withTimezone: true }).notNull(),
    profit: real("profit").notNull(),
    commission: real("commission").notNull().default(0),
    swap: real("swap").notNull().default(0),
    mae: real("mae"),
    mfe: real("mfe"),
    magicNumber: integer("magic_number"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqueUserTicket: unique("trades_user_ticket_unique").on(t.userId, t.ticket),
  }),
);

export type Trade = typeof tradesTable.$inferSelect;
export type NewTrade = typeof tradesTable.$inferInsert;

export const tradeSelectSchema = createSelectSchema(tradesTable);
export const tradeInsertSchema = createInsertSchema(tradesTable);
