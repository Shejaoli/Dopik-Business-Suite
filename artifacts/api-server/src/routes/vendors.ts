import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, vendorsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/vendors", async (req, res): Promise<void> => {
  const rows = await db.select().from(vendorsTable).orderBy(vendorsTable.name);
  res.json(rows);
});

router.post("/vendors", async (req, res): Promise<void> => {
  const { name, contactPerson, email, phone, address } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  const [vendor] = await db.insert(vendorsTable).values({ name, contactPerson: contactPerson || null, email: email || null, phone: phone || null, address: address || null }).returning();
  res.status(201).json(vendor);
});

router.put("/vendors/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { name, contactPerson, email, phone, address } = req.body;
  const [vendor] = await db.update(vendorsTable).set({ ...(name && { name }), contactPerson: contactPerson ?? null, email: email ?? null, phone: phone ?? null, address: address ?? null }).where(eq(vendorsTable.id, id)).returning();
  if (!vendor) { res.status(404).json({ error: "Vendor not found" }); return; }
  res.json(vendor);
});

router.delete("/vendors/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(vendorsTable).where(eq(vendorsTable.id, id));
  res.sendStatus(204);
});

export default router;
