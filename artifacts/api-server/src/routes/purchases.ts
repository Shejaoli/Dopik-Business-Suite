import { Router } from "express";
import { eq, ilike, desc } from "drizzle-orm";
import { db, purchasesTable, itemsTable, stockTable, vendorsTable, balancesTable, payablesTable, auditLogsTable, serialNumbersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/purchases", async (req, res): Promise<void> => {
  const search = req.query.search as string | undefined;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;

  const rows = await db
    .select({
      id: purchasesTable.id,
      itemId: purchasesTable.itemId,
      itemName: itemsTable.name,
      category: itemsTable.category,
      trackSerial: itemsTable.trackSerial,
      quantity: purchasesTable.quantity,
      totalCost: purchasesTable.totalCost,
      vendorId: purchasesTable.vendorId,
      vendorName: vendorsTable.name,
      paymentMethod: purchasesTable.paymentMethod,
      recordedBy: purchasesTable.recordedBy,
      createdAt: purchasesTable.createdAt,
    })
    .from(purchasesTable)
    .leftJoin(itemsTable, eq(purchasesTable.itemId, itemsTable.id))
    .leftJoin(vendorsTable, eq(purchasesTable.vendorId, vendorsTable.id))
    .where(search ? ilike(itemsTable.name, `%${search}%`) : undefined as any)
    .orderBy(desc(purchasesTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(rows.map(r => ({ ...r, vendorName: r.vendorName ?? null })));
});

router.post("/purchases", async (req, res): Promise<void> => {
  const { itemId, quantity, totalCost, vendorId, paymentMethod, serialNumbers } = req.body;
  if (!itemId || !quantity || !totalCost || !paymentMethod) {
    res.status(400).json({ error: "itemId, quantity, totalCost, paymentMethod required" });
    return;
  }

  const [item] = await db.select().from(itemsTable).where(eq(itemsTable.id, itemId));

  if (item?.trackSerial && serialNumbers?.length) {
    const snCount = serialNumbers.filter((s: string) => s.trim()).length;
    const qty = parseFloat(String(quantity));
    if (snCount !== qty) {
      res.status(400).json({ error: `Serial number count (${snCount}) must match quantity (${qty})` });
      return;
    }
  }

  const [purchase] = await db.insert(purchasesTable).values({
    itemId, quantity: String(quantity), totalCost: String(totalCost),
    vendorId: vendorId || null, paymentMethod, recordedBy: req.session.userId || null,
  }).returning();

  const [stockRow] = await db.select().from(stockTable).where(eq(stockTable.itemId, itemId));
  if (stockRow) {
    const newQty = parseFloat(stockRow.quantity) + parseFloat(String(quantity));
    await db.update(stockTable).set({ quantity: String(newQty), updatedAt: new Date() }).where(eq(stockTable.id, stockRow.id));
  }

  if (item?.trackSerial && Array.isArray(serialNumbers) && serialNumbers.length > 0) {
    const snValues = serialNumbers
      .map((sn: string) => sn.trim())
      .filter(Boolean)
      .map(sn => ({
        itemId,
        serialNumber: sn,
        status: "in_stock",
        referenceType: "purchase",
        referenceId: purchase.id,
      }));
    if (snValues.length > 0) {
      await db.insert(serialNumbersTable).values(snValues).onConflictDoNothing();
    }
  }

  const method = paymentMethod.toLowerCase();
  if (method === "credit") {
    await db.insert(payablesTable).values({
      purchaseId: purchase.id, vendorId: vendorId || null,
      totalAmount: String(totalCost), paidAmount: "0", dueDate: null, status: "unpaid",
    });
  } else {
    const dbMethod = method === "mobile_money" ? "mobile_money" : method;
    const [bal] = await db.select().from(balancesTable).where(eq(balancesTable.method, dbMethod));
    if (bal) {
      const newAmt = parseFloat(bal.amount) - parseFloat(String(totalCost));
      await db.update(balancesTable).set({ amount: String(newAmt), updatedAt: new Date() }).where(eq(balancesTable.id, bal.id));
    }
  }

  await db.insert(auditLogsTable).values({
    userId: req.session.userId || null, action: "create_purchase",
    details: `Purchase of item ${itemId} qty ${quantity} cost ${totalCost}`,
  });

  const [vendor] = vendorId ? await db.select().from(vendorsTable).where(eq(vendorsTable.id, vendorId)) : [null];

  res.status(201).json({
    ...purchase,
    itemName: item?.name ?? null,
    category: item?.category ?? null,
    trackSerial: item?.trackSerial ?? false,
    vendorName: vendor?.name ?? null,
  });
});

export default router;
