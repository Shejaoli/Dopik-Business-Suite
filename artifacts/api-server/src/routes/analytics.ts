import { Router } from "express";
import { eq, sql, gte, lte, and, desc, inArray } from "drizzle-orm";
import { db, salesTable, saleItemsTable, itemsTable, purchasesTable, expensesTable, stockTable, receivablesTable, customersTable, balancesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { getCategoriesForSuper } from "../lib/category-filter";

const router = Router();
router.use(requireAuth);

function periodBounds(period: string) {
  const now = new Date();
  if (period === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - 6); start.setHours(0, 0, 0, 0);
    return { start, end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999) };
  }
  if (period === "year") {
    return {
      start: new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0),
      end: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
    };
  }
  // month (default)
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

// Revenue over time — daily buckets
router.get("/analytics/revenue", async (req, res): Promise<void> => {
  const period = (req.query.period as string) || "month";
  const { start, end } = periodBounds(period);
  const rows = await db
    .select({ date: sql<string>`DATE(${salesTable.createdAt})`, total: sql<string>`SUM(${salesTable.totalAmount})` })
    .from(salesTable)
    .where(and(gte(salesTable.createdAt, start), lte(salesTable.createdAt, end), eq(salesTable.reverted, false)))
    .groupBy(sql`DATE(${salesTable.createdAt})`)
    .orderBy(sql`DATE(${salesTable.createdAt})`);
  res.json(rows.map(r => ({ date: r.date, revenue: parseFloat(r.total ?? "0") })));
});

// Sales by category
router.get("/analytics/categories", async (req, res): Promise<void> => {
  const period = (req.query.period as string) || "month";
  const { start, end } = periodBounds(period);
  const rows = await db
    .select({
      category: itemsTable.category,
      total: sql<string>`SUM(${saleItemsTable.lineTotal})`,
    })
    .from(saleItemsTable)
    .innerJoin(salesTable, eq(saleItemsTable.saleId, salesTable.id))
    .leftJoin(itemsTable, eq(saleItemsTable.itemId, itemsTable.id))
    .where(and(gte(salesTable.createdAt, start), lte(salesTable.createdAt, end), eq(salesTable.reverted, false)))
    .groupBy(itemsTable.category)
    .orderBy(desc(sql`SUM(${saleItemsTable.lineTotal})`));
  const totalRev = rows.reduce((s, r) => s + parseFloat(r.total ?? "0"), 0);
  res.json(rows.map(r => ({
    category: r.category ?? "Others",
    total: parseFloat(r.total ?? "0"),
    pct: totalRev > 0 ? Math.round((parseFloat(r.total ?? "0") / totalRev) * 100) : 0,
  })));
});

// Top selling products
router.get("/analytics/top-products", async (req, res): Promise<void> => {
  const period = (req.query.period as string) || "month";
  const { start, end } = periodBounds(period);
  const limit = parseInt(req.query.limit as string) || 10;
  const superCategory = req.query.superCategory as string | undefined;
  const cats = getCategoriesForSuper(superCategory);

  const conditions: any[] = [
    gte(salesTable.createdAt, start),
    lte(salesTable.createdAt, end),
    eq(salesTable.reverted, false),
  ];
  if (cats) conditions.push(inArray(itemsTable.category, cats));

  const rows = await db
    .select({
      itemId: saleItemsTable.itemId,
      name: itemsTable.name,
      category: itemsTable.category,
      total: sql<string>`SUM(${saleItemsTable.lineTotal})`,
      qty: sql<string>`SUM(${saleItemsTable.quantity})`,
    })
    .from(saleItemsTable)
    .innerJoin(salesTable, eq(saleItemsTable.saleId, salesTable.id))
    .leftJoin(itemsTable, eq(saleItemsTable.itemId, itemsTable.id))
    .where(and(...conditions))
    .groupBy(saleItemsTable.itemId, itemsTable.name, itemsTable.category)
    .orderBy(desc(sql`SUM(${saleItemsTable.lineTotal})`))
    .limit(limit);
  res.json(rows.map(r => ({ id: r.itemId, name: r.name ?? "Item", category: r.category, total: parseFloat(r.total ?? "0"), qty: parseFloat(r.qty ?? "0") })));
});

// Payment method breakdown
router.get("/analytics/payment-methods", async (req, res): Promise<void> => {
  const period = (req.query.period as string) || "month";
  const { start, end } = periodBounds(period);
  const rows = await db
    .select({ method: salesTable.paymentMethod, total: sql<string>`SUM(${salesTable.totalAmount})` })
    .from(salesTable)
    .where(and(gte(salesTable.createdAt, start), lte(salesTable.createdAt, end), eq(salesTable.reverted, false)))
    .groupBy(salesTable.paymentMethod);
  const totalRev = rows.reduce((s, r) => s + parseFloat(r.total ?? "0"), 0);
  res.json(rows.map(r => ({
    method: r.method ?? "other",
    total: parseFloat(r.total ?? "0"),
    pct: totalRev > 0 ? Math.round((parseFloat(r.total ?? "0") / totalRev) * 100) : 0,
  })));
});

// Stock health
router.get("/analytics/stock-health", async (_req, res): Promise<void> => {
  const [total] = await db.select({ count: sql<number>`count(*)` }).from(itemsTable);
  const stockAll = await db.select({ quantity: stockTable.quantity, minStock: stockTable.minStock, itemId: stockTable.itemId }).from(stockTable);
  const out = stockAll.filter(s => parseFloat(s.quantity) === 0).length;
  const low = stockAll.filter(s => parseFloat(s.quantity) > 0 && parseFloat(s.quantity) <= parseFloat(s.minStock)).length;
  const stockValue = await db.select({ quantity: stockTable.quantity, purchasePrice: itemsTable.purchasePrice })
    .from(stockTable).innerJoin(itemsTable, eq(stockTable.itemId, itemsTable.id));
  const totalValue = stockValue.reduce((s, r) => s + parseFloat(r.quantity) * parseFloat(r.purchasePrice), 0);
  res.json({ totalProducts: Number(total?.count ?? 0), outOfStock: out, lowStock: low, stockValue: totalValue });
});

// Credit summary
router.get("/analytics/credit-summary", async (_req, res): Promise<void> => {
  const unpaid = await db.select({
    id: receivablesTable.id, totalAmount: receivablesTable.totalAmount,
    paidAmount: receivablesTable.paidAmount, remaining: sql<string>`${receivablesTable.totalAmount} - ${receivablesTable.paidAmount}`,
    customerName: customersTable.name, createdAt: receivablesTable.createdAt,
  }).from(receivablesTable)
    .leftJoin(customersTable, eq(receivablesTable.customerId, customersTable.id))
    .where(sql`${receivablesTable.status} != 'paid'`)
    .orderBy(receivablesTable.createdAt);
  const totalOutstanding = unpaid.reduce((s, r) => s + parseFloat(r.remaining ?? "0"), 0);
  const oldest = unpaid[0] ?? null;
  const newest = unpaid[unpaid.length - 1] ?? null;
  res.json({
    totalOutstanding,
    customerCount: new Set(unpaid.map(r => r.customerName)).size,
    oldest: oldest ? { name: oldest.customerName, amount: oldest.remaining, date: oldest.createdAt } : null,
    newest: newest ? { name: newest.customerName, amount: newest.remaining, date: newest.createdAt } : null,
    records: unpaid.map(r => ({
      id: r.id, customer: r.customerName, remaining: parseFloat(r.remaining ?? "0"),
      date: r.createdAt,
      daysOverdue: Math.floor((Date.now() - new Date(r.createdAt ?? "").getTime()) / (1000 * 60 * 60 * 24)),
    })),
  });
});

// Sales heatmap — daily totals for a month
router.get("/analytics/heatmap", async (req, res): Promise<void> => {
  const monthStr = (req.query.month as string) || new Date().toISOString().substring(0, 7);
  const [year, month] = monthStr.split("-").map(Number);
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  const rows = await db
    .select({ date: sql<string>`DATE(${salesTable.createdAt})`, total: sql<string>`SUM(${salesTable.totalAmount})` })
    .from(salesTable)
    .where(and(gte(salesTable.createdAt, start), lte(salesTable.createdAt, end), eq(salesTable.reverted, false)))
    .groupBy(sql`DATE(${salesTable.createdAt})`);
  res.json(rows.map(r => ({ date: r.date, total: parseFloat(r.total ?? "0") })));
});

// Customer types — new vs returning
router.get("/analytics/customer-types", async (req, res): Promise<void> => {
  const period = (req.query.period as string) || "month";
  const { start, end } = periodBounds(period);
  // New customers: first sale in period
  const allSales = await db.select({ customerId: salesTable.customerId, createdAt: salesTable.createdAt })
    .from(salesTable).where(eq(salesTable.reverted, false));
  const firstSaleDates: Record<number, Date> = {};
  for (const s of allSales) {
    if (!s.customerId) continue;
    const d = new Date(s.createdAt ?? "");
    if (!firstSaleDates[s.customerId] || d < firstSaleDates[s.customerId]) firstSaleDates[s.customerId] = d;
  }
  let newCount = 0, returningCount = 0;
  for (const [, firstDate] of Object.entries(firstSaleDates)) {
    if (firstDate >= start && firstDate <= end) newCount++;
    else returningCount++;
  }
  res.json({ new: newCount, returning: returningCount });
});

// Best times — by day of week and hour
router.get("/analytics/best-times", async (req, res): Promise<void> => {
  const period = (req.query.period as string) || "month";
  const { start, end } = periodBounds(period);
  const rows = await db.select({ totalAmount: salesTable.totalAmount, createdAt: salesTable.createdAt })
    .from(salesTable)
    .where(and(gte(salesTable.createdAt, start), lte(salesTable.createdAt, end), eq(salesTable.reverted, false)));

  const byDay: number[] = Array(7).fill(0);
  const byHour: number[] = Array(24).fill(0);
  for (const r of rows) {
    const d = new Date(r.createdAt ?? "");
    byDay[d.getDay()] += parseFloat(r.totalAmount ?? "0");
    byHour[d.getHours()] += parseFloat(r.totalAmount ?? "0");
  }
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  res.json({
    byDay: days.map((name, i) => ({ name, total: byDay[i] })),
    byHour: Array.from({ length: 24 }, (_, i) => ({ hour: i, total: byHour[i] })),
  });
});

// Gross profit vs expenses over time
router.get("/analytics/profit-vs-expenses", async (req, res): Promise<void> => {
  const period = (req.query.period as string) || "month";
  const { start, end } = periodBounds(period);

  const salesRows = await db.select({
    date: sql<string>`DATE(${salesTable.createdAt})`,
    revenue: sql<string>`SUM(${salesTable.totalAmount})`,
  }).from(salesTable).where(and(gte(salesTable.createdAt, start), lte(salesTable.createdAt, end), eq(salesTable.reverted, false)))
    .groupBy(sql`DATE(${salesTable.createdAt})`).orderBy(sql`DATE(${salesTable.createdAt})`);

  const expRows = await db.select({
    date: sql<string>`DATE(${expensesTable.createdAt})`,
    total: sql<string>`SUM(${expensesTable.amount})`,
  }).from(expensesTable).where(and(gte(expensesTable.createdAt, start), lte(expensesTable.createdAt, end)))
    .groupBy(sql`DATE(${expensesTable.createdAt})`).orderBy(sql`DATE(${expensesTable.createdAt})`);

  const expMap: Record<string, number> = {};
  for (const e of expRows) expMap[e.date] = parseFloat(e.total ?? "0");

  res.json(salesRows.map(r => ({
    date: r.date,
    grossProfit: parseFloat(r.revenue ?? "0"),
    expenses: expMap[r.date] ?? 0,
  })));
});

// Restock Intelligence — items with low/no stock + sales velocity
router.get("/analytics/restock-intelligence", async (req, res): Promise<void> => {
  const superCategory = req.query.superCategory as string | undefined;
  const cats = getCategoriesForSuper(superCategory);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get all items with their current stock
  const stockItems = await db
    .select({
      itemId: itemsTable.id,
      itemName: itemsTable.name,
      category: itemsTable.category,
      sku: itemsTable.sku,
      costPrice: itemsTable.costPrice,
      quantity: stockTable.quantity,
      minStock: stockTable.minStock,
    })
    .from(itemsTable)
    .leftJoin(stockTable, eq(stockTable.itemId, itemsTable.id))
    .where(cats ? inArray(itemsTable.category, cats) : undefined);

  // Get units sold per item over last 30 days
  const salesVelocity = await db
    .select({
      itemId: saleItemsTable.itemId,
      totalSold: sql<string>`SUM(${saleItemsTable.quantity})`,
    })
    .from(saleItemsTable)
    .innerJoin(salesTable, eq(saleItemsTable.saleId, salesTable.id))
    .where(and(gte(salesTable.createdAt, thirtyDaysAgo), eq(salesTable.reverted, false)))
    .groupBy(saleItemsTable.itemId);

  const velocityMap: Record<number, number> = {};
  for (const v of salesVelocity) velocityMap[v.itemId] = parseFloat(v.totalSold ?? "0");

  const results = stockItems.map(item => {
    const qty = parseFloat(item.quantity ?? "0");
    const minStock = parseFloat(item.minStock ?? "0");
    const soldLast30 = velocityMap[item.itemId] ?? 0;
    const avgDailySales = soldLast30 / 30;
    const daysUntilStockout = avgDailySales > 0 ? Math.floor(qty / avgDailySales) : (qty > 0 ? 999 : 0);
    const suggestedRestock = Math.max(Math.ceil(avgDailySales * 30 * 1.2), minStock * 2, 5);

    let urgency: "critical" | "high" | "medium" | "low" = "low";
    if (qty === 0) urgency = "critical";
    else if (daysUntilStockout <= 7 || qty <= minStock) urgency = "high";
    else if (daysUntilStockout <= 14 || qty <= minStock * 2) urgency = "medium";

    return {
      itemId: item.itemId,
      itemName: item.itemName,
      category: item.category,
      sku: item.sku,
      currentQty: qty,
      minStock,
      soldLast30Days: soldLast30,
      avgDailySales: Math.round(avgDailySales * 100) / 100,
      daysUntilStockout: daysUntilStockout === 999 ? null : daysUntilStockout,
      suggestedRestock,
      urgency,
    };
  }).filter(r => r.urgency !== "low")
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.urgency] - order[b.urgency];
    });

  res.json(results);
});

export default router;
