---
name: Purchase form architecture
description: Dual-mode purchase form with draft, PO preview, and cancel safety flow
---

## Mode detection
- `item.trackSerial === true` → serialized mode (per-unit table with IMEI/color/storage/condition/vendor/payment/cost per row)
- `item.trackSerial === false` → simple mode (item, quantity, unit cost, vendor, payment, condition)

## Draft flow
- Save → POST /purchases with status='draft', notes=JSON.stringify({mode, rows, simple})
- Draft appears in list with amber "Draft" badge; clicking it calls GET /purchases/:id and restores form state from notes JSON
- Confirm draft → PATCH /purchases/:id with status='confirmed' triggers stock update + serialized_units insert

## PO preview
- Client-side only (no DB write). generatePO() creates PO-YYYYMMDD-XXXX.
- "Confirm & Save Purchase" button inside PO modal is the only way to actually save a confirmed purchase.
- "Confirm Purchase" button on main form is ONLY enabled after Verify is clicked (sets `verified=true`).

## Cancel safety flow
- Two modals: first warns with "Go Back & Edit" / "Yes cancel"; second requires typing a random alphanumeric code (format XXXX-XXXX) to confirm.

## Serialized units storage
- `serialized_units` table: one row per unit, linked to purchase_id. NOT the old serial_numbers table.
- The old serial_numbers table is still used for the legacy simple text-input serial flow.

**Why:** Dual-mode matches the user's requirement that phones/laptops need per-unit IMEI tracking while accessories use simple quantity entry.
