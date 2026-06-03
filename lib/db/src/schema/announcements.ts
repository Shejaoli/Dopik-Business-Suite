import { pgTable, serial, varchar, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const announcementsTable = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body").notNull(),
  priority: varchar("priority", { length: 20 }).default("normal"),
  pinned: boolean("pinned").default(false),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type Announcement = typeof announcementsTable.$inferSelect;
