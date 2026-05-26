import { Router } from "express";
import { eq, ilike, sql } from "drizzle-orm";
import { db, stockTable, itemsTable, stockAdjustmentsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

function getStockStatus(quantity: string, minStock: string): string {
  const qty = parseFloat(quantity);
  const min = parseFloat(minStock);
  if (qty === 0) return "out_of_stock";
  if (qty <= min) return "low_stock";
  return "in_stock";
}

router.get("/stock", async (req, res): Promise<void> => {
  const search = req.query.search as string | undefined;

  const rows = await db
    .select({
      id: stockTable.id,
      itemId: stockTable.itemId,
      itemName: itemsTable.name,
      qtyType: itemsTable.qtyType,
      quantity: stockTable.quantity,
      minStock: stockTable.minStock,
      purchasePrice: itemsTable.purchasePrice,
      salePrice: itemsTable.salePrice,
    })
    .from(stockTable)
    .innerJoin(itemsTable, eq(stockTable.itemId, itemsTable.id))
    .where(search ? ilike(itemsTable.name, `%${search}%`) : undefined as any)
    .orderBy(itemsTable.name);

  res.json(rows.map(r => ({
    ...r,
    status: getStockStatus(r.quantity, r.minStock),
  })));
});

router.get("/stock/alerts", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: stockTable.id,
      itemId: stockTable.itemId,
      itemName: itemsTable.name,
      qtyType: itemsTable.qtyType,
      quantity: stockTable.quantity,
      minStock: stockTable.minStock,
      purchasePrice: itemsTable.purchasePrice,
      salePrice: itemsTable.salePrice,
    })
    .from(stockTable)
    .innerJoin(itemsTable, eq(stockTable.itemId, itemsTable.id));

  const withStatus = rows.map(r => ({ ...r, status: getStockStatus(r.quantity, r.minStock) }));
  const outOfStock = withStatus.filter(r => r.status === "out_of_stock");
  const lowStock = withStatus.filter(r => r.status === "low_stock");

  res.json({ outOfStock, lowStock });
});

router.post("/stock/adjust", async (req, res): Promise<void> => {
  const { itemId, adjustmentType, quantity, reason } = req.body;
  if (!itemId || !adjustmentType || quantity == null) {
    res.status(400).json({ error: "itemId, adjustmentType, quantity required" });
    return;
  }

  const [stockRow] = await db.select().from(stockTable).where(eq(stockTable.itemId, itemId));
  if (!stockRow) {
    res.status(404).json({ error: "Stock not found for this item" });
    return;
  }

  const prev = parseFloat(stockRow.quantity);
  const adj = parseFloat(String(quantity));
  const newQty = adjustmentType === "increase" ? prev + adj : Math.max(0, prev - adj);

  await db.update(stockTable).set({ quantity: String(newQty), updatedAt: new Date() }).where(eq(stockTable.id, stockRow.id));

  const [adjustment] = await db.insert(stockAdjustmentsTable).values({
    itemId,
    adjustmentType,
    quantity: String(adj),
    previousQty: String(prev),
    newQty: String(newQty),
    reason: reason || null,
    adjustedBy: req.session.userId || null,
  }).returning();

  const [item] = await db.select().from(itemsTable).where(eq(itemsTable.id, itemId));

  res.json({
    ...adjustment,
    itemName: item?.name ?? null,
    qtyType: item?.qtyType ?? null,
    adjustedBy: null,
  });
});

router.get("/stock/adjustments", async (req, res): Promise<void> => {
  const itemId = req.query.itemId ? parseInt(req.query.itemId as string) : null;
  const type = req.query.type as string | undefined;

  let query = db
    .select({
      id: stockAdjustmentsTable.id,
      itemId: stockAdjustmentsTable.itemId,
      itemName: itemsTable.name,
      qtyType: itemsTable.qtyType,
      adjustmentType: stockAdjustmentsTable.adjustmentType,
      quantity: stockAdjustmentsTable.quantity,
      previousQty: stockAdjustmentsTable.previousQty,
      newQty: stockAdjustmentsTable.newQty,
      reason: stockAdjustmentsTable.reason,
      adjustedByName: usersTable.name,
      createdAt: stockAdjustmentsTable.createdAt,
    })
    .from(stockAdjustmentsTable)
    .leftJoin(itemsTable, eq(stockAdjustmentsTable.itemId, itemsTable.id))
    .leftJoin(usersTable, eq(stockAdjustmentsTable.adjustedBy, usersTable.id))
    .$dynamic();

  const conditions = [];
  if (itemId) conditions.push(eq(stockAdjustmentsTable.itemId, itemId));
  if (type && type !== "all") conditions.push(eq(stockAdjustmentsTable.adjustmentType, type));

  if (conditions.length > 0) {
    query = query.where(sql`${conditions.reduce((acc, c) => sql`${acc} AND ${c}`)}`) as any;
  }

  const rows = await query.orderBy(sql`${stockAdjustmentsTable.createdAt} DESC`);
  res.json(rows.map(r => ({
    ...r,
    adjustedBy: r.adjustedByName ?? null,
  })));
});

export default router;
