import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListCustomers } from "@workspace/api-client-react";
import { api, fmtDate, fmtCurrency } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Plus, Loader2, HandCoins, ChevronDown, ChevronUp, Banknote, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Loan = {
  id: number;
  customerId: number;
  customerName: string | null;
  amount: string;
  paidAmount: string;
  description: string | null;
  dueDate: string | null;
  status: string | null;
  createdAt: string | null;
  payments?: LoanPayment[];
};
type LoanPayment = {
  id: number;
  loanId: number;
  amount: string;
  paymentMethod: string | null;
  note: string | null;
  paidAt: string | null;
};

function useLoans() {
  return useQuery<Loan[]>({
    queryKey: ["loans"],
    queryFn: () => api.get("/loans"),
  });
}

function useCustomerSummary(customerId: number | null) {
  return useQuery({
    queryKey: ["customer-summary", customerId],
    queryFn: () => api.get(`/customers/${customerId}/summary`),
    enabled: !!customerId,
  });
}

function NewLoanDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { data: customersData } = useListCustomers();
  const customers: any[] = (customersData as any) ?? [];
  const [form, setForm] = useState({ customerId: "", amount: "", description: "", dueDate: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.customerId || !form.amount) {
      toast({ title: "Customer and amount are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await api.post("/loans", {
        customerId: Number(form.customerId),
        amount: form.amount,
        description: form.description || null,
        dueDate: form.dueDate || null,
      });
      toast({ title: "Loan recorded" });
      setForm({ customerId: "", amount: "", description: "", dueDate: "" });
      onCreated();
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record New Loan</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Customer *</Label>
            <Select value={form.customerId} onValueChange={v => set("customerId", v)}>
              <SelectTrigger><SelectValue placeholder="Select customer..." /></SelectTrigger>
              <SelectContent>
                {customers.map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Loan Amount *</Label>
            <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={e => set("amount", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input placeholder="What is this loan for?" value={form.description} onChange={e => set("description", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Due Date</Label>
            <Input type="date" value={form.dueDate} onChange={e => set("dueDate", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save Loan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({ loan, open, onClose, onPaid }: { loan: Loan; open: boolean; onClose: () => void; onPaid: () => void }) {
  const [form, setForm] = useState({ amount: "", paymentMethod: "cash", note: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const remaining = parseFloat(loan.amount) - parseFloat(loan.paidAmount);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.amount) return;
    setSaving(true);
    try {
      await api.post(`/loans/${loan.id}/payments`, {
        amount: form.amount,
        paymentMethod: form.paymentMethod,
        note: form.note || null,
      });
      toast({ title: "Payment recorded" });
      setForm({ amount: "", paymentMethod: "cash", note: "" });
      onPaid();
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record Payment — {loan.customerName}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="p-3 bg-amber-50 rounded-lg text-sm text-amber-800">
            <span className="font-medium">Outstanding:</span> {fmtCurrency(remaining)}
          </div>
          <div className="space-y-1.5">
            <Label>Payment Amount *</Label>
            <Input type="number" min="0.01" step="0.01" max={remaining} placeholder="0.00" value={form.amount} onChange={e => set("amount", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Payment Method</Label>
            <Select value={form.paymentMethod} onValueChange={v => set("paymentMethod", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="mobile_money">Mobile Money</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Note</Label>
            <Input placeholder="Optional note..." value={form.note} onChange={e => set("note", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.amount} className="bg-green-600 hover:bg-green-700 text-white">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Record Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LoanCard({ loan, onRefresh }: { loan: Loan; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [paying, setPaying] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const total = parseFloat(loan.amount);
  const paid = parseFloat(loan.paidAmount);
  const remaining = total - paid;
  const pct = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
  const isPaid = loan.status === "paid";

  const { data: detail, refetch } = useQuery<Loan>({
    queryKey: ["loan-detail", loan.id],
    queryFn: () => api.get(`/loans/${loan.id}`),
    enabled: expanded,
  });

  const handleDelete = async () => {
    if (!confirm(`Delete this loan for ${loan.customerName}?`)) return;
    try {
      await api.del(`/loans/${loan.id}`);
      toast({ title: "Loan deleted" });
      onRefresh();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="glass-panel overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", isPaid ? "bg-green-100" : "bg-amber-100")}>
              <HandCoins className={cn("h-5 w-5", isPaid ? "text-green-600" : "text-amber-600")} />
            </div>
            <div>
              <p className="font-semibold font-sora">{loan.customerName}</p>
              {loan.description && <p className="text-sm text-muted-foreground">{loan.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant={isPaid ? "default" : "outline"} className={isPaid ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-100" : "text-amber-700 border-amber-300 bg-amber-50"}>
              {isPaid ? "Paid" : "Active"}
            </Badge>
            <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-600" onClick={handleDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Loan Amount</span>
            <span className="font-medium">{fmtCurrency(total)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Paid</span>
            <span className="font-medium text-green-600">{fmtCurrency(paid)}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold">
            <span>Remaining</span>
            <span className={isPaid ? "text-green-600" : "text-amber-600"}>{fmtCurrency(remaining)}</span>
          </div>

          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
            <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          {loan.dueDate && (
            <p className="text-xs text-muted-foreground">Due: {fmtDate(loan.dueDate)}</p>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          {!isPaid && (
            <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => setPaying(true)}>
              <Banknote className="h-3.5 w-3.5 mr-1.5" />Record Payment
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setExpanded(e => !e)}>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            History
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t bg-gray-50/60 px-5 py-4">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Payment History</p>
          {!detail?.payments || detail.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments yet.</p>
          ) : (
            <div className="space-y-2">
              {detail.payments.map(p => (
                <div key={p.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 last:border-0">
                  <div>
                    <span className="font-medium text-green-700">{fmtCurrency(parseFloat(p.amount))}</span>
                    <span className="text-muted-foreground ml-2 capitalize">{p.paymentMethod?.replace("_", " ")}</span>
                    {p.note && <span className="text-muted-foreground ml-2">— {p.note}</span>}
                  </div>
                  <span className="text-xs text-muted-foreground">{fmtDate(p.paidAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {paying && (
        <PaymentDialog
          loan={loan}
          open={paying}
          onClose={() => setPaying(false)}
          onPaid={() => { onRefresh(); refetch(); }}
        />
      )}
    </div>
  );
}

export default function LoansPage() {
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "paid">("all");
  const qc = useQueryClient();
  const { data, isLoading } = useLoans();
  const loans: Loan[] = (data as any) ?? [];

  const refresh = () => qc.invalidateQueries({ queryKey: ["loans"] });

  const filtered = loans.filter(l => filter === "all" ? true : l.status === filter);
  const totalActive = loans.filter(l => l.status === "active").reduce((s, l) => s + (parseFloat(l.amount) - parseFloat(l.paidAmount)), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-sora">Loans</h1>
          <p className="text-sm text-muted-foreground">Track loans given to customers</p>
        </div>
        <Button onClick={() => setShowNew(true)} className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90">
          <Plus className="h-4 w-4 mr-2" />New Loan
        </Button>
      </div>

      {totalActive > 0 && (
        <div className="glass-panel p-4 flex items-center gap-3 border-l-4 border-amber-400">
          <HandCoins className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium">Total Outstanding Loans</p>
            <p className="text-lg font-bold text-amber-600">{fmtCurrency(totalActive)}</p>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {(["all", "active", "paid"] as const).map(f => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"}
            className={filter === f ? "bg-[#1A6DB5]" : ""}
            onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? [...Array(4)].map((_, i) => (
          <div key={i} className="glass-panel p-5 space-y-3">
            {[...Array(5)].map((_, j) => <div key={j} className="h-4 bg-muted animate-pulse rounded" />)}
          </div>
        )) : filtered.length === 0 ? (
          <div className="col-span-full glass-panel p-12 text-center text-muted-foreground">
            <HandCoins className="h-8 w-8 mx-auto mb-2 opacity-30" />
            {filter === "all" ? "No loans recorded yet" : `No ${filter} loans`}
          </div>
        ) : filtered.map(loan => (
          <LoanCard key={loan.id} loan={loan} onRefresh={refresh} />
        ))}
      </div>

      <NewLoanDialog open={showNew} onClose={() => setShowNew(false)} onCreated={refresh} />
    </div>
  );
}
