import { Router } from "express";
import { eq, ilike, sql, inArray, and, desc, gte, lte } from "drizzle-orm";
import { db, stockTable, itemsTable, stockAdjustmentsTable, usersTable, serialNumbersTable, serializedUnitsTable } from "@workspace/db";
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

router.get("/stock/:itemId/units", async (req, res): Promise<void> => {
  const itemId = parseInt(req.params.itemId);
  if (isNaN(itemId)) { res.status(400).json({ error: "Invalid itemId" }); return; }
  const units = await db.select({
    id: serializedUnitsTable.id,
    imeiOrSerial: serializedUnitsTable.imeiOrSerial,
    color: serializedUnitsTable.color,
    ram: serializedUnitsTable.ram,
    storage: serializedUnitsTable.storage,
    condition: serializedUnitsTable.condition,
    status: serializedUnitsTable.status,
    additionalInfo: serializedUnitsTable.additionalInfo,
    dateReceived: serializedUnitsTable.dateReceived,
  }).from(serializedUnitsTable)
    .where(eq(serializedUnitsTable.itemId, itemId))
    .orderBy(desc(serializedUnitsTable.dateReceived));
  res.json(units);
});

router.get("/stock/:itemId/history", async (req, res): Promise<void> => {
  const itemId = parseInt(req.params.itemId);
  if (isNaN(itemId)) { res.status(400).json({ error: "Invalid itemId" }); return; }

  const period = (req.query.period as string) || "month";
  const now = new Date();
  let start: Date;
  switch (period) {
    case "today": start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
    case "week":  start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
    case "year":  start = new Date(now.getFullYear(), 0, 1); break;
    default:      start = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const [adjustments, units] = await Promise.all([
    db.select({
      id: stockAdjustmentsTable.id,
      source: sql<string>`'adjustment'`,
      event: stockAdjustmentsTable.adjustmentType,
      quantity: stockAdjustmentsTable.quantity,
      reason: stockAdjustmentsTable.reason,
      date: stockAdjustmentsTable.createdAt,
      imeiOrSerial: sql<string | null>`NULL`,
      color: sql<string | null>`NULL`,
      ram: sql<string | null>`NULL`,
      storage: sql<string | null>`NULL`,
      condition: sql<string | null>`NULL`,
      status: sql<string | null>`NULL`,
    }).from(stockAdjustmentsTable)
      .where(and(
        eq(stockAdjustmentsTable.itemId, itemId),
        gte(stockAdjustmentsTable.createdAt, start),
        lte(stockAdjustmentsTable.createdAt, now),
      ))
      .orderBy(desc(stockAdjustmentsTable.createdAt)),

    db.select({
      id: serializedUnitsTable.id,
      source: sql<string>`'unit'`,
      event: serializedUnitsTable.status,
      quantity: sql<string>`'1'`,
      reason: sql<string | null>`NULL`,
      date: serializedUnitsTable.dateReceived,
      imeiOrSerial: serializedUnitsTable.imeiOrSerial,
      color: serializedUnitsTable.color,
      ram: serializedUnitsTable.ram,
      storage: serializedUnitsTable.storage,
      condition: serializedUnitsTable.condition,
      status: serializedUnitsTable.status,
    }).from(serializedUnitsTable)
      .where(and(
        eq(serializedUnitsTable.itemId, itemId),
        gte(serializedUnitsTable.dateReceived, start),
        lte(serializedUnitsTable.dateReceived, now),
      ))
      .orderBy(desc(serializedUnitsTable.dateReceived)),
  ]);

  const combined = [...adjustments, ...units]
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime());

  res.json(combined);
});

export default router;
