import { Router } from "express";
import { eq, ilike, sql, inArray, and } from "drizzle-orm";
import { db, stockTable, itemsTable, stockAdjustmentsTable, usersTable, serialNumbersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { getCategoriesForSuper } from "../lib/category-filter";

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
  const superCategory = req.query.superCategory as string | undefined;
  const cats = getCategoriesForSuper(superCategory);

  const conditions: any[] = [];
  if (search) conditions.push(ilike(itemsTable.name, `%${search}%`));
  if (cats) conditions.push(inArray(itemsTable.category, cats));

  const rows = await db
    .select({
      id: stockTable.id,
      itemId: stockTable.itemId,
      itemName: itemsTable.name,
      category: itemsTable.category,
      trackSerial: itemsTable.trackSerial,
      quantity: stockTable.quantity,
      minStock: stockTable.minStock,
      purchasePrice: itemsTable.purchasePrice,
      salePrice: itemsTable.salePrice,
    })
    .from(stockTable)
    .innerJoin(itemsTable, eq(stockTable.itemId, itemsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(itemsTable.name);

  res.json(rows.map(r => ({ ...r, status: getStockStatus(r.quantity, r.minStock) })));
});

router.get("/stock/alerts", async (req, res): Promise<void> => {
  const superCategory = req.query.superCategory as string | undefined;
  const cats = getCategoriesForSuper(superCategory);

  const rows = await db
    .select({
      id: stockTable.id,
      itemId: stockTable.itemId,
      itemName: itemsTable.name,
      category: itemsTable.category,
      trackSerial: itemsTable.trackSerial,
      quantity: stockTable.quantity,
      minStock: stockTable.minStock,
      purchasePrice: itemsTable.purchasePrice,
      salePrice: itemsTable.salePrice,
    })
    .from(stockTable)
    .innerJoin(itemsTable, eq(stockTable.itemId, itemsTable.id))
    .where(cats ? inArray(itemsTable.category, cats) : undefined);

  const withStatus = rows.map(r => ({ ...r, status: getStockStatus(r.quantity, r.minStock) }));
  const outOfStock = withStatus.filter(r => r.status === "out_of_stock");
  const lowStock = withStatus.filter(r => r.status === "low_stock");

  res.json({ outOfStock, lowStock });
});

router.post("/stock/adjust", async (req, res): Promise<void> => {
  const { itemId, adjustmentType, quantity, reason, serialNumbers } = req.body;
  if (!itemId || !adjustmentType || quantity == null) {
    res.status(400).json({ error: "itemId, adjustmentType, quantity required" });
    return;
  }

  const [item] = await db.select().from(itemsTable).where(eq(itemsTable.id, itemId));
  const [stockRow] = await db.select().from(stockTable).where(eq(stockTable.itemId, itemId));
  if (!stockRow) { res.status(404).json({ error: "Stock not found for this item" }); return; }

  const prev = parseFloat(stockRow.quantity);
  const adj = parseFloat(String(quantity));

  if (item?.trackSerial && adjustmentType !== "increase" && serialNumbers?.length) {
    const snCount = serialNumbers.filter((s: string) => s.trim()).length;
    if (snCount !== adj) {
      res.status(400).json({ error: `Serial number count (${snCount}) must match quantity (${adj})` });
      return;
    }
  }

  const newQty = adjustmentType === "increase" ? prev + adj : Math.max(0, prev - adj);

  await db.update(stockTable).set({ quantity: String(newQty), updatedAt: new Date() }).where(eq(stockTable.id, stockRow.id));

  const [adjustment] = await db.insert(stockAdjustmentsTable).values({
    itemId, adjustmentType, quantity: String(adj),
    previousQty: String(prev), newQty: String(newQty),
    reason: reason || null, adjustedBy: req.session.userId || null,
  }).returning();

  if (item?.trackSerial && Array.isArray(serialNumbers) && serialNumbers.length > 0) {
    const snList = serialNumbers.map((s: string) => s.trim()).filter(Boolean);
    if (adjustmentType === "increase") {
      const snValues = snList.map(sn => ({
        itemId, serialNumber: sn, status: "in_stock",
        referenceType: "adjustment", referenceId: adjustment.id,
      }));
      if (snValues.length > 0) await db.insert(serialNumbersTable).values(snValues).onConflictDoNothing();
    } else {
      if (snList.length > 0) {
        await db.update(serialNumbersTable)
          .set({ status: "adjusted_out", referenceType: "adjustment", referenceId: adjustment.id, updatedAt: new Date() })
          .where(inArray(serialNumbersTable.serialNumber, snList));
      }
    }
  }

  res.json({ ...adjustment, itemName: item?.name ?? null, category: item?.category ?? null, adjustedBy: null });
});

router.get("/stock/adjustments", async (req, res): Promise<void> => {
  const itemId = req.query.itemId ? parseInt(req.query.itemId as string) : null;
  const type = req.query.type as string | undefined;

  let query = db
    .select({
      id: stockAdjustmentsTable.id,
      itemId: stockAdjustmentsTable.itemId,
      itemName: itemsTable.name,
      category: itemsTable.category,
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
  res.json(rows.map(r => ({ ...r, adjustedBy: r.adjustedByName ?? null })));
});

export default router;
