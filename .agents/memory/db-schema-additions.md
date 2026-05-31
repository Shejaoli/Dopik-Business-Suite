---
name: DB schema additions
description: New tables and column additions for serialized purchase tracking
---

## New tables (created via raw SQL, also in Drizzle schema files)
- `colors` — id, name UNIQUE, created_at. Seeded with 16 common phone colors.
- `storage_options` — id, name UNIQUE, created_at. Seeded with 13 storage sizes.
- `serialized_units` — id, item_id, imei_or_serial, color, storage, condition, vendor_id, purchase_id, cost_price, payment_method, status, notes, date_received.

## Columns added to `purchases`
- `status VARCHAR(20) DEFAULT 'confirmed'` — 'draft' | 'confirmed'
- `po_number VARCHAR(50)` — format PO-YYYYMMDD-XXXX
- `notes TEXT` — stores draft form JSON as `{ mode, rows, simple }`

**Why:** Schema changes must be applied via raw SQL (`node -e` with pg Pool) — drizzle-kit push requires a TTY which is not available in this environment.
