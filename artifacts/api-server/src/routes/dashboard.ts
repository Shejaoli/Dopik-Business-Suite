import { Router } from "express";
import { eq, sql, gte, lte, and, desc } from "drizzle-orm";
import { db, itemsTable, stockTable, salesTable, saleItemsTable, purchasesTable, receivablesTable, balancesTable, customersTable, vendorsTable, expensesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/dashboard", async (req, res): Promise<void> => {
  const period = (req.query.period as string) ?? "month";

  // Period bounds
  const now = new Date();
  let periodStart: Date;
  let periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (period === "today") {
    periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  } else if (period === "yesterday") {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    periodStart = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
    periodEnd = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
  } else if (period === "week") {
    const day = now.getDay();
    const monday = new Date(now); monday.setDate(now.getDate() - ((day + 6) % 7));
    periodStart = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 0, 0, 0);
  } else if (period === "year") {
    periodStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    periodEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  } else {
    // month (default)
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  // Total items
  const [itemCount] = await db.select({ count: sql<number>`count(*)` }).from(itemsTable);

  // Total stock value
  const stockRows = await db
    .select({ quantity: stockTable.quantity, purchasePrice: itemsTable.purchasePrice })
    .from(stockTable)
    .innerJoin(itemsTable, eq(stockTable.itemId, itemsTable.id));
  const totalStockValue = stockRows.reduce((sum, r) => sum + parseFloat(r.quantity) * parseFloat(r.purchasePrice), 0);

  // Today's sales (always today regardless of period)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todaySalesRows = await db.select({ total: salesTable.totalAmount, reverted: salesTable.reverted })
    .from(salesTable).where(gte(salesTable.createdAt, todayStart));
  const todaySales = todaySalesRows.filter(r => !r.reverted).reduce((sum, r) => sum + parseFloat(r.total), 0);

  // Outstanding receivables
  const recRows = await db.select({ total: receivablesTable.totalAmount, paid: receivablesTable.paidAmount })
    .from(receivablesTable)
    .where(sql`${receivablesTable.status} != 'paid'`);
  const outstandingReceivables = recRows.reduce((sum, r) => sum + parseFloat(r.total) - parseFloat(r.paid), 0);

  // Balances
  const balances = await db.select().from(balancesTable);
  const cashBal = balances.find(b => b.method === "cash")?.amount ?? "0";
  const bankBal = balances.find(b => b.method === "bank")?.amount ?? "0";
  const mobileBal = balances.find(b => b.method === "mobile_money")?.amount ?? "0";

  // Stock alerts
  const stockAll = await db.select({ quantity: stockTable.quantity, minStock: stockTable.minStock }).from(stockTable);
  const outOfStockCount = stockAll.filter(s => parseFloat(s.quantity) === 0).length;
  const lowStockCount = stockAll.filter(s => parseFloat(s.quantity) > 0 && parseFloat(s.quantity) <= parseFloat(s.minStock)).length;

  // ── Profit for period ──────────────────────────────
  // Revenue: sum of non-reverted sales in period
  const salesInPeriod = await db.select({ total: salesTable.totalAmount, reverted: salesTable.reverted })
    .from(salesTable)
    .where(and(gte(salesTable.createdAt, periodStart), lte(salesTable.createdAt, periodEnd)));
  const revenue = salesInPeriod.filter(s => !s.reverted).reduce((sum, s) => sum + parseFloat(s.total), 0);

  // COGS: sum of (quantity × purchase_price) for sale items in period
  const cogsRows = await db
    .select({ quantity: saleItemsTable.quantity, purchasePrice: itemsTable.purchasePrice, reverted: salesTable.reverted })
    .from(saleItemsTable)
    .innerJoin(salesTable, eq(saleItemsTable.saleId, salesTable.id))
    .leftJoin(itemsTable, eq(saleItemsTable.itemId, itemsTable.id))
    .where(and(gte(salesTable.createdAt, periodStart), lte(salesTable.createdAt, periodEnd)));
  const cogs = cogsRows
    .filter(r => !r.reverted)
    .reduce((sum, r) => sum + parseFloat(r.quantity) * parseFloat(r.purchasePrice ?? "0"), 0);

  const grossProfit = revenue - cogs;

  // Total expenses in period
  const expRows = await db.select({ amount: expensesTable.amount })
    .from(expensesTable)
    .where(and(gte(expensesTable.createdAt, periodStart), lte(expensesTable.createdAt, periodEnd)));
  const totalExpenses = expRows.reduce((sum, e) => sum + parseFloat(e.amount), 0);

  const netProfit = grossProfit - totalExpenses;

  // Recent sales (last 10)
  const recentSales = await db
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
    .limit(10);

  const recentSalesWithItems = await Promise.all(recentSales.map(async sale => {
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
    return { ...sale, items, customerName: sale.customerName ?? null };
  }));

  // Recent purchases (last 10)
  const recentPurchases = await db
    .select({
      id: purchasesTable.id,
      itemId: purchasesTable.itemId,
      itemName: itemsTable.name,
      category: itemsTable.category,
      quantity: purchasesTable.quantity,
      totalCost: purchasesTable.totalCost,
      vendorId: purchasesTable.vendorId,
      vendorName: vendorsTable.name,
      paymentMethod: purchasesTable.paymentMethod,
      recordedBy: purchasesTable.recordedBy,
      createdAt: purchasesTable.createdAt,
    })
    .from(purchasesTable)
    .leftJoin(itemsTable, eq(purchasesTable.itemId, itemsTable.id))
    .leftJoin(vendorsTable, eq(purchasesTable.vendorId, vendorsTable.id))
    .orderBy(desc(purchasesTable.createdAt))
    .limit(10);

  res.json({
    totalItems: Number(itemCount?.count ?? 0),
    totalStockValue: String(totalStockValue.toFixed(2)),
    todaySales: String(todaySales.toFixed(2)),
    outstandingReceivables: String(outstandingReceivables.toFixed(2)),
    cashBalance: cashBal,
    bankBalance: bankBal,
    mobileMoney: mobileBal,
    outOfStockCount,
    lowStockCount,
    // Profit summary
    revenue: String(revenue.toFixed(2)),
    grossProfit: String(grossProfit.toFixed(2)),
    totalExpenses: String(totalExpenses.toFixed(2)),
    netProfit: String(netProfit.toFixed(2)),
    period,
    recentSales: recentSalesWithItems,
    recentPurchases: recentPurchases.map(p => ({ ...p, vendorName: p.vendorName ?? null, itemName: p.itemName ?? null })),
  });
});

export default router;
