import { Router } from "express";
import { eq, desc, inArray } from "drizzle-orm";
import {
  db, salesTable, saleItemsTable, itemsTable, stockTable,
  customersTable, balancesTable, receivablesTable, auditLogsTable,
  serialNumbersTable, serializedUnitsTable, creditAccountsTable,
} from "@workspace/db";
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
      serializedUnitId: saleItemsTable.serializedUnitId,
    })
    .from(saleItemsTable)
    .leftJoin(itemsTable, eq(saleItemsTable.itemId, itemsTable.id))
    .where(eq(saleItemsTable.saleId, sale.id));
  return { ...sale, items };
}

async function updateBalance(method: string, amount: number) {
  const dbMethod = method === "momo" ? "mobile_money" : method;
  const [bal] = await db.select().from(balancesTable).where(eq(balancesTable.method, dbMethod));
  if (bal) {
    const newAmt = parseFloat(bal.amount) + amount;
    await db.update(balancesTable).set({ amount: String(newAmt), updatedAt: new Date() }).where(eq(balancesTable.id, bal.id));
  }
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
      discountAmount: salesTable.discountAmount,
      discountType: salesTable.discountType,
      amountReceived: salesTable.amountReceived,
      changeGiven: salesTable.changeGiven,
      paymentTermsDays: salesTable.paymentTermsDays,
      splitPaymentMethod2: salesTable.splitPaymentMethod2,
      splitPaymentAmount1: salesTable.splitPaymentAmount1,
      splitPaymentAmount2: salesTable.splitPaymentAmount2,
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
  const {
    customerId, paymentMethod, totalAmount, items,
    paymentTermsDays, discountAmount, discountType,
    amountReceived, changeGiven,
    splitPaymentMethod2, splitPaymentAmount1, splitPaymentAmount2,
  } = req.body;

  if (!paymentMethod || !totalAmount || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "paymentMethod, totalAmount, items[] required" });
    return;
  }

  const method = paymentMethod.toLowerCase();

  if (method === "credit" && !customerId) {
    res.status(400).json({ error: "A customer is required for credit sales" });
    return;
  }

  for (const saleItem of items) {
    if (saleItem.serializedUnitId) {
      const [unit] = await db.select().from(serializedUnitsTable).where(eq(serializedUnitsTable.id, saleItem.serializedUnitId));
      if (!unit || unit.status !== "in_stock") {
        res.status(400).json({ error: `Serialized unit ${saleItem.serializedUnitId} is not available` });
        return;
      }
    } else {
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
  }

  const [sale] = await db.insert(salesTable).values({
    customerId: customerId || null,
    paymentMethod,
    totalAmount: String(totalAmount),
    discountAmount: discountAmount != null ? String(discountAmount) : "0",
    discountType: discountType || null,
    amountReceived: amountReceived != null ? String(amountReceived) : null,
    changeGiven: changeGiven != null ? String(changeGiven) : null,
    paymentTermsDays: paymentTermsDays ? Number(paymentTermsDays) : null,
    splitPaymentMethod2: splitPaymentMethod2 || null,
    splitPaymentAmount1: splitPaymentAmount1 != null ? String(splitPaymentAmount1) : null,
    splitPaymentAmount2: splitPaymentAmount2 != null ? String(splitPaymentAmount2) : null,
    recordedBy: req.session.userId || null,
    reverted: false,
  }).returning();

  for (const saleItem of items) {
    const qty = parseFloat(String(saleItem.quantity));
    const price = parseFloat(String(saleItem.unitPrice));
    const lineTotal = qty * price;

    await db.insert(saleItemsTable).values({
      saleId: sale.id,
      itemId: saleItem.itemId,
      quantity: String(qty),
      unitPrice: String(price),
      lineTotal: String(lineTotal),
      serializedUnitId: saleItem.serializedUnitId || null,
    });

    if (saleItem.serializedUnitId) {
      await db.update(serializedUnitsTable)
        .set({
          status: "sold",
          saleId: sale.id,
          soldAt: new Date(),
          soldPrice: String(price),
          soldToCustomerId: customerId || null,
        })
        .where(eq(serializedUnitsTable.id, saleItem.serializedUnitId));

      const [stockRow] = await db.select().from(stockTable).where(eq(stockTable.itemId, saleItem.itemId));
      if (stockRow) {
        const newQty = Math.max(0, parseFloat(stockRow.quantity) - 1);
        await db.update(stockTable).set({ quantity: String(newQty), updatedAt: new Date() }).where(eq(stockTable.id, stockRow.id));
      }
    } else {
      const [stockRow] = await db.select().from(stockTable).where(eq(stockTable.itemId, saleItem.itemId));
      if (stockRow) {
        const newQty = Math.max(0, parseFloat(stockRow.quantity) - qty);
        await db.update(stockTable).set({ quantity: String(newQty), updatedAt: new Date() }).where(eq(stockTable.id, stockRow.id));
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
  }

  if (method === "credit") {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (Number(paymentTermsDays) || 30));

    await db.insert(creditAccountsTable).values({
      saleId: sale.id,
      customerId: customerId,
      totalAmount: String(totalAmount),
      amountPaid: "0",
      balance: String(totalAmount),
      dueDate: dueDate,
      status: "active",
    });

    await db.insert(receivablesTable).values({
      saleId: sale.id,
      customerId: customerId || 1,
      totalAmount: String(totalAmount),
      paidAmount: "0",
      dueDate: dueDate.toISOString().split("T")[0],
      status: "unpaid",
    });
  } else if (method === "split") {
    const amt1 = parseFloat(String(splitPaymentAmount1 ?? 0));
    const amt2 = parseFloat(String(splitPaymentAmount2 ?? 0));
    const m1 = (paymentMethod).toLowerCase();
    const m2 = (splitPaymentMethod2 || "cash").toLowerCase();
    if (amt1 > 0) await updateBalance(m1 === "split" ? "cash" : m1, amt1);
    if (amt2 > 0) await updateBalance(m2, amt2);
  } else {
    await updateBalance(method, parseFloat(String(totalAmount)));
  }

  await db.insert(auditLogsTable).values({
    userId: req.session.userId || null,
    action: "create_sale",
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
    if (si.serializedUnitId) {
      await db.update(serializedUnitsTable)
        .set({ status: "in_stock", saleId: null, soldAt: null, soldPrice: null, soldToCustomerId: null })
        .where(eq(serializedUnitsTable.id, si.serializedUnitId));

      const [stockRow] = await db.select().from(stockTable).where(eq(stockTable.itemId, si.itemId));
      if (stockRow) {
        const newQty = parseFloat(stockRow.quantity) + 1;
        await db.update(stockTable).set({ quantity: String(newQty), updatedAt: new Date() }).where(eq(stockTable.id, stockRow.id));
      }
    } else {
      const [stockRow] = await db.select().from(stockTable).where(eq(stockTable.itemId, si.itemId));
      if (stockRow) {
        const newQty = parseFloat(stockRow.quantity) + parseFloat(si.quantity);
        await db.update(stockTable).set({ quantity: String(newQty), updatedAt: new Date() }).where(eq(stockTable.id, stockRow.id));
      }
    }
  }

  await db.update(serialNumbersTable)
    .set({ status: "in_stock", referenceType: null, referenceId: null, updatedAt: new Date() })
    .where(eq(serialNumbersTable.referenceId, id));

  const method = sale.paymentMethod?.toLowerCase() ?? "cash";
  if (method !== "credit") {
    if (method === "split") {
      const amt1 = parseFloat(String(sale.splitPaymentAmount1 ?? 0));
      const amt2 = parseFloat(String(sale.splitPaymentAmount2 ?? 0));
      const m2 = (sale.splitPaymentMethod2 || "cash").toLowerCase();
      if (amt1 > 0) await updateBalance("cash", -amt1);
      if (amt2 > 0) await updateBalance(m2, -amt2);
    } else {
      await updateBalance(method, -parseFloat(sale.totalAmount));
    }
  }

  const [updated] = await db.update(salesTable).set({ reverted: true }).where(eq(salesTable.id, id)).returning();

  await db.insert(auditLogsTable).values({
    userId: req.session.userId || null,
    action: "revert_sale",
    details: `Reverted sale ${id}`,
  });

  const result = await buildSaleResponse(updated);
  res.json(result);
});

export default router;
