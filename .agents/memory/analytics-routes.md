---
name: Analytics routes
description: All analytics API endpoints and their data sources
---

## Registered in routes/index.ts
- `analyticsRouter` from `./analytics` — all /api/analytics/* endpoints
- `colorsRouter` from `./colors` — /api/colors and /api/storage-options

## Analytics endpoints (all require auth)
- GET /analytics/revenue?period=week|month|year — daily revenue buckets
- GET /analytics/categories?period=... — revenue by item category with pct
- GET /analytics/top-products?period=...&limit=N — top N products by revenue
- GET /analytics/payment-methods?period=... — sales split by payment method with pct
- GET /analytics/stock-health — totalProducts, outOfStock, lowStock, stockValue
- GET /analytics/credit-summary — totalOutstanding, customerCount, records array
- GET /analytics/heatmap?month=YYYY-MM — daily sales totals for calendar heatmap
- GET /analytics/customer-types?period=... — new vs returning customer counts
- GET /analytics/best-times?period=... — sales by day of week and hour of day
- GET /analytics/profit-vs-expenses?period=... — daily grossProfit + expenses for area chart

## Period helper
`periodBounds(period)` returns `{start, end}` Date objects for week/month/year.

**Why:** Separated from dashboard.ts to keep route files focused. Dashboard.ts has its own profit calc for the gauge; analytics.ts has more granular breakdowns for the Charts page.
