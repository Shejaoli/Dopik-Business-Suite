import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useListSales, getListSalesQueryKey } from "@workspace/api-client-react";
import { fmtRWF, fmtDateTime, api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Scale, Plus, Search, ShieldAlert, Loader2, Undo2, Receipt, Pencil, Trash2 } from "lucide-react";
import { ReceiptModal } from "@/components/ReceiptModal";
import { CategoryTabs } from "@/components/CategoryTabs";
import { useCategoryTab, matchesSuperCat, SUPER_CATS, type SuperCat } from "@/lib/categories";

type SaleItem = {
  itemName: string; itemId: number; quantity: string; category?: string;
};

type Sale = {
  id: number;
  customerName?: string | null;
  paymentMethod?: string | null;
  totalAmount?: string | null;
  reverted?: boolean | null;
  createdAt?: string | null;
  items?: SaleItem[];
};

function paymentBadge(m: string | null | undefined) {
  switch ((m || "").toLowerCase()) {
    case "cash": return "bg-green-100 text-green-800";
    case "mobile_money": return "bg-blue-100 text-blue-800";
    case "bank": return "bg-teal-100 text-teal-800";
    case "credit": return "bg-amber-100 text-amber-800";
    case "split": return "bg-purple-100 text-purple-800";
    default: return "bg-gray-100 text-gray-700";
  }
}

function paymentLabel(m: string | null | undefined) {
  const map: Record<string, string> = {
    cash: "Cash", mobile_money: "MoMo", bank: "Bank Transfer",
    credit: "Credit", split: "Split",
  };
  return map[(m || "").toLowerCase()] || (m || "—");
}

function statusBadge(sale: Sale) {
  if (sale.reverted) return { cls: "bg-red-100 text-red-700", label: "Reverted" };
  if (sale.paymentMethod?.toLowerCase() === "credit") return { cls: "bg-amber-100 text-amber-700", label: "Credit Pending" };
  return { cls: "bg-green-100 text-green-700", label: "Completed" };
}

function revertPhrase(sale: Sale) { return `sudo revert sale #${sale.id}`; }

function RevertDialog({ sale, open, onClose, onReverted }: {
  sale: Sale; open: boolean; onClose: () => void; onReverted: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [reverting, setReverting] = useState(false);
  const { toast } = useToast();
  const phrase = revertPhrase(sale);
  const matches = typed === phrase;

  const handleRevert = async () => {
    if (!matches) return;
    setReverting(true);
    try {
      await api.post(`/sales/${sale.id}/revert`);
      toast({ title: "Sale reverted", description: "Stock has been restored." });
      onReverted();
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setReverting(false); setTyped(""); }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setTyped(""); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <ShieldAlert className="h-5 w-5" /> Confirm Revert Sale
          </DialogTitle>
          <DialogDescription>This will reverse the sale and restore all stock. This action cannot be undone.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm space-y-1">
            <p className="text-red-700 font-medium">Sale #{sale.id} — {sale.customerName ?? "Walk-in"}</p>
            <p className="text-red-600">{fmtRWF(sale.totalAmount)} · {(sale.items ?? []).map(i => i.itemName).join(", ") || "—"}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">
              Type <span className="font-mono font-bold bg-gray-100 px-1.5 py-0.5 rounded text-gray-800">{phrase}</span> to confirm:
            </Label>
            <Input value={typed} onChange={e => setTyped(e.target.value)} placeholder={phrase}
              className={`font-mono text-sm ${typed && !matches ? "border-red-300" : typed && matches ? "border-green-400" : ""}`}
              autoFocus onKeyDown={e => e.key === "Enter" && matches && handleRevert()} />
            {typed && !matches && <p className="text-xs text-red-500">Phrase does not match</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); setTyped(""); }}>Cancel</Button>
          <Button onClick={handleRevert} disabled={!matches || reverting} className="bg-red-600 hover:bg-red-700 text-white">
            {reverting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Confirm Revert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "bank", label: "Bank Transfer" },
  { value: "credit", label: "Credit" },
  { value: "split", label: "Split" },
];

function EditSaleDialog({ sale, open, onClose, onSaved }: {
  sale: Sale; open: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [customerName, setCustomerName] = useState(sale.customerName ?? "");
  const [paymentMethod, setPaymentMethod] = useState(sale.paymentMethod ?? "cash");
  const [date, setDate] = useState(
    sale.createdAt ? new Date(sale.createdAt).toISOString().slice(0, 10) : ""
  );
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch<any>(`/sales/${sale.id}`, {
        customerName: customerName || null,
        paymentMethod,
        date: date || undefined,
      });
      toast({ title: "Sale updated" });
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
            <Pencil className="h-4 w-4" /> Edit Sale #{sale.id}
          </DialogTitle>
          <DialogDescription>Update sale metadata. Stock quantities and amounts are not changed.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>Customer Name</Label>
            <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Walk-in (leave blank)" />
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
            <Label>Date</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
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

function DeleteSaleDialog({ sale, open, onClose, onDeleted }: {
  sale: Sale; open: boolean; onClose: () => void; onDeleted: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const phrase = `delete sale #${sale.id}`;
  const matches = typed === phrase;

  const handleDelete = async () => {
    if (!matches) return;
    setDeleting(true);
    try {
      await api.delete(`/sales/${sale.id}`);
      toast({ title: "Sale deleted", description: "Stock and balance have been reversed." });
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
            <Trash2 className="h-5 w-5" /> Delete Sale #{sale.id}
          </DialogTitle>
          <DialogDescription>
            This permanently removes the sale and reverses all stock and balance changes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm space-y-1">
            <p className="text-red-700 font-medium">Sale #{sale.id} — {sale.customerName ?? "Walk-in"}</p>
            <p className="text-red-600">
              {fmtRWF(sale.totalAmount)} · {(sale.items ?? []).map(i => i.itemName).join(", ") || "—"}
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
            {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Delete Sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SalesHistoryPage() {
  const [search, setSearch] = useState("");
  const [superCat, setSuperCat] = useCategoryTab("sales");
  const [revertSale, setRevertSale] = useState<Sale | null>(null);
  const [editSale, setEditSale] = useState<Sale | null>(null);
  const [deleteSale, setDeleteSale] = useState<Sale | null>(null);
  const [receiptSaleId, setReceiptSaleId] = useState<number | null>(null);
  const { data: sales, isLoading } = useListSales({});
  const qc = useQueryClient();
  const allSales: Sale[] = (sales as any) ?? [];

  const saleMatchesCat = (s: Sale): boolean => {
    if (superCat === "all") return true;
    const items = s.items ?? [];
    if (items.length === 0) return false;
    return items.some(i => matchesSuperCat(i.category ?? "Others", superCat));
  };

  const catFiltered = allSales.filter(saleMatchesCat);
  const filtered = catFiltered.filter(s =>
    !search || (s.customerName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const catCounts: Partial<Record<SuperCat, number>> = { all: allSales.length };
  for (const sc of SUPER_CATS.filter(c => c.key !== "all")) {
    catCounts[sc.key] = allSales.filter(s =>
      (s.items ?? []).some(i => matchesSuperCat(i.category ?? "Others", sc.key))
    ).length;
  }

  const totalRevenue = filtered.reduce((s, sale) => s + parseFloat(sale.totalAmount ?? "0"), 0);

  const refresh = () => qc.invalidateQueries({ queryKey: getListSalesQueryKey() });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Sales History</h1>
          <p className="text-sm text-gray-400 mt-0.5">All recorded sales transactions</p>
        </div>
        <Link href="/multi-sale">
          <Button className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90 self-start sm:self-auto">
            <Plus className="h-4 w-4 mr-2" /> New Sale
          </Button>
        </Link>
      </div>

      <CategoryTabs value={superCat} onChange={setSuperCat} counts={catCounts} />

      {superCat !== "all" && (
        <div className="flex items-center gap-4 px-4 py-3 bg-green-50 border border-green-100 rounded-xl">
          <div>
            <p className="text-xs text-green-600 font-medium uppercase tracking-wide">
              {SUPER_CATS.find(c => c.key === superCat)?.emoji} {SUPER_CATS.find(c => c.key === superCat)?.label} Revenue
            </p>
            <p className="text-lg font-bold text-green-800">{fmtRWF(String(totalRevenue))}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-green-600">Sales</p>
            <p className="text-lg font-bold text-green-800">{filtered.length}</p>
          </div>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by customer..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {["#", "Customer", "Items Summary", "Total", "Payment", "Status", "Date", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    {[...Array(8)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 animate-pulse rounded" /></td>)}
                  </tr>
                ))
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <Scale className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">
                      {superCat !== "all" ? `No ${SUPER_CATS.find(c => c.key === superCat)?.label} sales found` : "No sales found"}
                    </p>
                  </td>
                </tr>
              )}
              {filtered.map(s => {
                const sb = statusBadge(s);
                const itemSummary = (s.items ?? []).map(i => `${i.itemName} ×${parseFloat(i.quantity as string)}`).join(", ");
                return (
                  <tr key={s.id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${s.reverted ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3 text-gray-400 text-xs">#{s.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{s.customerName || "Walk-in"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[180px]">
                      <span className="truncate block">{itemSummary || "—"}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-green-600 font-mono whitespace-nowrap">{fmtRWF(s.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs ${paymentBadge(s.paymentMethod)}`}>
                        {paymentLabel(s.paymentMethod)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs ${sb.cls}`}>{sb.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{fmtDateTime(s.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {!s.reverted && (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-[#1A6DB5] hover:bg-blue-50 gap-1"
                            onClick={() => setReceiptSaleId(s.id)} title="View receipt">
                            <Receipt className="h-3.5 w-3.5" />
                            <span className="text-xs hidden sm:inline">Receipt</span>
                          </Button>
                        )}
                        {!s.reverted && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-[#1A6DB5] hover:bg-blue-50"
                            onClick={() => setEditSale(s)} title="Edit sale">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {!s.reverted && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-orange-500 hover:text-orange-600 hover:bg-orange-50"
                            onClick={() => setRevertSale(s)} title="Revert sale">
                            <Undo2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteSale(s)} title="Delete sale">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {revertSale && (
        <RevertDialog sale={revertSale} open={!!revertSale} onClose={() => setRevertSale(null)}
          onReverted={refresh} />
      )}

      {editSale && (
        <EditSaleDialog sale={editSale} open={!!editSale} onClose={() => setEditSale(null)}
          onSaved={refresh} />
      )}

      {deleteSale && (
        <DeleteSaleDialog sale={deleteSale} open={!!deleteSale} onClose={() => setDeleteSale(null)}
          onDeleted={refresh} />
      )}

      {receiptSaleId !== null && (
        <ReceiptModal saleId={receiptSaleId} open={receiptSaleId !== null}
          onClose={() => setReceiptSaleId(null)} />
      )}
    </div>
  );
}
