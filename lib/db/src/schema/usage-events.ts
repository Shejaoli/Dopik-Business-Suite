import { pgTable, serial, integer, varchar, jsonb, timestamp } from "drizzle-orm/pg-core";

export const usageEventsTable = pgTable("usage_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  page: varchar("page", { length: 100 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type UsageEvent = typeof usageEventsTable.$inferSelect;
