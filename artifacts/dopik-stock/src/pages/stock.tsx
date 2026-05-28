import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListStock, useGetStockAlerts, useListStockAdjustments, getListStockQueryKey } from "@workspace/api-client-react";
import { api, fmtRWF, fmtDateTime, statusBadgeColor } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Search, AlertTriangle, TrendingUp, TrendingDown, Loader2, Boxes } from "lucide-react";

type StockEntry = {
  id: number; itemId: number; itemName: string; category: string; trackSerial: boolean;
  quantity: string; minStock: string; purchasePrice: string; salePrice: string;
  status: string;
};

export default function StockPage() {
  const [search, setSearch] = useState("");
  const [adjustItem, setAdjustItem] = useState<StockEntry | null>(null);
  const [form, setForm] = useState({ adjustmentType: "increase", quantity: "", reason: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: stockData, isLoading } = useListStock({ search: search || undefined });
  const { data: alerts } = useGetStockAlerts();
  const { data: adjustments } = useListStockAdjustments({});
  const stock: StockEntry[] = (stockData as any) ?? [];

  const handleAdjust = async () => {
    if (!adjustItem || !form.quantity) return;
    setSaving(true);
    try {
      await api.post("/stock/adjust", {
        itemId: adjustItem.itemId,
        adjustmentType: form.adjustmentType,
        quantity: parseFloat(form.quantity),
        reason: form.reason,
      });
      toast({ title: "Stock adjusted" });
      setAdjustItem(null);
      setForm({ adjustmentType: "increase", quantity: "", reason: "" });
      qc.invalidateQueries({ queryKey: getListStockQueryKey() });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold font-sora">Stock Management</h1>
        <p className="text-sm text-muted-foreground">Monitor and adjust inventory levels</p>
      </div>

      {/* Alert summary */}
      {alerts && (
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-panel p-4 border-l-4 border-red-400">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium">Out of Stock</span>
            </div>
            <p className="text-2xl font-bold text-red-600 mt-1">{(alerts as any).outOfStock?.length ?? 0}</p>
          </div>
          <div className="glass-panel p-4 border-l-4 border-yellow-400">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">Low Stock</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600 mt-1">{(alerts as any).lowStock?.length ?? 0}</p>
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
                      <Boxes className="h-8 w-8 mx-auto mb-2 opacity-30" />No stock records
                    </td></tr>
                  ) : stock.map(s => (
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
                            onClick={() => { setAdjustItem(s); setForm(f => ({ ...f, adjustmentType: "increase" })); }}
                          >
                            <TrendingUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => { setAdjustItem(s); setForm(f => ({ ...f, adjustmentType: "decrease" })); }}
                          >
                            <TrendingDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
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

      {/* Adjust Dialog */}
      <Dialog open={!!adjustItem} onOpenChange={open => !open && setAdjustItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock — {adjustItem?.itemName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-3">
              {["increase", "decrease"].map(type => (
                <button
                  key={type}
                  onClick={() => setForm(f => ({ ...f, adjustmentType: type }))}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium capitalize transition-all ${
                    form.adjustmentType === type
                      ? type === "increase"
                        ? "border-green-500 bg-green-50 text-green-700"
                        : "border-red-400 bg-red-50 text-red-700"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {type === "increase" ? "▲" : "▼"} {type}
                </button>
              ))}
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Current stock: <strong>{parseFloat(adjustItem?.quantity ?? "0").toLocaleString()}</strong> &bull; Category: <strong>{adjustItem?.category}</strong>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Quantity to adjust *</Label>
              <Input
                type="number" min={0.01} step={0.01}
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Input
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="e.g. Damaged goods, correction..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustItem(null)}>Cancel</Button>
            <Button
              onClick={handleAdjust}
              disabled={saving || !form.quantity}
              className={form.adjustmentType === "increase" ? "bg-green-600 hover:bg-green-700" : "bg-red-500 hover:bg-red-600"}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirm Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
