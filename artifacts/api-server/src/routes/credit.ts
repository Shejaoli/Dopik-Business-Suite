import { Router } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import { db, creditAccountsTable, creditPaymentsTable, installmentPlansTable, customersTable, salesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { logActivity } from "./staff";

const router = Router();
router.use(requireAuth);

function buildCreditResponse(account: any, customer: any, payments: any[]) {
  const daysOverdue = account.dueDate
    ? Math.max(0, Math.floor((Date.now() - new Date(account.dueDate).getTime()) / 86400000))
    : 0;
  const urgency = !account.dueDate ? "none"
    : parseFloat(account.balance) <= 0 ? "paid"
    : daysOverdue > 0 ? "overdue"
    : daysOverdue > -7 ? "due_soon"
    : "ok";
  return { ...account, customerName: customer?.name, customerPhone: customer?.phone, payments, daysOverdue, urgency };
}

router.get("/credit", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(creditAccountsTable)
    .leftJoin(customersTable, eq(creditAccountsTable.customerId, customersTable.id))
    .orderBy(desc(creditAccountsTable.createdAt));

  const results = await Promise.all(rows.map(async (r) => {
    const payments = await db.select().from(creditPaymentsTable)
      .where(eq(creditPaymentsTable.creditAccountId, r.credit_accounts.id))
      .orderBy(desc(creditPaymentsTable.paidAt));
    return buildCreditResponse(r.credit_accounts, r.customers, payments);
  }));

  res.json(results);
});

router.get("/credit/summary", async (req, res): Promise<void> => {
  const active = await db.select({
    totalBalance: sql<string>`COALESCE(SUM(balance),0)`,
    count: sql<number>`COUNT(*)`,
    overdueBalance: sql<string>`COALESCE(SUM(CASE WHEN due_date < NOW() AND balance > 0 THEN balance ELSE 0 END),0)`,
    overdueCount: sql<number>`SUM(CASE WHEN due_date < NOW() AND balance > 0 THEN 1 ELSE 0 END)`,
  }).from(creditAccountsTable).where(eq(creditAccountsTable.status, "active"));

  res.json(active[0] || { totalBalance: "0", count: 0, overdueBalance: "0", overdueCount: 0 });
});

router.get("/credit/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [row] = await db.select().from(creditAccountsTable)
    .leftJoin(customersTable, eq(creditAccountsTable.customerId, customersTable.id))
    .where(eq(creditAccountsTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }

  const payments = await db.select().from(creditPaymentsTable)
    .where(eq(creditPaymentsTable.creditAccountId, id))
    .orderBy(desc(creditPaymentsTable.paidAt));

  const installments = await db.select().from(installmentPlansTable)
    .where(eq(installmentPlansTable.creditAccountId, id))
    .orderBy(installmentPlansTable.installmentNumber);

  res.json({ ...buildCreditResponse(row.credit_accounts, row.customers, payments), installments });
});

router.post("/credit", async (req, res): Promise<void> => {
  const { saleId, customerId, totalAmount, amountPaid, dueDate, notes, installments } = req.body;
  if (!customerId || !totalAmount) {
    res.status(400).json({ error: "customerId and totalAmount required" });
    return;
  }
  const balance = parseFloat(totalAmount) - parseFloat(amountPaid || "0");
  const [account] = await db.insert(creditAccountsTable).values({
    saleId: saleId || null,
    customerId,
    totalAmount: String(totalAmount),
    amountPaid: String(amountPaid || 0),
    balance: String(balance),
    dueDate: dueDate ? new Date(dueDate) : null,
    status: balance <= 0 ? "paid" : "active",
    notes: notes || null,
  }).returning();

  if (installments && Array.isArray(installments) && installments.length > 0) {
    for (const inst of installments) {
      await db.insert(installmentPlansTable).values({
        creditAccountId: account.id,
        installmentNumber: inst.number,
        amount: String(inst.amount),
        dueDate: new Date(inst.dueDate),
        status: "pending",
      });
    }
  }

  await logActivity(req, "create_credit", `Created credit account for customer #${customerId}: ${totalAmount} RWF`);
  res.status(201).json(account);
});

router.post("/credit/:id/payment", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { amount, paymentMethod, notes } = req.body;
  if (!amount || parseFloat(amount) <= 0) {
    res.status(400).json({ error: "amount required" });
    return;
  }

  const [account] = await db.select().from(creditAccountsTable).where(eq(creditAccountsTable.id, id));
  if (!account) { res.status(404).json({ error: "Credit account not found" }); return; }

  const [payment] = await db.insert(creditPaymentsTable).values({
    creditAccountId: id,
    amount: String(amount),
    paymentMethod: paymentMethod || "cash",
    notes: notes || null,
    recordedBy: req.session.userId || null,
  }).returning();

  const newAmountPaid = parseFloat(account.amountPaid) + parseFloat(amount);
  const newBalance = Math.max(0, parseFloat(account.totalAmount) - newAmountPaid);
  const newStatus = newBalance <= 0 ? "paid" : "active";

  await db.update(creditAccountsTable).set({
    amountPaid: String(newAmountPaid),
    balance: String(newBalance),
    status: newStatus,
    updatedAt: new Date(),
  }).where(eq(creditAccountsTable.id, id));

  const pendingInstallments = await db.select().from(installmentPlansTable)
    .where(and(eq(installmentPlansTable.creditAccountId, id), eq(installmentPlansTable.status, "pending")))
    .orderBy(installmentPlansTable.installmentNumber)
    .limit(1);

  if (pendingInstallments.length > 0) {
    await db.update(installmentPlansTable).set({ status: "paid", paidAt: new Date() })
      .where(eq(installmentPlansTable.id, pendingInstallments[0].id));
  }

  await logActivity(req, "record_credit_payment", `Recorded credit payment of ${amount} RWF for account #${id}`);
  res.json({ payment, newBalance, newStatus });
});

router.patch("/credit/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { dueDate, notes, status } = req.body;
  const updates: any = { updatedAt: new Date() };
  if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;
  if (notes !== undefined) updates.notes = notes;
  if (status) updates.status = status;
  const [account] = await db.update(creditAccountsTable).set(updates).where(eq(creditAccountsTable.id, id)).returning();
  if (!account) { res.status(404).json({ error: "Not found" }); return; }
  res.json(account);
});

export default router;
