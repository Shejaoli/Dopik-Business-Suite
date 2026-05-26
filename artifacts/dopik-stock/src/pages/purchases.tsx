import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListPurchases, useListVendors, useListStock, getListPurchasesQueryKey } from "@workspace/api-client-react";
import { api, fmtRWF, fmtDateTime, paymentBadgeColor } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, ShoppingCart, Loader2 } from "lucide-react";

const PAYMENT_METHODS = ["cash", "bank", "mobile_money", "credit"];

export default function PurchasesPage() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    itemId: "", quantity: "", totalCost: "", vendorId: "", paymentMethod: "cash",
  });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useListPurchases({});
  const { data: vendors } = useListVendors();
  const { data: stock } = useListStock({});
  const purchases: any[] = (data as any) ?? [];
  const vendorList: any[] = (vendors as any) ?? [];
  const stockItems: any[] = (stock as any) ?? [];

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.itemId || !form.quantity || !form.totalCost || !form.paymentMethod) return;
    setSaving(true);
    try {
      await api.post("/purchases", {
        itemId: Number(form.itemId),
        quantity: parseFloat(form.quantity),
        totalCost: parseFloat(form.totalCost),
        vendorId: form.vendorId ? Number(form.vendorId) : null,
        paymentMethod: form.paymentMethod,
      });
      toast({ title: "Purchase recorded" });
      setShowCreate(false);
      setForm({ itemId: "", quantity: "", totalCost: "", vendorId: "", paymentMethod: "cash" });
      qc.invalidateQueries({ queryKey: getListPurchasesQueryKey() });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const filtered = purchases.filter(p =>
    !search || (p.itemName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-sora">Purchases</h1>
          <p className="text-sm text-muted-foreground">Record stock purchases from vendors</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90 self-start sm:self-auto">
          <Plus className="h-4 w-4 mr-2" />New Purchase
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by item..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {["#", "Item", "Quantity", "Total Cost", "Vendor", "Payment", "Date"].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">
                  <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-30" />No purchases found
                </td></tr>
              ) : filtered.map(p => (
                <tr key={p.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">#{p.id}</td>
                  <td className="px-4 py-3 font-medium max-w-[180px]"><span className="truncate block">{p.itemName}</span></td>
                  <td className="px-4 py-3">{parseFloat(p.quantity).toLocaleString()} {p.qtyType}</td>
                  <td className="px-4 py-3 font-semibold">{fmtRWF(p.totalCost)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.vendorName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs ${paymentBadgeColor(p.paymentMethod)}`}>
                      {p.paymentMethod?.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmtDateTime(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record New Purchase</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Item *</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.itemId}
                onChange={e => set("itemId", e.target.value)}
              >
                <option value="">Select item...</option>
                {stockItems.map((s: any) => (
                  <option key={s.itemId} value={s.itemId}>{s.itemName} (in stock: {parseFloat(s.quantity).toLocaleString()})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Quantity *</Label>
                <Input type="number" min={0.01} step={0.01} value={form.quantity} onChange={e => set("quantity", e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Total Cost (RWF) *</Label>
                <Input type="number" min={0} value={form.totalCost} onChange={e => set("totalCost", e.target.value)} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Vendor</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.vendorId}
                  onChange={e => set("vendorId", e.target.value)}
                >
                  <option value="">Select vendor...</option>
                  {vendorList.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Payment Method *</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.paymentMethod}
                  onChange={e => set("paymentMethod", e.target.value)}
                >
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
                </select>
              </div>
            </div>
            {form.paymentMethod === "credit" && (
              <div className="p-3 bg-yellow-50 rounded-xl border border-yellow-200 text-sm text-yellow-700">
                ⚠ Credit purchase will be recorded as a payable
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={saving || !form.itemId || !form.quantity || !form.totalCost}
              className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Record Purchase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
