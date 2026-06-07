import { Router } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, repairJobsTable, repairPartsTable, repairStatusHistoryTable, customersTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
// Inline simple activity logging for repairs (avoids circular imports)
async function logRepairActivity(userId: number | null, description: string) {
  try {
    if (!userId) return;
    const { db, activityLogTable, usersTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const [user] = await db.select({ name: usersTable.name, role: usersTable.role })
      .from(usersTable).where(eq(usersTable.id, userId));
    await db.insert(activityLogTable).values({
      userId, userName: user?.name || "Unknown", userRole: user?.role || "unknown",
      action: "repair", description,
    });
  } catch {}
}

const router = Router();
router.use(requireAuth);

const STATUSES = ["received", "diagnosing", "repairing", "ready", "collected"];

async function buildRepairResponse(job: any) {
  const parts = await db.select().from(repairPartsTable)
    .where(eq(repairPartsTable.repairId, job.id))
    .orderBy(repairPartsTable.createdAt);
  const history = await db.select({
    id: repairStatusHistoryTable.id,
    status: repairStatusHistoryTable.status,
    notes: repairStatusHistoryTable.notes,
    changedAt: repairStatusHistoryTable.changedAt,
    changedByName: usersTable.name,
  }).from(repairStatusHistoryTable)
    .leftJoin(usersTable, eq(repairStatusHistoryTable.changedBy, usersTable.id))
    .where(eq(repairStatusHistoryTable.repairId, job.id))
    .orderBy(repairStatusHistoryTable.changedAt);

  const partsCost = parts.reduce((sum: number, p: any) => sum + parseFloat(p.partCost) * (p.quantity || 1), 0);
  const daysInShop = Math.floor((Date.now() - new Date(job.receivedDate || job.createdAt).getTime()) / 86400000);

  return { ...job, parts, history, partsCost, daysInShop };
}

router.get("/repairs", async (req, res): Promise<void> => {
  const rows = await db.select({
    id: repairJobsTable.id,
    customerId: repairJobsTable.customerId,
    customerName: repairJobsTable.customerName,
    customerPhone: repairJobsTable.customerPhone,
    deviceType: repairJobsTable.deviceType,
    brand: repairJobsTable.brand,
    model: repairJobsTable.model,
    imeiOrSerial: repairJobsTable.imeiOrSerial,
    problem: repairJobsTable.problem,
    status: repairJobsTable.status,
    technicianId: repairJobsTable.technicianId,
    priority: repairJobsTable.priority,
    estimatedCost: repairJobsTable.estimatedCost,
    depositPaid: repairJobsTable.depositPaid,
    laborCost: repairJobsTable.laborCost,
    technicianCost: repairJobsTable.technicianCost,
    totalCost: repairJobsTable.totalCost,
    workDone: repairJobsTable.workDone,
    warrantyDays: repairJobsTable.warrantyDays,
    notes: repairJobsTable.notes,
    receivedDate: repairJobsTable.receivedDate,
    createdAt: repairJobsTable.createdAt,
    updatedAt: repairJobsTable.updatedAt,
    technicianName: usersTable.name,
  }).from(repairJobsTable)
    .leftJoin(usersTable, eq(repairJobsTable.technicianId, usersTable.id))
    .orderBy(desc(repairJobsTable.createdAt));

  const results = await Promise.all(rows.map(buildRepairResponse));
  res.json(results);
});

router.get("/repairs/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [row] = await db.select({
    id: repairJobsTable.id,
    customerId: repairJobsTable.customerId,
    customerName: repairJobsTable.customerName,
    customerPhone: repairJobsTable.customerPhone,
    deviceType: repairJobsTable.deviceType,
    brand: repairJobsTable.brand,
    model: repairJobsTable.model,
    imeiOrSerial: repairJobsTable.imeiOrSerial,
    problem: repairJobsTable.problem,
    status: repairJobsTable.status,
    technicianId: repairJobsTable.technicianId,
    priority: repairJobsTable.priority,
    estimatedCost: repairJobsTable.estimatedCost,
    depositPaid: repairJobsTable.depositPaid,
    laborCost: repairJobsTable.laborCost,
    technicianCost: repairJobsTable.technicianCost,
    totalCost: repairJobsTable.totalCost,
    workDone: repairJobsTable.workDone,
    warrantyDays: repairJobsTable.warrantyDays,
    notes: repairJobsTable.notes,
    receivedDate: repairJobsTable.receivedDate,
    createdAt: repairJobsTable.createdAt,
    updatedAt: repairJobsTable.updatedAt,
    technicianName: usersTable.name,
  }).from(repairJobsTable)
    .leftJoin(usersTable, eq(repairJobsTable.technicianId, usersTable.id))
    .where(eq(repairJobsTable.id, id));

  if (!row) { res.status(404).json({ error: "Repair not found" }); return; }
  const result = await buildRepairResponse(row);
  res.json(result);
});

router.post("/repairs", async (req, res): Promise<void> => {
  const { customerId, customerName, customerPhone, deviceType, brand, model, imeiOrSerial, problem, technicianId, priority, estimatedCost, depositPaid, notes } = req.body;
  if (!deviceType || !problem) {
    res.status(400).json({ error: "deviceType and problem are required" });
    return;
  }

  let resolvedName = customerName;
  let resolvedPhone = customerPhone;
  if (customerId) {
    const [c] = await db.select().from(customersTable).where(eq(customersTable.id, customerId));
    if (c) { resolvedName = c.name; resolvedPhone = c.phone || customerPhone; }
  }

  const [job] = await db.insert(repairJobsTable).values({
    customerId: customerId || null,
    customerName: resolvedName || null,
    customerPhone: resolvedPhone || null,
    deviceType,
    brand: brand || null,
    model: model || null,
    imeiOrSerial: imeiOrSerial || null,
    problem,
    status: "received",
    technicianId: technicianId || null,
    priority: priority || "normal",
    estimatedCost: estimatedCost ? String(estimatedCost) : null,
    depositPaid: depositPaid ? String(depositPaid) : "0",
    notes: notes || null,
    receivedDate: new Date(),
  }).returning();

  await db.insert(repairStatusHistoryTable).values({
    repairId: job.id,
    status: "received",
    notes: "Repair job created",
    changedBy: (req.session as any).userId || null,
  });

  logRepairActivity((req.session as any).userId, `Created repair job #${job.id} — ${deviceType} ${brand || ""} ${model || ""} (${resolvedName || "Unknown"})`);
  const result = await buildRepairResponse(job);
  res.status(201).json(result);
});

router.patch("/repairs/:id/status", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { status, notes } = req.body;
  if (!status || !STATUSES.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${STATUSES.join(", ")}` });
    return;
  }

  const [job] = await db.update(repairJobsTable).set({ status, updatedAt: new Date() })
    .where(eq(repairJobsTable.id, id)).returning();
  if (!job) { res.status(404).json({ error: "Repair not found" }); return; }

  await db.insert(repairStatusHistoryTable).values({
    repairId: id,
    status,
    notes: notes || null,
    changedBy: (req.session as any).userId || null,
  });

  logRepairActivity((req.session as any).userId, `Updated repair #${id} status to "${status}"`);
  const result = await buildRepairResponse(job);
  res.json(result);
});

router.patch("/repairs/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { laborCost, workDone, warrantyDays, notes, technicianId, estimatedCost, depositPaid, technicianCost } = req.body;

  const [existing] = await db.select().from(repairJobsTable).where(eq(repairJobsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Repair not found" }); return; }

  const parts = await db.select().from(repairPartsTable).where(eq(repairPartsTable.repairId, id));
  const partsCost = parts.reduce((sum: number, p: any) => sum + parseFloat(p.partCost) * (p.quantity || 1), 0);
  const labor = laborCost !== undefined ? parseFloat(String(laborCost)) : parseFloat(String(existing.laborCost || "0"));
  const total = partsCost + labor;

  const [job] = await db.update(repairJobsTable).set({
    ...(laborCost !== undefined && { laborCost: String(laborCost) }),
    ...(technicianCost !== undefined && { technicianCost: String(technicianCost) }),
    ...(workDone !== undefined && { workDone }),
    ...(warrantyDays !== undefined && { warrantyDays }),
    ...(notes !== undefined && { notes }),
    ...(technicianId !== undefined && { technicianId }),
    ...(estimatedCost !== undefined && { estimatedCost: String(estimatedCost) }),
    ...(depositPaid !== undefined && { depositPaid: String(depositPaid) }),
    totalCost: String(total),
    updatedAt: new Date(),
  }).where(eq(repairJobsTable.id, id)).returning();

  const result = await buildRepairResponse(job);
  res.json(result);
});

router.post("/repairs/:id/parts", async (req, res): Promise<void> => {
  const repairId = parseInt(req.params.id);
  const { partName, partCost, quantity } = req.body;
  if (!partName || !partCost) {
    res.status(400).json({ error: "partName and partCost required" });
    return;
  }

  const [part] = await db.insert(repairPartsTable).values({
    repairId, partName, partCost: String(partCost), quantity: quantity || 1,
  }).returning();

  const parts = await db.select().from(repairPartsTable).where(eq(repairPartsTable.repairId, repairId));
  const [job] = await db.select().from(repairJobsTable).where(eq(repairJobsTable.id, repairId));
  const partsCost = parts.reduce((sum: number, p: any) => sum + parseFloat(p.partCost) * (p.quantity || 1), 0);
  const labor = parseFloat(String(job.laborCost || "0"));
  await db.update(repairJobsTable).set({ totalCost: String(partsCost + labor), updatedAt: new Date() })
    .where(eq(repairJobsTable.id, repairId));

  res.status(201).json(part);
});

router.delete("/repairs/:id/parts/:partId", async (req, res): Promise<void> => {
  const repairId = parseInt(req.params.id);
  const partId = parseInt(req.params.partId);
  await db.delete(repairPartsTable).where(eq(repairPartsTable.id, partId));

  const parts = await db.select().from(repairPartsTable).where(eq(repairPartsTable.repairId, repairId));
  const [job] = await db.select().from(repairJobsTable).where(eq(repairJobsTable.id, repairId));
  const partsCost = parts.reduce((sum: number, p: any) => sum + parseFloat(p.partCost) * (p.quantity || 1), 0);
  const labor = parseFloat(String(job.laborCost || "0"));
  await db.update(repairJobsTable).set({ totalCost: String(partsCost + labor), updatedAt: new Date() })
    .where(eq(repairJobsTable.id, repairId));

  res.sendStatus(204);
});

router.delete("/repairs/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(repairJobsTable).where(eq(repairJobsTable.id, id));
  logRepairActivity((req.session as any).userId, `Deleted repair job #${id}`);
  res.sendStatus(204);
});

export default router;
