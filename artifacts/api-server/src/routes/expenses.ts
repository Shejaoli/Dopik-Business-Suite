import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, expenseAccountsTable, expensesTable, balancesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/expense-accounts", async (req, res): Promise<void> => {
  const rows = await db.select().from(expenseAccountsTable).orderBy(expenseAccountsTable.name);
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
