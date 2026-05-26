import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListExpenseAccounts, getListExpenseAccountsQueryKey } from "@workspace/api-client-react";
import { api, fmtRWF, fmtDateTime, paymentBadgeColor } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Receipt, Loader2 } from "lucide-react";

const PAYMENT_METHODS = ["cash", "bank", "mobile_money"];

export default function ExpensesPage() {
  const [showExpense, setShowExpense] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ accountId: "", paymentMethod: "cash", amount: "", description: "" });
  const [accountForm, setAccountForm] = useState({ name: "", accountType: "expense" });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useListExpenseAccounts();
  const accounts: any[] = (data as any) ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: getListExpenseAccountsQueryKey() });

  // We'll also track expenses locally since we don't have a listExpenses hook
  const [localExpenses, setLocalExpenses] = useState<any[]>([]);

  const setEF = (k: string, v: string) => setExpenseForm(f => ({ ...f, [k]: v }));

  const handlePayExpense = async () => {
    if (!expenseForm.accountId || !expenseForm.paymentMethod || !expenseForm.amount) return;
    setSaving(true);
    try {
      const result = await api.post<any>("/expenses", {
        accountId: Number(expenseForm.accountId),
        paymentMethod: expenseForm.paymentMethod,
        amount: parseFloat(expenseForm.amount),
        description: expenseForm.description,
      });
      toast({ title: "Expense recorded" });
      setLocalExpenses(prev => [result, ...prev]);
      setShowExpense(false);
      setExpenseForm({ accountId: "", paymentMethod: "cash", amount: "", description: "" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleCreateAccount = async () => {
    if (!accountForm.name) return;
    setSaving(true);
    try {
      await api.post("/expense-accounts", accountForm);
      toast({ title: "Account created" });
      setShowAccount(false);
      setAccountForm({ name: "", accountType: "expense" });
      invalidate();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold font-sora">Expenses</h1><p className="text-sm text-muted-foreground">Track and manage business expenses</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAccount(true)}><Plus className="h-4 w-4 mr-1" />Account</Button>
          <Button onClick={() => setShowExpense(true)} className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90"><Plus className="h-4 w-4 mr-2" />Record Expense</Button>
        </div>
      </div>

      <Tabs defaultValue="expenses">
        <TabsList><TabsTrigger value="expenses">Expenses</TabsTrigger><TabsTrigger value="accounts">Accounts</TabsTrigger></TabsList>

        <TabsContent value="expenses" className="mt-4">
          <div className="glass-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {["Account", "Description", "Amount", "Payment", "Date"].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {localExpenses.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">
                      <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />No expenses recorded this session
                    </td></tr>
                  ) : localExpenses.map((e: any, i: number) => (
                    <tr key={i} className="border-b border-border hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{e.accountName ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{e.description ?? "—"}</td>
                      <td className="px-4 py-3 font-bold text-red-600">{fmtRWF(e.amount)}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${paymentBadgeColor(e.paymentMethod)}`}>{e.paymentMethod?.replace(/_/g, " ")}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmtDateTime(e.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="accounts" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {isLoading ? [...Array(6)].map((_, i) => (
              <div key={i} className="glass-panel p-4"><div className="h-4 bg-muted animate-pulse rounded" /></div>
            )) : accounts.map(a => (
              <div key={a.id} className="glass-panel p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#1A6DB5]/10 flex items-center justify-center flex-shrink-0">
                  <Receipt className="h-4 w-4 text-[#1A6DB5]" />
                </div>
                <div><p className="font-medium text-sm">{a.name}</p><p className="text-xs text-muted-foreground capitalize">{a.accountType}</p></div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Record Expense Dialog */}
      <Dialog open={showExpense} onOpenChange={setShowExpense}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Expense</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Account *</Label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={expenseForm.accountId} onChange={e => setEF("accountId", e.target.value)}>
                <option value="">Select account...</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (RWF) *</Label>
                <Input type="number" min={0.01} value={expenseForm.amount} onChange={e => setEF("amount", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Method *</Label>
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={expenseForm.paymentMethod} onChange={e => setEF("paymentMethod", e.target.value)}>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Description</Label><Input value={expenseForm.description} onChange={e => setEF("description", e.target.value)} placeholder="Optional notes..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExpense(false)}>Cancel</Button>
            <Button onClick={handlePayExpense} disabled={saving || !expenseForm.accountId || !expenseForm.amount} className="bg-red-500 hover:bg-red-600">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Record Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Account Dialog */}
      <Dialog open={showAccount} onOpenChange={setShowAccount}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Expense Account</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>Account Name *</Label><Input value={accountForm.name} onChange={e => setAccountForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Rent, Utilities..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAccount(false)}>Cancel</Button>
            <Button onClick={handleCreateAccount} disabled={saving || !accountForm.name} className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Create Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
