import { Link } from "wouter";
import { useListSales } from "@workspace/api-client-react";
import { fmtRWF } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Scale, Plus } from "lucide-react";

export default function SalesHistoryPage() {
  const { data: sales, isLoading } = useListSales();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Sales History</h1>
          <p className="text-sm text-gray-400 mt-0.5">All recorded sales transactions</p>
        </div>
        <Link href="/sales">
          <Button className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90">
            <Plus className="h-4 w-4 mr-2" />New Sale
          </Button>
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {["Date", "Customer", "Items", "Total Amount", "Payment"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400">Loading...</td></tr>
              )}
              {!isLoading && (!sales || sales.length === 0) && (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <Scale className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No sales recorded yet</p>
                  </td>
                </tr>
              )}
              {sales?.map(sale => (
                <tr key={sale.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {sale.createdAt ? new Date(sale.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{sale.customerName || "Walk-in"}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {sale.items && sale.items.length > 0
                      ? sale.items.map((it) => it.itemName || `Item #${it.itemId}`).join(", ")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-gray-800">{fmtRWF(sale.totalAmount)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 capitalize">
                      {sale.paymentMethod || "—"}
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
