import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq, desc, and, gte, lte, ilike, or } from "drizzle-orm";
import { db, usersTable, activityLogTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: ["all"],
  manager: ["dashboard", "sales", "purchases", "stock", "customers", "repairs", "reports", "export"],
  cashier: ["dashboard", "sales", "customers"],
  stock_manager: ["dashboard", "stock", "purchases", "reports"],
};

export function hasPermission(role: string, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes("all") || perms.includes(permission);
}

function safeUser(u: any) {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, status: u.status, lastLogin: u.lastLogin, createdAt: u.createdAt };
}

router.get("/staff", async (req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  res.json(users.map(safeUser));
});

router.post("/staff", async (req, res): Promise<void> => {
  const { name, email, phone, role, password } = req.body;
  if (!name || !email || !password) {
    res.status(400).json({ error: "name, email, password required" });
    return;
  }
  const validRoles = ["owner", "manager", "cashier", "stock_manager"];
  if (role && !validRoles.includes(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({
    name, email, phone: phone || null, passwordHash, role: role || "cashier", status: "active",
  }).returning();
  await logActivity(req, "create_staff", `Created staff account: ${name} (${role || "cashier"})`);
  res.status(201).json(safeUser(user));
});

router.put("/staff/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { name, email, phone, role, status, password } = req.body;
  const updates: any = {};
  if (name) updates.name = name;
  if (email) updates.email = email;
  if (phone !== undefined) updates.phone = phone;
  if (role) updates.role = role;
  if (status) updates.status = status;
  if (password) updates.passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "Staff not found" }); return; }
  await logActivity(req, "update_staff", `Updated staff account: ${user.name}`);
  res.json(safeUser(user));
});

router.delete("/staff/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (id === req.session.userId) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }
  const [user] = await db.delete(usersTable).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "Staff not found" }); return; }
  await logActivity(req, "delete_staff", `Deleted staff account: ${user.name}`);
  res.json({ ok: true });
});

router.get("/activity-log", async (req, res): Promise<void> => {
  const { userId, action, from, to, limit: lim, page: pg } = req.query;
  const limit = parseInt(lim as string) || 100;
  const page = parseInt(pg as string) || 1;
  const offset = (page - 1) * limit;

  const conditions: any[] = [];
  if (userId) conditions.push(eq(activityLogTable.userId, parseInt(userId as string)));
  if (action) conditions.push(ilike(activityLogTable.action, `%${action}%`));
  if (from) conditions.push(gte(activityLogTable.createdAt, new Date(from as string)));
  if (to) conditions.push(lte(activityLogTable.createdAt, new Date(to as string)));

  const logs = await db
    .select()
    .from(activityLogTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(activityLogTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(logs);
});

export async function logActivity(req: any, action: string, description: string) {
  try {
    if (!req.session?.userId) return;
    const [user] = await db.select({ name: usersTable.name, role: usersTable.role })
      .from(usersTable).where(eq(usersTable.id, req.session.userId));
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || null;
    await db.insert(activityLogTable).values({
      userId: req.session.userId,
      userName: user?.name || "Unknown",
      userRole: user?.role || "unknown",
      action,
      description,
      ipAddress: ip,
    });
  } catch {}
}

export default router;
