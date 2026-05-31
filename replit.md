# Dopik Electronics Stock Management

A full-stack stock and business management system for Dopik Electronics Ltd — handles inventory, sales, purchases, credit, staff, and receipts.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, auto-runs DB push + seed)
- `pnpm --filter @workspace/dopik-stock run dev` — run the frontend (Vite, port auto-assigned by Replit)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/db run seed` — seed admin user, balances, storage options, colors
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (port 8080)
- DB: PostgreSQL + Drizzle ORM
- Frontend: React + Vite + Tailwind + shadcn/ui
- Password hashing: bcryptjs (NOT bcrypt — native module blocked by pnpm)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/` — all Drizzle table definitions (source of truth)
- `lib/db/src/seed.ts` — seeds admin user (owner role), balances, storage, colors
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/routes/index.ts` — route registry
- `artifacts/dopik-stock/src/pages/` — React page components
- `artifacts/dopik-stock/src/components/Layout.tsx` — sidebar navigation
- `artifacts/dopik-stock/src/App.tsx` — client-side route definitions

## Architecture decisions

- API server auto-runs `db push` + `seed` on every startup (dev script chains them)
- `bcryptjs` used instead of `bcrypt` — the native C++ build is blocked by pnpm security policy
- Admin seeded as `role: "owner"` — the highest permission level
- Credit accounts are separate from receivables — receivables track vendor credit, credit_accounts track customer installment/credit sales
- Activity log captures all mutating actions automatically via `logActivity()` helper in staff.ts

## Product

- **Inventory**: Items, stock levels, stock adjustments, alerts, serial number tracking
- **Transactions**: Purchases (with serialized unit intake), Sales (single + multi-item), Sales history
- **Customers & Vendors**: CRM-lite, payables, receivables
- **Credit Management**: Credit accounts, payment recording, installment plans, WhatsApp reminders
- **Receipts**: Professional receipt generation, print, WhatsApp sharing
- **Staff & Permissions**: 4 roles (Owner/Manager/Cashier/Stock Manager), activity log
- **Accounting**: Cash/bank/mobile_money balances, expenses, loans
- **Analytics & Reports**: Charts, sales/purchase/expense reports

## Seed credentials

- Email: `admin@dopikelectronics.com`
- Password: `dopik2026`
- Role: `owner` (full access)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always use `bcryptjs` not `bcrypt` — native bcrypt fails pnpm build script policy
- API port is 8080 (not 5000) — set via `PORT` env or `${PORT:-8080}` fallback
- Vite frontend port is auto-assigned by Replit (currently 20758) — use `$REPLIT_DEV_DOMAIN` for public URL
- `drizzle-kit push` must be run before the server starts when schema changes — the dev startup script does this automatically

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
