import { Router } from "express";
import { eq, desc, sql, ilike, or } from "drizzle-orm";
import { db, customersTable, salesTable, saleItemsTable, itemsTable, creditAccountsTable, serializedUnitsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/customers", async (req, res): Promise<void> => {
  const search = req.query.search as string | undefined;
  const baseQuery = db.select().from(customersTable);
  const rows = await (search
    ? baseQuery.where(or(ilike(customersTable.name, `%${search}%`), ilike(customersTable.phone, `%${search}%`))).orderBy(customersTable.name)
    : baseQuery.orderBy(customersTable.name));

  const enriched = await Promise.all(rows.map(async (c) => {
    const [stats] = await db.select({
      totalOrders: sql<number>`COUNT(DISTINCT s.id)`,
      totalSpent: sql<string>`COALESCE(SUM(s.total_amount),0)`,
    }).from(salesTable.as("s")).where(sql`s.customer_id = ${c.id} AND s.reverted = false`);

    const [creditStats] = await db.select({
      creditBalance: sql<string>`COALESCE(SUM(balance),0)`,
    }).from(creditAccountsTable).where(eq(creditAccountsTable.customerId, c.id));

    const [lastSale] = await db.select({ createdAt: salesTable.createdAt })
      .from(salesTable).where(eq(salesTable.customerId, c.id))
      .orderBy(desc(salesTable.createdAt)).limit(1);

    return {
      ...c,
      totalOrders: stats?.totalOrders || 0,
      totalSpent: stats?.totalSpent || "0",
      creditBalance: creditStats?.creditBalance || "0",
      lastPurchaseDate: lastSale?.createdAt || null,
    };
  }));

  res.json(enriched);
});

router.get("/customers/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, id));
  if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }

  const sales = await db.select({
    id: salesTable.id,
    paymentMethod: salesTable.paymentMethod,
    totalAmount: salesTable.totalAmount,
    reverted: salesTable.reverted,
    createdAt: salesTable.createdAt,
  }).from(salesTable).where(eq(salesTable.customerId, id))
    .orderBy(desc(salesTable.createdAt));

  const salesWithItems = await Promise.all(sales.map(async (s) => {
    const items = await db.select({
      itemName: itemsTable.name,
      quantity: saleItemsTable.quantity,
      unitPrice: saleItemsTable.unitPrice,
      lineTotal: saleItemsTable.lineTotal,
    }).from(saleItemsTable).leftJoin(itemsTable, eq(saleItemsTable.itemId, itemsTable.id))
      .where(eq(saleItemsTable.saleId, s.id));
    return { ...s, items };
  }));

  const creditAccounts = await db.select().from(creditAccountsTable)
    .where(eq(creditAccountsTable.customerId, id))
    .orderBy(desc(creditAccountsTable.createdAt));

  const warranties = await db.select({
    id: serializedUnitsTable.id,
    imeiOrSerial: serializedUnitsTable.imeiOrSerial,
    color: serializedUnitsTable.color,
    storage: serializedUnitsTable.storage,
    dateReceived: serializedUnitsTable.soldAt,
    status: serializedUnitsTable.status,
    itemName: itemsTable.name,
  }).from(serializedUnitsTable)
    .leftJoin(itemsTable, eq(serializedUnitsTable.itemId, itemsTable.id))
    .where(eq(serializedUnitsTable.soldToCustomerId, id));

  const totalSpent = sales.filter(s => !s.reverted).reduce((sum, s) => sum + parseFloat(s.totalAmount), 0);
  const totalOrders = sales.filter(s => !s.reverted).length;
  const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
  const creditBalance = creditAccounts.reduce((sum, c) => sum + parseFloat(String(c.balance || "0")), 0);

  res.json({
    customer,
    stats: { totalOrders, totalSpent, avgOrderValue, creditBalance },
    sales: salesWithItems,
    creditAccounts,
    warranties,
  });
});

router.get("/customers/:id/summary", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const sales = await db.select({ totalAmount: salesTable.totalAmount, reverted: salesTable.reverted })
    .from(salesTable).where(eq(salesTable.customerId, id));
  const totalSpent = sales.filter(s => !s.reverted).reduce((s, r) => s + parseFloat(r.totalAmount), 0);
  res.json({ totalSpent, totalLoan: 0, totalLoanPaid: 0, activeLoans: 0 });
});

router.post("/customers", async (req, res): Promise<void> => {
  const { name, contactPerson, email, phone, address } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "name required" }); return; }
  try {
    const [customer] = await db.insert(customersTable).values({
      name: name.trim(),
      contactPerson: contactPerson?.trim() || null,
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      address: address?.trim() || null,
    }).returning();
    res.status(201).json(customer);
  } catch (err: any) {
    console.error("[POST /customers] Error:", err);
    res.status(500).json({ error: err?.message || "Failed to create customer" });
  }
});

router.put("/customers/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { name, contactPerson, email, phone, address } = req.body;
  const [customer] = await db.update(customersTable).set({
    ...(name && { name }), contactPerson: contactPerson ?? null,
    email: email ?? null, phone: phone ?? null, address: address ?? null,
  }).where(eq(customersTable.id, id)).returning();
  if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }
  res.json(customer);
});

router.delete("/customers/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(customersTable).where(eq(customersTable.id, id));
  res.sendStatus(204);
});

export default router;
