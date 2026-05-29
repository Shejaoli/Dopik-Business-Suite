import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, fmtRWF, fmtDate } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowUpCircle, ArrowDownCircle, Wallet, History, TrendingUp, TrendingDown, MinusCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const METHODS = [
  { key: "cash", label: "Cash", color: "green" },
  { key: "bank", label: "Bank", color: "blue" },
  { key: "mobile_money", label: "Mobile Money", color: "purple" },
];

function useBalances() {
  return useQuery<any[]>({ queryKey: ["balances"], queryFn: () => api.get("/balances") });
}

function useBalanceHistory() {
  return useQuery<any[]>({ queryKey: ["balance-history"], queryFn: () => api.get("/balances/history") });
}

type ActionType = "add" | "reduce";

function AdjustPanel({ method, label, current, onDone }: {
  method: string; label: string; current: number; onDone: () => void;
}) {
  const [action, setAction] = useState<ActionType>("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) { toast({ title: "Enter a valid amount", variant: "destructive" }); return; }
    if (action === "reduce" && !reason.trim()) { toast({ title: "Reason is required when reducing balance", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await api.post(`/balances/${method}/${action}`, { amount: num, reason: reason || null });
      toast({ title: `${label} balance ${action === "add" ? "increased" : "reduced"} by ${fmtRWF(String(num))}` });
      setAmount("");
      setReason("");
      onDone();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setAction("add")}
          className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border text-sm font-semibold transition",
            action === "add" ? "bg-green-600 border-green-600 text-white" : "border-gray-200 text-gray-500 hover:bg-gray-50")}>
          <ArrowUpCircle className="h-4 w-4" /> Add Funds
        </button>
        <button
          onClick={() => setAction("reduce")}
          className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border text-sm font-semibold transition",
            action === "reduce" ? "bg-red-500 border-red-500 text-white" : "border-gray-200 text-gray-500 hover:bg-gray-50")}>
          <ArrowDownCircle className="h-4 w-4" /> Reduce
        </button>
      </div>

      <div className="space-y-1.5">
        <Label>Amount (RWF) *</Label>
        <Input type="number" min="1" step="1" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label>Reason / Comment {action === "reduce" ? "*" : "(optional)"}</Label>
        <Input
          placeholder={action === "add" ? "e.g. Opening balance, cash deposit..." : "e.g. Petty cash withdrawal, correction..."}
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
      </div>

      {amount && parseFloat(amount) > 0 && (
        <div className={cn("p-3 rounded-xl text-sm", action === "add" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800")}>
          {action === "add" ? "+" : "-"}{fmtRWF(amount)} →
          New balance: {fmtRWF(String(action === "add"
            ? current + parseFloat(amount)
            : current - parseFloat(amount)))}
        </div>
      )}

      <Button onClick={handleSubmit} disabled={saving}
        className={cn("w-full", action === "add" ? "bg-green-600 hover:bg-green-700" : "bg-red-500 hover:bg-red-600")}>
        {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        {action === "add" ? "Add Funds" : "Reduce Balance"}
      </Button>
    </div>
  );
}

const methodColors: Record<string, string> = {
  cash: "text-green-600 bg-green-50 border-green-200",
  bank: "text-blue-600 bg-blue-50 border-blue-200",
  mobile_money: "text-purple-600 bg-purple-50 border-purple-200",
};

const typeIcon = {
  add: <TrendingUp className="h-4 w-4 text-green-600" />,
  reduce: <TrendingDown className="h-4 w-4 text-red-500" />,
  set: <MinusCircle className="h-4 w-4 text-gray-400" />,
};
const typeBadge = {
  add: "bg-green-50 text-green-700 border-green-200",
  reduce: "bg-red-50 text-red-700 border-red-200",
  set: "bg-gray-50 text-gray-600 border-gray-200",
};

export default function BalancesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: balances = [] } = useBalances();
  const { data: history = [] } = useBalanceHistory();
  const [activeMethod, setActiveMethod] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["balances"] });
    qc.invalidateQueries({ queryKey: ["balance-history"] });
  };

  const getBalance = (method: string) => {
    const b = balances.find((b: any) => b.method === method);
    return b ? parseFloat(b.amount) : 0;
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold font-sora">Balance Management</h1>
        <p className="text-sm text-muted-foreground">Track and manage your cash, bank, and mobile money balances</p>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {METHODS.map(({ key, label }) => {
          const bal = getBalance(key);
          return (
            <div key={key} className="glass-panel p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-muted-foreground">{label}</span>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className={cn("text-2xl font-bold font-sora", bal < 0 ? "text-red-600" : "text-foreground")}>
                {fmtRWF(String(bal))}
              </p>
              {isAdmin && (
                <button
                  onClick={() => setActiveMethod(activeMethod === key ? null : key)}
                  className={cn("mt-3 w-full py-1.5 rounded-lg text-xs font-semibold border transition",
                    activeMethod === key
                      ? "bg-[#1A6DB5] text-white border-[#1A6DB5]"
                      : "border-gray-200 text-gray-500 hover:bg-gray-50")}>
                  {activeMethod === key ? "Close" : "Adjust"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Adjust panel */}
      {isAdmin && activeMethod && (
        <div className="glass-panel p-6">
          <h2 className="font-semibold font-sora mb-4">
            Adjust {METHODS.find(m => m.key === activeMethod)?.label} Balance
          </h2>
          <AdjustPanel
            method={activeMethod}
            label={METHODS.find(m => m.key === activeMethod)?.label ?? activeMethod}
            current={getBalance(activeMethod)}
            onDone={refresh}
          />
        </div>
      )}

      {/* History */}
      <div className="glass-panel overflow-hidden">
        <div className="flex items-center gap-2 p-5 border-b border-border">
          <History className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold font-sora">Adjustment History</h2>
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No balance adjustments recorded yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {history.map((h: any) => (
              <div key={h.id} className="flex items-start justify-between gap-4 px-5 py-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5">{typeIcon[h.type as keyof typeof typeIcon] ?? typeIcon.set}</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={cn("text-xs", typeBadge[h.type as keyof typeof typeBadge] ?? typeBadge.set)}>
                        {h.type === "add" ? "Added" : h.type === "reduce" ? "Reduced" : "Set"}
                      </Badge>
                      <Badge variant="outline" className={cn("text-xs capitalize", methodColors[h.method] ?? "")}>
                        {h.method.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    {h.reason && <p className="text-sm text-muted-foreground mt-1 truncate">{h.reason}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {fmtRWF(h.balanceBefore)} → {fmtRWF(h.balanceAfter)}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={cn("font-bold text-sm", h.type === "add" ? "text-green-600" : h.type === "reduce" ? "text-red-500" : "text-gray-600")}>
                    {h.type === "add" ? "+" : h.type === "reduce" ? "-" : ""}{fmtRWF(h.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(h.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
