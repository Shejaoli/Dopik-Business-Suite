import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, stockCountSessionsTable, stockCountEntriesTable, stockTable, itemsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/stock-count/sessions", async (req, res): Promise<void> => {
  const sessions = await db
    .select({
      id: stockCountSessionsTable.id,
      status: stockCountSessionsTable.status,
      notes: stockCountSessionsTable.notes,
      startedBy: stockCountSessionsTable.startedBy,
      startedByName: usersTable.name,
      startedAt: stockCountSessionsTable.startedAt,
      completedAt: stockCountSessionsTable.completedAt,
    })
    .from(stockCountSessionsTable)
    .leftJoin(usersTable, eq(stockCountSessionsTable.startedBy, usersTable.id))
    .orderBy(desc(stockCountSessionsTable.startedAt))
    .limit(20);
  res.json(sessions);
});

router.post("/stock-count/start", async (req, res): Promise<void> => {
  const role = (req.session as any).role;
  if (!["owner", "manager", "admin"].includes(role)) {
    res.status(403).json({ error: "Only managers and owners can start stock count" });
    return;
  }
  const { notes } = req.body;
  const [session] = await db.insert(stockCountSessionsTable).values({
    startedBy: req.session.userId || null,
    notes: notes || null,
    status: "in_progress",
  }).returning();
  res.status(201).json(session);
});

router.get("/stock-count/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [session] = await db.select().from(stockCountSessionsTable).where(eq(stockCountSessionsTable.id, id));
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const entries = await db
    .select({
      id: stockCountEntriesTable.id,
      itemId: stockCountEntriesTable.itemId,
      itemName: itemsTable.name,
      category: itemsTable.category,
      systemQty: stockCountEntriesTable.systemQty,
      countedQty: stockCountEntriesTable.countedQty,
      variance: stockCountEntriesTable.variance,
      notes: stockCountEntriesTable.notes,
    })
    .from(stockCountEntriesTable)
    .leftJoin(itemsTable, eq(stockCountEntriesTable.itemId, itemsTable.id))
    .where(eq(stockCountEntriesTable.sessionId, id));

  const allStock = await db
    .select({ itemId: stockTable.itemId, itemName: itemsTable.name, category: itemsTable.category, quantity: stockTable.quantity })
    .from(stockTable)
    .innerJoin(itemsTable, eq(stockTable.itemId, itemsTable.id))
    .orderBy(itemsTable.name);

  const countedItemIds = new Set(entries.map(e => e.itemId));
  const remaining = allStock.filter(s => !countedItemIds.has(s.itemId));

  res.json({ session, entries, remaining });
});

router.post("/stock-count/:id/record", async (req, res): Promise<void> => {
  const sessionId = parseInt(req.params.id);
  const [session] = await db.select().from(stockCountSessionsTable).where(eq(stockCountSessionsTable.id, sessionId));
  if (!session || session.status !== "in_progress") {
    res.status(400).json({ error: "Session not found or already completed" });
    return;
  }

  const { itemId, countedQty, notes } = req.body;
  if (itemId == null || countedQty == null) {
    res.status(400).json({ error: "itemId and countedQty are required" });
    return;
  }

  const [stockRow] = await db.select().from(stockTable).where(eq(stockTable.itemId, itemId));
  const systemQty = stockRow?.quantity ?? "0";
  const variance = (parseFloat(String(countedQty)) - parseFloat(systemQty)).toString();

  const [entry] = await db.insert(stockCountEntriesTable).values({
    sessionId,
    itemId,
    systemQty,
    countedQty: String(countedQty),
    variance,
    notes: notes || null,
  }).returning();

  res.status(201).json({ ...entry, systemQty, variance });
});

router.post("/stock-count/:id/complete", async (req, res): Promise<void> => {
  const role = (req.session as any).role;
  if (!["owner", "manager", "admin"].includes(role)) {
    res.status(403).json({ error: "Only managers and owners can complete stock count" });
    return;
  }
  const id = parseInt(req.params.id);
  const { applyChanges } = req.body;

  const [session] = await db.select().from(stockCountSessionsTable).where(eq(stockCountSessionsTable.id, id));
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  if (applyChanges) {
    const entries = await db.select().from(stockCountEntriesTable).where(eq(stockCountEntriesTable.sessionId, id));
    for (const entry of entries) {
      await db.update(stockTable)
        .set({ quantity: entry.countedQty, updatedAt: new Date() })
        .where(eq(stockTable.itemId, entry.itemId));
    }
  }

  const [updated] = await db.update(stockCountSessionsTable)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(stockCountSessionsTable.id, id))
    .returning();
  res.json(updated);
});

export default router;
