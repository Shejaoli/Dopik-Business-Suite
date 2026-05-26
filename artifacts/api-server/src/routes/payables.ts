import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, payablesTable, payablePaymentsTable, balancesTable, purchasesTable, vendorsTable, itemsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/payables", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: payablesTable.id,
      purchaseId: payablesTable.purchaseId,
      vendorId: payablesTable.vendorId,
      vendorName: vendorsTable.name,
      itemName: itemsTable.name,
      totalAmount: payablesTable.totalAmount,
      paidAmount: payablesTable.paidAmount,
      dueDate: payablesTable.dueDate,
      status: payablesTable.status,
      createdAt: payablesTable.createdAt,
    })
    .from(payablesTable)
    .leftJoin(vendorsTable, eq(payablesTable.vendorId, vendorsTable.id))
    .leftJoin(purchasesTable, eq(payablesTable.purchaseId, purchasesTable.id))
    .leftJoin(itemsTable, eq(purchasesTable.itemId, itemsTable.id))
    .orderBy(payablesTable.createdAt);

  res.json(rows.map(r => ({
    ...r,
    remaining: String(parseFloat(r.totalAmount) - parseFloat(r.paidAmount)),
    vendorName: r.vendorName ?? null,
    itemName: r.itemName ?? null,
  })));
});

router.post("/payables/:id/payment", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { amount, paymentMethod } = req.body;
  if (!amount || !paymentMethod) { res.status(400).json({ error: "amount and paymentMethod required" }); return; }

  const [payable] = await db.select().from(payablesTable).where(eq(payablesTable.id, id));
  if (!payable) { res.status(404).json({ error: "Payable not found" }); return; }

  const newPaid = parseFloat(payable.paidAmount) + parseFloat(String(amount));
  const total = parseFloat(payable.totalAmount);
  const status = newPaid >= total ? "paid" : newPaid > 0 ? "partial" : "unpaid";

  const [updated] = await db.update(payablesTable).set({
    paidAmount: String(newPaid), status,
  }).where(eq(payablesTable.id, id)).returning();

  // Deduct from balance
  const dbMethod = paymentMethod.toLowerCase() === "mobile_money" ? "mobile_money" : paymentMethod.toLowerCase();
  const [bal] = await db.select().from(balancesTable).where(eq(balancesTable.method, dbMethod));
  if (bal) {
    const newAmt = parseFloat(bal.amount) - parseFloat(String(amount));
    await db.update(balancesTable).set({ amount: String(newAmt), updatedAt: new Date() }).where(eq(balancesTable.id, bal.id));
  }

  await db.insert(payablePaymentsTable).values({
    payableId: id, amount: String(amount), paymentMethod, recordedBy: req.session.userId || null,
  });

  res.json({ ...updated, remaining: String(parseFloat(updated.totalAmount) - parseFloat(updated.paidAmount)), vendorName: null, itemName: null });
});

export default router;
