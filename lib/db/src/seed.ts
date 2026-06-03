import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import bcryptjs from "bcryptjs";
import * as schema from "./schema";
import { usersTable, balancesTable, colorsTable, storageOptionsTable, ramOptionsTable } from "./schema";
import { eq } from "drizzle-orm";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function seed() {
  console.log("🌱 Seeding database...");

  // ── Session table (used by express-session PgSessionStore) ──────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS session (
      sid  VARCHAR NOT NULL PRIMARY KEY,
      sess JSON    NOT NULL,
      expire TIMESTAMP(6) NOT NULL
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS session_expire_idx ON session (expire)
  `);


  // ── Admin user ──────────────────────────────────────────────────────────────
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
      role: "owner",
    });
    console.log(`✅ Admin user created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  } else {
    console.log(`ℹ️  Admin user already exists: ${ADMIN_EMAIL}`);
  }

  // ── Cash balance accounts ───────────────────────────────────────────────────
  const existingBalances = await db.select().from(balancesTable);
  if (existingBalances.length === 0) {
    await db.insert(balancesTable).values([
      { method: "cash", amount: "0" },
      { method: "bank", amount: "0" },
      { method: "mobile_money", amount: "0" },
    ]);
    console.log("✅ Balance accounts created (cash, bank, mobile_money)");
  } else {
    console.log(`ℹ️  Balance accounts already exist (${existingBalances.length} records)`);
  }

  // ── Storage options ─────────────────────────────────────────────────────────
  const DEFAULT_STORAGE = [
    "16GB", "32GB", "64GB", "128GB", "256GB", "512GB", "1TB",
    "256GB SSD", "512GB SSD", "1TB SSD", "1TB HDD", "500GB HDD",
  ];

  for (const name of DEFAULT_STORAGE) {
    await db
      .insert(storageOptionsTable)
      .values({ name })
      .onConflictDoNothing();
  }
  console.log(`✅ Storage options seeded (${DEFAULT_STORAGE.length} entries)`);

  // ── Default colors ──────────────────────────────────────────────────────────
  const DEFAULT_COLORS = [
    "Black", "White", "Silver", "Gold", "Blue", "Red", "Green",
    "Purple", "Pink", "Yellow", "Gray", "Rose Gold", "Space Gray",
  ];

  for (const name of DEFAULT_COLORS) {
    await db
      .insert(colorsTable)
      .values({ name })
      .onConflictDoNothing();
  }
  console.log(`✅ Colors seeded (${DEFAULT_COLORS.length} entries)`);

  // ── RAM options ─────────────────────────────────────────────────────────────
  const DEFAULT_RAM = [
    "2GB", "3GB", "4GB", "6GB", "8GB", "12GB", "16GB", "32GB", "64GB",
  ];

  for (const name of DEFAULT_RAM) {
    await db
      .insert(ramOptionsTable)
      .values({ name })
      .onConflictDoNothing();
  }
  console.log(`✅ RAM options seeded (${DEFAULT_RAM.length} entries)`);

  console.log("🎉 Seeding complete.");
  await pool.end();
}

seed().catch(err => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
