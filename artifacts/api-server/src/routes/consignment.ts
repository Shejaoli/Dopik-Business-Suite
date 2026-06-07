import { Router } from "express";
import { db } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router = Router();

// Raw SQL for consignment_items (not in Drizzle schema yet — using pg directly)
function cTable() {
  return sql`consignment_items`;
}

// GET /consignment — list all consignment items with item name
router.get("/consignment", async (req, res): Promise<void> => {
  try {
    const rows = await db.execute(sql`
      SELECT ci.*,
             i.item_name,
             i.category,
             COALESCE(i.sale_price, 0) AS item_sale_price
      FROM consignment_items ci
      LEFT JOIN items i ON i.id = ci.item_id
      ORDER BY ci.given_at DESC
    `);
    res.json(rows.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /consignment — create new consignment assignment
router.post("/consignment", async (req, res): Promise<void> => {
  const {
    itemId, sellerName, sellerPhone,
    serializedUnitId, imeiOrSerial, color, storage, ram, condition,
    costPrice, salePrice, notes,
  } = req.body;

  if (!itemId || !sellerName) {
    res.status(400).json({ error: "itemId and sellerName are required" });
    return;
  }

  try {
    const result = await db.execute(sql`
      INSERT INTO consignment_items
        (item_id, seller_name, seller_phone, serialized_unit_id, imei_or_serial,
         color, storage, ram, condition, cost_price, sale_price, notes, recorded_by)
      VALUES
        (${itemId}, ${sellerName}, ${sellerPhone ?? null}, ${serializedUnitId ?? null},
         ${imeiOrSerial ?? null}, ${color ?? null}, ${storage ?? null}, ${ram ?? null},
         ${condition ?? null}, ${costPrice ?? 0}, ${salePrice ?? null}, ${notes ?? null},
         ${(req as any).session?.userId ?? null})
      RETURNING *
    `);
    res.status(201).json(result.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /consignment/:id — update status (returned / sold)
router.patch("/consignment/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { status, salePrice, notes } = req.body;

  if (!status) {
    res.status(400).json({ error: "status is required" });
    return;
  }

  try {
    let profit: number | null = null;

    // If marking as sold, compute profit
    if (status === "sold" && salePrice != null) {
      const existing = await db.execute(sql`SELECT cost_price FROM consignment_items WHERE id = ${id}`);
      if (existing.rows[0]) {
        profit = parseFloat(String(salePrice)) - parseFloat(String(existing.rows[0].cost_price ?? 0));
      }
    }

    const returnedAt = status === "returned" ? new Date() : null;
    const soldAt = status === "sold" ? new Date() : null;

    const result = await db.execute(sql`
      UPDATE consignment_items
      SET status = ${status},
          sale_price = COALESCE(${salePrice ?? null}, sale_price),
          profit = COALESCE(${profit}, profit),
          notes = COALESCE(${notes ?? null}, notes),
          returned_at = COALESCE(${returnedAt}, returned_at),
          sold_at = COALESCE(${soldAt}, sold_at)
      WHERE id = ${id}
      RETURNING *
    `);

    if (!result.rows[0]) {
      res.status(404).json({ error: "Consignment item not found" });
      return;
    }

    res.json(result.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /consignment/:id
router.delete("/consignment/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  try {
    await db.execute(sql`DELETE FROM consignment_items WHERE id = ${id}`);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
