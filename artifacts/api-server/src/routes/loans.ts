import { Router } from "express";
import { eq, sql, desc } from "drizzle-orm";
import { db, loansTable, loanPaymentsTable, customersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/loans", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: loansTable.id,
      customerId: loansTable.customerId,
      customerName: customersTable.name,
      amount: loansTable.amount,
      paidAmount: loansTable.paidAmount,
      description: loansTable.description,
      dueDate: loansTable.dueDate,
      status: loansTable.status,
      createdAt: loansTable.createdAt,
    })
    .from(loansTable)
    .leftJoin(customersTable, eq(loansTable.customerId, customersTable.id))
    .orderBy(desc(loansTable.createdAt));
  res.json(rows);
});

router.get("/loans/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const [loan] = await db
    .select({
      id: loansTable.id,
      customerId: loansTable.customerId,
      customerName: customersTable.name,
      amount: loansTable.amount,
      paidAmount: loansTable.paidAmount,
      description: loansTable.description,
      dueDate: loansTable.dueDate,
      status: loansTable.status,
      createdAt: loansTable.createdAt,
    })
    .from(loansTable)
    .leftJoin(customersTable, eq(loansTable.customerId, customersTable.id))
    .where(eq(loansTable.id, id));
  if (!loan) { res.status(404).json({ error: "Loan not found" }); return; }

  const payments = await db
    .select()
    .from(loanPaymentsTable)
    .where(eq(loanPaymentsTable.loanId, id))
    .orderBy(desc(loanPaymentsTable.paidAt));

  res.json({ ...loan, payments });
});

router.post("/loans", async (req, res): Promise<void> => {
  const { customerId, amount, description, dueDate } = req.body;
  if (!customerId || !amount) { res.status(400).json({ error: "customerId and amount required" }); return; }
  const [loan] = await db.insert(loansTable).values({
    customerId: Number(customerId),
    amount: String(amount),
    description: description || null,
    dueDate: dueDate || null,
    recordedBy: req.session.userId,
  }).returning();
  res.status(201).json(loan);
});

router.post("/loans/:id/payments", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const { amount, paymentMethod, note } = req.body;
  if (!amount) { res.status(400).json({ error: "amount required" }); return; }

  const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, id));
  if (!loan) { res.status(404).json({ error: "Loan not found" }); return; }

  const newPaid = parseFloat(loan.paidAmount) + parseFloat(amount);
  const totalAmount = parseFloat(loan.amount);
  const newStatus = newPaid >= totalAmount ? "paid" : "active";

  await db.insert(loanPaymentsTable).values({
    loanId: id,
    amount: String(amount),
    paymentMethod: paymentMethod || "cash",
    note: note || null,
    recordedBy: req.session.userId,
  });

  const [updated] = await db
    .update(loansTable)
    .set({ paidAmount: String(Math.min(newPaid, totalAmount)), status: newStatus })
    .where(eq(loansTable.id, id))
    .returning();

  res.json(updated);
});

router.delete("/loans/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  await db.delete(loansTable).where(eq(loansTable.id, id));
  res.sendStatus(204);
});

router.get("/customers/:id/summary", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const [spending] = await db.execute<{ total: string }>(
    sql`SELECT COALESCE(SUM(s.total_amount), 0) AS total FROM sales s WHERE s.customer_id = ${id} AND s.reverted = false`
  );
  const [loanSummary] = await db.execute<{ total_loan: string; total_paid: string; active_count: string }>(
    sql`SELECT COALESCE(SUM(amount), 0) AS total_loan, COALESCE(SUM(paid_amount), 0) AS total_paid, COUNT(*) FILTER (WHERE status = 'active') AS active_count FROM loans WHERE customer_id = ${id}`
  );
  res.json({
    totalSpent: parseFloat((spending as any)?.total ?? "0"),
    totalLoan: parseFloat((loanSummary as any)?.total_loan ?? "0"),
    totalLoanPaid: parseFloat((loanSummary as any)?.total_paid ?? "0"),
    activeLoans: parseInt((loanSummary as any)?.active_count ?? "0", 10),
  });
});

export default router;
