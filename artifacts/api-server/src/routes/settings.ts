import { Router } from "express";
import { eq } from "drizzle-orm";
import { pool, db, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();

const SETTINGS_KEY = "feature_flags";

const FLAG_DEFAULTS: Record<string, boolean> = {
  showItemsPage: false,
  showAddUnitButton: true,
  repairTracking: true,
  creditInstallments: true,
  customerCRM: true,
  expenseTracking: true,
  staffPermissions: true,
  chartsAnalytics: true,
  reports: true,
  consignment: true,
  loans: true,
  stockCount: true,
  restockIntelligence: true,
  announcements: true,
  receiptScanner: true,
  usageAnalytics: true,
};

router.get("/settings/features", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT value FROM app_settings WHERE key = $1",
      [SETTINGS_KEY]
    );
    const stored = result.rows[0]?.value ?? {};
    res.json({ ...FLAG_DEFAULTS, ...stored });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/settings/features", requireAuth, async (req, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));
  if (!user || !["owner", "admin", "manager"].includes(user.role ?? "")) {
    return res.status(403).json({ error: "Only owners and admins can change feature settings" });
  }
  try {
    const flags = req.body;
    await pool.query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
      [SETTINGS_KEY, JSON.stringify(flags)]
    );
    res.json({ ...FLAG_DEFAULTS, ...flags });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
