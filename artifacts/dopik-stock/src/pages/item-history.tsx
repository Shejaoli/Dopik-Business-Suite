import { useListItems, useListStockAdjustments } from "@workspace/api-client-react";
import { History } from "lucide-react";

export default function ItemHistoryPage() {
  const { data: items } = useListItems();
  const { data: adjustments, isLoading } = useListStockAdjustments();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Item History</h1>
        <p className="text-sm text-gray-400 mt-0.5">Stock movement history across all items</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {["Date", "Item", "Adjustment Type", "Qty Change", "Reason", "Recorded By"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Loading history...</td></tr>
              )}
              {!isLoading && (!adjustments || adjustments.length === 0) && (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <History className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No stock movements recorded yet</p>
                  </td>
                </tr>
              )}
              {adjustments?.map(adj => (
                <tr key={adj.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {adj.createdAt ? new Date(adj.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{adj.itemName || `Item #${adj.itemId}`}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      adj.adjustmentType === "in"
                        ? "bg-green-100 text-green-700"
                        : adj.adjustmentType === "out"
                        ? "bg-red-100 text-red-700"
                        : "bg-blue-100 text-blue-700"
                    }`}>
                      {adj.adjustmentType === "in" ? "Stock In" : adj.adjustmentType === "out" ? "Stock Out" : adj.adjustmentType}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-gray-800">
                    {adj.adjustmentType === "out" ? "-" : "+"}{adj.quantity}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{adj.reason || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">System</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
