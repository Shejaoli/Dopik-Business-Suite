import { useQuery } from "@tanstack/react-query";
import { api, fmtRWF } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CategoryTabs } from "@/components/CategoryTabs";
import { useCategoryTab, type SuperCat } from "@/lib/categories";
import { Brain, TrendingDown, AlertTriangle, Package, Clock, ShoppingCart } from "lucide-react";

interface RestockItem {
  itemId: number;
  itemName: string;
  category: string;
  sku: string | null;
  currentQty: number;
  minStock: number;
  soldLast30Days: number;
  avgDailySales: number;
  daysUntilStockout: number | null;
  suggestedRestock: number;
  urgency: "critical" | "high" | "medium" | "low";
}

const urgencyConfig: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  critical: { label: "Out of Stock", color: "text-red-700", bg: "bg-red-50", border: "border-red-200", dot: "bg-red-500" },
  high: { label: "Restock Soon", color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", dot: "bg-orange-500" },
  medium: { label: "Running Low", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-400" },
  low: { label: "OK", color: "text-green-700", bg: "bg-green-50", border: "border-green-200", dot: "bg-green-500" },
};

export default function RestockIntelligencePage() {
  const [superCat, setSuperCat] = useCategoryTab("restock");

  const params: Record<string, string> = {};
  if (superCat !== "all") params.superCategory = superCat;

  const { data: items = [], isLoading } = useQuery<RestockItem[]>({
    queryKey: ["restock-intelligence", superCat],
    queryFn: () => api.get("/analytics/restock-intelligence", params),
  });

  const critical = items.filter(i => i.urgency === "critical");
  const high = items.filter(i => i.urgency === "high");
  const medium = items.filter(i => i.urgency === "medium");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold font-sora flex items-center gap-2">
          <Brain className="h-6 w-6 text-[#1A6DB5]" />
          Restock Intelligence
        </h1>
        <p className="text-sm text-muted-foreground">AI-powered restocking suggestions based on stock levels and sales velocity</p>
      </div>

      <CategoryTabs value={superCat} onChange={setSuperCat} />

      {/* Summary cards */}
      {!isLoading && (
        <div className="grid grid-cols-3 gap-4">
          <div className="glass-panel p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{critical.length}</p>
                <p className="text-xs text-gray-500">Out of stock</p>
              </div>
            </div>
          </div>
          <div className="glass-panel p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600">{high.length}</p>
                <p className="text-xs text-gray-500">Restock soon</p>
              </div>
            </div>
          </div>
          <div className="glass-panel p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Package className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{medium.length}</p>
                <p className="text-xs text-gray-500">Running low</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="glass-panel p-12 text-center">
          <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">All stock levels look healthy!</p>
          <p className="text-sm text-gray-400 mt-1">No items need restocking in this category.</p>
        </div>
      ) : (
        <div className="glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Item</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">In Stock</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Sold (30d)</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">
                    <span className="flex items-center justify-end gap-1"><Clock className="h-3 w-3" />Days Left</span>
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">
                    <span className="flex items-center justify-end gap-1"><ShoppingCart className="h-3 w-3" />Restock Qty</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map(item => {
                  const cfg = urgencyConfig[item.urgency];
                  return (
                    <tr key={item.itemId} className={`${cfg.bg} hover:brightness-95 transition-all`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                          <div>
                            <p className="font-medium text-gray-900">{item.itemName}</p>
                            <p className="text-xs text-gray-400">{item.category}{item.sku ? ` · ${item.sku}` : ""}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        <span className={item.currentQty === 0 ? "text-red-600 font-bold" : "text-gray-900"}>
                          {item.currentQty}
                        </span>
                        {item.minStock > 0 && (
                          <p className="text-xs text-gray-400">min: {item.minStock}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <p className="font-medium">{item.soldLast30Days}</p>
                        <p className="text-xs text-gray-400">{item.avgDailySales}/day avg</p>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {item.daysUntilStockout === null ? (
                          <span className="text-xs text-gray-400">No sales data</span>
                        ) : item.daysUntilStockout === 0 ? (
                          <span className="text-xs font-bold text-red-600">OUT</span>
                        ) : (
                          <span className={`font-medium ${item.daysUntilStockout <= 7 ? "text-red-600" : item.daysUntilStockout <= 14 ? "text-orange-600" : "text-gray-700"}`}>
                            {item.daysUntilStockout}d
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-bold text-[#1A6DB5] text-base">{item.suggestedRestock}</span>
                        <p className="text-xs text-gray-400">units</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 bg-gray-50/50 border-t border-gray-100 text-xs text-gray-400">
            Based on 30-day sales velocity · Suggested quantity = 30-day demand × 1.2 buffer
          </div>
        </div>
      )}
    </div>
  );
}
