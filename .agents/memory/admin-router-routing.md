---
name: Admin router routing bug
description: Express sub-router middleware without path prefix intercepts all requests, not just matched routes
---

## Rule
Never use `router.use(middleware)` as a catch-all in a sub-router that is mounted without a path prefix on the main router.

## Why
In Express, when a sub-router is mounted via `mainRouter.use(subRouter)` (no path), ALL incoming requests pass through the sub-router. Any `router.use(middleware)` inside the sub-router runs on every request — even those destined for other routers registered after it — because Express calls `next()` to fall through only after checking routes, but the middleware runs before route matching.

In this project: `adminRouter` was mounted without a path prefix but had `router.use(requireAdmin)` at the top. This silently blocked all routes registered AFTER adminRouter in routes/index.ts (colors, analytics, staff, credit, etc.) for non-admin users, returning 403 "Admin access required" instead of reaching the correct router.

Routes registered BEFORE adminRouter in routes/index.ts were unaffected (purchases, sales, vendors, etc.).

## How to apply
- In `admin.ts`: apply `requireAuth` and `requireAdmin` inline on each individual route handler, NOT as `router.use()`.
- Also note: `requireAdmin` must accept both `"admin"` and `"owner"` roles — owner is the highest permission level.
- The `push-force` (drizzle-kit push --force) flag also hangs in non-TTY; the dev script now skips push entirely and relies on migrate.ts for all schema changes.
