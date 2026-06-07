import { useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useListExpenseAccounts, getListExpenseAccountsQueryKey } from "@workspace/api-client-react";
import { api, fmtRWF, fmtDateTime, paymentBadgeColor } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Receipt, Loader2, Edit, Trash2, TrendingDown } from "lucide-react";

const PAYMENT_METHODS = ["cash", "bank", "mobile_money"];

export default function ExpensesPage() {
  const [showExpense, setShowExpense] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [editAccount, setEditAccount] = useState<any>(null);
  const [detailAccount, setDetailAccount] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ accountId: "", paymentMethod: "cash", amount: "", description: "" });
  const [accountForm, setAccountForm] = useState({ name: "", accountType: "expense" });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: accountsRaw, isLoading: accountsLoading } = useListExpenseAccounts();
  const accounts: any[] = (accountsRaw as any) ?? [];
  const invalidateAccounts = () => qc.invalidateQueries({ queryKey: getListExpenseAccountsQueryKey() });

  const { data: expensesRaw, isLoading: expensesLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => api.get<any[]>("/expenses"),
  });
  const expenses: any[] = expensesRaw ?? [];
  const invalidateExpenses = () => qc.invalidateQueries({ queryKey: ["expenses"] });

  const setEF = (k: string, v: string) => setExpenseForm(f => ({ ...f, [k]: v }));

  const handlePayExpense = async () => {
    if (!expenseForm.accountId || !expenseForm.paymentMethod || !expenseForm.amount) return;
    setSaving(true);
    try {
      await api.post<any>("/expenses", {
        accountId: Number(expenseForm.accountId),
        paymentMethod: expenseForm.paymentMethod,
        amount: parseFloat(expenseForm.amount),
        description: expenseForm.description,
      });
      toast({ title: "Expense recorded" });
      invalidateExpenses();
      invalidateAccounts();
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
      invalidateAccounts();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleUpdateAccount = async () => {
    if (!editAccount || !editAccount.name) return;
    setSaving(true);
    try {
      await api.put(`/expense-accounts/${editAccount.id}`, { name: editAccount.name, accountType: editAccount.accountType });
      toast({ title: "Account updated" });
      setEditAccount(null);
      invalidateAccounts();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDeleteAccount = async (id: number, name: string) => {
    if (!confirm(`Delete account "${name}"? This will not delete existing expense records.`)) return;
    try {
      await api.del(`/expense-accounts/${id}`);
      toast({ title: "Account deleted" });
      invalidateAccounts();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
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
                  {expensesLoading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        {[...Array(5)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}
                      </tr>
                    ))
                  ) : expenses.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">
                      <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />No expenses recorded yet
                    </td></tr>
                  ) : expenses.map((e: any) => (
                    <tr key={e.id} className="border-b border-border hover:bg-muted/30">
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
            {accountsLoading ? [...Array(6)].map((_, i) => (
              <div key={i} className="glass-panel p-4"><div className="h-4 bg-muted animate-pulse rounded" /></div>
            )) : accounts.length === 0 ? (
              <div className="col-span-full glass-panel p-12 text-center text-muted-foreground">
                <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />No accounts yet — click "+ Account" to create one
              </div>
            ) : accounts.map(a => (
              <div key={a.id} className="glass-panel p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailAccount(a)}>
                <div className="flex items-start justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-[#1A6DB5]/10 flex items-center justify-center flex-shrink-0">
                    <Receipt className="h-4 w-4 text-[#1A6DB5]" />
                  </div>
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" onClick={() => setEditAccount({ ...a })}><Edit className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => handleDeleteAccount(a.id, a.name)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                <p className="font-medium text-sm">{a.name}</p>
                <p className="text-xs text-muted-foreground capitalize mb-2">{a.accountType}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                  <span className="text-sm font-semibold text-red-600">{fmtRWF(a.totalSpent ?? "0")}</span>
                  <span className="text-xs text-muted-foreground">spent ({a.count ?? 0} transactions)</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">Click to view transactions →</p>
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

      {/* Edit Account Dialog */}
      <Dialog open={!!editAccount} onOpenChange={open => !open && setEditAccount(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Account</DialogTitle></DialogHeader>
          {editAccount && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5"><Label>Account Name *</Label><Input value={editAccount.name} onChange={e => setEditAccount((a: any) => ({ ...a, name: e.target.value }))} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAccount(null)}>Cancel</Button>
            <Button onClick={handleUpdateAccount} disabled={saving} className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Account Detail Dialog */}
      <Dialog open={!!detailAccount} onOpenChange={open => !open && setDetailAccount(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-[#1A6DB5]" />
              {detailAccount?.name}
            </DialogTitle>
          </DialogHeader>
          {detailAccount && (() => {
            const accountExpenses = expenses.filter((e: any) => e.accountId === detailAccount.id || e.accountName === detailAccount.name);
            const totalSpent = accountExpenses.reduce((s: number, e: any) => s + parseFloat(e.amount || "0"), 0);
            return (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-red-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500">Total Spent</p>
                    <p className="font-bold text-red-600 text-lg">{fmtRWF(String(totalSpent))}</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500">Transactions</p>
                    <p className="font-bold text-[#1A6DB5] text-lg">{accountExpenses.length}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500">Type</p>
                    <p className="font-bold text-gray-700 capitalize">{detailAccount.accountType}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Transaction History</p>
                  {accountExpenses.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">No expenses recorded for this account yet</div>
                  ) : (
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {accountExpenses.map((e: any) => (
                        <div key={e.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 text-sm">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{e.description || "—"}</p>
                            <p className="text-xs text-muted-foreground">{fmtDateTime(e.createdAt)}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                            <Badge className={`text-xs ${paymentBadgeColor(e.paymentMethod)}`}>{e.paymentMethod?.replace(/_/g, " ")}</Badge>
                            <span className="font-bold text-red-600">{fmtRWF(e.amount)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setDetailAccount(null); setExpenseForm(f => ({ ...f, accountId: String(detailAccount.id) })); setShowExpense(true); }}
                    className="text-[#1A6DB5] border-[#1A6DB5]/30">
                    <Plus className="h-4 w-4 mr-1" /> Add Expense
                  </Button>
                  <Button variant="outline" onClick={() => setDetailAccount(null)}>Close</Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
