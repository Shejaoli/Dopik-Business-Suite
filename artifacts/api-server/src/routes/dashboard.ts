import { Router } from "express";
import { eq, sql, gte, desc } from "drizzle-orm";
import { db, itemsTable, stockTable, salesTable, saleItemsTable, purchasesTable, receivablesTable, balancesTable, customersTable, vendorsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/dashboard", async (req, res): Promise<void> => {
  // Total items
  const [itemCount] = await db.select({ count: sql<number>`count(*)` }).from(itemsTable);

  // Total stock value
  const stockRows = await db
    .select({ quantity: stockTable.quantity, purchasePrice: itemsTable.purchasePrice })
    .from(stockTable)
    .innerJoin(itemsTable, eq(stockTable.itemId, itemsTable.id));
  const totalStockValue = stockRows.reduce((sum, r) => sum + parseFloat(r.quantity) * parseFloat(r.purchasePrice), 0);

  // Today's sales
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todaySalesRows = await db.select({ total: salesTable.totalAmount }).from(salesTable).where(gte(salesTable.createdAt, today));
  const todaySales = todaySalesRows.reduce((sum, r) => sum + parseFloat(r.total), 0);

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

  // Fetch items for recent sales
  const recentSalesWithItems = await Promise.all(recentSales.map(async sale => {
    const items = await db
      .select({
        id: saleItemsTable.id,
        saleId: saleItemsTable.saleId,
        itemId: saleItemsTable.itemId,
        itemName: itemsTable.name,
        qtyType: itemsTable.qtyType,
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
      qtyType: itemsTable.qtyType,
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
    recentSales: recentSalesWithItems,
    recentPurchases: recentPurchases.map(p => ({ ...p, vendorName: p.vendorName ?? null, itemName: p.itemName ?? null })),
  });
});

export default router;
