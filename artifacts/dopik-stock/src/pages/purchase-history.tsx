import { useListPurchases } from "@workspace/api-client-react";
import { ShoppingBag } from "lucide-react";
import { fmtRWF } from "@/lib/api";

export default function PurchaseHistoryPage() {
  const { data: purchases, isLoading } = useListPurchases();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Purchase History</h1>
        <p className="text-sm text-gray-400 mt-0.5">All recorded purchase transactions</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {["Date", "Item", "Vendor", "Quantity", "Total", "Payment"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">Loading...</td></tr>
              )}
              {!isLoading && (!purchases || purchases.length === 0) && (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <ShoppingBag className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No purchases recorded yet</p>
                  </td>
                </tr>
              )}
              {purchases?.map(p => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{p.itemName || `Item #${p.itemId}`}</td>
                  <td className="px-4 py-3 text-gray-600">{p.vendorName || "—"}</td>
                  <td className="px-4 py-3 font-mono">{p.quantity} {p.qtyType}</td>
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
