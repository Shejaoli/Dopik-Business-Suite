import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrations = [
  `CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal',
    pinned BOOLEAN DEFAULT FALSE,
    created_by INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT,
    reference_id INTEGER,
    reference_type VARCHAR(50),
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS stock_count_sessions (
    id SERIAL PRIMARY KEY,
    started_by INTEGER,
    status VARCHAR(20) DEFAULT 'in_progress',
    notes TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
  )`,

  `CREATE TABLE IF NOT EXISTS stock_count_entries (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    system_qty NUMERIC(12,2) NOT NULL,
    counted_qty NUMERIC(12,2) NOT NULL,
    variance NUMERIC(12,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS usage_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    event_type VARCHAR(50) NOT NULL,
    page VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS referred_by INTEGER`,
];

async function run() {
  const client = await pool.connect();
  try {
    console.log("🔄 Running migrations...");
    for (const sql of migrations) {
      await client.query(sql);
    }
    console.log("✅ Migrations complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error("Migration failed:", e); process.exit(1); });
