import { pgTable, serial, integer, varchar, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const stockCountSessionsTable = pgTable("stock_count_sessions", {
  id: serial("id").primaryKey(),
  startedBy: integer("started_by"),
  status: varchar("status", { length: 20 }).default("in_progress"),
  notes: text("notes"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const stockCountEntriesTable = pgTable("stock_count_entries", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  itemId: integer("item_id").notNull(),
  systemQty: numeric("system_qty", { precision: 12, scale: 2 }).notNull(),
  countedQty: numeric("counted_qty", { precision: 12, scale: 2 }).notNull(),
  variance: numeric("variance", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type StockCountSession = typeof stockCountSessionsTable.$inferSelect;
export type StockCountEntry = typeof stockCountEntriesTable.$inferSelect;
