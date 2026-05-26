import { pgTable, serial, integer, numeric, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const expenseAccountsTable = pgTable("expense_accounts", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  accountType: varchar("account_type", { length: 30 }).default("expense"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => expenseAccountsTable.id),
  paymentMethod: varchar("payment_method", { length: 30 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  paidBy: integer("paid_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertExpenseAccountSchema = createInsertSchema(expenseAccountsTable).omit({ id: true, createdAt: true });
export type InsertExpenseAccount = z.infer<typeof insertExpenseAccountSchema>;
export type ExpenseAccount = typeof expenseAccountsTable.$inferSelect;

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({ id: true, createdAt: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;
