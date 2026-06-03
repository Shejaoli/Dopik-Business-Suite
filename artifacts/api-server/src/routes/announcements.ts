import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, announcementsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/announcements", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: announcementsTable.id,
      title: announcementsTable.title,
      body: announcementsTable.body,
      priority: announcementsTable.priority,
      pinned: announcementsTable.pinned,
      createdBy: announcementsTable.createdBy,
      authorName: usersTable.name,
      createdAt: announcementsTable.createdAt,
    })
    .from(announcementsTable)
    .leftJoin(usersTable, eq(announcementsTable.createdBy, usersTable.id))
    .orderBy(desc(announcementsTable.pinned), desc(announcementsTable.createdAt));
  res.json(rows);
});

router.post("/announcements", async (req, res): Promise<void> => {
  const role = (req.session as any).role;
  if (role !== "owner" && role !== "admin") {
    res.status(403).json({ error: "Only owners can post announcements" });
    return;
  }
  const { title, body, priority, pinned } = req.body;
  if (!title || !body) {
    res.status(400).json({ error: "title and body are required" });
    return;
  }
  const [row] = await db.insert(announcementsTable).values({
    title,
    body,
    priority: priority || "normal",
    pinned: !!pinned,
    createdBy: req.session.userId || null,
  }).returning();
  res.status(201).json(row);
});

router.patch("/announcements/:id", async (req, res): Promise<void> => {
  const role = (req.session as any).role;
  if (role !== "owner" && role !== "admin") {
    res.status(403).json({ error: "Only owners can edit announcements" });
    return;
  }
  const id = parseInt(req.params.id);
  const { title, body, priority, pinned } = req.body;
  const fields: Record<string, any> = {};
  if (title) fields.title = title;
  if (body) fields.body = body;
  if (priority) fields.priority = priority;
  if (pinned !== undefined) fields.pinned = !!pinned;
  const [row] = await db.update(announcementsTable).set(fields).where(eq(announcementsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/announcements/:id", async (req, res): Promise<void> => {
  const role = (req.session as any).role;
  if (role !== "owner" && role !== "admin") {
    res.status(403).json({ error: "Only owners can delete announcements" });
    return;
  }
  const id = parseInt(req.params.id);
  await db.delete(announcementsTable).where(eq(announcementsTable.id, id));
  res.json({ ok: true });
});

export default router;
