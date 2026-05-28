import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, receivablesTable, receivablePaymentsTable, balancesTable, salesTable, customersTable, saleItemsTable, itemsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/receivables", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: receivablesTable.id,
      saleId: receivablesTable.saleId,
      customerId: receivablesTable.customerId,
      customerName: customersTable.name,
      totalAmount: receivablesTable.totalAmount,
      paidAmount: receivablesTable.paidAmount,
      dueDate: receivablesTable.dueDate,
      status: receivablesTable.status,
      createdAt: receivablesTable.createdAt,
    })
    .from(receivablesTable)
    .leftJoin(customersTable, eq(receivablesTable.customerId, customersTable.id))
    .orderBy(receivablesTable.createdAt);

  const results = await Promise.all(rows.map(async r => {
    const saleItems = await db
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
      .where(eq(saleItemsTable.saleId, r.saleId));

    const itemName = saleItems.length === 1 ? (saleItems[0].itemName ?? null) : null;
    return {
      ...r,
      remaining: String(parseFloat(r.totalAmount) - parseFloat(r.paidAmount)),
      customerName: r.customerName ?? null,
      itemName,
      saleItems,
    };
  }));

  res.json(results);
});

router.post("/receivables/:id/payment", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { amount, paymentMethod } = req.body;
  if (!amount || !paymentMethod) { res.status(400).json({ error: "amount and paymentMethod required" }); return; }

  const [receivable] = await db.select().from(receivablesTable).where(eq(receivablesTable.id, id));
  if (!receivable) { res.status(404).json({ error: "Receivable not found" }); return; }

  const newPaid = parseFloat(receivable.paidAmount) + parseFloat(String(amount));
  const total = parseFloat(receivable.totalAmount);
  const status = newPaid >= total ? "paid" : newPaid > 0 ? "partial" : "unpaid";

  const [updated] = await db.update(receivablesTable).set({
    paidAmount: String(newPaid), status,
  }).where(eq(receivablesTable.id, id)).returning();

  // Add to balance
  const dbMethod = paymentMethod.toLowerCase() === "mobile_money" ? "mobile_money" : paymentMethod.toLowerCase();
  const [bal] = await db.select().from(balancesTable).where(eq(balancesTable.method, dbMethod));
  if (bal) {
    const newAmt = parseFloat(bal.amount) + parseFloat(String(amount));
    await db.update(balancesTable).set({ amount: String(newAmt), updatedAt: new Date() }).where(eq(balancesTable.id, bal.id));
  }

  await db.insert(receivablePaymentsTable).values({
    receivableId: id, amount: String(amount), paymentMethod, recordedBy: req.session.userId || null,
  });

  res.json({ ...updated, remaining: String(parseFloat(updated.totalAmount) - parseFloat(updated.paidAmount)), customerName: null, itemName: null, saleItems: [] });
});

export default router;
