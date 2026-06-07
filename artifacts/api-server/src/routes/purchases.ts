import { Router } from "express";
import { eq, ilike, desc, and, inArray } from "drizzle-orm";
import { db, purchasesTable, itemsTable, stockTable, vendorsTable, balancesTable, payablesTable, auditLogsTable, serialNumbersTable, serializedUnitsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/purchases", async (req, res): Promise<void> => {
  const search = req.query.search as string | undefined;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;
  const includeStatus = req.query.status as string | undefined;

  let query = db
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
      status: purchasesTable.status,
      poNumber: purchasesTable.poNumber,
      notes: purchasesTable.notes,
      createdAt: purchasesTable.createdAt,
    })
    .from(purchasesTable)
    .leftJoin(itemsTable, eq(purchasesTable.itemId, itemsTable.id))
    .leftJoin(vendorsTable, eq(purchasesTable.vendorId, vendorsTable.id))
    .$dynamic();

  const conditions: any[] = [];
  if (search) conditions.push(ilike(itemsTable.name, `%${search}%`));
  if (includeStatus) {
    conditions.push(eq(purchasesTable.status, includeStatus));
  }
  if (conditions.length > 0) query = query.where(and(...conditions) as any);

  const rows = await query.orderBy(desc(purchasesTable.createdAt)).limit(limit).offset(offset);
  res.json(rows.map(r => ({ ...r, vendorName: r.vendorName ?? null })));
});

// Get a single purchase with its serialized units (for draft reload)
router.get("/purchases/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [purchase] = await db.select({
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
    status: purchasesTable.status,
    poNumber: purchasesTable.poNumber,
    notes: purchasesTable.notes,
    createdAt: purchasesTable.createdAt,
  }).from(purchasesTable)
    .leftJoin(itemsTable, eq(purchasesTable.itemId, itemsTable.id))
    .leftJoin(vendorsTable, eq(purchasesTable.vendorId, vendorsTable.id))
    .where(eq(purchasesTable.id, id));

  if (!purchase) { res.status(404).json({ error: "Not found" }); return; }

  const units = await db.select().from(serializedUnitsTable).where(eq(serializedUnitsTable.purchaseId, id));
  res.json({ ...purchase, units });
});

router.post("/purchases", async (req, res): Promise<void> => {
  const { itemId, quantity, totalCost, vendorId, paymentMethod, serialNumbers, status, poNumber, notes, units } = req.body;

  if (!itemId || !quantity || !totalCost || !paymentMethod) {
    res.status(400).json({ error: "itemId, quantity, totalCost, paymentMethod required" });
    return;
  }

  const purchaseStatus = status || "confirmed";

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
    vendorId: vendorId || null, paymentMethod,
    recordedBy: req.session.userId || null,
    status: purchaseStatus, poNumber: poNumber || null,
    notes: notes || null,
  }).returning();

  // Only update stock and balances for confirmed purchases
  if (purchaseStatus === "confirmed") {
    const [stockRow] = await db.select().from(stockTable).where(eq(stockTable.itemId, itemId));
    if (stockRow) {
      const newQty = parseFloat(stockRow.quantity) + parseFloat(String(quantity));
      await db.update(stockTable).set({ quantity: String(newQty), updatedAt: new Date() }).where(eq(stockTable.id, stockRow.id));
    }

    // Insert serialized units if provided (new per-unit flow)
    if (Array.isArray(units) && units.length > 0) {
      await db.insert(serializedUnitsTable).values(
        units.map((u: any) => ({
          itemId,
          imeiOrSerial: u.imeiOrSerial || null,
          color: u.color || null,
          storage: u.storage || null,
          ram: u.ram || null,
          additionalInfo: u.additionalInfo || null,
          condition: u.condition || null,
          vendorId: u.vendorId ? Number(u.vendorId) : (vendorId || null),
          purchaseId: purchase.id,
          costPrice: u.costPrice ? String(u.costPrice) : null,
          paymentMethod: u.paymentMethod || paymentMethod,
          status: "in_stock",
        }))
      );
    } else if (item?.trackSerial && Array.isArray(serialNumbers) && serialNumbers.length > 0) {
      // Legacy serial number flow
      const snValues = serialNumbers.map((sn: string) => sn.trim()).filter(Boolean).map(sn => ({
        itemId, serialNumber: sn, status: "in_stock",
        referenceType: "purchase", referenceId: purchase.id,
      }));
      if (snValues.length > 0) await db.insert(serialNumbersTable).values(snValues).onConflictDoNothing();
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

    // Update item prices from this purchase
    const unitCost = parseFloat(String(totalCost)) / Math.max(1, parseFloat(String(quantity)));
    const itemPriceUpdates: Record<string, string> = { purchasePrice: String(unitCost) };
    if (req.body.salePrice !== undefined && req.body.salePrice !== "") itemPriceUpdates.salePrice = String(req.body.salePrice);
    if (req.body.minSalePrice !== undefined && req.body.minSalePrice !== "") itemPriceUpdates.minSalePrice = String(req.body.minSalePrice);
    await db.update(itemsTable).set(itemPriceUpdates).where(eq(itemsTable.id, itemId));

    // Update minStock if provided
    if (req.body.minStock !== undefined && req.body.minStock !== "") {
      const [sr2] = await db.select().from(stockTable).where(eq(stockTable.itemId, itemId));
      if (sr2) await db.update(stockTable).set({ minStock: String(req.body.minStock) }).where(eq(stockTable.id, sr2.id));
    }

    await db.insert(auditLogsTable).values({
      userId: req.session.userId || null, action: "create_purchase",
      details: `Purchase of item ${itemId} qty ${quantity} cost ${totalCost} PO:${poNumber || 'N/A'}`,
    });
  }

  const [vendor] = vendorId ? await db.select().from(vendorsTable).where(eq(vendorsTable.id, vendorId)) : [null];

  res.status(201).json({
    ...purchase,
    itemName: item?.name ?? null,
    category: item?.category ?? null,
    trackSerial: item?.trackSerial ?? false,
    vendorName: vendor?.name ?? null,
  });
});

// Update (confirm a draft, or general update)
router.patch("/purchases/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { itemId, quantity, totalCost, vendorId, paymentMethod, status, poNumber, notes, units } = req.body;

  const [existing] = await db.select().from(purchasesTable).where(eq(purchasesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const wasDraft = existing.status === "draft";
  const isConfirming = status === "confirmed";

  const updates: any = {};
  if (itemId !== undefined) updates.itemId = itemId;
  if (quantity !== undefined) updates.quantity = String(quantity);
  if (totalCost !== undefined) updates.totalCost = String(totalCost);
  if (vendorId !== undefined) updates.vendorId = vendorId || null;
  if (paymentMethod !== undefined) updates.paymentMethod = paymentMethod;
  if (poNumber !== undefined) updates.poNumber = poNumber;
  if (notes !== undefined) updates.notes = notes;
  if (status !== undefined) updates.status = status;

  const [updated] = await db.update(purchasesTable).set(updates).where(eq(purchasesTable.id, id)).returning();

  // If confirming a draft, update stock and balances
  if (wasDraft && isConfirming) {
    const finalItemId = itemId || existing.itemId;
    const finalQty = quantity || existing.quantity;
    const finalCost = totalCost || existing.totalCost;
    const finalPayment = paymentMethod || existing.paymentMethod || "cash";
    const finalVendorId = vendorId !== undefined ? vendorId : existing.vendorId;

    const [stockRow] = await db.select().from(stockTable).where(eq(stockTable.itemId, finalItemId));
    if (stockRow) {
      const newQty = parseFloat(stockRow.quantity) + parseFloat(String(finalQty));
      await db.update(stockTable).set({ quantity: String(newQty), updatedAt: new Date() }).where(eq(stockTable.id, stockRow.id));
    }

    if (Array.isArray(units) && units.length > 0) {
      // Remove old draft units if any
      await db.delete(serializedUnitsTable).where(eq(serializedUnitsTable.purchaseId, id));
      await db.insert(serializedUnitsTable).values(
        units.map((u: any) => ({
          itemId: finalItemId,
          imeiOrSerial: u.imeiOrSerial || null,
          color: u.color || null,
          storage: u.storage || null,
          ram: u.ram || null,
          additionalInfo: u.additionalInfo || null,
          condition: u.condition || null,
          vendorId: u.vendorId ? Number(u.vendorId) : (finalVendorId || null),
          purchaseId: id,
          costPrice: u.costPrice ? String(u.costPrice) : null,
          paymentMethod: u.paymentMethod || finalPayment,
          status: "in_stock",
        }))
      );
    }

    const method = (finalPayment || "").toLowerCase();
    if (method === "credit") {
      await db.insert(payablesTable).values({
        purchaseId: id, vendorId: finalVendorId || null,
        totalAmount: String(finalCost), paidAmount: "0", dueDate: null, status: "unpaid",
      });
    } else {
      const dbMethod = method === "mobile_money" ? "mobile_money" : method;
      const [bal] = await db.select().from(balancesTable).where(eq(balancesTable.method, dbMethod));
      if (bal) {
        const newAmt = parseFloat(bal.amount) - parseFloat(String(finalCost));
        await db.update(balancesTable).set({ amount: String(newAmt), updatedAt: new Date() }).where(eq(balancesTable.id, bal.id));
      }
    }

    // Update item prices from confirmed purchase
    const unitCost = parseFloat(String(finalCost)) / Math.max(1, parseFloat(String(finalQty)));
    const itemPriceUpd: Record<string, string> = { purchasePrice: String(unitCost) };
    if (req.body.salePrice !== undefined && req.body.salePrice !== "") itemPriceUpd.salePrice = String(req.body.salePrice);
    if (req.body.minSalePrice !== undefined && req.body.minSalePrice !== "") itemPriceUpd.minSalePrice = String(req.body.minSalePrice);
    await db.update(itemsTable).set(itemPriceUpd).where(eq(itemsTable.id, finalItemId));

    // Update minStock if provided
    if (req.body.minStock !== undefined && req.body.minStock !== "") {
      const [sr3] = await db.select().from(stockTable).where(eq(stockTable.itemId, finalItemId));
      if (sr3) await db.update(stockTable).set({ minStock: String(req.body.minStock) }).where(eq(stockTable.id, sr3.id));
    }

    await db.insert(auditLogsTable).values({
      userId: req.session.userId || null, action: "confirm_purchase",
      details: `Draft purchase ${id} confirmed. Item ${finalItemId} qty ${finalQty}`,
    });
  }

  res.json(updated);
});

// Edit purchase metadata (date, vendor, notes, payment — no stock/balance reversal)
router.put("/purchases/:id/meta", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(purchasesTable).where(eq(purchasesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const { vendorId, paymentMethod, notes, poNumber, purchaseDate } = req.body;
  const updates: any = {};
  if (vendorId !== undefined) updates.vendorId = vendorId || null;
  if (paymentMethod) updates.paymentMethod = paymentMethod;
  if (notes !== undefined) updates.notes = notes;
  if (poNumber !== undefined) updates.poNumber = poNumber;
  if (purchaseDate) updates.createdAt = new Date(purchaseDate);

  const [updated] = await db.update(purchasesTable).set(updates).where(eq(purchasesTable.id, id)).returning();
  res.json(updated);
});

// Delete a purchase (draft or confirmed — reverses stock/balance for confirmed)
router.delete("/purchases/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(purchasesTable).where(eq(purchasesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  if (existing.status === "confirmed") {
    // Reverse stock
    const [stockRow] = await db.select().from(stockTable).where(eq(stockTable.itemId, existing.itemId!));
    if (stockRow) {
      const newQty = Math.max(0, parseFloat(stockRow.quantity) - parseFloat(existing.quantity));
      await db.update(stockTable).set({ quantity: String(newQty), updatedAt: new Date() }).where(eq(stockTable.id, stockRow.id));
    }
    // Restore balance
    const method = (existing.paymentMethod || "cash").toLowerCase();
    if (method !== "credit") {
      const dbMethod = method === "mobile_money" ? "mobile_money" : method;
      const [bal] = await db.select().from(balancesTable).where(eq(balancesTable.method, dbMethod));
      if (bal) {
        const newAmt = parseFloat(bal.amount) + parseFloat(existing.totalCost);
        await db.update(balancesTable).set({ amount: String(newAmt), updatedAt: new Date() }).where(eq(balancesTable.id, bal.id));
      }
    }
  }

  await db.delete(serializedUnitsTable).where(eq(serializedUnitsTable.purchaseId, id));
  await db.delete(purchasesTable).where(eq(purchasesTable.id, id));
  res.json({ ok: true });
});

export default router;
