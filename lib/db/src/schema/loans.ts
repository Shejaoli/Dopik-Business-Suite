import { pgTable, serial, integer, numeric, varchar, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";
import { usersTable } from "./users";

export const loansTable = pgTable("loans", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  description: text("description"),
  dueDate: date("due_date"),
  status: varchar("status", { length: 20 }).default("active"),
  recordedBy: integer("recorded_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const loanPaymentsTable = pgTable("loan_payments", {
  id: serial("id").primaryKey(),
  loanId: integer("loan_id").notNull().references(() => loansTable.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 30 }).default("cash"),
  note: text("note"),
  paidAt: timestamp("paid_at", { withTimezone: true }).defaultNow(),
  recordedBy: integer("recorded_by").references(() => usersTable.id),
});

export const insertLoanSchema = createInsertSchema(loansTable).omit({ id: true, createdAt: true, paidAmount: true, status: true });
export type InsertLoan = z.infer<typeof insertLoanSchema>;
export type Loan = typeof loansTable.$inferSelect;

export const insertLoanPaymentSchema = createInsertSchema(loanPaymentsTable).omit({ id: true, paidAt: true });
export type InsertLoanPayment = z.infer<typeof insertLoanPaymentSchema>;
export type LoanPayment = typeof loanPaymentsTable.$inferSelect;
