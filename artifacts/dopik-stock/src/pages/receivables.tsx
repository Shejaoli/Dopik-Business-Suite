import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListReceivables, getListReceivablesQueryKey } from "@workspace/api-client-react";
import { api, fmtRWF, fmtDate, fmtDateTime, statusBadgeColor } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Loader2 } from "lucide-react";

const PAYMENT_METHODS = ["cash", "bank", "mobile_money"];

export default function ReceivablesPage() {
  const [payDialog, setPayDialog] = useState<any>(null);
  const [payForm, setPayForm] = useState({ amount: "", paymentMethod: "cash" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useListReceivables();
  const receivables: any[] = (data as any) ?? [];

  const totalOutstanding = receivables
    .filter(r => r.status !== "paid")
    .reduce((sum, r) => sum + parseFloat(r.remaining ?? "0"), 0);

  const handleCollect = async () => {
    if (!payDialog || !payForm.amount || !payForm.paymentMethod) return;
    setSaving(true);
    try {
      await api.post(`/receivables/${payDialog.id}/payment`, {
        amount: parseFloat(payForm.amount),
        paymentMethod: payForm.paymentMethod,
      });
      toast({ title: "Payment collected" });
      setPayDialog(null);
      setPayForm({ amount: "", paymentMethod: "cash" });
      qc.invalidateQueries({ queryKey: getListReceivablesQueryKey() });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold font-sora">Receivables</h1><p className="text-sm text-muted-foreground">Track credit sales and collections</p></div>
        <div className="glass-panel px-4 py-2 text-right">
          <p className="text-xs text-muted-foreground">Total Outstanding</p>
          <p className="text-lg font-bold text-orange-600">{fmtRWF(totalOutstanding)}</p>
        </div>
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {["#", "Customer", "Items", "Total", "Paid", "Remaining", "Due Date", "Status", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {[...Array(9)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}
                  </tr>
                ))
              ) : receivables.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">
                  <Wallet className="h-8 w-8 mx-auto mb-2 opacity-30" />No receivables
                </td></tr>
              ) : receivables.map(r => (
                <tr key={r.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">#{r.id}</td>
                  <td className="px-4 py-3 font-medium">{r.customerName ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-[140px]">
                    <span className="truncate block">
                      {(r.saleItems ?? []).map((i: any) => `${i.itemName} ×${parseFloat(i.quantity)}`).join(", ") || r.itemName || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold">{fmtRWF(r.totalAmount)}</td>
                  <td className="px-4 py-3 text-green-600">{fmtRWF(r.paidAmount)}</td>
                  <td className="px-4 py-3 font-bold text-orange-600">{fmtRWF(r.remaining)}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(r.dueDate)}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs ${statusBadgeColor(r.status)}`}>{r.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {r.status !== "paid" && (
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white text-xs"
                        onClick={() => { setPayDialog(r); setPayForm({ amount: r.remaining, paymentMethod: "cash" }); }}
                      >
                        Collect
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!payDialog} onOpenChange={open => !open && setPayDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Collect Payment — {payDialog?.customerName ?? "Customer"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 bg-muted rounded-xl text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total:</span><span className="font-medium">{fmtRWF(payDialog?.totalAmount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Collected:</span><span className="font-medium text-green-600">{fmtRWF(payDialog?.paidAmount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Remaining:</span><span className="font-bold text-orange-600">{fmtRWF(payDialog?.remaining)}</span></div>
            </div>
            <div className="space-y-1.5"><Label>Amount (RWF) *</Label><Input type="number" min={0.01} max={parseFloat(payDialog?.remaining ?? "0")} value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>Payment Method *</Label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={payForm.paymentMethod} onChange={e => setPayForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(null)}>Cancel</Button>
            <Button onClick={handleCollect} disabled={saving || !payForm.amount} className="bg-green-600 hover:bg-green-700">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Confirm Collection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
