import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmtRWF, fmtDate, fmtDateTime } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard, TrendingDown, AlertCircle, CheckCircle2,
  Plus, ChevronDown, ChevronUp, Phone, Calendar, MessageSquare
} from "lucide-react";

type CreditAccount = {
  id: number;
  customerId: number;
  customerName: string;
  customerPhone?: string;
  totalAmount: string;
  amountPaid: string;
  balance: string;
  dueDate?: string;
  status: string;
  notes?: string;
  urgency: "none" | "ok" | "due_soon" | "overdue" | "paid";
  daysOverdue: number;
  payments: CreditPayment[];
  createdAt: string;
};

type CreditPayment = {
  id: number;
  amount: string;
  paymentMethod: string;
  notes?: string;
  paidAt: string;
};

function urgencyBadge(urgency: string, daysOverdue: number) {
  if (urgency === "paid") return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
  if (urgency === "overdue") return <Badge className="bg-red-100 text-red-800">Overdue {daysOverdue}d</Badge>;
  if (urgency === "due_soon") return <Badge className="bg-amber-100 text-amber-800">Due Soon</Badge>;
  if (urgency === "ok") return <Badge className="bg-blue-100 text-blue-800">Active</Badge>;
  return <Badge className="bg-gray-100 text-gray-600">No Due Date</Badge>;
}

function progressBar(paid: number, total: number) {
  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
      <div className="bg-[#1A6DB5] h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function PaymentModal({ account, open, onClose }: {
  account: CreditAccount; open: boolean; onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const balance = parseFloat(account.balance);
  const entered = parseFloat(amount) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || entered <= 0) { toast({ title: "Enter a valid amount", variant: "destructive" }); return; }
    if (entered > balance) { toast({ title: "Amount exceeds remaining balance", variant: "destructive" }); return; }
    setLoading(true);
    try {
      await api.post(`/credit/${account.id}/payment`, { amount: String(entered), paymentMethod: method, notes });
      toast({ title: "Payment recorded", description: `${fmtRWF(entered)} recorded successfully` });
      qc.invalidateQueries({ queryKey: ["credit"] });
      setAmount(""); setNotes("");
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const waText = encodeURIComponent(
    `Hello ${account.customerName}, this is a friendly reminder that your payment of ${fmtRWF(account.balance)} is due${account.dueDate ? ` on ${fmtDate(account.dueDate)}` : ""} at Dopik Electronics. Please contact us if you need assistance.`
  );
  const waLink = account.customerPhone
    ? `https://wa.me/${account.customerPhone.replace(/\D/g, "")}?text=${waText}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment — {account.customerName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Total</span>
              <span className="font-medium">{fmtRWF(account.totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Paid so far</span>
              <span className="font-medium text-green-600">{fmtRWF(account.amountPaid)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 mt-1">
              <span className="text-gray-700 font-semibold">Remaining</span>
              <span className="font-bold text-red-600">{fmtRWF(account.balance)}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label>Payment Amount (RWF) *</Label>
              <Input
                type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder="0" min="1" max={balance} step="any"
              />
              {entered > 0 && entered < balance && (
                <p className="text-xs text-gray-500 mt-1">
                  Remaining after: {fmtRWF(balance - entered)}
                </p>
              )}
            </div>
            <div>
              <Label>Payment Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any note..." />
            </div>
            <DialogFooter className="gap-2">
              {waLink && (
                <a href={waLink} target="_blank" rel="noopener noreferrer">
                  <Button type="button" variant="outline" className="gap-2 text-green-600 border-green-200 hover:bg-green-50">
                    <MessageSquare className="w-4 h-4" /> Send Reminder
                  </Button>
                </a>
              )}
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={loading} className="bg-[#1A6DB5] hover:bg-[#155a96]">
                {loading ? "Saving..." : "Record Payment"}
              </Button>
            </DialogFooter>
          </form>

          {account.payments.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Payment History</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {account.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1.5">
                    <div>
                      <span className="font-medium text-green-700">{fmtRWF(p.amount)}</span>
                      <span className="text-gray-400 ml-2">via {p.paymentMethod.replace("_", " ")}</span>
                    </div>
                    <span className="text-gray-400">{fmtDate(p.paidAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreditCard_({ account }: { account: CreditAccount }) {
  const [expanded, setExpanded] = useState(false);
  const [payModal, setPayModal] = useState(false);

  const total = parseFloat(account.totalAmount);
  const paid = parseFloat(account.amountPaid);
  const balance = parseFloat(account.balance);

  const urgencyBorder = account.urgency === "overdue"
    ? "border-l-4 border-l-red-400"
    : account.urgency === "due_soon"
    ? "border-l-4 border-l-amber-400"
    : account.urgency === "paid"
    ? "border-l-4 border-l-green-400"
    : "border-l-4 border-l-gray-200";

  const waText = encodeURIComponent(
    `Hello ${account.customerName}, this is a friendly reminder that your payment of ${fmtRWF(account.balance)} is due${account.dueDate ? ` on ${fmtDate(account.dueDate)}` : ""} at Dopik Electronics. Please contact us if you need assistance.`
  );
  const waLink = account.customerPhone
    ? `https://wa.me/${account.customerPhone.replace(/\D/g, "")}?text=${waText}`
    : null;

  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${urgencyBorder}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-[#0F1A2E]">{account.customerName}</p>
              {urgencyBadge(account.urgency, account.daysOverdue)}
            </div>
            {account.customerPhone && (
              <a href={`tel:${account.customerPhone}`} className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 hover:text-[#1A6DB5]">
                <Phone className="w-3 h-3" /> {account.customerPhone}
              </a>
            )}
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-red-600">{fmtRWF(balance)}</p>
            <p className="text-xs text-gray-400">remaining</p>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{fmtRWF(paid)} paid</span>
            <span>{total > 0 ? Math.round((paid / total) * 100) : 0}% of {fmtRWF(total)}</span>
          </div>
          {progressBar(paid, total)}
        </div>

        {account.dueDate && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
            <Calendar className="w-3 h-3" />
            Due: {fmtDate(account.dueDate)}
            {account.urgency === "overdue" && (
              <span className="text-red-600 font-medium ml-1">({account.daysOverdue}d overdue)</span>
            )}
          </div>
        )}

        <div className="flex gap-2 mt-3">
          {account.status === "active" && (
            <Button size="sm" onClick={() => setPayModal(true)}
              className="bg-[#1A6DB5] hover:bg-[#155a96] text-xs h-7 px-3">
              Record Payment
            </Button>
          )}
          {waLink && (
            <a href={waLink} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50 text-xs h-7 px-3 gap-1">
                <MessageSquare className="w-3 h-3" /> Remind
              </Button>
            </a>
          )}
          <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}
            className="text-xs h-7 px-2 ml-auto text-gray-500">
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            History
          </Button>
        </div>
      </div>

      {expanded && account.payments.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50 p-3">
          <p className="text-xs font-medium text-gray-600 mb-2">Payment History</p>
          <div className="space-y-1">
            {account.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span className="text-green-700 font-medium">{fmtRWF(p.amount)}</span>
                <span className="text-gray-500 capitalize">{p.paymentMethod.replace("_", " ")}</span>
                <span className="text-gray-400">{fmtDateTime(p.paidAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {payModal && <PaymentModal account={account} open={payModal} onClose={() => setPayModal(false)} />}
    </div>
  );
}

export default function CreditPage() {
  const [filter, setFilter] = useState<"all" | "active" | "overdue" | "paid">("all");
  const [search, setSearch] = useState("");

  const { data: accounts = [], isLoading } = useQuery<CreditAccount[]>({
    queryKey: ["credit"],
    queryFn: () => api.get("/credit"),
  });

  const { data: summary } = useQuery<any>({
    queryKey: ["credit-summary"],
    queryFn: () => api.get("/credit/summary"),
  });

  const filtered = accounts.filter((a) => {
    if (filter === "active" && a.status !== "active") return false;
    if (filter === "overdue" && a.urgency !== "overdue") return false;
    if (filter === "paid" && a.status !== "paid") return false;
    if (search && !a.customerName.toLowerCase().includes(search.toLowerCase()) &&
      !(a.customerPhone || "").includes(search)) return false;
    return true;
  });

  const sortedFiltered = [...filtered].sort((a, b) => {
    if (a.urgency === "overdue" && b.urgency !== "overdue") return -1;
    if (b.urgency === "overdue" && a.urgency !== "overdue") return 1;
    if (a.urgency === "due_soon" && b.urgency !== "due_soon") return -1;
    if (b.urgency === "due_soon" && a.urgency !== "due_soon") return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const overdueCount = accounts.filter((a) => a.urgency === "overdue").length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F1A2E]">Credit Management</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track outstanding credit and record payments</p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-[#1A6DB5]" />
              <p className="text-xs text-gray-500">Total Outstanding</p>
            </div>
            <p className="text-lg font-bold text-[#0F1A2E]">{fmtRWF(summary.totalBalance)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{summary.count} accounts</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <p className="text-xs text-gray-500">Overdue</p>
            </div>
            <p className="text-lg font-bold text-red-600">{fmtRWF(summary.overdueBalance)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{summary.overdueCount || 0} accounts</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-amber-500" />
              <p className="text-xs text-gray-500">Active Credit</p>
            </div>
            <p className="text-lg font-bold text-amber-600">
              {accounts.filter((a) => a.status === "active").length}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">open accounts</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <p className="text-xs text-gray-500">Fully Paid</p>
            </div>
            <p className="text-lg font-bold text-green-600">
              {accounts.filter((a) => a.status === "paid").length}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">accounts cleared</p>
          </div>
        </div>
      )}

      {overdueCount > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">
            <strong>{overdueCount} account{overdueCount > 1 ? "s are" : " is"} overdue.</strong>{" "}
            Contact these customers to arrange payment.
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by customer name or phone..."
          className="max-w-xs"
        />
        <div className="flex gap-1.5 flex-wrap">
          {[
            { key: "all", label: "All" },
            { key: "active", label: "Active" },
            { key: "overdue", label: "Overdue" },
            { key: "paid", label: "Paid" },
          ].map((f) => (
            <Button key={f.key} size="sm" variant={filter === f.key ? "default" : "outline"}
              className={filter === f.key ? "bg-[#1A6DB5] hover:bg-[#155a96]" : ""}
              onClick={() => setFilter(f.key as any)}>
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading credit accounts...</div>
      ) : sortedFiltered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p>No credit accounts found</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sortedFiltered.map((account) => (
            <CreditCard_ key={account.id} account={account} />
          ))}
        </div>
      )}
    </div>
  );
}
