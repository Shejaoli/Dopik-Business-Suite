import { Router } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, notificationsTable, stockTable, itemsTable, announcementsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

async function generateSystemNotifications(userId: number): Promise<void> {
  const existingTypes = await db
    .select({ referenceId: notificationsTable.referenceId, type: notificationsTable.type })
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId));

  const existingKeys = new Set(existingTypes.map(e => `${e.type}_${e.referenceId}`));

  const stockRows = await db
    .select({ id: stockTable.id, itemId: stockTable.itemId, quantity: stockTable.quantity, minStock: stockTable.minStock, itemName: itemsTable.name })
    .from(stockTable)
    .innerJoin(itemsTable, eq(stockTable.itemId, itemsTable.id));

  const toInsert: any[] = [];

  for (const s of stockRows) {
    const qty = parseFloat(s.quantity);
    const min = parseFloat(s.minStock);
    if (qty === 0 && !existingKeys.has(`low_stock_${s.itemId}`)) {
      toInsert.push({
        userId, type: "low_stock",
        title: `${s.itemName} is out of stock`,
        body: `Current quantity: 0. Restock needed.`,
        referenceId: s.itemId, referenceType: "item", read: false,
      });
    } else if (qty > 0 && qty <= min && !existingKeys.has(`low_stock_${s.itemId}`)) {
      toInsert.push({
        userId, type: "low_stock",
        title: `${s.itemName} is running low`,
        body: `Only ${qty} left (minimum: ${min}).`,
        referenceId: s.itemId, referenceType: "item", read: false,
      });
    }
  }

  const announcements = await db
    .select({ id: announcementsTable.id, title: announcementsTable.title, body: announcementsTable.body })
    .from(announcementsTable)
    .orderBy(desc(announcementsTable.createdAt))
    .limit(5);

  for (const a of announcements) {
    if (!existingKeys.has(`announcement_${a.id}`)) {
      toInsert.push({
        userId, type: "announcement",
        title: a.title, body: a.body,
        referenceId: a.id, referenceType: "announcement", read: false,
      });
    }
  }

  if (toInsert.length > 0) {
    await db.insert(notificationsTable).values(toInsert).onConflictDoNothing();
  }
}

router.get("/notifications", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) { res.json([]); return; }

  await generateSystemNotifications(userId);

  const rows = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);

  const unreadCount = rows.filter(r => !r.read).length;
  res.json({ notifications: rows, unreadCount });
});

router.post("/notifications/:id/read", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  const id = parseInt(req.params.id);
  await db.update(notificationsTable)
    .set({ read: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId!)));
  res.json({ ok: true });
});

router.post("/notifications/mark-all-read", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) { res.json({ ok: true }); return; }
  await db.update(notificationsTable)
    .set({ read: true })
    .where(eq(notificationsTable.userId, userId));
  res.json({ ok: true });
});

router.delete("/notifications/:id", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  const id = parseInt(req.params.id);
  await db.delete(notificationsTable)
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId!)));
  res.json({ ok: true });
});

export default router;
