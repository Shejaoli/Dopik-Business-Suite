import { useGetStockAlerts } from "@workspace/api-client-react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export default function StockAlertsPage() {
  const { data: alerts, isLoading } = useGetStockAlerts();

  const outOfStock = alerts?.outOfStock || [];
  const lowStock = alerts?.lowStock || [];
  const allAlerts = [...outOfStock, ...lowStock];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Stock Alerts</h1>
        <p className="text-sm text-gray-400 mt-0.5">Items that need restocking attention</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">{outOfStock.length}</p>
            <p className="text-xs text-red-500 font-medium">Out of Stock</p>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-600">{lowStock.length}</p>
            <p className="text-xs text-amber-500 font-medium">Low Stock</p>
          </div>
        </div>
      </div>

      {/* Alerts list */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {["Item", "Unit", "Stock / Minimum", "Status"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400">Loading alerts...</td></tr>
              )}
              {!isLoading && allAlerts.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-16 text-center">
                    <CheckCircle2 className="h-12 w-12 text-green-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">All stock levels are healthy</p>
                    <p className="text-gray-400 text-xs mt-1">No alerts at this time</p>
                  </td>
                </tr>
              )}
              {allAlerts.map(alert => {
                const isOut = outOfStock.some(o => o.itemId === alert.itemId);
                return (
                  <tr key={alert.itemId} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">{alert.itemName}</td>
                    <td className="px-4 py-3 font-mono text-gray-500">{alert.qtyType}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold text-lg ${isOut ? "text-red-600" : "text-amber-500"}`}>
                        {alert.quantity}
                      </span>
                      <span className="text-xs text-gray-400 ml-1">/ min {alert.minStock}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                        isOut ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        <AlertTriangle className="h-3 w-3" />
                        {isOut ? "Out of Stock" : "Low Stock"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
