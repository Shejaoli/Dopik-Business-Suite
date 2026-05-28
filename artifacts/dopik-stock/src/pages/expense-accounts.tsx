import { useState } from "react";
import { useListExpenseAccounts } from "@workspace/api-client-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Plus, Loader2 } from "lucide-react";

export default function ExpenseAccountsPage() {
  const { data: accounts, isLoading, refetch } = useListExpenseAccounts();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", accountType: "expense" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    setSubmitting(true);
    try {
      await api.post("/expenses/accounts", form);
      toast({ title: "Account created" });
      setForm({ name: "", accountType: "expense" });
      setShowForm(false);
      refetch();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Expense Accounts</h1>
          <p className="text-sm text-gray-400 mt-0.5">Chart of accounts for expense tracking</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1A6DB5] hover:bg-[#155ea0] text-white text-sm font-semibold transition shadow"
        >
          <Plus className="h-4 w-4" />
          New Account
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[#1A6DB5]" /> Add Expense Account
          </h2>
          <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1 flex-1 min-w-48">
              <label className="text-xs font-semibold text-gray-500 uppercase">Account Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Office Supplies"
                required
                className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 outline-none focus:border-[#1A6DB5]"
              />
            </div>
            <div className="space-y-1 min-w-40">
              <label className="text-xs font-semibold text-gray-500 uppercase">Type</label>
              <select
                value={form.accountType}
                onChange={e => setForm(f => ({ ...f, accountType: e.target.value }))}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 outline-none focus:border-[#1A6DB5]"
              >
                <option value="expense">Expense</option>
                <option value="overhead">Overhead</option>
                <option value="cogs">Cost of Goods</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1A6DB5] text-white text-sm font-semibold hover:bg-[#155ea0] transition disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {["#", "Account Name", "Type", "Created"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={4} className="text-center py-10 text-gray-400">Loading...</td></tr>
              )}
              {!isLoading && (!accounts || accounts.length === 0) && (
                <tr>
                  <td colSpan={4} className="py-14 text-center">
                    <BookOpen className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No expense accounts found</p>
                  </td>
                </tr>
              )}
              {accounts?.map((acc, i) => (
                <tr key={acc.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{acc.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#1A6DB5]/10 text-[#1A6DB5] capitalize">
                      {acc.accountType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {acc.createdAt ? new Date(acc.createdAt).toLocaleDateString("en-GB") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
