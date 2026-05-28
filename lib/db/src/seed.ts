import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import bcryptjs from "bcryptjs";
import * as schema from "./schema";
import { usersTable, balancesTable } from "./schema";
import { eq } from "drizzle-orm";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function seed() {
  console.log("🌱 Seeding database...");

  // ── Admin user ──────────────────────────────────────────────
  const ADMIN_EMAIL = "admin@dopikelectronics.com";
  const ADMIN_PASSWORD = "dopik2026";

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, ADMIN_EMAIL));

  if (existing.length === 0) {
    const passwordHash = await bcryptjs.hash(ADMIN_PASSWORD, 10);
    await db.insert(usersTable).values({
      name: "Admin",
      email: ADMIN_EMAIL,
      passwordHash,
      role: "admin",
    });
    console.log(`✅ Admin user created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  } else {
    console.log(`ℹ️  Admin user already exists: ${ADMIN_EMAIL}`);
  }

  // ── Cash balances (create if none exist) ───────────────────
  const existingBalances = await db.select().from(balancesTable);
  if (existingBalances.length === 0) {
    await db.insert(balancesTable).values([
      { method: "cash", amount: "0" },
      { method: "bank", amount: "0" },
      { method: "mobile_money", amount: "0" },
    ]);
    console.log("✅ Cash balance accounts created (cash, bank, mobile_money)");
  } else {
    console.log(`ℹ️  Balance accounts already exist (${existingBalances.length} records)`);
  }

  console.log("🎉 Seeding complete.");
  await pool.end();
}

seed().catch(err => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
