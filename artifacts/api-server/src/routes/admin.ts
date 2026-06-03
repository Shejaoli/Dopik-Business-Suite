import { Router } from "express";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { runBackup, getBackupStatus } from "../lib/pg-backup";
import { db, pool } from "@workspace/db";
import bcryptjs from "bcryptjs";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/admin/backup/run", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const result = await runBackup();
  if (result.success) {
    res.json({ success: true, file: result.file, message: "Backup completed successfully" });
  } else {
    res.status(500).json({ success: false, error: result.error });
  }
});

router.get("/admin/backup/status", requireAuth, requireAdmin, (_req, res): Promise<void> => {
  res.json(getBackupStatus());
  return Promise.resolve();
});

router.post("/admin/reset-data", requireAuth, async (req, res): Promise<void> => {
  const { password } = req.body;

  // Only owner role can reset data
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));
  if (!user || user.role !== "owner") {
    res.status(403).json({ error: "Only the owner can reset data" });
    return;
  }

  if (!password) {
    res.status(400).json({ error: "Password is required" });
    return;
  }

  const valid = await bcryptjs.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }

  const ipAddress = ((req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown").split(",")[0].trim();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Log the reset event BEFORE deleting — this table is never cleared
    await client.query(
      `INSERT INTO system_events (event_type, performed_by, ip_address, details) VALUES ($1, $2, $3, $4)`,
      ["data_reset", user.id, ipAddress, JSON.stringify({ performedBy: user.name, email: user.email, timestamp: new Date().toISOString() })]
    );

    const tables = [
      "credit_payments",
      "installment_plans",
      "credit_accounts",
      "sale_items",
      "sales",
      "serialized_units",
      "serial_numbers",
      "stock_count_entries",
      "stock_count_sessions",
      "payables",
      "receivables",
      "purchases",
      "expenses",
      "loans",
      "audit_logs",
      "activity_log",
      "usage_events",
      "notifications",
      "repairs",
      "announcements",
      "stock_adjustments",
      "customers",
    ];

    for (const t of tables) {
      await client.query(`DELETE FROM ${t}`);
    }

    // Reset stock quantities to 0
    await client.query("UPDATE stock SET quantity = '0', updated_at = NOW()");

    // Reset balances to 0
    await client.query("UPDATE balances SET amount = '0', updated_at = NOW()");

    await client.query("COMMIT");
    res.json({ ok: true, message: "All transaction data has been deleted. Stock and balances reset to zero." });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Reset data failed:", err);
    res.status(500).json({ error: err.message ?? "Reset failed" });
  } finally {
    client.release();
  }
});

export default router;
