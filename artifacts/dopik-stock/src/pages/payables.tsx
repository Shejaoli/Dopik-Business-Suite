import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListPayables, getListPayablesQueryKey } from "@workspace/api-client-react";
import { api, fmtRWF, fmtDate, fmtDateTime, statusBadgeColor, paymentBadgeColor } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Loader2 } from "lucide-react";

const PAYMENT_METHODS = ["cash", "bank", "mobile_money"];

export default function PayablesPage() {
  const [payDialog, setPayDialog] = useState<any>(null);
  const [payForm, setPayForm] = useState({ amount: "", paymentMethod: "cash" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useListPayables();
  const payables: any[] = (data as any) ?? [];

  const totalOutstanding = payables
    .filter(p => p.status !== "paid")
    .reduce((sum, p) => sum + parseFloat(p.remaining ?? "0"), 0);

  const handlePay = async () => {
    if (!payDialog || !payForm.amount || !payForm.paymentMethod) return;
    setSaving(true);
    try {
      await api.post(`/payables/${payDialog.id}/payment`, {
        amount: parseFloat(payForm.amount),
        paymentMethod: payForm.paymentMethod,
      });
      toast({ title: "Payment recorded" });
      setPayDialog(null);
      setPayForm({ amount: "", paymentMethod: "cash" });
      qc.invalidateQueries({ queryKey: getListPayablesQueryKey() });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold font-sora">Payables</h1><p className="text-sm text-muted-foreground">Track outstanding vendor payments</p></div>
        <div className="glass-panel px-4 py-2 text-right">
          <p className="text-xs text-muted-foreground">Total Outstanding</p>
          <p className="text-lg font-bold text-red-600">{fmtRWF(totalOutstanding)}</p>
        </div>
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {["#", "Item", "Vendor", "Total", "Paid", "Remaining", "Due Date", "Status", ""].map(h => (
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
              ) : payables.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">
                  <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-30" />No payables
                </td></tr>
              ) : payables.map(p => (
                <tr key={p.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">#{p.id}</td>
                  <td className="px-4 py-3 font-medium max-w-[140px]"><span className="truncate block">{p.itemName ?? "—"}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{p.vendorName ?? "—"}</td>
                  <td className="px-4 py-3 font-semibold">{fmtRWF(p.totalAmount)}</td>
                  <td className="px-4 py-3 text-green-600">{fmtRWF(p.paidAmount)}</td>
                  <td className="px-4 py-3 font-bold text-red-600">{fmtRWF(p.remaining)}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(p.dueDate)}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs ${statusBadgeColor(p.status)}`}>{p.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {p.status !== "paid" && (
                      <Button
                        size="sm"
                        className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90 text-white text-xs"
                        onClick={() => { setPayDialog(p); setPayForm({ amount: p.remaining, paymentMethod: "cash" }); }}
                      >
                        Pay
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
          <DialogHeader><DialogTitle>Record Payment — {payDialog?.vendorName ?? payDialog?.itemName}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 bg-muted rounded-xl text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total:</span><span className="font-medium">{fmtRWF(payDialog?.totalAmount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Paid:</span><span className="font-medium text-green-600">{fmtRWF(payDialog?.paidAmount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Remaining:</span><span className="font-bold text-red-600">{fmtRWF(payDialog?.remaining)}</span></div>
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
            <Button onClick={handlePay} disabled={saving || !payForm.amount} className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
