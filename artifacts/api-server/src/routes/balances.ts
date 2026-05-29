import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, balancesTable, balanceHistoryTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/balances", async (_req, res): Promise<void> => {
  const rows = await db.select().from(balancesTable);
  res.json(rows);
});

router.get("/balances/history", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(balanceHistoryTable)
    .orderBy(desc(balanceHistoryTable.createdAt))
    .limit(300);
  res.json(rows);
});

router.post("/balances/:method/add", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { method } = req.params as { method: string };
    const { amount, reason } = req.body;
    const num = Number(amount);
    if (!num || isNaN(num) || num <= 0) {
      res.status(400).json({ error: "Valid positive amount is required" });
      return;
    }
    let [bal] = await db.select().from(balancesTable).where(eq(balancesTable.method, method));
    if (!bal) {
      [bal] = await db.insert(balancesTable).values({ method, amount: "0" }).returning();
    }
    const before = parseFloat(bal.amount);
    const after = before + num;
    const [updated] = await db.update(balancesTable)
      .set({ amount: after.toFixed(2), updatedAt: new Date() })
      .where(eq(balancesTable.method, method)).returning();
    await db.insert(balanceHistoryTable).values({
      method, type: "add", amount: num.toFixed(2), reason: reason || null,
      balanceBefore: before.toFixed(2), balanceAfter: after.toFixed(2),
      performedBy: req.session.userId || null,
    });
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/balances/:method/reduce", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { method } = req.params as { method: string };
    const { amount, reason } = req.body;
    const num = Number(amount);
    if (!num || isNaN(num) || num <= 0) {
      res.status(400).json({ error: "Valid positive amount is required" });
      return;
    }
    const [bal] = await db.select().from(balancesTable).where(eq(balancesTable.method, method));
    if (!bal) { res.status(404).json({ error: "Balance not found" }); return; }
    if (!reason) { res.status(400).json({ error: "Reason is required when reducing balance" }); return; }
    const before = parseFloat(bal.amount);
    const after = before - num;
    const [updated] = await db.update(balancesTable)
      .set({ amount: after.toFixed(2), updatedAt: new Date() })
      .where(eq(balancesTable.method, method)).returning();
    await db.insert(balanceHistoryTable).values({
      method, type: "reduce", amount: num.toFixed(2), reason,
      balanceBefore: before.toFixed(2), balanceAfter: after.toFixed(2),
      performedBy: req.session.userId || null,
    });
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Keep for backward compat (settings page set)
router.put("/balances/:method", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { method } = req.params as { method: string };
    const { amount, reason } = req.body;
    const num = Number(amount);
    if (isNaN(num)) { res.status(400).json({ error: "Valid amount is required" }); return; }
    let [bal] = await db.select().from(balancesTable).where(eq(balancesTable.method, method));
    const before = bal ? parseFloat(bal.amount) : 0;
    if (!bal) {
      [bal] = await db.insert(balancesTable).values({ method, amount: num.toFixed(2) }).returning();
    } else {
      [bal] = await db.update(balancesTable)
        .set({ amount: num.toFixed(2), updatedAt: new Date() })
        .where(eq(balancesTable.method, method)).returning();
    }
    await db.insert(balanceHistoryTable).values({
      method, type: "set", amount: Math.abs(num - before).toFixed(2),
      reason: reason || null,
      balanceBefore: before.toFixed(2), balanceAfter: num.toFixed(2),
      performedBy: req.session.userId || null,
    });
    res.json(bal);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
