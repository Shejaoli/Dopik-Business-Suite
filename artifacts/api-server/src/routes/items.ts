import { Router } from "express";
import { eq, ilike, sql, desc } from "drizzle-orm";
import { db, itemsTable, stockTable, purchasesTable, saleItemsTable, stockAdjustmentsTable, vendorsTable, customersTable, salesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/items", async (req, res): Promise<void> => {
  const search = req.query.search as string | undefined;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;

  const inStockOnly = req.query.inStock === "true";

  let query = db
    .select({
      id: itemsTable.id,
      name: itemsTable.name,
      category: itemsTable.category,
      trackSerial: itemsTable.trackSerial,
      purchasePrice: itemsTable.purchasePrice,
      salePrice: itemsTable.salePrice,
      alternativeItemId: itemsTable.alternativeItemId,
      createdAt: itemsTable.createdAt,
      stockQuantity: stockTable.quantity,
    })
    .from(itemsTable)
    .leftJoin(stockTable, eq(itemsTable.id, stockTable.itemId))
    .$dynamic();

  const conditions = [];
  if (search) conditions.push(ilike(itemsTable.name, `%${search}%`));
  if (inStockOnly) conditions.push(sql`CAST(${stockTable.quantity} AS NUMERIC) > 0`);
  if (conditions.length > 0) query = query.where(sql`${conditions.reduce((a, b) => sql`${a} AND ${b}`)}`) as any;

  const countBase = db
    .select({ count: sql<number>`count(*)` })
    .from(itemsTable)
    .leftJoin(stockTable, eq(itemsTable.id, stockTable.itemId))
    .$dynamic();
  const [countResult] = await (conditions.length > 0
    ? countBase.where(sql`${conditions.reduce((a, b) => sql`${a} AND ${b}`)}`)
    : countBase);

  const items = await query.orderBy(desc(itemsTable.createdAt)).limit(limit).offset(offset);

  const altIds = items.filter(i => i.alternativeItemId).map(i => i.alternativeItemId!);
  const altItems = altIds.length > 0
    ? await db.select({ id: itemsTable.id, name: itemsTable.name }).from(itemsTable)
        .where(sql`${itemsTable.id} = ANY(${altIds})`)
    : [];
  const altMap = Object.fromEntries(altItems.map(a => [a.id, a.name]));

  res.json({
    items: items.map(i => ({ ...i, alternativeItemName: i.alternativeItemId ? altMap[i.alternativeItemId] ?? null : null })),
    total: Number(countResult?.count ?? 0),
    page,
    limit,
  });
});

router.post("/items", async (req, res): Promise<void> => {
  const { name, category, trackSerial, purchasePrice, salePrice, alternativeItemId } = req.body;
  if (!name || !category || purchasePrice == null || salePrice == null) {
    res.status(400).json({ error: "name, category, purchasePrice, salePrice are required" });
    return;
  }
  const [item] = await db.insert(itemsTable).values({
    name,
    category,
    trackSerial: trackSerial === true || trackSerial === "true",
    purchasePrice: String(purchasePrice),
    salePrice: String(salePrice),
    alternativeItemId: alternativeItemId || null,
  }).returning();

  await db.insert(stockTable).values({ itemId: item.id, quantity: "0", minStock: "0" });

  res.status(201).json({ ...item, alternativeItemName: null });
});

router.put("/items/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { name, category, trackSerial, purchasePrice, salePrice, alternativeItemId, minStock } = req.body;

  const itemFields: Record<string, any> = {};
  if (name) itemFields.name = name;
  if (category) itemFields.category = category;
  if (trackSerial !== undefined) itemFields.trackSerial = trackSerial === true || trackSerial === "true";
  if (purchasePrice != null) itemFields.purchasePrice = String(purchasePrice);
  if (salePrice != null) itemFields.salePrice = String(salePrice);
  if (alternativeItemId !== undefined) itemFields.alternativeItemId = alternativeItemId || null;

  let item: typeof itemsTable.$inferSelect | undefined;
  if (Object.keys(itemFields).length > 0) {
    const [updated] = await db.update(itemsTable).set(itemFields).where(eq(itemsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Item not found" }); return; }
    item = updated;
  } else {
    const [existing] = await db.select().from(itemsTable).where(eq(itemsTable.id, id));
    if (!existing) { res.status(404).json({ error: "Item not found" }); return; }
    item = existing;
  }

  if (minStock != null) {
    await db.update(stockTable).set({ minStock: String(minStock) }).where(eq(stockTable.itemId, id));
  }

  res.json({ ...item, alternativeItemName: null });
});

router.get("/items/:id/history", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const purchases = await db
    .select({ id: purchasesTable.id, quantity: purchasesTable.quantity, totalCost: purchasesTable.totalCost, vendorName: vendorsTable.name, createdAt: purchasesTable.createdAt })
    .from(purchasesTable).leftJoin(vendorsTable, eq(purchasesTable.vendorId, vendorsTable.id))
    .where(eq(purchasesTable.itemId, id));

  const sales = await db
    .select({ saleId: saleItemsTable.saleId, quantity: saleItemsTable.quantity, lineTotal: saleItemsTable.lineTotal, customerName: customersTable.name, createdAt: salesTable.createdAt })
    .from(saleItemsTable).leftJoin(salesTable, eq(saleItemsTable.saleId, salesTable.id))
    .leftJoin(customersTable, eq(salesTable.customerId, customersTable.id))
    .where(eq(saleItemsTable.itemId, id));

  const adjustments = await db
    .select({ id: stockAdjustmentsTable.id, adjustmentType: stockAdjustmentsTable.adjustmentType, quantity: stockAdjustmentsTable.quantity, previousQty: stockAdjustmentsTable.previousQty, newQty: stockAdjustmentsTable.newQty, reason: stockAdjustmentsTable.reason, createdAt: stockAdjustmentsTable.createdAt })
    .from(stockAdjustmentsTable).where(eq(stockAdjustmentsTable.itemId, id));

  const history = [
    ...purchases.map(p => ({ type: "purchase", date: p.createdAt?.toISOString() ?? "", quantity: p.quantity, amount: p.totalCost, vendorName: p.vendorName ?? null, customerName: null, adjustmentType: null, reason: null, adjustedBy: null })),
    ...sales.map(s => ({ type: "sale", date: s.createdAt?.toISOString() ?? "", quantity: s.quantity, amount: s.lineTotal, vendorName: null, customerName: s.customerName ?? null, adjustmentType: null, reason: null, adjustedBy: null })),
    ...adjustments.map(a => ({ type: "adjustment", date: a.createdAt?.toISOString() ?? "", quantity: a.quantity, amount: null, vendorName: null, customerName: null, adjustmentType: a.adjustmentType, reason: a.reason ?? null, adjustedBy: null })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  res.json(history);
});

export default router;
