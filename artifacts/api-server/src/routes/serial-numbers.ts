import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, serialNumbersTable, itemsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/serial-numbers", async (req, res): Promise<void> => {
  const itemId = req.query.itemId ? parseInt(req.query.itemId as string) : null;
  const status = req.query.status as string | undefined;

  let query = db
    .select({
      id: serialNumbersTable.id,
      itemId: serialNumbersTable.itemId,
      itemName: itemsTable.name,
      serialNumber: serialNumbersTable.serialNumber,
      status: serialNumbersTable.status,
      referenceType: serialNumbersTable.referenceType,
      referenceId: serialNumbersTable.referenceId,
      notes: serialNumbersTable.notes,
      createdAt: serialNumbersTable.createdAt,
      updatedAt: serialNumbersTable.updatedAt,
    })
    .from(serialNumbersTable)
    .leftJoin(itemsTable, eq(serialNumbersTable.itemId, itemsTable.id))
    .$dynamic();

  const conditions: any[] = [];
  if (itemId) conditions.push(eq(serialNumbersTable.itemId, itemId));
  if (status) conditions.push(eq(serialNumbersTable.status, status));

  if (conditions.length === 1) query = query.where(conditions[0]) as any;
  if (conditions.length === 2) query = query.where(eq(serialNumbersTable.itemId, itemId!)) as any;

  const rows = await (query as any).orderBy(desc(serialNumbersTable.createdAt));

  let result = rows;
  if (status) result = rows.filter((r: any) => r.status === status);

  res.json(result);
});

export default router;
