import { Router } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, salesTable, saleItemsTable, itemsTable, customersTable, serialNumbersTable, serializedUnitsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

function generateReceiptNumber(saleId: number, createdAt: Date): string {
  const date = createdAt.toISOString().slice(0, 10).replace(/-/g, "");
  const seq = String(saleId).padStart(4, "0");
  return `REC-${date}-${seq}`;
}

async function buildReceipt(saleId: number) {
  const [sale] = await db
    .select({
      id: salesTable.id,
      customerId: salesTable.customerId,
      customerName: customersTable.name,
      customerPhone: customersTable.phone,
      paymentMethod: salesTable.paymentMethod,
      totalAmount: salesTable.totalAmount,
      discountAmount: salesTable.discountAmount,
      discountType: salesTable.discountType,
      amountReceived: salesTable.amountReceived,
      changeGiven: salesTable.changeGiven,
      paymentTermsDays: salesTable.paymentTermsDays,
      splitPaymentMethod2: salesTable.splitPaymentMethod2,
      splitPaymentAmount1: salesTable.splitPaymentAmount1,
      splitPaymentAmount2: salesTable.splitPaymentAmount2,
      createdAt: salesTable.createdAt,
      reverted: salesTable.reverted,
    })
    .from(salesTable)
    .leftJoin(customersTable, eq(salesTable.customerId, customersTable.id))
    .where(eq(salesTable.id, saleId));

  if (!sale) return null;

  const items = await db
    .select({
      id: saleItemsTable.id,
      itemId: saleItemsTable.itemId,
      itemName: itemsTable.name,
      category: itemsTable.category,
      quantity: saleItemsTable.quantity,
      unitPrice: saleItemsTable.unitPrice,
      lineTotal: saleItemsTable.lineTotal,
      serializedUnitId: saleItemsTable.serializedUnitId,
    })
    .from(saleItemsTable)
    .leftJoin(itemsTable, eq(saleItemsTable.itemId, itemsTable.id))
    .where(eq(saleItemsTable.saleId, saleId));

  const serialsByItem: Record<number, string[]> = {};
  for (const item of items) {
    const serials = await db
      .select({ serialNumber: serialNumbersTable.serialNumber })
      .from(serialNumbersTable)
      .where(eq(serialNumbersTable.referenceId, saleId));
    serialsByItem[item.itemId!] = serials.map((s) => s.serialNumber);
  }

  const enrichedItems = await Promise.all(items.map(async (it) => {
    let serializedUnit: { imeiOrSerial: string | null; color: string | null; storage: string | null; condition: string | null } | null = null;
    if (it.serializedUnitId) {
      const [unit] = await db.select({
        imeiOrSerial: serializedUnitsTable.imeiOrSerial,
        color: serializedUnitsTable.color,
        storage: serializedUnitsTable.storage,
        condition: serializedUnitsTable.condition,
      }).from(serializedUnitsTable).where(eq(serializedUnitsTable.id, it.serializedUnitId));
      if (unit) serializedUnit = unit;
    }
    return {
      ...it,
      serialNumbers: serialsByItem[it.itemId!] || [],
      serializedUnit,
    };
  }));

  const receiptNumber = generateReceiptNumber(sale.id, new Date(sale.createdAt!));
  const siteUrl = process.env.SITE_URL || "https://dopikelectronics.com";

  return {
    receiptNumber,
    siteUrl,
    sale: {
      id: sale.id,
      customerName: sale.customerName || "Walk-in Customer",
      customerPhone: sale.customerPhone || null,
      paymentMethod: sale.paymentMethod,
      totalAmount: sale.totalAmount,
      discountAmount: sale.discountAmount || "0",
      discountType: sale.discountType || null,
      amountReceived: sale.amountReceived || null,
      changeGiven: sale.changeGiven || null,
      paymentTermsDays: sale.paymentTermsDays || null,
      splitPaymentMethod2: sale.splitPaymentMethod2 || null,
      splitPaymentAmount1: sale.splitPaymentAmount1 || null,
      splitPaymentAmount2: sale.splitPaymentAmount2 || null,
      createdAt: sale.createdAt,
    },
    items: enrichedItems,
    store: {
      name: "Dopik Electronics",
      address: "Kigali, Rwanda",
      phone: "+250 788 000 000",
      email: "info@dopikelectronics.com",
      warrantyPeriod: "6 months",
    },
  };
}

router.get("/receipts/next-number", async (req, res): Promise<void> => {
  const [row] = await db.select({ maxId: sql<number>`COALESCE(MAX(id), 0)` }).from(salesTable);
  const nextId = (row?.maxId ?? 0) + 1;
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  res.json({ receiptNumber: `REC-${today}-${String(nextId).padStart(4, "0")}` });
});

router.get("/receipts/:saleId", async (req, res): Promise<void> => {
  const saleId = parseInt(req.params.saleId);
  const receipt = await buildReceipt(saleId);
  if (!receipt) { res.status(404).json({ error: "Sale not found" }); return; }
  res.json(receipt);
});

router.get("/receipts", async (req, res): Promise<void> => {
  const limit = parseInt(req.query.limit as string) || 50;
  const page = parseInt(req.query.page as string) || 1;
  const offset = (page - 1) * limit;

  const sales = await db
    .select({
      id: salesTable.id,
      customerName: customersTable.name,
      paymentMethod: salesTable.paymentMethod,
      totalAmount: salesTable.totalAmount,
      createdAt: salesTable.createdAt,
    })
    .from(salesTable)
    .leftJoin(customersTable, eq(salesTable.customerId, customersTable.id))
    .where(eq(salesTable.reverted, false))
    .orderBy(desc(salesTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(sales.map((s) => ({
    ...s,
    receiptNumber: generateReceiptNumber(s.id, new Date(s.createdAt!)),
  })));
});

export default router;
