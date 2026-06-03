import { Router } from "express";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import { db, salesTable, saleItemsTable, purchasesTable, expensesTable, expenseAccountsTable, itemsTable, vendorsTable, stockAdjustmentsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/reports/sales", async (req, res): Promise<void> => {
  const { start, end } = req.query as { start?: string; end?: string };

  const conditions = [];
  if (start) conditions.push(gte(salesTable.createdAt, new Date(start)));
  if (end) conditions.push(lte(salesTable.createdAt, new Date(end + "T23:59:59Z")));

  const rows = await db
    .select({
      itemName: itemsTable.name,
      category: itemsTable.category,
      quantity: saleItemsTable.quantity,
      totalSale: saleItemsTable.lineTotal,
      saleDate: salesTable.createdAt,
    })
    .from(saleItemsTable)
    .innerJoin(salesTable, eq(saleItemsTable.saleId, salesTable.id))
    .leftJoin(itemsTable, eq(saleItemsTable.itemId, itemsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined as any)
    .orderBy(sql`${salesTable.createdAt} DESC`);

  const totalSales = rows.reduce((sum, r) => sum + parseFloat(r.totalSale), 0);

  res.json({
    rows: rows.map(r => ({
      itemName: r.itemName ?? "Unknown",
      category: r.category ?? "",
      quantity: r.quantity,
      totalSale: r.totalSale,
      saleDate: r.saleDate?.toISOString() ?? "",
    })),
    totalSales: String(totalSales.toFixed(2)),
  });
});

router.get("/reports/purchases", async (req, res): Promise<void> => {
  const { start, end } = req.query as { start?: string; end?: string };

  const conditions = [];
  if (start) conditions.push(gte(purchasesTable.createdAt, new Date(start)));
  if (end) conditions.push(lte(purchasesTable.createdAt, new Date(end + "T23:59:59Z")));

  const rows = await db
    .select({
      itemName: itemsTable.name,
      category: itemsTable.category,
      quantity: purchasesTable.quantity,
      totalCost: purchasesTable.totalCost,
      vendorName: vendorsTable.name,
      purchaseDate: purchasesTable.createdAt,
    })
    .from(purchasesTable)
    .leftJoin(itemsTable, eq(purchasesTable.itemId, itemsTable.id))
    .leftJoin(vendorsTable, eq(purchasesTable.vendorId, vendorsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined as any)
    .orderBy(sql`${purchasesTable.createdAt} DESC`);

  const totalCost = rows.reduce((sum, r) => sum + parseFloat(r.totalCost), 0);

  res.json({
    rows: rows.map(r => ({
      itemName: r.itemName ?? "Unknown",
      category: r.category ?? "",
      quantity: r.quantity,
      totalCost: r.totalCost,
      vendorName: r.vendorName ?? null,
      purchaseDate: r.purchaseDate?.toISOString() ?? "",
    })),
    totalCost: String(totalCost.toFixed(2)),
  });
});

router.get("/reports/expenses", async (req, res): Promise<void> => {
  const { start, end } = req.query as { start?: string; end?: string };

  const conditions = [];
  if (start) conditions.push(gte(expensesTable.createdAt, new Date(start)));
  if (end) conditions.push(lte(expensesTable.createdAt, new Date(end + "T23:59:59Z")));

  const rows = await db
    .select({
      accountName: expenseAccountsTable.name,
      description: expensesTable.description,
      amount: expensesTable.amount,
      date: expensesTable.createdAt,
    })
    .from(expensesTable)
    .leftJoin(expenseAccountsTable, eq(expensesTable.accountId, expenseAccountsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined as any)
    .orderBy(sql`${expensesTable.createdAt} DESC`);

  const totalExpenses = rows.reduce((sum, r) => sum + parseFloat(r.amount), 0);

  res.json({
    rows: rows.map(r => ({
      accountName: r.accountName ?? "Unknown",
      description: r.description ?? null,
      amount: r.amount,
      date: r.date?.toISOString() ?? "",
    })),
    totalExpenses: String(totalExpenses.toFixed(2)),
  });
});

router.get("/reports/summary", async (req, res): Promise<void> => {
  const year = parseInt(req.query.year as string) || new Date().getFullYear();

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const rows = await Promise.all(months.map(async (month) => {
    const start = new Date(`${year}-${String(month).padStart(2, "0")}-01`);
    const end = new Date(year, month, 0, 23, 59, 59);

    // Gross profit from sale_items
    const salesRows = await db
      .select({
        quantity: saleItemsTable.quantity,
        unitPrice: saleItemsTable.unitPrice,
        purchasePrice: itemsTable.purchasePrice,
      })
      .from(saleItemsTable)
      .innerJoin(salesTable, eq(saleItemsTable.saleId, salesTable.id))
      .leftJoin(itemsTable, eq(saleItemsTable.itemId, itemsTable.id))
      .where(and(gte(salesTable.createdAt, start), lte(salesTable.createdAt, end)));

    const grossProfit = salesRows.reduce((sum, s) => {
      const qty = parseFloat(s.quantity);
      const unitPrice = parseFloat(s.unitPrice);
      const purchasePrice = parseFloat(s.purchasePrice ?? "0");
      return sum + (unitPrice - purchasePrice) * qty;
    }, 0);

    // Stock adjustment cost (decrease type)
    const adjRows = await db
      .select({
        quantity: stockAdjustmentsTable.quantity,
        purchasePrice: itemsTable.purchasePrice,
      })
      .from(stockAdjustmentsTable)
      .leftJoin(itemsTable, eq(stockAdjustmentsTable.itemId, itemsTable.id))
      .where(and(
        eq(stockAdjustmentsTable.adjustmentType, "decrease"),
        gte(stockAdjustmentsTable.createdAt, start),
        lte(stockAdjustmentsTable.createdAt, end),
      ));

    const stockAdjustmentCost = adjRows.reduce((sum, a) => {
      return sum + parseFloat(a.quantity) * parseFloat(a.purchasePrice ?? "0");
    }, 0);

    // Total expenses
    const expRows = await db
      .select({ amount: expensesTable.amount })
      .from(expensesTable)
      .where(and(gte(expensesTable.createdAt, start), lte(expensesTable.createdAt, end)));

    const totalExpenses = expRows.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const netProfit = grossProfit - stockAdjustmentCost - totalExpenses;

    return {
      month,
      monthName: monthNames[month - 1],
      grossProfit: String(grossProfit.toFixed(2)),
      stockAdjustmentCost: String(stockAdjustmentCost.toFixed(2)),
      totalExpenses: String(totalExpenses.toFixed(2)),
      netProfit: String(netProfit.toFixed(2)),
    };
  }));

  const totals = {
    month: 0,
    monthName: "Total",
    grossProfit: String(rows.reduce((s, r) => s + parseFloat(r.grossProfit), 0).toFixed(2)),
    stockAdjustmentCost: String(rows.reduce((s, r) => s + parseFloat(r.stockAdjustmentCost), 0).toFixed(2)),
    totalExpenses: String(rows.reduce((s, r) => s + parseFloat(r.totalExpenses), 0).toFixed(2)),
    netProfit: String(rows.reduce((s, r) => s + parseFloat(r.netProfit), 0).toFixed(2)),
  };

  res.json({ year, rows, totals });
});

router.get("/reports/pnl", async (req, res): Promise<void> => {
  const { start, end } = req.query as { start?: string; end?: string };
  const now = new Date();
  const currentStart = start ? new Date(start + "T00:00:00") : new Date(now.getFullYear(), now.getMonth(), 1);
  const currentEnd = end ? new Date(end + "T23:59:59") : now;
  const durationMs = currentEnd.getTime() - currentStart.getTime();
  const prevEnd = new Date(currentStart.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);

  async function calcPeriod(pStart: Date, pEnd: Date) {
    const salesRows = await db.select({ total: salesTable.totalAmount, reverted: salesTable.reverted })
      .from(salesTable).where(and(gte(salesTable.createdAt, pStart), lte(salesTable.createdAt, pEnd)));
    const revenue = salesRows.filter(r => !r.reverted).reduce((s, r) => s + parseFloat(r.total), 0);

    const cogsRows = await db
      .select({ quantity: saleItemsTable.quantity, purchasePrice: itemsTable.purchasePrice, reverted: salesTable.reverted })
      .from(saleItemsTable)
      .innerJoin(salesTable, eq(saleItemsTable.saleId, salesTable.id))
      .leftJoin(itemsTable, eq(saleItemsTable.itemId, itemsTable.id))
      .where(and(gte(salesTable.createdAt, pStart), lte(salesTable.createdAt, pEnd)));
    const cogs = cogsRows.filter(r => !r.reverted).reduce((s, r) => s + parseFloat(r.quantity) * parseFloat(r.purchasePrice ?? "0"), 0);

    const grossProfit = revenue - cogs;
    const expRows = await db.select({ amount: expensesTable.amount })
      .from(expensesTable).where(and(gte(expensesTable.createdAt, pStart), lte(expensesTable.createdAt, pEnd)));
    const totalExpenses = expRows.reduce((s, e) => s + parseFloat(e.amount), 0);
    const netProfit = grossProfit - totalExpenses;
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    return { revenue, cogs, grossProfit, grossMargin, totalExpenses, netProfit, netMargin };
  }

  const [cur, prev] = await Promise.all([calcPeriod(currentStart, currentEnd), calcPeriod(prevStart, prevEnd)]);
  const pct = (c: number, p: number) => p === 0 ? null : parseFloat(((c - p) / Math.abs(p) * 100).toFixed(1));
  const s = (n: number) => String(n.toFixed(2));

  res.json({
    revenue: s(cur.revenue), cogs: s(cur.cogs), grossProfit: s(cur.grossProfit),
    grossMargin: s(cur.grossMargin), totalExpenses: s(cur.totalExpenses),
    netProfit: s(cur.netProfit), netMargin: s(cur.netMargin),
    prev: { revenue: s(prev.revenue), grossProfit: s(prev.grossProfit), netProfit: s(prev.netProfit) },
    changes: { revenue: pct(cur.revenue, prev.revenue), grossProfit: pct(cur.grossProfit, prev.grossProfit), netProfit: pct(cur.netProfit, prev.netProfit) },
    period: { start: currentStart.toISOString().split("T")[0], end: currentEnd.toISOString().split("T")[0] },
  });
});

export default router;
