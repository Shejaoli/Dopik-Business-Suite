import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const activityLogTable = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id),
  userName: varchar("user_name", { length: 100 }),
  userRole: varchar("user_role", { length: 30 }),
  action: varchar("action", { length: 100 }).notNull(),
  description: text("description").notNull(),
  ipAddress: varchar("ip_address", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type ActivityLog = typeof activityLogTable.$inferSelect;
