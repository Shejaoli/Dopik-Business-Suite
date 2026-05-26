import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListSales, useListCustomers, useListStock, getListSalesQueryKey } from "@workspace/api-client-react";
import { api, fmtRWF, fmtDateTime, paymentBadgeColor } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, TrendingUp, Loader2, Trash2, AlertCircle, Undo2 } from "lucide-react";

const PAYMENT_METHODS = ["cash", "bank", "mobile_money", "credit"];

type SaleLineItem = {
  itemId: number; itemName: string; qtyType: string;
  quantity: string; unitPrice: string; availableQty: number;
};

export default function SalesPage() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [lineItems, setLineItems] = useState<SaleLineItem[]>([]);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useListSales({});
  const { data: customers } = useListCustomers();
  const { data: stock } = useListStock({});
  const sales: any[] = (data as any) ?? [];
  const customerList: any[] = (customers as any) ?? [];
  const stockItems: any[] = (stock as any) ?? [];

  const addLineItem = (stockEntry: any) => {
    if (lineItems.find(l => l.itemId === stockEntry.itemId)) return;
    setLineItems(prev => [...prev, {
      itemId: stockEntry.itemId,
      itemName: stockEntry.itemName,
      qtyType: stockEntry.qtyType,
      quantity: "1",
      unitPrice: stockEntry.salePrice,
      availableQty: parseFloat(stockEntry.quantity),
    }]);
  };

  const updateLine = (idx: number, key: string, val: string) => {
    setLineItems(prev => prev.map((l, i) => i === idx ? { ...l, [key]: val } : l));
  };

  const removeLine = (idx: number) => setLineItems(prev => prev.filter((_, i) => i !== idx));

  const totalAmount = lineItems.reduce((sum, l) => {
    const qty = parseFloat(l.quantity) || 0;
    const price = parseFloat(l.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  const handleCreate = async () => {
    if (lineItems.length === 0 || !paymentMethod) return;
    // Validate quantities
    for (const l of lineItems) {
      if (parseFloat(l.quantity) <= 0) {
        toast({ title: "Invalid quantity", description: `Quantity for ${l.itemName} must be > 0`, variant: "destructive" });
        return;
      }
      if (parseFloat(l.quantity) > l.availableQty) {
        toast({ title: "Insufficient stock", description: `Only ${l.availableQty} ${l.qtyType} available for ${l.itemName}`, variant: "destructive" });
        return;
      }
    }
    setSaving(true);
    try {
      await api.post("/sales", {
        customerId: customerId ? Number(customerId) : null,
        paymentMethod,
        totalAmount: totalAmount.toFixed(2),
        items: lineItems.map(l => ({
          itemId: l.itemId,
          quantity: parseFloat(l.quantity),
          unitPrice: parseFloat(l.unitPrice),
        })),
      });
      toast({ title: "Sale recorded", description: `Total: ${fmtRWF(totalAmount)}` });
      setShowCreate(false);
      setLineItems([]);
      setCustomerId("");
      setPaymentMethod("cash");
      qc.invalidateQueries({ queryKey: getListSalesQueryKey() });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleRevert = async (saleId: number) => {
    if (!confirm("Are you sure you want to revert this sale? Stock will be restored.")) return;
    try {
      await api.post(`/sales/${saleId}/revert`);
      toast({ title: "Sale reverted" });
      qc.invalidateQueries({ queryKey: getListSalesQueryKey() });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const filtered = sales.filter(s =>
    !search || (s.customerName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-sora">Sales</h1>
          <p className="text-sm text-muted-foreground">Record and manage sales transactions</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90 self-start sm:self-auto">
          <Plus className="h-4 w-4 mr-2" />New Sale
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by customer..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {["#", "Customer", "Items", "Total", "Payment", "Status", "Date", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {[...Array(8)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />No sales found
                </td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} className={`border-b border-border hover:bg-muted/30 transition-colors ${s.reverted ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3 text-muted-foreground">#{s.id}</td>
                  <td className="px-4 py-3 font-medium">{s.customerName ?? "Walk-in"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-[160px]">
                    <span className="truncate block">
                      {(s.items ?? []).map((i: any) => `${i.itemName} ×${parseFloat(i.quantity)}`).join(", ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-green-600">{fmtRWF(s.totalAmount)}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs ${paymentBadgeColor(s.paymentMethod)}`}>
                      {s.paymentMethod?.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {s.reverted
                      ? <Badge className="bg-red-100 text-red-700 text-xs">Reverted</Badge>
                      : <Badge className="bg-green-100 text-green-700 text-xs">Completed</Badge>
                    }
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmtDateTime(s.createdAt)}</td>
                  <td className="px-4 py-3">
                    {!s.reverted && (
                      <Button
                        size="sm" variant="ghost"
                        className="text-orange-500 hover:text-orange-600 hover:bg-orange-50"
                        onClick={() => handleRevert(s.id)}
                        title="Revert sale"
                      >
                        <Undo2 className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Sale Dialog */}
      <Dialog open={showCreate} onOpenChange={open => { if (!open) { setShowCreate(false); setLineItems([]); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Record New Sale</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Customer</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={customerId}
                  onChange={e => setCustomerId(e.target.value)}
                >
                  <option value="">Walk-in customer</option>
                  {customerList.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Payment Method *</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                >
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
                </select>
              </div>
            </div>

            {/* Add Item */}
            <div className="space-y-1.5">
              <Label>Add Item</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value=""
                onChange={e => {
                  const s = stockItems.find((s: any) => s.itemId === Number(e.target.value));
                  if (s) addLineItem(s);
                  e.target.value = "";
                }}
              >
                <option value="">Select item to add...</option>
                {stockItems
                  .filter((s: any) => parseFloat(s.quantity) > 0 && !lineItems.find(l => l.itemId === s.itemId))
                  .map((s: any) => (
                    <option key={s.itemId} value={s.itemId}>{s.itemName} (stock: {parseFloat(s.quantity).toLocaleString()})</option>
                  ))}
              </select>
            </div>

            {/* Line Items */}
            {lineItems.length > 0 && (
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Item</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Qty</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Unit Price</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((l, idx) => (
                      <tr key={l.itemId} className="border-t border-border">
                        <td className="px-3 py-2 font-medium text-xs max-w-[120px]">
                          <span className="truncate block">{l.itemName}</span>
                          <span className="text-muted-foreground">max: {l.availableQty}</span>
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number" min={0.01} step={0.01} max={l.availableQty}
                            value={l.quantity}
                            onChange={e => updateLine(idx, "quantity", e.target.value)}
                            className="h-7 w-20 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number" min={0}
                            value={l.unitPrice}
                            onChange={e => updateLine(idx, "unitPrice", e.target.value)}
                            className="h-7 w-28 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-sm">
                          {fmtRWF((parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0))}
                        </td>
                        <td className="px-3 py-2">
                          <button onClick={() => removeLine(idx)} className="text-muted-foreground hover:text-red-500">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border bg-muted/30">
                      <td colSpan={3} className="px-3 py-2 font-semibold text-right">Total</td>
                      <td className="px-3 py-2 text-right font-bold text-lg text-green-600">{fmtRWF(totalAmount)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {lineItems.length === 0 && (
              <div className="py-6 text-center text-muted-foreground text-sm border-2 border-dashed rounded-xl">
                <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-40" />
                Add items to the sale
              </div>
            )}

            {paymentMethod === "credit" && (
              <div className="p-3 bg-yellow-50 rounded-xl border border-yellow-200 text-sm text-yellow-700">
                ⚠ Credit sale will be recorded as a receivable
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setLineItems([]); }}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={saving || lineItems.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Record Sale — {fmtRWF(totalAmount)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
