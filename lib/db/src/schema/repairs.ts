import { pgTable, serial, integer, varchar, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";
import { usersTable } from "./users";

export const repairJobsTable = pgTable("repair_jobs", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customersTable.id),
  customerName: varchar("customer_name", { length: 150 }),
  customerPhone: varchar("customer_phone", { length: 30 }),
  deviceType: varchar("device_type", { length: 50 }).notNull(),
  brand: varchar("brand", { length: 100 }),
  model: varchar("model", { length: 100 }),
  imeiOrSerial: varchar("imei_or_serial", { length: 200 }),
  problem: text("problem").notNull(),
  status: varchar("status", { length: 30 }).default("received"),
  technicianId: integer("technician_id").references(() => usersTable.id),
  priority: varchar("priority", { length: 20 }).default("normal"),
  estimatedCost: numeric("estimated_cost", { precision: 12, scale: 2 }),
  depositPaid: numeric("deposit_paid", { precision: 12, scale: 2 }).default("0"),
  laborCost: numeric("labor_cost", { precision: 12, scale: 2 }).default("0"),
  totalCost: numeric("total_cost", { precision: 12, scale: 2 }).default("0"),
  workDone: text("work_done"),
  warrantyDays: integer("warranty_days").default(30),
  notes: text("notes"),
  receivedDate: timestamp("received_date", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const repairPartsTable = pgTable("repair_parts", {
  id: serial("id").primaryKey(),
  repairId: integer("repair_id").notNull().references(() => repairJobsTable.id, { onDelete: "cascade" }),
  partName: varchar("part_name", { length: 200 }).notNull(),
  partCost: numeric("part_cost", { precision: 12, scale: 2 }).notNull(),
  quantity: integer("quantity").default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const repairStatusHistoryTable = pgTable("repair_status_history", {
  id: serial("id").primaryKey(),
  repairId: integer("repair_id").notNull().references(() => repairJobsTable.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 30 }).notNull(),
  notes: text("notes"),
  changedBy: integer("changed_by").references(() => usersTable.id),
  changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow(),
});

export type RepairJob = typeof repairJobsTable.$inferSelect;
export type RepairPart = typeof repairPartsTable.$inferSelect;
export type RepairStatusHistory = typeof repairStatusHistoryTable.$inferSelect;
