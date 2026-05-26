import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListItems, getListItemsQueryKey } from "@workspace/api-client-react";
import { api, fmtRWF, fmtDateTime } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Loader2, Package } from "lucide-react";

type Item = {
  id: number; name: string; qtyType: string;
  purchasePrice: string; salePrice: string;
  alternativeItemId?: number | null;
  alternativeItemName?: string | null;
  createdAt?: string | null;
};

const QTY_TYPES = ["unit", "piece", "box", "kg", "litre", "set", "pair", "roll"];

function ItemForm({
  initial, items, onSave, onCancel, loading
}: {
  initial?: Partial<Item>;
  items: Item[];
  onSave: (d: any) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    qtyType: initial?.qtyType ?? "unit",
    purchasePrice: initial?.purchasePrice ?? "",
    salePrice: initial?.salePrice ?? "",
    alternativeItemId: initial?.alternativeItemId ?? "",
  });

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label>Item Name *</Label>
        <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Samsung 65 4K TV" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Qty Type *</Label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={form.qtyType}
            onChange={e => set("qtyType", e.target.value)}
          >
            {QTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Alternative Item</Label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={form.alternativeItemId ?? ""}
            onChange={e => set("alternativeItemId", e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">None</option>
            {items.filter(i => i.id !== initial?.id).map(i => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Purchase Price (RWF) *</Label>
          <Input
            type="number" min={0}
            value={form.purchasePrice}
            onChange={e => set("purchasePrice", e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Sale Price (RWF) *</Label>
          <Input
            type="number" min={0}
            value={form.salePrice}
            onChange={e => set("salePrice", e.target.value)}
            placeholder="0"
          />
        </div>
      </div>
      <DialogFooter className="pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          onClick={() => onSave(form)}
          disabled={loading || !form.name || !form.purchasePrice || !form.salePrice}
          className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function ItemsPage() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useListItems({ search: search || undefined });
  const items: Item[] = (data as any)?.items ?? (Array.isArray(data) ? data : []);

  const invalidate = () => qc.invalidateQueries({ queryKey: getListItemsQueryKey() });

  const handleCreate = async (form: any) => {
    setSaving(true);
    try {
      await api.post("/items", form);
      toast({ title: "Item created" });
      setShowCreate(false);
      invalidate();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleUpdate = async (form: any) => {
    if (!editItem) return;
    setSaving(true);
    try {
      await api.put(`/items/${editItem.id}`, form);
      toast({ title: "Item updated" });
      setEditItem(null);
      invalidate();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const margin = (item: Item) => {
    const p = parseFloat(item.purchasePrice);
    const s = parseFloat(item.salePrice);
    if (!p || !s) return "—";
    return `${(((s - p) / p) * 100).toFixed(1)}%`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-sora">Items</h1>
          <p className="text-sm text-muted-foreground">Manage your product catalog</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90 self-start sm:self-auto">
          <Plus className="h-4 w-4 mr-2" />Add Item
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search items..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {["Name", "Qty Type", "Purchase Price", "Sale Price", "Margin", "Alternative", "Added"].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-muted animate-pulse rounded w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No items found
                  </td>
                </tr>
              ) : items.map(item => (
                <tr key={item.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium max-w-[200px]">
                    <span className="truncate block">{item.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">{item.qtyType}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtRWF(item.purchasePrice)}</td>
                  <td className="px-4 py-3 font-medium">{fmtRWF(item.salePrice)}</td>
                  <td className="px-4 py-3">
                    <Badge className="bg-green-100 text-green-700 text-xs">{margin(item)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-[120px]">
                    <span className="truncate block">{item.alternativeItemName ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                    {fmtDateTime(item.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setEditItem(item)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Item</DialogTitle></DialogHeader>
          <ItemForm items={items} onSave={handleCreate} onCancel={() => setShowCreate(false)} loading={saving} />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={open => !open && setEditItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Item</DialogTitle></DialogHeader>
          {editItem && (
            <ItemForm
              initial={editItem}
              items={items}
              onSave={handleUpdate}
              onCancel={() => setEditItem(null)}
              loading={saving}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
