---
name: DB migration strategy
description: How to add new DB tables/columns without drizzle-kit push hanging in non-TTY environments
---

## Rule
Never use `drizzle-kit push` (or `push --force`) as the automated dev startup step when new tables are being added. It prompts interactively in non-TTY shells even with `--force`.

**Why:** drizzle-kit `tablesResolver` calls interactive prompts when it detects possible renamed tables. `--force` only skips data-loss confirmations, not name-conflict prompts. Non-TTY shells (workflow runners, CI) throw: "Interactive prompts require a TTY terminal."

**How to apply:**
- The dev startup script now calls `pnpm --filter @workspace/db run migrate` (runs `lib/db/src/migrate.ts`)
- That script uses raw `pg` Pool + `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- It is fully idempotent and TTY-free
- When adding new tables: add the Drizzle schema file, export from `schema/index.ts`, AND add the SQL to `lib/db/src/migrate.ts`
- `drizzle-kit push` can still be used manually from a TTY shell for existing tables or initial setup
