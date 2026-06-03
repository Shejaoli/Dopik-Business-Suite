import { pgTable, serial, integer, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body"),
  referenceId: integer("reference_id"),
  referenceType: varchar("reference_type", { length: 50 }),
  read: boolean("read").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type Notification = typeof notificationsTable.$inferSelect;
