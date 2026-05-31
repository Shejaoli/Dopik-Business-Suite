import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, fmtRWF, fmtDateTime } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Eye } from "lucide-react";
import { ReceiptModal, paymentLabel } from "@/components/ReceiptModal";

type ReceiptSummary = {
  id: number;
  receiptNumber: string;
  customerName?: string;
  paymentMethod?: string;
  totalAmount: string;
  createdAt: string;
};

function pmBadge(m: string) {
  const colors: Record<string, string> = {
    cash: "bg-green-100 text-green-800",
    bank: "bg-blue-100 text-blue-800",
    mobile_money: "bg-yellow-100 text-yellow-800",
    credit: "bg-red-100 text-red-800",
  };
  return colors[m] || "bg-gray-100 text-gray-700";
}

export default function ReceiptsPage() {
  const [search, setSearch] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);

  const { data: receipts = [], isLoading } = useQuery<ReceiptSummary[]>({
    queryKey: ["receipts"],
    queryFn: () => api.get("/receipts?limit=200"),
  });

  const filtered = receipts.filter((r) => {
    if (!search) return true;
    return (
      r.receiptNumber.toLowerCase().includes(search.toLowerCase()) ||
      (r.customerName || "").toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F1A2E]">Receipts</h1>
        <p className="text-sm text-gray-500 mt-0.5">View, print, save, and share sales receipts</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by receipt # or customer..." className="pl-9" />
        </div>
        <p className="text-sm text-gray-400">{filtered.length} receipts</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Receipt #</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Payment</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Loading receipts...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">No receipts found</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-[#1A6DB5]">{r.receiptNumber}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-[#0F1A2E]">{r.customerName || "Walk-in Customer"}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs ${pmBadge(r.paymentMethod || "")}`}>
                      {paymentLabel(r.paymentMethod || "")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{fmtRWF(r.totalAmount)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDateTime(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
                      onClick={() => setSelectedSaleId(r.id)}>
                      <Eye className="w-3.5 h-3.5" /> View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSaleId !== null && (
        <ReceiptModal
          saleId={selectedSaleId}
          open={selectedSaleId !== null}
          onClose={() => setSelectedSaleId(null)}
        />
      )}
    </div>
  );
}
