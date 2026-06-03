import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api, fmtRWF, fmtDate, fmtDateTime } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Users, Loader2, Eye, Search, Phone, Mail } from "lucide-react";

type Customer = {
  id: number; name: string; contactPerson?: string | null; email?: string | null;
  phone?: string | null; address?: string | null; createdAt?: string | null;
  totalOrders?: number; totalSpent?: string; creditBalance?: string; lastPurchaseDate?: string | null;
};

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
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

export default function CustomersPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: () => api.get("/customers"),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["customers"] });

  const filtered = customers.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) ||
      (c.phone || "").includes(q) ||
      (c.email || "").toLowerCase().includes(q);
  });

  const handleCreate = async (form: any) => {
    setSaving(true);
    try {
      const customer = await api.post<any>("/customers", form);
      toast({ title: `Customer "${customer.name}" added successfully` });
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-sora flex items-center gap-2">
            <Users className="w-6 h-6" /> Customers
          </h1>
          <p className="text-sm text-muted-foreground">Manage your customer database</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90">
          <Plus className="h-4 w-4 mr-2" />Add Customer
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, or email..."
            className="pl-9"
          />
        </div>
        <p className="text-sm text-gray-400">{filtered.length} customers</p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Contact</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Orders</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Total Spent</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Credit Balance</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Last Purchase</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading customers...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-gray-400">
                    <Users className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                    {search ? "No customers match your search" : "No customers yet"}
                  </td>
                </tr>
              ) : filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1A6DB5] to-[#F5A800] flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">{getInitials(c.name)}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-[#0F1A2E]">{c.name}</p>
                        {c.contactPerson && <p className="text-xs text-gray-400">{c.contactPerson}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="space-y-0.5">
                      {c.phone && <p className="text-xs flex items-center gap-1 text-gray-600"><Phone className="w-3 h-3" />{c.phone}</p>}
                      {c.email && <p className="text-xs flex items-center gap-1 text-gray-500"><Mail className="w-3 h-3" />{c.email}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    <span className="font-medium text-gray-700">{c.totalOrders || 0}</span>
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    <span className="font-semibold text-green-700">{fmtRWF(c.totalSpent || "0")}</span>
                  </td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell">
                    {parseFloat(c.creditBalance || "0") > 0 ? (
                      <span className="font-semibold text-red-600">{fmtRWF(c.creditBalance || "0")}</span>
                    ) : (
                      <Badge className="bg-green-100 text-green-700 text-xs">Clear</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs">
                    {c.lastPurchaseDate ? fmtDate(c.lastPurchaseDate) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs"
                        onClick={() => navigate(`/customers/${c.id}`)}>
                        <Eye className="w-3.5 h-3.5" /> Profile
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditCustomer(c)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-600" onClick={() => handleDelete(c.id, c.name)}>
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
