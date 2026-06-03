import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, serializedUnitsTable, itemsTable } from "@workspace/db";

const router = Router();

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

router.get("/public/warranty/:imei", async (req, res): Promise<void> => {
  const ip = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "unknown").split(",")[0].trim();
  if (!rateLimit(ip, 20, 60 * 60 * 1000)) {
    res.status(429).json({ error: "Too many requests. Please try again later." });
    return;
  }

  const { imei } = req.params;
  if (!imei || imei.length < 3) {
    res.status(400).json({ error: "IMEI/Serial too short" });
    return;
  }

  const [unit] = await db.select({
    id: serializedUnitsTable.id,
    imeiOrSerial: serializedUnitsTable.imeiOrSerial,
    color: serializedUnitsTable.color,
    ram: serializedUnitsTable.ram,
    storage: serializedUnitsTable.storage,
    condition: serializedUnitsTable.condition,
    status: serializedUnitsTable.status,
    dateReceived: serializedUnitsTable.dateReceived,
    itemId: serializedUnitsTable.itemId,
    itemName: itemsTable.name,
    itemCategory: itemsTable.category,
  }).from(serializedUnitsTable)
    .leftJoin(itemsTable, eq(serializedUnitsTable.itemId, itemsTable.id))
    .where(eq(serializedUnitsTable.imeiOrSerial, imei));

  if (!unit) {
    res.json({ found: false });
    return;
  }

  const warrantyMonths = 6;
  const purchaseDate = unit.dateReceived ? new Date(unit.dateReceived) : null;
  let expiryDate: Date | null = null;
  let daysRemaining: number | null = null;
  let warrantyStatus: "active" | "expired" | "unknown" = "unknown";

  if (purchaseDate) {
    expiryDate = new Date(purchaseDate);
    expiryDate.setMonth(expiryDate.getMonth() + warrantyMonths);
    const now = new Date();
    daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / 86400000);
    warrantyStatus = daysRemaining > 0 ? "active" : "expired";
  }

  res.json({
    found: true,
    imeiOrSerial: unit.imeiOrSerial,
    productName: unit.itemName,
    category: unit.itemCategory,
    color: unit.color,
    ram: unit.ram,
    storage: unit.storage,
    condition: unit.condition,
    purchaseDate: purchaseDate?.toISOString() || null,
    warrantyMonths,
    expiryDate: expiryDate?.toISOString() || null,
    daysRemaining,
    warrantyStatus,
    store: {
      name: "Dopik Electronics",
      address: "Kigali, Rwanda",
      phone: "+250 788 000 000",
      email: "info@dopikelectronics.com",
    },
  });
});

export default router;
