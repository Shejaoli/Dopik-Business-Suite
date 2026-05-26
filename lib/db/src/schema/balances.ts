import { pgTable, serial, varchar, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const balancesTable = pgTable("balances", {
  id: serial("id").primaryKey(),
  method: varchar("method", { length: 30 }).notNull().unique(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertBalanceSchema = createInsertSchema(balancesTable).omit({ id: true, updatedAt: true });
export type InsertBalance = z.infer<typeof insertBalanceSchema>;
export type Balance = typeof balancesTable.$inferSelect;
