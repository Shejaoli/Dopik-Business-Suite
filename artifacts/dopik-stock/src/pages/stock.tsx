import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useListStock, useGetStockAlerts, useListStockAdjustments, getListStockQueryKey } from "@workspace/api-client-react";
import { api, fmtRWF, fmtDate, fmtDateTime, statusBadgeColor } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, AlertTriangle, TrendingUp, TrendingDown, Loader2, Boxes, ChevronDown, ChevronUp, History } from "lucide-react";
import { CategoryTabs } from "@/components/CategoryTabs";
import { useCategoryTab, matchesSuperCat, SUPER_CATS, type SuperCat } from "@/lib/categories";

const HISTORY_PERIODS = [
  { key: "today", label: "Today" },
  { key: "week",  label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year",  label: "This Year" },
];

type StockEntry = {
  id: number; itemId: number; itemName: string; category: string; trackSerial: boolean;
  quantity: string; minStock: string; purchasePrice: string; salePrice: string;
  status: string;
};

export default function StockPage() {
  const [search, setSearch] = useState("");
  const [superCat, setSuperCat] = useCategoryTab("stock");
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  const [historyPeriod, setHistoryPeriod] = useState("month");
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data: stockData, isLoading } = useListStock({ search: search || undefined });
  const { data: alerts } = useGetStockAlerts();
  const { data: adjustments } = useListStockAdjustments({});
  const allStock: StockEntry[] = (stockData as any) ?? [];

  const { data: itemHistory, isLoading: historyLoading } = useQuery<any[]>({
    queryKey: ["stock-history", expandedItemId, historyPeriod],
    queryFn: () => api.get(`/stock/${expandedItemId}/history?period=${historyPeriod}`),
    enabled: expandedItemId !== null,
  });

  const stock = allStock.filter(s => matchesSuperCat(s.category, superCat));

  const catCounts: Partial<Record<SuperCat, number>> = { all: allStock.length };
  for (const sc of SUPER_CATS.filter(c => c.key !== "all")) {
    catCounts[sc.key] = allStock.filter(s => matchesSuperCat(s.category, sc.key)).length;
  }

  const alertsData = alerts as any;
  const outOfStockFiltered = (alertsData?.outOfStock ?? []).filter((s: StockEntry) => matchesSuperCat(s.category, superCat));
  const lowStockFiltered = (alertsData?.lowStock ?? []).filter((s: StockEntry) => matchesSuperCat(s.category, superCat));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold font-sora">Stock Management</h1>
        <p className="text-sm text-muted-foreground">Monitor and adjust inventory levels</p>
      </div>

      <CategoryTabs value={superCat} onChange={setSuperCat} counts={catCounts} />

      {alerts && (
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-panel p-4 border-l-4 border-red-400">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium">Out of Stock</span>
            </div>
            <p className="text-2xl font-bold text-red-600 mt-1">{outOfStockFiltered.length}</p>
            {superCat !== "all" && <p className="text-xs text-muted-foreground mt-0.5">in {SUPER_CATS.find(c => c.key === superCat)?.label}</p>}
          </div>
          <div className="glass-panel p-4 border-l-4 border-yellow-400">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">Low Stock</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600 mt-1">{lowStockFiltered.length}</p>
            {superCat !== "all" && <p className="text-xs text-muted-foreground mt-0.5">in {SUPER_CATS.find(c => c.key === superCat)?.label}</p>}
          </div>
        </div>
      )}

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Current Stock</TabsTrigger>
          <TabsTrigger value="adjustments">Adjustments Log</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="mt-4 space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="glass-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {["Item", "Category", "In Stock", "Min Stock", "Status", "Purchase Price", "Sale Price", "Actions"].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        {[...Array(8)].map((_, j) => (
                          <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>
                        ))}
                      </tr>
                    ))
                  ) : stock.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">
                      <Boxes className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      {superCat !== "all" ? `No ${SUPER_CATS.find(c => c.key === superCat)?.label} stock` : "No stock records"}
                    </td></tr>
                  ) : stock.map(s => (
                    <>
                    <tr key={s.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium max-w-[180px]"><span className="truncate block">{s.itemName}</span></td>
                      <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{s.category}</Badge></td>
                      <td className="px-4 py-3 font-bold">{parseFloat(s.quantity).toLocaleString()}</td>
                      <td className="px-4 py-3 text-muted-foreground">{parseFloat(s.minStock).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${statusBadgeColor(s.status)}`}>
                          {s.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtRWF(s.purchasePrice)}</td>
                      <td className="px-4 py-3">{fmtRWF(s.salePrice)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button
                            size="sm" variant="ghost"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            title="Increase stock"
                            onClick={() => navigate(`/stock-adjustment?itemId=${s.itemId}&type=increase`)}
                          >
                            <TrendingUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            title="Decrease stock"
                            onClick={() => navigate(`/stock-adjustment?itemId=${s.itemId}&type=decrease`)}
                          >
                            <TrendingDown className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="text-[#1A6DB5] hover:bg-[#1A6DB5]/10"
                            onClick={() => setExpandedItemId(expandedItemId === s.itemId ? null : s.itemId)}
                            title="View item history"
                          >
                            {expandedItemId === s.itemId ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {expandedItemId === s.itemId && (
                      <tr key={`${s.id}-history`} className="bg-muted/20">
                        <td colSpan={8} className="px-6 pb-4 pt-2">
                          <div className="flex items-center gap-2 mb-3">
                            <History className="h-3.5 w-3.5 text-[#1A6DB5]" />
                            <span className="text-xs font-semibold text-gray-600">Item History</span>
                            <div className="flex gap-1 ml-2">
                              {HISTORY_PERIODS.map(p => (
                                <button
                                  key={p.key}
                                  onClick={() => setHistoryPeriod(p.key)}
                                  className={`px-2.5 py-1 text-[10px] font-medium rounded-full transition-colors ${
                                    historyPeriod === p.key
                                      ? "bg-[#1A6DB5] text-white"
                                      : "bg-white border border-border text-muted-foreground hover:border-[#1A6DB5]"
                                  }`}
                                >
                                  {p.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          {historyLoading ? (
                            <div className="flex items-center gap-2 text-muted-foreground text-xs py-2">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />Loading history...
                            </div>
                          ) : !itemHistory?.length ? (
                            <p className="text-xs text-muted-foreground py-3 text-center">
                              No activity recorded for this period.
                            </p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs border-collapse">
                                <thead>
                                  <tr className="border-b border-border">
                                    {["Event", "IMEI / Serial", "Color", "RAM", "Storage", "Qty", "Reason / Status", "Date"].map(h => (
                                      <th key={h} className="text-left px-2 py-1.5 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {itemHistory.map((h: any, idx: number) => {
                                    const isUnit = h.source === "unit";
                                    const eventLabel = isUnit
                                      ? (h.status === "in_stock" ? "Received" : h.status === "sold" ? "Sold" : h.status ?? "Unit")
                                      : h.event === "increase" || h.event === "in" ? "Increase" : "Decrease";
                                    const eventColor = eventLabel === "Received" || eventLabel === "Increase"
                                      ? "bg-green-100 text-green-700"
                                      : eventLabel === "Sold" ? "bg-blue-100 text-blue-700"
                                      : "bg-red-100 text-red-700";
                                    return (
                                      <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                                        <td className="px-2 py-1.5">
                                          <Badge className={`text-[10px] px-1.5 py-0 ${eventColor}`}>{eventLabel}</Badge>
                                        </td>
                                        <td className="px-2 py-1.5 font-mono text-[10px]">{h.imeiOrSerial || "—"}</td>
                                        <td className="px-2 py-1.5">{h.color || "—"}</td>
                                        <td className="px-2 py-1.5">{h.ram || "—"}</td>
                                        <td className="px-2 py-1.5">{h.storage || "—"}</td>
                                        <td className="px-2 py-1.5 font-medium">{h.quantity ?? "—"}</td>
                                        <td className="px-2 py-1.5 max-w-[160px]">
                                          <span className="truncate block text-muted-foreground">{h.reason || h.condition || "—"}</span>
                                        </td>
                                        <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">{fmtDate(h.date)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="adjustments" className="mt-4">
          <div className="glass-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {["Item", "Type", "Quantity", "Previous", "New Qty", "Reason", "Date"].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {((adjustments as any) ?? []).length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No adjustments logged</td></tr>
                  ) : ((adjustments as any) ?? []).map((a: any) => (
                    <tr key={a.id} className="border-b border-border hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{a.itemName}</td>
                      <td className="px-4 py-3">
                        <Badge className={a.adjustmentType === "increase" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                          {a.adjustmentType}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-medium">{parseFloat(a.quantity).toLocaleString()}</td>
                      <td className="px-4 py-3 text-muted-foreground">{parseFloat(a.previousQty).toLocaleString()}</td>
                      <td className="px-4 py-3 font-medium">{parseFloat(a.newQty).toLocaleString()}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-[160px]">
                        <span className="truncate block">{a.reason ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmtDateTime(a.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

    </div>
  );
}
