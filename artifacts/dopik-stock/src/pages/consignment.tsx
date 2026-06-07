import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, fmtRWF, fmtDateTime } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeftRight, Plus, Loader2, CheckCircle2, RotateCcw, Trash2, TrendingUp } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  with_seller: "bg-blue-100 text-blue-700",
  returned: "bg-gray-100 text-gray-600",
  sold: "bg-green-100 text-green-700",
};

const STATUS_LABELS: Record<string, string> = {
  with_seller: "With Seller",
  returned: "Returned",
  sold: "Sold",
};

type ConsignmentItem = {
  id: number;
  item_id: number;
  item_name: string;
  category: string;
  seller_name: string;
  seller_phone?: string;
  serialized_unit_id?: number;
  imei_or_serial?: string;
  color?: string;
  storage?: string;
  ram?: string;
  condition?: string;
  cost_price: string;
  sale_price?: string;
  status: string;
  profit?: string;
  notes?: string;
  given_at: string;
  sold_at?: string;
  returned_at?: string;
};

export default function ConsignmentPage() {
  const [showNew, setShowNew] = useState(false);
  const [updateItem, setUpdateItem] = useState<ConsignmentItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: rawItems, isLoading } = useQuery({
    queryKey: ["consignment"],
    queryFn: () => api.get<ConsignmentItem[]>("/consignment"),
  });
  const allItems: ConsignmentItem[] = rawItems ?? [];

  const { data: stockItemsRaw } = useQuery({
    queryKey: ["items"],
    queryFn: () => api.get<any[]>("/items"),
  });
  const stockItems: any[] = (stockItemsRaw as any)?.items ?? stockItemsRaw ?? [];

  const [form, setForm] = useState({
    itemId: "", sellerName: "", sellerPhone: "",
    imeiOrSerial: "", color: "", storage: "", condition: "", costPrice: "", salePrice: "", notes: "",
  });
  const [updateForm, setUpdateForm] = useState({ status: "sold", salePrice: "", notes: "" });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const invalidate = () => qc.invalidateQueries({ queryKey: ["consignment"] });

  const handleCreate = async () => {
    if (!form.itemId || !form.sellerName) {
      toast({ title: "Item and seller name are required", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      await api.post("/consignment", {
        itemId: Number(form.itemId),
        sellerName: form.sellerName,
        sellerPhone: form.sellerPhone || undefined,
        imeiOrSerial: form.imeiOrSerial || undefined,
        color: form.color || undefined,
        storage: form.storage || undefined,
        condition: form.condition || undefined,
        costPrice: form.costPrice ? parseFloat(form.costPrice) : 0,
        salePrice: form.salePrice ? parseFloat(form.salePrice) : undefined,
        notes: form.notes || undefined,
      });
      toast({ title: "Consignment item created" });
      setShowNew(false);
      setForm({ itemId: "", sellerName: "", sellerPhone: "", imeiOrSerial: "", color: "", storage: "", condition: "", costPrice: "", salePrice: "", notes: "" });
      invalidate();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleUpdate = async () => {
    if (!updateItem) return;
    setSaving(true);
    try {
      await api.patch(`/consignment/${updateItem.id}`, {
        status: updateForm.status,
        salePrice: updateForm.salePrice ? parseFloat(updateForm.salePrice) : undefined,
        notes: updateForm.notes || undefined,
      });
      toast({ title: `Marked as ${updateForm.status}` });
      setUpdateItem(null);
      invalidate();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this consignment record?")) return;
    try {
      await api.del(`/consignment/${id}`);
      toast({ title: "Deleted" });
      invalidate();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const filtered = filterStatus === "all" ? allItems : allItems.filter(i => i.status === filterStatus);

  const totalProfit = allItems.filter(i => i.status === "sold").reduce((s, i) => s + parseFloat(i.profit ?? "0"), 0);
  const withSellerCount = allItems.filter(i => i.status === "with_seller").length;
  const soldCount = allItems.filter(i => i.status === "sold").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-sora flex items-center gap-2">
            <ArrowLeftRight className="h-6 w-6 text-[#1A6DB5]" /> Consignment
          </h1>
          <p className="text-sm text-muted-foreground">Track items given to external sellers</p>
        </div>
        <Button onClick={() => setShowNew(true)} className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90">
          <Plus className="h-4 w-4 mr-2" />Assign to Seller
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-panel p-4 text-center">
          <p className="text-xs text-muted-foreground">With Sellers</p>
          <p className="text-2xl font-bold text-blue-600">{withSellerCount}</p>
        </div>
        <div className="glass-panel p-4 text-center">
          <p className="text-xs text-muted-foreground">Sold</p>
          <p className="text-2xl font-bold text-green-600">{soldCount}</p>
        </div>
        <div className="glass-panel p-4 text-center">
          <p className="text-xs text-muted-foreground">Total Profit</p>
          <p className="text-2xl font-bold text-green-600">{fmtRWF(String(totalProfit))}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {["all", "with_seller", "sold", "returned"].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === s ? "bg-[#1A6DB5] text-white" : "bg-white border border-border text-muted-foreground hover:border-[#1A6DB5]"}`}>
            {s === "all" ? "All" : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {["Item", "Seller", "IMEI / Serial", "Cost", "Sale Price", "Profit", "Status", "Date", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {[...Array(9)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}
                </tr>
              )) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">
                  <ArrowLeftRight className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No consignment items yet
                </td></tr>
              ) : filtered.map(item => (
                <tr key={item.id} className="border-b border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="font-medium">{item.item_name ?? `Item #${item.item_id}`}</p>
                    {item.color && <p className="text-xs text-muted-foreground">{item.color}{item.storage ? ` · ${item.storage}` : ""}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{item.seller_name}</p>
                    {item.seller_phone && <p className="text-xs text-muted-foreground">{item.seller_phone}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{item.imei_or_serial ?? "—"}</td>
                  <td className="px-4 py-3 font-mono">{fmtRWF(item.cost_price)}</td>
                  <td className="px-4 py-3 font-mono">{item.sale_price ? fmtRWF(item.sale_price) : "—"}</td>
                  <td className="px-4 py-3">
                    {item.profit != null ? (
                      <span className={`font-semibold ${parseFloat(item.profit) >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {fmtRWF(item.profit)}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs ${STATUS_COLORS[item.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABELS[item.status] ?? item.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(item.given_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {item.status === "with_seller" && (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                          onClick={() => { setUpdateItem(item); setUpdateForm({ status: "sold", salePrice: item.sale_price ?? "", notes: "" }); }}>
                          Update
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500 hover:text-red-600"
                        onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Consignment Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Assign Item to Seller</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Item *</Label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.itemId} onChange={e => set("itemId", e.target.value)}>
                <option value="">Select item...</option>
                {stockItems.map((i: any) => (
                  <option key={i.id ?? i.itemId} value={i.id ?? i.itemId}>
                    {i.itemName ?? i.item_name ?? i.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Seller Name *</Label><Input value={form.sellerName} onChange={e => set("sellerName", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Seller Phone</Label><Input value={form.sellerPhone} onChange={e => set("sellerPhone", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>IMEI / Serial</Label><Input value={form.imeiOrSerial} onChange={e => set("imeiOrSerial", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Color</Label><Input value={form.color} onChange={e => set("color", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Storage</Label><Input value={form.storage} onChange={e => set("storage", e.target.value)} placeholder="e.g. 128GB" /></div>
              <div className="space-y-1.5"><Label>Condition</Label><Input value={form.condition} onChange={e => set("condition", e.target.value)} placeholder="e.g. Brand New" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Cost Price (RWF)</Label><Input type="number" min={0} value={form.costPrice} onChange={e => set("costPrice", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Target Sale Price (RWF)</Label><Input type="number" min={0} value={form.salePrice} onChange={e => set("salePrice", e.target.value)} /></div>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Input value={form.notes} onChange={e => set("notes", e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !form.itemId || !form.sellerName} className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Assign to Seller
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={!!updateItem} onOpenChange={open => !open && setUpdateItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Update Status — {updateItem?.item_name}</DialogTitle></DialogHeader>
          {updateItem && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>New Status</Label>
                <div className="flex gap-2">
                  {["sold", "returned"].map(s => (
                    <button key={s} onClick={() => setUpdateForm(f => ({ ...f, status: s }))}
                      className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-colors ${updateForm.status === s ? "bg-[#1A6DB5] text-white border-[#1A6DB5]" : "border-border hover:border-[#1A6DB5] text-muted-foreground"}`}>
                      {s === "sold" ? <><CheckCircle2 className="h-4 w-4 inline mr-1" />Sold</> : <><RotateCcw className="h-4 w-4 inline mr-1" />Returned</>}
                    </button>
                  ))}
                </div>
              </div>
              {updateForm.status === "sold" && (
                <div className="space-y-1.5">
                  <Label>Actual Sale Price (RWF) *</Label>
                  <Input type="number" min={0} value={updateForm.salePrice}
                    onChange={e => setUpdateForm(f => ({ ...f, salePrice: e.target.value }))} />
                  {updateForm.salePrice && updateItem.cost_price && (
                    <p className="text-xs text-green-600">
                      Profit: <strong>{fmtRWF(String(parseFloat(updateForm.salePrice) - parseFloat(updateItem.cost_price)))}</strong>
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-1.5"><Label>Notes</Label><Input value={updateForm.notes} onChange={e => setUpdateForm(f => ({ ...f, notes: e.target.value }))} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateItem(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={saving || (updateForm.status === "sold" && !updateForm.salePrice)}
              className="bg-green-600 hover:bg-green-700">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {updateForm.status === "sold" ? "Mark as Sold" : "Mark as Returned"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
