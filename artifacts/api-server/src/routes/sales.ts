import { Router } from "express";
import { eq, desc, inArray } from "drizzle-orm";
import { db, salesTable, saleItemsTable, itemsTable, stockTable, customersTable, balancesTable, receivablesTable, auditLogsTable, serialNumbersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

async function buildSaleResponse(sale: any) {
  const items = await db
    .select({
      id: saleItemsTable.id,
      saleId: saleItemsTable.saleId,
      itemId: saleItemsTable.itemId,
      itemName: itemsTable.name,
      category: itemsTable.category,
      quantity: saleItemsTable.quantity,
      unitPrice: saleItemsTable.unitPrice,
      lineTotal: saleItemsTable.lineTotal,
    })
    .from(saleItemsTable)
    .leftJoin(itemsTable, eq(saleItemsTable.itemId, itemsTable.id))
    .where(eq(saleItemsTable.saleId, sale.id));
  return { ...sale, items };
}

router.get("/sales", async (req, res): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;

  const rows = await db
    .select({
      id: salesTable.id,
      customerId: salesTable.customerId,
      customerName: customersTable.name,
      paymentMethod: salesTable.paymentMethod,
      totalAmount: salesTable.totalAmount,
      recordedBy: salesTable.recordedBy,
      reverted: salesTable.reverted,
      createdAt: salesTable.createdAt,
    })
    .from(salesTable)
    .leftJoin(customersTable, eq(salesTable.customerId, customersTable.id))
    .orderBy(desc(salesTable.createdAt))
    .limit(limit)
    .offset(offset);

  const results = await Promise.all(rows.map(buildSaleResponse));
  res.json(results);
});

router.post("/sales", async (req, res): Promise<void> => {
  const { customerId, paymentMethod, totalAmount, items, paymentTermsDays } = req.body;
  if (!paymentMethod || !totalAmount || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "paymentMethod, totalAmount, items[] required" });
    return;
  }

  for (const saleItem of items) {
    const [stockRow] = await db.select().from(stockTable).where(eq(stockTable.itemId, saleItem.itemId));
    if (!stockRow || parseFloat(stockRow.quantity) <= 0) {
      res.status(400).json({ error: `Item ${saleItem.itemId} is out of stock` });
      return;
    }
    if (parseFloat(stockRow.quantity) < parseFloat(String(saleItem.quantity))) {
      res.status(400).json({ error: `Insufficient stock for item ${saleItem.itemId}` });
      return;
    }
  }

  const [sale] = await db.insert(salesTable).values({
    customerId: customerId || null, paymentMethod, totalAmount: String(totalAmount),
    recordedBy: req.session.userId || null, reverted: false,
  }).returning();

  for (const saleItem of items) {
    const lineTotal = parseFloat(String(saleItem.quantity)) * parseFloat(String(saleItem.unitPrice));
    await db.insert(saleItemsTable).values({
      saleId: sale.id, itemId: saleItem.itemId,
      quantity: String(saleItem.quantity), unitPrice: String(saleItem.unitPrice),
      lineTotal: String(lineTotal),
    });

    const [stockRow] = await db.select().from(stockTable).where(eq(stockTable.itemId, saleItem.itemId));
    if (stockRow) {
      const newQty = parseFloat(stockRow.quantity) - parseFloat(String(saleItem.quantity));
      await db.update(stockTable).set({ quantity: String(Math.max(0, newQty)), updatedAt: new Date() }).where(eq(stockTable.id, stockRow.id));
    }

    if (Array.isArray(saleItem.serialNumbers) && saleItem.serialNumbers.length > 0) {
      const snList = saleItem.serialNumbers.map((s: string) => s.trim()).filter(Boolean);
      if (snList.length > 0) {
        await db.update(serialNumbersTable)
          .set({ status: "sold", referenceType: "sale", referenceId: sale.id, updatedAt: new Date() })
          .where(inArray(serialNumbersTable.serialNumber, snList));
      }
    }
  }

  const method = paymentMethod.toLowerCase();
  if (method === "credit") {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (Number(paymentTermsDays) || 30));
    await db.insert(receivablesTable).values({
      saleId: sale.id, customerId: customerId || 1,
      totalAmount: String(totalAmount), paidAmount: "0",
      dueDate: dueDate.toISOString().split("T")[0], status: "unpaid",
    });
  } else {
    const dbMethod = method === "mobile_money" ? "mobile_money" : method;
    const [bal] = await db.select().from(balancesTable).where(eq(balancesTable.method, dbMethod));
    if (bal) {
      const newAmt = parseFloat(bal.amount) + parseFloat(String(totalAmount));
      await db.update(balancesTable).set({ amount: String(newAmt), updatedAt: new Date() }).where(eq(balancesTable.id, bal.id));
    }
  }

  await db.insert(auditLogsTable).values({
    userId: req.session.userId || null, action: "create_sale",
    details: `Sale ${sale.id} total ${totalAmount} payment ${paymentMethod}`,
  });

  const result = await buildSaleResponse(sale);
  res.status(201).json(result);
});

router.post("/sales/:id/revert", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, id));
  if (!sale) { res.status(404).json({ error: "Sale not found" }); return; }
  if (sale.reverted) { res.status(400).json({ error: "Sale already reverted" }); return; }

  const items = await db.select().from(saleItemsTable).where(eq(saleItemsTable.saleId, id));
  for (const si of items) {
    const [stockRow] = await db.select().from(stockTable).where(eq(stockTable.itemId, si.itemId));
    if (stockRow) {
      const newQty = parseFloat(stockRow.quantity) + parseFloat(si.quantity);
      await db.update(stockTable).set({ quantity: String(newQty), updatedAt: new Date() }).where(eq(stockTable.id, stockRow.id));
    }
  }

  await db.update(serialNumbersTable)
    .set({ status: "in_stock", referenceType: null, referenceId: null, updatedAt: new Date() })
    .where(eq(serialNumbersTable.referenceId, id));

  const method = sale.paymentMethod?.toLowerCase() ?? "cash";
  if (method !== "credit") {
    const dbMethod = method === "mobile_money" ? "mobile_money" : method;
    const [bal] = await db.select().from(balancesTable).where(eq(balancesTable.method, dbMethod));
    if (bal) {
      const newAmt = parseFloat(bal.amount) - parseFloat(sale.totalAmount);
      await db.update(balancesTable).set({ amount: String(newAmt), updatedAt: new Date() }).where(eq(balancesTable.id, bal.id));
    }
  }

  const [updated] = await db.update(salesTable).set({ reverted: true }).where(eq(salesTable.id, id)).returning();

  await db.insert(auditLogsTable).values({
    userId: req.session.userId || null, action: "revert_sale", details: `Reverted sale ${id}`,
  });

  const result = await buildSaleResponse(updated);
  res.json(result);
});

export default router;
