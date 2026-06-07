import { pgTable, serial, integer, numeric, varchar, boolean, timestamp, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";
import { itemsTable } from "./items";
import { usersTable } from "./users";

export const salesTable = pgTable("sales", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customersTable.id),
  paymentMethod: varchar("payment_method", { length: 30 }).default("cash"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).default("0"),
  discountType: varchar("discount_type", { length: 10 }),
  amountReceived: numeric("amount_received", { precision: 12, scale: 2 }),
  changeGiven: numeric("change_given", { precision: 12, scale: 2 }),
  paymentTermsDays: integer("payment_terms_days"),
  splitPaymentMethod2: varchar("split_payment_method_2", { length: 30 }),
  splitPaymentAmount1: numeric("split_payment_amount_1", { precision: 12, scale: 2 }),
  splitPaymentAmount2: numeric("split_payment_amount_2", { precision: 12, scale: 2 }),
  customerName: varchar("customer_name", { length: 200 }),
  customerPhone: varchar("customer_phone", { length: 30 }),
  recordedBy: integer("recorded_by").references(() => usersTable.id),
  reverted: boolean("reverted").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const saleItemsTable = pgTable("sale_items", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").notNull().references(() => salesTable.id, { onDelete: "cascade" }),
  itemId: integer("item_id").notNull().references(() => itemsTable.id),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull(),
  serializedUnitId: integer("serialized_unit_id"),
  additionalInfo: text("additional_info"),
});

export const insertSaleSchema = createInsertSchema(salesTable).omit({ id: true, createdAt: true });
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof salesTable.$inferSelect;

export const insertSaleItemSchema = createInsertSchema(saleItemsTable).omit({ id: true });
export type InsertSaleItem = z.infer<typeof insertSaleItemSchema>;
export type SaleItem = typeof saleItemsTable.$inferSelect;
