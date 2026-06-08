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

  `CREATE TABLE IF NOT EXISTS ram_options (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `ALTER TABLE serialized_units ADD COLUMN IF NOT EXISTS ram VARCHAR(50)`,
  `ALTER TABLE serialized_units ADD COLUMN IF NOT EXISTS additional_info TEXT`,
  `ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS additional_info TEXT`,

  `ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_name VARCHAR(200)`,
  `ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(30)`,

  `CREATE TABLE IF NOT EXISTS system_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    performed_by INTEGER,
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address VARCHAR(100),
    details JSONB
  )`,

  `ALTER TABLE items ADD COLUMN IF NOT EXISTS min_sale_price NUMERIC(12,2) DEFAULT 0`,

  `CREATE TABLE IF NOT EXISTS consignment_items (
    id SERIAL PRIMARY KEY,
    serialized_unit_id INTEGER,
    item_id INTEGER NOT NULL,
    seller_name VARCHAR(200) NOT NULL,
    seller_phone VARCHAR(50),
    imei_or_serial VARCHAR(200),
    color VARCHAR(50),
    storage VARCHAR(50),
    ram VARCHAR(50),
    condition VARCHAR(100),
    cost_price NUMERIC(12,2) DEFAULT 0,
    sale_price NUMERIC(12,2),
    status VARCHAR(30) DEFAULT 'with_seller',
    profit NUMERIC(12,2),
    notes TEXT,
    given_at TIMESTAMPTZ DEFAULT NOW(),
    returned_at TIMESTAMPTZ,
    sold_at TIMESTAMPTZ,
    recorded_by INTEGER
  )`,

  `ALTER TABLE repair_jobs ADD COLUMN IF NOT EXISTS technician_cost NUMERIC(12,2) DEFAULT 0`,
  `ALTER TABLE serialized_units ADD COLUMN IF NOT EXISTS selling_price NUMERIC(12,2)`,
  `ALTER TABLE serialized_units ADD COLUMN IF NOT EXISTS min_selling_price NUMERIC(12,2)`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS category_access TEXT DEFAULT 'all'`,

  `CREATE TABLE IF NOT EXISTS app_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
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
