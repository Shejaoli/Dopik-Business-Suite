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
import { Scale, Plus, Search, ShieldAlert, Loader2, Undo2, Receipt } from "lucide-react";
import { ReceiptModal } from "@/components/ReceiptModal";

type Sale = {
  id: number;
  customerName?: string | null;
  paymentMethod?: string | null;
  totalAmount?: string | null;
  reverted?: boolean | null;
  createdAt?: string | null;
  items?: { itemName: string; itemId: number; quantity: string }[];
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

export default function SalesHistoryPage() {
  const [search, setSearch] = useState("");
  const [revertSale, setRevertSale] = useState<Sale | null>(null);
  const [receiptSaleId, setReceiptSaleId] = useState<number | null>(null);
  const { data: sales, isLoading } = useListSales({});
  const qc = useQueryClient();
  const saleList: Sale[] = (sales as any) ?? [];

  const filtered = saleList.filter(s =>
    !search || (s.customerName ?? "").toLowerCase().includes(search.toLowerCase())
  );

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
                    <p className="text-gray-400 text-sm">No sales found</p>
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
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-orange-500 hover:text-orange-600 hover:bg-orange-50"
                            onClick={() => setRevertSale(s)} title="Revert sale">
                            <Undo2 className="h-4 w-4" />
                          </Button>
                        )}
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
          onReverted={() => qc.invalidateQueries({ queryKey: getListSalesQueryKey() })} />
      )}

      {receiptSaleId !== null && (
        <ReceiptModal saleId={receiptSaleId} open={receiptSaleId !== null}
          onClose={() => setReceiptSaleId(null)} />
      )}
    </div>
  );
}
