import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListCustomers, getListCustomersQueryKey } from "@workspace/api-client-react";
import { api, fmtDateTime } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Users, Loader2 } from "lucide-react";

type Customer = { id: number; name: string; contactPerson?: string | null; email?: string | null; phone?: string | null; address?: string | null; createdAt?: string | null };

function CustomerForm({ initial, onSave, onCancel, loading }: {
  initial?: Partial<Customer>; onSave: (d: any) => void; onCancel: () => void; loading: boolean;
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
      <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} /></div>
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

export default function CustomersPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useListCustomers();
  const customers: Customer[] = (data as any) ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: getListCustomersQueryKey() });

  const handleCreate = async (form: any) => {
    setSaving(true);
    try {
      await api.post("/customers", form);
      toast({ title: "Customer added" });
      setShowCreate(false);
      invalidate();
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (form: any) => {
    if (!editCustomer) return;
    setSaving(true);
    try {
      await api.put(`/customers/${editCustomer.id}`, form);
      toast({ title: "Customer updated" });
      setEditCustomer(null);
      invalidate();
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete customer "${name}"?`)) return;
    try {
      await api.del(`/customers/${id}`);
      toast({ title: "Customer deleted" });
      invalidate();
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold font-sora">Customers</h1><p className="text-sm text-muted-foreground">Manage your customer accounts</p></div>
        <Button onClick={() => setShowCreate(true)} className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90"><Plus className="h-4 w-4 mr-2" />Add Customer</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? [...Array(6)].map((_, i) => (
          <div key={i} className="glass-panel p-5"><div className="space-y-2">{[...Array(4)].map((_, j) => <div key={j} className="h-4 bg-muted animate-pulse rounded" />)}</div></div>
        )) : customers.length === 0 ? (
          <div className="col-span-full glass-panel p-12 text-center text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />No customers yet
          </div>
        ) : customers.map(c => (
          <div key={c.id} className="glass-panel p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#F5A800]/10 flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 text-[#F5A800]" />
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditCustomer(c)}><Edit className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(c.id, c.name)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            <h3 className="font-semibold font-sora mb-1">{c.name}</h3>
            {c.contactPerson && <p className="text-sm text-muted-foreground">{c.contactPerson}</p>}
            {c.phone && <p className="text-sm text-muted-foreground">{c.phone}</p>}
            {c.email && <p className="text-sm text-muted-foreground truncate">{c.email}</p>}
            <p className="text-xs text-muted-foreground mt-2">Added {fmtDateTime(c.createdAt)}</p>
          </div>
        ))}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent><DialogHeader><DialogTitle>Add Customer</DialogTitle></DialogHeader>
          <CustomerForm onSave={handleCreate} onCancel={() => setShowCreate(false)} loading={saving} />
        </DialogContent>
      </Dialog>
      <Dialog open={!!editCustomer} onOpenChange={open => !open && setEditCustomer(null)}>
        <DialogContent><DialogHeader><DialogTitle>Edit Customer</DialogTitle></DialogHeader>
          {editCustomer && <CustomerForm initial={editCustomer} onSave={handleUpdate} onCancel={() => setEditCustomer(null)} loading={saving} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
