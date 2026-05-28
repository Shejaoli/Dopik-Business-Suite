import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { itemsTable } from "./items";

export const serialNumbersTable = pgTable("serial_numbers", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull().references(() => itemsTable.id, { onDelete: "cascade" }),
  serialNumber: varchar("serial_number", { length: 200 }).notNull().unique(),
  status: varchar("status", { length: 30 }).notNull().default("in_stock"),
  referenceType: varchar("reference_type", { length: 30 }),
  referenceId: integer("reference_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertSerialNumberSchema = createInsertSchema(serialNumbersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSerialNumber = z.infer<typeof insertSerialNumberSchema>;
export type SerialNumber = typeof serialNumbersTable.$inferSelect;
