import { pgTable, serial, integer, numeric, varchar, timestamp } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";
import { salesTable } from "./sales";
import { usersTable } from "./users";

export const creditAccountsTable = pgTable("credit_accounts", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").references(() => salesTable.id),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).notNull().default("0"),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull(),
  dueDate: timestamp("due_date", { withTimezone: true }),
  status: varchar("status", { length: 20 }).default("active"),
  notes: varchar("notes", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const creditPaymentsTable = pgTable("credit_payments", {
  id: serial("id").primaryKey(),
  creditAccountId: integer("credit_account_id").notNull().references(() => creditAccountsTable.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 30 }).default("cash"),
  notes: varchar("notes", { length: 300 }),
  recordedBy: integer("recorded_by").references(() => usersTable.id),
  paidAt: timestamp("paid_at", { withTimezone: true }).defaultNow(),
});

export const installmentPlansTable = pgTable("installment_plans", {
  id: serial("id").primaryKey(),
  creditAccountId: integer("credit_account_id").notNull().references(() => creditAccountsTable.id, { onDelete: "cascade" }),
  installmentNumber: integer("installment_number").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  status: varchar("status", { length: 20 }).default("pending"),
});

export type CreditAccount = typeof creditAccountsTable.$inferSelect;
export type CreditPayment = typeof creditPaymentsTable.$inferSelect;
export type InstallmentPlan = typeof installmentPlansTable.$inferSelect;
