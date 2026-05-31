import { pgTable, serial, integer, varchar, numeric, timestamp, text } from "drizzle-orm/pg-core";
import { itemsTable } from "./items";
import { vendorsTable } from "./vendors";
import { purchasesTable } from "./purchases";
import { customersTable } from "./customers";

export const serializedUnitsTable = pgTable("serialized_units", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull().references(() => itemsTable.id),
  imeiOrSerial: varchar("imei_or_serial", { length: 200 }),
  color: varchar("color", { length: 100 }),
  storage: varchar("storage", { length: 50 }),
  condition: varchar("condition", { length: 100 }),
  vendorId: integer("vendor_id").references(() => vendorsTable.id),
  purchaseId: integer("purchase_id").references(() => purchasesTable.id),
  costPrice: numeric("cost_price", { precision: 12, scale: 2 }),
  paymentMethod: varchar("payment_method", { length: 30 }),
  status: varchar("status", { length: 30 }).default("in_stock"),
  notes: text("notes"),
  dateReceived: timestamp("date_received", { withTimezone: true }).defaultNow(),
  saleId: integer("sale_id"),
  soldAt: timestamp("sold_at", { withTimezone: true }),
  soldPrice: numeric("sold_price", { precision: 12, scale: 2 }),
  soldToCustomerId: integer("sold_to_customer_id").references(() => customersTable.id),
});

export type SerializedUnit = typeof serializedUnitsTable.$inferSelect;
