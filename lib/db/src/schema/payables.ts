import { pgTable, serial, integer, numeric, varchar, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { purchasesTable } from "./purchases";
import { vendorsTable } from "./vendors";
import { usersTable } from "./users";

export const payablesTable = pgTable("payables", {
  id: serial("id").primaryKey(),
  purchaseId: integer("purchase_id").notNull().references(() => purchasesTable.id),
  vendorId: integer("vendor_id").references(() => vendorsTable.id),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  dueDate: date("due_date"),
  status: varchar("status", { length: 20 }).default("unpaid"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const payablePaymentsTable = pgTable("payable_payments", {
  id: serial("id").primaryKey(),
  payableId: integer("payable_id").notNull().references(() => payablesTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 30 }),
  paidAt: timestamp("paid_at", { withTimezone: true }).defaultNow(),
  recordedBy: integer("recorded_by").references(() => usersTable.id),
});

export const insertPayableSchema = createInsertSchema(payablesTable).omit({ id: true, createdAt: true });
export type InsertPayable = z.infer<typeof insertPayableSchema>;
export type Payable = typeof payablesTable.$inferSelect;
