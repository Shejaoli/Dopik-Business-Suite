import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListPurchases, getListPurchasesQueryKey } from "@workspace/api-client-react";
import { ShoppingBag, Pencil, Trash2, Loader2, Search } from "lucide-react";
import { fmtRWF, fmtDate, fmtDateTime, api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CategoryTabs } from "@/components/CategoryTabs";
import { useCategoryTab, matchesSuperCat, SUPER_CATS, type SuperCat } from "@/lib/categories";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "bank", label: "Bank Transfer" },
  { value: "credit", label: "Other" },
];

function EditPurchaseDialog({
  purchase, open, onClose, onSaved,
}: {
  purchase: any; open: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [date, setDate] = useState(
    purchase?.createdAt ? new Date(purchase.createdAt).toISOString().slice(0, 10) : ""
  );
  const [paymentMethod, setPaymentMethod] = useState(purchase?.paymentMethod ?? "cash");
  const [vendorName, setVendorName] = useState(purchase?.vendorName ?? "");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put<any>(`/purchases/${purchase.id}/meta`, {
        paymentMethod,
        date: date || undefined,
        vendorNote: vendorName || undefined,
      });
      toast({ title: "Purchase updated" });
      onSaved();
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" /> Edit Purchase #{purchase?.id}
          </DialogTitle>
          <DialogDescription>Update metadata — stock and balance are not affected.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Payment Method</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
            >
              {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Vendor Note <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
            <Input value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="Vendor name or note…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeletePurchaseDialog({
  purchase, open, onClose, onDeleted,
}: {
  purchase: any; open: boolean; onClose: () => void; onDeleted: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const phrase = `delete purchase #${purchase?.id}`;
  const matches = typed === phrase;

  const handleDelete = async () => {
    if (!matches) return;
    setDeleting(true);
    try {
      await api.delete(`/purchases/${purchase.id}`);
      toast({ title: "Purchase deleted", description: "Stock and balance have been reversed." });
      onDeleted();
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setDeleting(false); setTyped(""); }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setTyped(""); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" /> Delete Purchase #{purchase?.id}
          </DialogTitle>
          <DialogDescription>
            This will permanently delete the purchase record and reverse stock + balance changes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm space-y-1">
            <p className="text-red-700 font-medium">{purchase?.itemName || `Item #${purchase?.itemId}`}</p>
            <p className="text-red-600">
              Qty: {purchase?.quantity} · {fmtRWF(purchase?.totalCost)} · {purchase?.paymentMethod}
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">
              Type <span className="font-mono font-bold bg-gray-100 px-1.5 py-0.5 rounded text-gray-800">{phrase}</span> to confirm:
            </Label>
            <Input
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder={phrase}
              className={`font-mono text-sm ${typed && !matches ? "border-red-300" : typed && matches ? "border-green-400" : ""}`}
              autoFocus
              onKeyDown={e => e.key === "Enter" && matches && handleDelete()}
            />
            {typed && !matches && <p className="text-xs text-red-500">Phrase does not match</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); setTyped(""); }}>Cancel</Button>
          <Button onClick={handleDelete} disabled={!matches || deleting} className="bg-red-600 hover:bg-red-700 text-white">
            {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Delete Purchase
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PurchaseHistoryPage() {
  const [superCat, setSuperCat] = useCategoryTab("purchases");
  const [search, setSearch] = useState("");
  const [editPurchase, setEditPurchase] = useState<any | null>(null);
  const [deletePurchase, setDeletePurchase] = useState<any | null>(null);
  const { data: purchases, isLoading } = useListPurchases();
  const qc = useQueryClient();
  const { toast: _toast } = useToast();

  const allPurchases: any[] = (purchases as any) ?? [];

  const catFiltered = allPurchases.filter(p => matchesSuperCat(p.category ?? "Others", superCat));
  const filtered = catFiltered.filter(p =>
    !search || (p.itemName ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (p.vendorName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const catCounts: Partial<Record<SuperCat, number>> = { all: allPurchases.length };
  for (const sc of SUPER_CATS.filter(c => c.key !== "all")) {
    catCounts[sc.key] = allPurchases.filter(p => matchesSuperCat(p.category ?? "Others", sc.key)).length;
  }

  const totalCost = filtered.reduce((s: number, p: any) => s + parseFloat(p.totalCost ?? "0"), 0);

  const refresh = () => qc.invalidateQueries({ queryKey: getListPurchasesQueryKey() });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Purchase History</h1>
        <p className="text-sm text-gray-400 mt-0.5">All recorded purchase transactions</p>
      </div>

      <CategoryTabs value={superCat} onChange={setSuperCat} counts={catCounts} />

      {superCat !== "all" && (
        <div className="flex items-center gap-4 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl">
          <div>
            <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">
              {SUPER_CATS.find(c => c.key === superCat)?.emoji} {SUPER_CATS.find(c => c.key === superCat)?.label} Purchases
            </p>
            <p className="text-lg font-bold text-blue-800">{fmtRWF(String(totalCost))}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-blue-600">Transactions</p>
            <p className="text-lg font-bold text-blue-800">{filtered.length}</p>
          </div>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by item or vendor..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {["Date", "Item", "Category", "Vendor", "Quantity", "Total", "Payment", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">Loading...</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <ShoppingBag className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">
                      {superCat !== "all" ? `No ${SUPER_CATS.find(c => c.key === superCat)?.label} purchases yet` : "No purchases recorded yet"}
                    </p>
                  </td>
                </tr>
              )}
              {filtered.map((p: any) => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {fmtDate(p.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{p.itemName || `Item #${p.itemId}`}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      {p.category ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.vendorName || "—"}</td>
                  <td className="px-4 py-3 font-mono">{p.quantity}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-gray-800">{fmtRWF(p.totalCost)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 capitalize">
                      {p.paymentMethod}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 w-7 p-0 text-gray-400 hover:text-[#1A6DB5] hover:bg-blue-50"
                        title="Edit metadata"
                        onClick={() => setEditPurchase(p)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                        title="Delete purchase"
                        onClick={() => setDeletePurchase(p)}
                      >
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

      {editPurchase && (
        <EditPurchaseDialog
          purchase={editPurchase}
          open={!!editPurchase}
          onClose={() => setEditPurchase(null)}
          onSaved={refresh}
        />
      )}

      {deletePurchase && (
        <DeletePurchaseDialog
          purchase={deletePurchase}
          open={!!deletePurchase}
          onClose={() => setDeletePurchase(null)}
          onDeleted={refresh}
        />
      )}
    </div>
  );
}
