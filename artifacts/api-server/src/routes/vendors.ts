import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db, vendorsTable, purchasesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/vendors", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: vendorsTable.id,
      name: vendorsTable.name,
      contactPerson: vendorsTable.contactPerson,
      email: vendorsTable.email,
      phone: vendorsTable.phone,
      address: vendorsTable.address,
      createdAt: vendorsTable.createdAt,
      totalPurchases: sql<string>`COALESCE(SUM(CASE WHEN ${purchasesTable.status} = 'confirmed' THEN ${purchasesTable.totalCost}::numeric ELSE 0 END), 0)::text`,
      purchaseCount: sql<number>`COUNT(CASE WHEN ${purchasesTable.status} = 'confirmed' THEN 1 END)::int`,
    })
    .from(vendorsTable)
    .leftJoin(purchasesTable, eq(purchasesTable.vendorId, vendorsTable.id))
    .groupBy(vendorsTable.id)
    .orderBy(vendorsTable.name);
  res.json(rows);
});

router.get("/vendors/:id/purchases", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const rows = await db
    .select()
    .from(purchasesTable)
    .where(eq(purchasesTable.vendorId, id))
    .orderBy(sql`${purchasesTable.createdAt} DESC`)
    .limit(50);
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
