import { Router } from "express";
import { eq, gte, desc, sql } from "drizzle-orm";
import { db, usageEventsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.post("/analytics/track", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) { res.json({ ok: true }); return; }
  const { eventType, page, metadata } = req.body;
  if (!eventType) { res.json({ ok: true }); return; }
  await db.insert(usageEventsTable).values({
    userId, eventType, page: page || null, metadata: metadata || null,
  });
  res.json({ ok: true });
});

router.get("/analytics/usage", async (req, res): Promise<void> => {
  const role = (req.session as any).role;
  if (role !== "owner" && role !== "admin") {
    res.status(403).json({ error: "Owner only" });
    return;
  }

  const days = parseInt(req.query.days as string) || 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const pageViews = await db
    .select({
      page: usageEventsTable.page,
      count: sql<number>`count(*)`,
    })
    .from(usageEventsTable)
    .where(gte(usageEventsTable.createdAt, since))
    .groupBy(usageEventsTable.page)
    .orderBy(desc(sql`count(*)`))
    .limit(20);

  const byUser = await db
    .select({
      userId: usageEventsTable.userId,
      userName: usersTable.name,
      count: sql<number>`count(*)`,
    })
    .from(usageEventsTable)
    .leftJoin(usersTable, eq(usageEventsTable.userId, usersTable.id))
    .where(gte(usageEventsTable.createdAt, since))
    .groupBy(usageEventsTable.userId, usersTable.name)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  const byEventType = await db
    .select({
      eventType: usageEventsTable.eventType,
      count: sql<number>`count(*)`,
    })
    .from(usageEventsTable)
    .where(gte(usageEventsTable.createdAt, since))
    .groupBy(usageEventsTable.eventType)
    .orderBy(desc(sql`count(*)`));

  const daily = await db
    .select({
      date: sql<string>`DATE(${usageEventsTable.createdAt})`,
      count: sql<number>`count(*)`,
    })
    .from(usageEventsTable)
    .where(gte(usageEventsTable.createdAt, since))
    .groupBy(sql`DATE(${usageEventsTable.createdAt})`)
    .orderBy(sql`DATE(${usageEventsTable.createdAt})`);

  res.json({ pageViews, byUser, byEventType, daily, days });
});

export default router;
