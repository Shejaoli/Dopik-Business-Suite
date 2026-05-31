import { pgTable, serial, varchar, timestamp } from "drizzle-orm/pg-core";

export const storageOptionsTable = pgTable("storage_options", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type StorageOption = typeof storageOptionsTable.$inferSelect;
