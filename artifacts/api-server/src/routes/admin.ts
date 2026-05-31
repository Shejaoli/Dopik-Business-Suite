import { Router } from "express";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { runBackup, getBackupStatus } from "../lib/pg-backup";

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

router.post("/admin/backup/run", async (_req, res): Promise<void> => {
  const result = await runBackup();
  if (result.success) {
    res.json({ success: true, file: result.file, message: "Backup completed successfully" });
  } else {
    res.status(500).json({ success: false, error: result.error });
  }
});

router.get("/admin/backup/status", (_req, res): Promise<void> => {
  res.json(getBackupStatus());
  return Promise.resolve();
});

export default router;
