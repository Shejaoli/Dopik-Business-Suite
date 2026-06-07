import { useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useListVendors, getListVendorsQueryKey } from "@workspace/api-client-react";
import { api, fmtDateTime, fmtRWF } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Building2, Loader2, ShoppingBag, X } from "lucide-react";

type Vendor = {
  id: number; name: string; contactPerson?: string | null; email?: string | null;
  phone?: string | null; address?: string | null; createdAt?: string | null;
  totalPurchases?: string; purchaseCount?: number;
};

function VendorForm({ initial, onSave, onCancel, loading }: {
  initial?: Partial<Vendor>; onSave: (d: any) => void; onCancel: () => void; loading: boolean;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    contactPerson: initial?.contactPerson ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    address: initial?.address ?? "",
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1.5"><Label>Company Name *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Contact Person</Label><Input value={form.contactPerson} onChange={e => set("contactPerson", e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={e => set("phone", e.target.value)} /></div>
      </div>
      <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={e => set("email", e.target.value)} /></div>
      <div className="space-y-1.5"><Label>Address</Label><Input value={form.address} onChange={e => set("address", e.target.value)} /></div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(form)} disabled={loading || !form.name} className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90">
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save
        </Button>
      </DialogFooter>
    </div>
  );
}

function VendorDetail({ vendor, onClose }: { vendor: Vendor; onClose: () => void }) {
  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ["vendor-purchases", vendor.id],
    queryFn: () => api.get<any[]>(`/vendors/${vendor.id}/purchases`),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        {vendor.contactPerson && <div><p className="text-xs text-muted-foreground">Contact</p><p className="font-medium">{vendor.contactPerson}</p></div>}
        {vendor.phone && <div><p className="text-xs text-muted-foreground">Phone</p><p className="font-medium">{vendor.phone}</p></div>}
        {vendor.email && <div><p className="text-xs text-muted-foreground">Email</p><p className="font-medium">{vendor.email}</p></div>}
        {vendor.address && <div><p className="text-xs text-muted-foreground">Address</p><p className="font-medium">{vendor.address}</p></div>}
      </div>
      <div className="flex gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex-1 text-center">
          <p className="text-xs text-muted-foreground">Total Spent</p>
          <p className="font-bold text-green-700 text-lg">{fmtRWF(vendor.totalPurchases ?? "0")}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex-1 text-center">
          <p className="text-xs text-muted-foreground">Purchases</p>
          <p className="font-bold text-blue-700 text-lg">{vendor.purchaseCount ?? 0}</p>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Recent Purchases</p>
        {isLoading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-8 bg-muted animate-pulse rounded" />)}</div>
        ) : (purchases as any[]).length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No purchases from this vendor yet</p>
        ) : (
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {(purchases as any[]).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                <div>
                  <span className="font-medium">{p.itemName ?? `Item #${p.itemId}`}</span>
                  <span className="text-xs text-muted-foreground ml-2">qty: {parseFloat(p.quantity).toLocaleString()}</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{fmtRWF(p.totalCost)}</p>
                  <p className="text-xs text-muted-foreground">{fmtDateTime(p.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Close</Button>
      </DialogFooter>
    </div>
  );
}

export default function VendorsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [editVendor, setEditVendor] = useState<Vendor | null>(null);
  const [detailVendor, setDetailVendor] = useState<Vendor | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useListVendors();
  const vendors: Vendor[] = (data as any) ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: getListVendorsQueryKey() });

  const handleCreate = async (form: any) => {
    setSaving(true);
    try {
      await api.post("/vendors", form);
      toast({ title: "Vendor added" });
      setShowCreate(false);
      invalidate();
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (form: any) => {
    if (!editVendor) return;
    setSaving(true);
    try {
      await api.put(`/vendors/${editVendor.id}`, form);
      toast({ title: "Vendor updated" });
      setEditVendor(null);
      invalidate();
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete vendor "${name}"?`)) return;
    try {
      await api.del(`/vendors/${id}`);
      toast({ title: "Vendor deleted" });
      invalidate();
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold font-sora">Vendors</h1><p className="text-sm text-muted-foreground">Manage your suppliers and purchase history</p></div>
        <Button onClick={() => setShowCreate(true)} className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90"><Plus className="h-4 w-4 mr-2" />Add Vendor</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? [...Array(6)].map((_, i) => (
          <div key={i} className="glass-panel p-5"><div className="space-y-2">{[...Array(4)].map((_, j) => <div key={j} className="h-4 bg-muted animate-pulse rounded" />)}</div></div>
        )) : vendors.length === 0 ? (
          <div className="col-span-full glass-panel p-12 text-center text-muted-foreground">
            <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />No vendors yet
          </div>
        ) : vendors.map(v => (
          <div
            key={v.id}
            className="glass-panel p-5 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setDetailVendor(v)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#1A6DB5]/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="h-5 w-5 text-[#1A6DB5]" />
              </div>
              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                <Button size="sm" variant="ghost" onClick={() => setEditVendor(v)}><Edit className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(v.id, v.name)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            <h3 className="font-semibold font-sora mb-1">{v.name}</h3>
            {v.contactPerson && <p className="text-sm text-muted-foreground">{v.contactPerson}</p>}
            {v.phone && <p className="text-sm text-muted-foreground">{v.phone}</p>}
            {v.email && <p className="text-sm text-muted-foreground truncate">{v.email}</p>}
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{v.purchaseCount ?? 0} purchases</span>
              </div>
              <span className="text-sm font-bold text-green-600">{fmtRWF(v.totalPurchases ?? "0")}</span>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent><DialogHeader><DialogTitle>Add Vendor</DialogTitle></DialogHeader>
          <VendorForm onSave={handleCreate} onCancel={() => setShowCreate(false)} loading={saving} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editVendor} onOpenChange={open => !open && setEditVendor(null)}>
        <DialogContent><DialogHeader><DialogTitle>Edit Vendor</DialogTitle></DialogHeader>
          {editVendor && <VendorForm initial={editVendor} onSave={handleUpdate} onCancel={() => setEditVendor(null)} loading={saving} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailVendor} onOpenChange={open => !open && setDetailVendor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#1A6DB5]" />
              {detailVendor?.name}
            </DialogTitle>
          </DialogHeader>
          {detailVendor && <VendorDetail vendor={detailVendor} onClose={() => setDetailVendor(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
