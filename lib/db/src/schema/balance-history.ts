import { pgTable, serial, integer, numeric, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const balanceHistoryTable = pgTable("balance_history", {
  id: serial("id").primaryKey(),
  method: varchar("method", { length: 30 }).notNull(),
  type: varchar("type", { length: 10 }).notNull(), // "add" | "reduce" | "set"
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  reason: text("reason"),
  balanceBefore: numeric("balance_before", { precision: 12, scale: 2 }).notNull(),
  balanceAfter: numeric("balance_after", { precision: 12, scale: 2 }).notNull(),
  performedBy: integer("performed_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type BalanceHistory = typeof balanceHistoryTable.$inferSelect;
