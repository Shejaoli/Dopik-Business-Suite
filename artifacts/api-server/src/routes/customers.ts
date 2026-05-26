import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, customersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/customers", async (req, res): Promise<void> => {
  const rows = await db.select().from(customersTable).orderBy(customersTable.name);
  res.json(rows);
});

router.post("/customers", async (req, res): Promise<void> => {
  const { name, contactPerson, email, phone, address } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  const [customer] = await db.insert(customersTable).values({ name, contactPerson: contactPerson || null, email: email || null, phone: phone || null, address: address || null }).returning();
  res.status(201).json(customer);
});

router.put("/customers/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { name, contactPerson, email, phone, address } = req.body;
  const [customer] = await db.update(customersTable).set({ ...(name && { name }), contactPerson: contactPerson ?? null, email: email ?? null, phone: phone ?? null, address: address ?? null }).where(eq(customersTable.id, id)).returning();
  if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }
  res.json(customer);
});

router.delete("/customers/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(customersTable).where(eq(customersTable.id, id));
  res.sendStatus(204);
});

export default router;
