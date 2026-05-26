import { pgTable, serial, integer, numeric, varchar, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { salesTable } from "./sales";
import { customersTable } from "./customers";
import { usersTable } from "./users";

export const receivablesTable = pgTable("receivables", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").notNull().references(() => salesTable.id),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  dueDate: date("due_date"),
  status: varchar("status", { length: 20 }).default("unpaid"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const receivablePaymentsTable = pgTable("receivable_payments", {
  id: serial("id").primaryKey(),
  receivableId: integer("receivable_id").notNull().references(() => receivablesTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 30 }),
  paidAt: timestamp("paid_at", { withTimezone: true }).defaultNow(),
  recordedBy: integer("recorded_by").references(() => usersTable.id),
});

export const insertReceivableSchema = createInsertSchema(receivablesTable).omit({ id: true, createdAt: true });
export type InsertReceivable = z.infer<typeof insertReceivableSchema>;
export type Receivable = typeof receivablesTable.$inferSelect;
