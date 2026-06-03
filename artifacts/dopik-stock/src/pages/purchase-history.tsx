import { useState } from "react";
import { useListPurchases } from "@workspace/api-client-react";
import { ShoppingBag } from "lucide-react";
import { fmtRWF, fmtDate } from "@/lib/api";
import { CategoryTabs } from "@/components/CategoryTabs";
import { useCategoryTab, matchesSuperCat, SUPER_CATS, type SuperCat } from "@/lib/categories";

export default function PurchaseHistoryPage() {
  const [superCat, setSuperCat] = useCategoryTab("purchases");
  const { data: purchases, isLoading } = useListPurchases();

  const allPurchases: any[] = (purchases as any) ?? [];

  const filtered = allPurchases.filter(p =>
    matchesSuperCat(p.category ?? "Others", superCat)
  );

  const catCounts: Partial<Record<SuperCat, number>> = { all: allPurchases.length };
  for (const sc of SUPER_CATS.filter(c => c.key !== "all")) {
    catCounts[sc.key] = allPurchases.filter(p => matchesSuperCat(p.category ?? "Others", sc.key)).length;
  }

  const totalCost = filtered.reduce((s: number, p: any) => s + parseFloat(p.totalCost ?? "0"), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Purchase History</h1>
        <p className="text-sm text-gray-400 mt-0.5">All recorded purchase transactions</p>
      </div>

      <CategoryTabs value={superCat} onChange={setSuperCat} counts={catCounts} />

      {superCat !== "all" && (
        <div className="flex items-center gap-4 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl">
          <div>
            <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">
              {SUPER_CATS.find(c => c.key === superCat)?.emoji} {SUPER_CATS.find(c => c.key === superCat)?.label} Purchases
            </p>
            <p className="text-lg font-bold text-blue-800">{fmtRWF(String(totalCost))}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-blue-600">Transactions</p>
            <p className="text-lg font-bold text-blue-800">{filtered.length}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {["Date", "Item", "Category", "Vendor", "Quantity", "Total", "Payment"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">Loading...</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <ShoppingBag className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">
                      {superCat !== "all" ? `No ${SUPER_CATS.find(c => c.key === superCat)?.label} purchases yet` : "No purchases recorded yet"}
                    </p>
                  </td>
                </tr>
              )}
              {filtered.map((p: any) => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {fmtDate(p.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{p.itemName || `Item #${p.itemId}`}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      {p.category ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.vendorName || "—"}</td>
                  <td className="px-4 py-3 font-mono">{p.quantity}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-gray-800">{fmtRWF(p.totalCost)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 capitalize">
                      {p.paymentMethod}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
