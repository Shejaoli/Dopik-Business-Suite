import { Router } from "express";
import { db } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import {
  usersTable, itemsTable, stockTable, stockAdjustmentsTable,
  customersTable, vendorsTable,
  salesTable, saleItemsTable,
  purchasesTable,
  receivablesTable, receivablePaymentsTable,
  payablesTable, payablePaymentsTable,
  loansTable, loanPaymentsTable,
  expensesTable, expenseAccountsTable,
  balancesTable, auditLogsTable,
  serialNumbersTable,
} from "@workspace/db";

const router = Router();
router.use(requireAuth);

router.get("/backup/export", async (_req, res): Promise<void> => {
  try {
    const [
      users, items, stock, stockAdjustments,
      customers, vendors,
      sales, saleItems, purchases,
      receivables, receivablePayments,
      payables, payablePayments,
      loans, loanPayments,
      expenses, expenseAccounts,
      balances, auditLogs,
      serialNumbers,
    ] = await Promise.all([
      db.select().from(usersTable),
      db.select().from(itemsTable),
      db.select().from(stockTable),
      db.select().from(stockAdjustmentsTable),
      db.select().from(customersTable),
      db.select().from(vendorsTable),
      db.select().from(salesTable),
      db.select().from(saleItemsTable),
      db.select().from(purchasesTable),
      db.select().from(receivablesTable),
      db.select().from(receivablePaymentsTable),
      db.select().from(payablesTable),
      db.select().from(payablePaymentsTable),
      db.select().from(loansTable),
      db.select().from(loanPaymentsTable),
      db.select().from(expensesTable),
      db.select().from(expenseAccountsTable),
      db.select().from(balancesTable),
      db.select().from(auditLogsTable),
      db.select().from(serialNumbersTable),
    ]);

    const backup = {
      version: 2,
      exportedAt: new Date().toISOString(),
      data: {
        users, items, stock, stockAdjustments,
        customers, vendors,
        sales, saleItems, purchases,
        receivables, receivablePayments,
        payables, payablePayments,
        loans, loanPayments,
        expenses, expenseAccounts,
        balances, auditLogs,
        serialNumbers,
      },
    };

    const filename = `dopik-backup-${new Date().toISOString().split("T")[0]}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.json(backup);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

function fixDates<T extends Record<string, any>>(records: T[]): T[] {
  if (!records?.length) return records;
  return records.map(record => {
    const fixed: Record<string, any> = {};
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        fixed[key] = new Date(value);
      } else {
        fixed[key] = value;
      }
    }
    return fixed as T;
  });
}

router.post("/backup/import", async (req, res): Promise<void> => {
  try {
    const backup = req.body;
    if (!backup?.version || !backup?.data) {
      res.status(400).json({ error: "Invalid backup file format" });
      return;
    }
    const d = backup.data;

    await db.execute(`
      TRUNCATE TABLE
        serial_numbers,
        audit_logs, loan_payments, loans,
        sale_items, receivable_payments, receivables,
        payable_payments, payables,
        stock_adjustments, stock,
        sales, purchases,
        expenses, expense_accounts,
        balances,
        items, customers, vendors,
        users
      RESTART IDENTITY CASCADE
    `);

    if (d.users?.length)                await db.insert(usersTable).values(fixDates(d.users));
    if (d.items?.length)                await db.insert(itemsTable).values(fixDates(d.items));
    if (d.stock?.length)                await db.insert(stockTable).values(fixDates(d.stock));
    if (d.customers?.length)            await db.insert(customersTable).values(fixDates(d.customers));
    if (d.vendors?.length)              await db.insert(vendorsTable).values(fixDates(d.vendors));
    if (d.expenseAccounts?.length)      await db.insert(expenseAccountsTable).values(fixDates(d.expenseAccounts));
    if (d.balances?.length)             await db.insert(balancesTable).values(fixDates(d.balances));
    if (d.sales?.length)                await db.insert(salesTable).values(fixDates(d.sales));
    if (d.saleItems?.length)            await db.insert(saleItemsTable).values(fixDates(d.saleItems));
    if (d.purchases?.length)            await db.insert(purchasesTable).values(fixDates(d.purchases));
    if (d.receivables?.length)          await db.insert(receivablesTable).values(fixDates(d.receivables));
    if (d.receivablePayments?.length)   await db.insert(receivablePaymentsTable).values(fixDates(d.receivablePayments));
    if (d.payables?.length)             await db.insert(payablesTable).values(fixDates(d.payables));
    if (d.payablePayments?.length)      await db.insert(payablePaymentsTable).values(fixDates(d.payablePayments));
    if (d.expenses?.length)             await db.insert(expensesTable).values(fixDates(d.expenses));
    if (d.loans?.length)                await db.insert(loansTable).values(fixDates(d.loans));
    if (d.loanPayments?.length)         await db.insert(loanPaymentsTable).values(fixDates(d.loanPayments));
    if (d.stockAdjustments?.length)     await db.insert(stockAdjustmentsTable).values(fixDates(d.stockAdjustments));
    if (d.serialNumbers?.length)        await db.insert(serialNumbersTable).values(fixDates(d.serialNumbers));
    if (d.auditLogs?.length)            await db.insert(auditLogsTable).values(fixDates(d.auditLogs));

    // Reset all sequences so new inserts don't collide with restored IDs
    await db.execute(`
      SELECT setval(pg_get_serial_sequence('users', 'id'),           COALESCE((SELECT MAX(id) FROM users), 0) + 1, false);
      SELECT setval(pg_get_serial_sequence('items', 'id'),           COALESCE((SELECT MAX(id) FROM items), 0) + 1, false);
      SELECT setval(pg_get_serial_sequence('stock', 'id'),           COALESCE((SELECT MAX(id) FROM stock), 0) + 1, false);
      SELECT setval(pg_get_serial_sequence('stock_adjustments', 'id'), COALESCE((SELECT MAX(id) FROM stock_adjustments), 0) + 1, false);
      SELECT setval(pg_get_serial_sequence('customers', 'id'),       COALESCE((SELECT MAX(id) FROM customers), 0) + 1, false);
      SELECT setval(pg_get_serial_sequence('vendors', 'id'),         COALESCE((SELECT MAX(id) FROM vendors), 0) + 1, false);
      SELECT setval(pg_get_serial_sequence('sales', 'id'),           COALESCE((SELECT MAX(id) FROM sales), 0) + 1, false);
      SELECT setval(pg_get_serial_sequence('sale_items', 'id'),      COALESCE((SELECT MAX(id) FROM sale_items), 0) + 1, false);
      SELECT setval(pg_get_serial_sequence('purchases', 'id'),       COALESCE((SELECT MAX(id) FROM purchases), 0) + 1, false);
      SELECT setval(pg_get_serial_sequence('receivables', 'id'),     COALESCE((SELECT MAX(id) FROM receivables), 0) + 1, false);
      SELECT setval(pg_get_serial_sequence('receivable_payments', 'id'), COALESCE((SELECT MAX(id) FROM receivable_payments), 0) + 1, false);
      SELECT setval(pg_get_serial_sequence('payables', 'id'),        COALESCE((SELECT MAX(id) FROM payables), 0) + 1, false);
      SELECT setval(pg_get_serial_sequence('payable_payments', 'id'), COALESCE((SELECT MAX(id) FROM payable_payments), 0) + 1, false);
      SELECT setval(pg_get_serial_sequence('loans', 'id'),           COALESCE((SELECT MAX(id) FROM loans), 0) + 1, false);
      SELECT setval(pg_get_serial_sequence('loan_payments', 'id'),   COALESCE((SELECT MAX(id) FROM loan_payments), 0) + 1, false);
      SELECT setval(pg_get_serial_sequence('expenses', 'id'),        COALESCE((SELECT MAX(id) FROM expenses), 0) + 1, false);
      SELECT setval(pg_get_serial_sequence('expense_accounts', 'id'), COALESCE((SELECT MAX(id) FROM expense_accounts), 0) + 1, false);
      SELECT setval(pg_get_serial_sequence('balances', 'id'),        COALESCE((SELECT MAX(id) FROM balances), 0) + 1, false);
      SELECT setval(pg_get_serial_sequence('audit_logs', 'id'),      COALESCE((SELECT MAX(id) FROM audit_logs), 0) + 1, false);
      SELECT setval(pg_get_serial_sequence('serial_numbers', 'id'),  COALESCE((SELECT MAX(id) FROM serial_numbers), 0) + 1, false);
    `);

    res.json({ success: true, message: "Database restored successfully. Please log in again." });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
