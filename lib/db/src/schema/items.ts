import { pgTable, serial, varchar, numeric, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ITEM_CATEGORIES = [
  "Smartphone",
  "Phone Accessories",
  "Laptop",
  "Laptop Accessories",
  "Tablet",
  "Gaming",
  "Gaming Accessories",
  "Smartwatches",
  "Audio",
  "Cameras",
  "Camera Accessories",
  "Others",
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const itemsTable = pgTable("items", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  category: varchar("category", { length: 100 }).notNull().default("Others"),
  trackSerial: boolean("track_serial").notNull().default(false),
  purchasePrice: numeric("purchase_price", { precision: 12, scale: 2 }).notNull().default("0"),
  salePrice: numeric("sale_price", { precision: 12, scale: 2 }).notNull().default("0"),
  alternativeItemId: integer("alternative_item_id").references((): any => itemsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertItemSchema = createInsertSchema(itemsTable).omit({ id: true, createdAt: true });
export type InsertItem = z.infer<typeof insertItemSchema>;
export type Item = typeof itemsTable.$inferSelect;
