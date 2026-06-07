import { Router } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, expenseAccountsTable, expensesTable, balancesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/expense-accounts", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: expenseAccountsTable.id,
      name: expenseAccountsTable.name,
      accountType: expenseAccountsTable.accountType,
      totalSpent: sql<string>`COALESCE(SUM(${expensesTable.amount}::numeric), 0)::text`,
      count: sql<number>`COUNT(${expensesTable.id})::int`,
    })
    .from(expenseAccountsTable)
    .leftJoin(expensesTable, eq(expensesTable.accountId, expenseAccountsTable.id))
    .groupBy(expenseAccountsTable.id)
    .orderBy(expenseAccountsTable.name);
  res.json(rows);
});

router.post("/expense-accounts", async (req, res): Promise<void> => {
  const { name, accountType } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  const [account] = await db.insert(expenseAccountsTable).values({ name, accountType: accountType || "expense" }).returning();
  res.status(201).json(account);
});

router.put("/expense-accounts/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { name, accountType } = req.body;
  const [account] = await db.update(expenseAccountsTable).set({ ...(name && { name }), ...(accountType && { accountType }) }).where(eq(expenseAccountsTable.id, id)).returning();
  if (!account) { res.status(404).json({ error: "Account not found" }); return; }
  res.json(account);
});

router.delete("/expense-accounts/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(expenseAccountsTable).where(eq(expenseAccountsTable.id, id));
  res.sendStatus(204);
});

router.get("/expenses", async (req, res): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 100;
  const offset = (page - 1) * limit;
  const rows = await db
    .select({
      id: expensesTable.id,
      accountId: expensesTable.accountId,
      accountName: expenseAccountsTable.name,
      paymentMethod: expensesTable.paymentMethod,
      amount: expensesTable.amount,
      description: expensesTable.description,
      createdAt: expensesTable.createdAt,
    })
    .from(expensesTable)
    .leftJoin(expenseAccountsTable, eq(expensesTable.accountId, expenseAccountsTable.id))
    .orderBy(desc(expensesTable.createdAt))
    .limit(limit)
    .offset(offset);
  res.json(rows);
});

router.post("/expenses", async (req, res): Promise<void> => {
  const { accountId, paymentMethod, amount, description } = req.body;
  if (!accountId || !paymentMethod || !amount) { res.status(400).json({ error: "accountId, paymentMethod, amount required" }); return; }

  const dbMethod = paymentMethod.toLowerCase() === "mobile_money" ? "mobile_money" : paymentMethod.toLowerCase();
  const [bal] = await db.select().from(balancesTable).where(eq(balancesTable.method, dbMethod));
  if (bal && parseFloat(bal.amount) < parseFloat(String(amount))) {
    res.status(400).json({ error: "Insufficient balance" });
    return;
  }

  const [expense] = await db.insert(expensesTable).values({
    accountId, paymentMethod, amount: String(amount), description: description || null, paidBy: req.session.userId || null,
  }).returning();

  if (bal) {
    const newAmt = parseFloat(bal.amount) - parseFloat(String(amount));
    await db.update(balancesTable).set({ amount: String(newAmt), updatedAt: new Date() }).where(eq(balancesTable.id, bal.id));
  }

  const [account] = await db.select().from(expenseAccountsTable).where(eq(expenseAccountsTable.id, accountId));
  res.status(201).json({ ...expense, accountName: account?.name ?? null });
});

export default router;
