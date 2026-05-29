import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, balancesTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/balances", async (_req, res): Promise<void> => {
  const rows = await db.select().from(balancesTable);
  res.json(rows);
});

router.put("/balances/:method", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { method } = req.params;
    const { amount } = req.body;

    if (amount === undefined || amount === null || isNaN(Number(amount))) {
      res.status(400).json({ error: "Valid amount is required" });
      return;
    }

    const [existing] = await db.select().from(balancesTable).where(eq(balancesTable.method, method));

    if (!existing) {
      const [created] = await db.insert(balancesTable).values({
        method,
        amount: String(Number(amount).toFixed(2)),
      }).returning();
      res.json(created);
      return;
    }

    const [updated] = await db.update(balancesTable)
      .set({ amount: String(Number(amount).toFixed(2)), updatedAt: new Date() })
      .where(eq(balancesTable.method, method))
      .returning();

    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
