import { useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useListCustomers, getListCustomersQueryKey } from "@workspace/api-client-react";
import { api, fmtDateTime, fmtCurrency } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Users, Loader2, ShoppingBag, HandCoins } from "lucide-react";

type Customer = { id: number; name: string; contactPerson?: string | null; email?: string | null; phone?: string | null; address?: string | null; createdAt?: string | null };
type CustomerSummary = { totalSpent: number; totalLoan: number; totalLoanPaid: number; activeLoans: number };

function useCustomerSummary(customerId: number) {
  return useQuery<CustomerSummary>({
    queryKey: ["customer-summary", customerId],
    queryFn: () => api.get(`/customers/${customerId}/summary`),
  });
}

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

function CustomerCard({ c, onEdit, onDelete }: { c: Customer; onEdit: () => void; onDelete: () => void }) {
  const { data: summary } = useCustomerSummary(c.id);
  const hasLoan = (summary?.activeLoans ?? 0) > 0;
  const outstanding = (summary?.totalLoan ?? 0) - (summary?.totalLoanPaid ?? 0);

  return (
    <div className="glass-panel p-5 hover:shadow-md transition-shadow flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl bg-[#F5A800]/10 flex items-center justify-center flex-shrink-0">
          <Users className="h-5 w-5 text-[#F5A800]" />
        </div>
        <div className="flex items-center gap-1">
          {hasLoan && (
            <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-[11px]">
              <HandCoins className="h-3 w-3 mr-1" />On Loan
            </Badge>
          )}
          <Button size="sm" variant="ghost" onClick={onEdit}><Edit className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      <div>
        <h3 className="font-semibold font-sora">{c.name}</h3>
        {c.contactPerson && <p className="text-sm text-muted-foreground">{c.contactPerson}</p>}
        {c.phone && <p className="text-sm text-muted-foreground">{c.phone}</p>}
        {c.email && <p className="text-sm text-muted-foreground truncate">{c.email}</p>}
      </div>

      {summary && (
        <div className="border-t pt-3 grid grid-cols-2 gap-2">
          <div className="text-center p-2 bg-blue-50 rounded-lg">
            <ShoppingBag className="h-3.5 w-3.5 text-blue-500 mx-auto mb-0.5" />
            <p className="text-xs text-muted-foreground">Total Spent</p>
            <p className="text-sm font-bold text-blue-700">{fmtCurrency(summary.totalSpent)}</p>
          </div>
          <div className={`text-center p-2 rounded-lg ${hasLoan ? "bg-amber-50" : "bg-green-50"}`}>
            <HandCoins className={`h-3.5 w-3.5 mx-auto mb-0.5 ${hasLoan ? "text-amber-500" : "text-green-500"}`} />
            <p className="text-xs text-muted-foreground">Loan Balance</p>
            <p className={`text-sm font-bold ${hasLoan ? "text-amber-700" : "text-green-700"}`}>
              {hasLoan ? fmtCurrency(outstanding) : "Clear"}
            </p>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">Added {fmtDateTime(c.createdAt)}</p>
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
          <CustomerCard
            key={c.id}
            c={c}
            onEdit={() => setEditCustomer(c)}
            onDelete={() => handleDelete(c.id, c.name)}
          />
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
