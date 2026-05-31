import { pgTable, serial, varchar, timestamp } from "drizzle-orm/pg-core";

export const colorsTable = pgTable("colors", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type Color = typeof colorsTable.$inferSelect;
