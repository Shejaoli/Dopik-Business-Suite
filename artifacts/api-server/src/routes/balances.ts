import { Router } from "express";
import { db, balancesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/balances", async (req, res): Promise<void> => {
  const rows = await db.select().from(balancesTable);
  res.json(rows);
});

export default router;
