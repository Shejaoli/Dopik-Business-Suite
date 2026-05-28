import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useListStock } from "@workspace/api-client-react";
import { api, fmtDateTime } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, ArrowLeft, Plus, TrendingUp, TrendingDown } from "lucide-react";

function useFilteredAdjustments(itemId: string, type: string) {
  return useQuery({
    queryKey: ["adjustments", itemId, type],
    queryFn: () => {
      const params = new URLSearchParams();
      if (itemId) params.set("itemId", itemId);
      if (type && type !== "all") params.set("type", type);
      const qs = params.toString();
      return api.get(`/stock/adjustments${qs ? `?${qs}` : ""}`);
    },
  });
}

export default function AdjustmentHistoryPage() {
  const [itemFilter, setItemFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: stockData } = useListStock({});
  const stockItems: any[] = (stockData as any) ?? [];

  const { data: adjustments, isLoading } = useFilteredAdjustments(itemFilter, typeFilter);
  const rows: any[] = (adjustments as any) ?? [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Adjustment History</h1>
          <p className="text-sm text-gray-400 mt-0.5">Full record of all stock adjustments</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/stock">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />Back to Stock
            </Button>
          </Link>
          <Link href="/stock-adjustment">
            <Button size="sm" className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90 gap-1.5">
              <Plus className="h-3.5 w-3.5" />New Adjustment
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Item filter */}
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[200px]"
          value={itemFilter}
          onChange={e => setItemFilter(e.target.value)}
        >
          <option value="">All Items</option>
          {stockItems.map((s: any) => (
            <option key={s.itemId} value={s.itemId}>{s.itemName}</option>
          ))}
        </select>

        {/* Type filter */}
        <div className="flex gap-1.5">
          {[
            { value: "all", label: "All Types" },
            { value: "increase", label: "Increase", icon: TrendingUp },
            { value: "decrease", label: "Decrease", icon: TrendingDown },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setTypeFilter(opt.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                typeFilter === opt.value
                  ? opt.value === "increase"
                    ? "bg-green-100 border-green-400 text-green-700"
                    : opt.value === "decrease"
                    ? "bg-red-100 border-red-400 text-red-700"
                    : "bg-[#1A6DB5] border-[#1A6DB5] text-white"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {opt.icon && <opt.icon className="h-3.5 w-3.5" />}
              {opt.label}
            </button>
          ))}
        </div>

        {/* Active filter summary */}
        {(itemFilter || typeFilter !== "all") && (
          <button
            onClick={() => { setItemFilter(""); setTypeFilter("all"); }}
            className="text-xs text-[#1A6DB5] hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {["#", "Date", "Item", "Type", "Quantity", "Prev Qty", "New Qty", "Reason"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 animate-pulse rounded" /></td>
                    ))}
                  </tr>
                ))
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <RotateCcw className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No adjustment history found</p>
                    {(itemFilter || typeFilter !== "all") && (
                      <p className="text-gray-300 text-xs mt-1">Try clearing the filters</p>
                    )}
                  </td>
                </tr>
              )}
              {rows.map((adj: any, i: number) => (
                <tr key={adj.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {fmtDateTime(adj.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800 max-w-[160px]">
                    <span className="truncate block">{adj.itemName || `Item #${adj.itemId}`}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs gap-1 ${
                      adj.adjustmentType === "increase"
                        ? "bg-green-100 text-green-700 border-green-200"
                        : "bg-red-100 text-red-700 border-red-200"
                    }`}>
                      {adj.adjustmentType === "increase"
                        ? <TrendingUp className="h-3 w-3" />
                        : <TrendingDown className="h-3 w-3" />}
                      {adj.adjustmentType === "increase" ? "Increase" : "Decrease"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-gray-800">
                    {adj.adjustmentType === "increase" ? "+" : "−"}{parseFloat(adj.quantity).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                    {adj.previousQty != null ? parseFloat(adj.previousQty).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-medium text-gray-700">
                    {adj.newQty != null ? parseFloat(adj.newQty).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px]">
                    <span className="truncate block">{adj.reason || "—"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isLoading && rows.length > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/40">
            <p className="text-xs text-gray-400">
              Showing <strong>{rows.length}</strong> record{rows.length !== 1 ? "s" : ""}
              {itemFilter ? ` for ${stockItems.find(s => String(s.itemId) === itemFilter)?.itemName ?? "selected item"}` : ""}
              {typeFilter !== "all" ? ` · ${typeFilter} only` : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
