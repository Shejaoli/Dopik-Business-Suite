---
name: Category separation
description: How the super-category filter works across frontend and backend
---

## Rule
Three super-categories partition all product categories:
- **Phones** → ["Smartphone"]
- **Computers** → ["Laptop", "Laptop Accessories", "Tablet", "Gaming", "Gaming Accessories"]
- **Accessories** → ["Phone Accessories", "Smartwatches", "Audio", "Cameras", "Camera Accessories", "Others"]
- **all** → no filter (show everything)

**Why:** The business sells across these three market segments; staff need to filter reports and views per segment.

**How to apply:**
- Backend: `artifacts/api-server/src/lib/category-filter.ts` — `getCategoriesForSuper(superCat?)` returns `string[] | undefined`
- Frontend: `artifacts/dopik-stock/src/lib/categories.ts` — `useCategoryTab(storageKey)` hook, `matchesSuperCat(category, superCat)` for client-side filtering
- Component: `CategoryTabs` in `artifacts/dopik-stock/src/components/CategoryTabs.tsx`
- All `api.get()` calls now accept an optional second `params: Record<string, string>` argument for query string building
- Pages with category filter: stock, items, purchase-history, sales-history, charts, restock-intelligence
