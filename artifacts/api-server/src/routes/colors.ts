import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, colorsTable, storageOptionsTable, ramOptionsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/colors", async (_req, res): Promise<void> => {
  const rows = await db.select().from(colorsTable).orderBy(colorsTable.name);
  res.json(rows);
});

router.post("/colors", async (req, res): Promise<void> => {
  const { name } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "name required" }); return; }
  const [row] = await db.insert(colorsTable).values({ name: name.trim() }).onConflictDoNothing().returning();
  if (!row) {
    const [existing] = await db.select().from(colorsTable).where(eq(colorsTable.name, name.trim()));
    res.json(existing);
  } else { res.status(201).json(row); }
});

router.get("/storage-options", async (_req, res): Promise<void> => {
  const rows = await db.select().from(storageOptionsTable).orderBy(storageOptionsTable.name);
  res.json(rows);
});

router.post("/storage-options", async (req, res): Promise<void> => {
  const { name } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "name required" }); return; }
  const [row] = await db.insert(storageOptionsTable).values({ name: name.trim() }).onConflictDoNothing().returning();
  if (!row) {
    const [existing] = await db.select().from(storageOptionsTable).where(eq(storageOptionsTable.name, name.trim()));
    res.json(existing);
  } else { res.status(201).json(row); }
});

router.get("/ram-options", async (_req, res): Promise<void> => {
  const rows = await db.select().from(ramOptionsTable).orderBy(ramOptionsTable.name);
  res.json(rows);
});

router.post("/ram-options", async (req, res): Promise<void> => {
  const { name } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "name required" }); return; }
  const [row] = await db.insert(ramOptionsTable).values({ name: name.trim() }).onConflictDoNothing().returning();
  if (!row) {
    const [existing] = await db.select().from(ramOptionsTable).where(eq(ramOptionsTable.name, name.trim()));
    res.json(existing);
  } else { res.status(201).json(row); }
});

export default router;
