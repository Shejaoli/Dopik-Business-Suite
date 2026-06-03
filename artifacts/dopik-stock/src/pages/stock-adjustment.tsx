import { useState } from "react";
import { useListItems, useListStockAdjustments } from "@workspace/api-client-react";
import { api, fmtDate } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { SlidersHorizontal, Plus, Loader2, Barcode } from "lucide-react";

export default function StockAdjustmentPage() {
  const { data: items } = useListItems();
  const { data: adjustments, isLoading, refetch } = useListStockAdjustments();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serialInput, setSerialInput] = useState("");
  const [form, setForm] = useState({ itemId: "", adjustmentType: "in", quantity: "", reason: "" });

  const selectedItem = items?.items?.find((i: any) => String(i.id) === form.itemId);
  const tracksSerial = (selectedItem as any)?.trackSerial === true;
  const isDecrease = form.adjustmentType === "out";
  const showSerialInput = tracksSerial && isDecrease;

  const getSerialNumbers = () => serialInput.split("\n").map(s => s.trim()).filter(Boolean);
  const serialCount = getSerialNumbers().length;
  const qty = parseFloat(form.quantity) || 0;
  const serialCountOk = !showSerialInput || serialInput.trim() === "" || serialCount === qty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.itemId || !form.quantity) return;

    if (showSerialInput && serialInput.trim()) {
      const sns = getSerialNumbers();
      if (sns.length !== qty) {
        toast({
          title: "Serial number mismatch",
          description: `You entered ${sns.length} serial number(s) but the quantity is ${qty}.`,
          variant: "destructive",
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      const serialNumbers = showSerialInput && serialInput.trim() ? getSerialNumbers() : undefined;
      await api.post("/stock/adjust", {
        itemId: Number(form.itemId),
        adjustmentType: form.adjustmentType,
        quantity: form.quantity,
        reason: form.reason || null,
        ...(serialNumbers?.length && { serialNumbers }),
      });
      toast({ title: "Adjustment recorded successfully" });
      setForm({ itemId: "", adjustmentType: "in", quantity: "", reason: "" });
      setSerialInput("");
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
          <h1 className="text-xl font-bold text-gray-800">Stock Adjustment</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manually adjust stock levels for any item</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1A6DB5] hover:bg-[#155ea0] text-white text-sm font-semibold transition shadow"
        >
          <Plus className="h-4 w-4" />
          New Adjustment
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[#1A6DB5]" /> Record Stock Adjustment
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Item *</label>
                <select
                  value={form.itemId}
                  onChange={e => { setForm(f => ({ ...f, itemId: e.target.value })); setSerialInput(""); }}
                  required
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 outline-none focus:border-[#1A6DB5]"
                >
                  <option value="">Select item...</option>
                  {items?.items?.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name}{(item as any).trackSerial ? " 🔲" : ""}
                    </option>
                  ))}
                </select>
                {tracksSerial && (
                  <p className="text-xs text-purple-600 flex items-center gap-1 mt-1">
                    <Barcode className="h-3 w-3" />Serial tracked
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Type *</label>
                <select
                  value={form.adjustmentType}
                  onChange={e => { setForm(f => ({ ...f, adjustmentType: e.target.value })); setSerialInput(""); }}
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 outline-none focus:border-[#1A6DB5]"
                >
                  <option value="in">Stock In (+)</option>
                  <option value="out">Stock Out (−)</option>
                  <option value="correction">Correction</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Quantity *</label>
                <input
                  type="number" min="0.01" step="0.01"
                  value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                  required placeholder="0"
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 outline-none focus:border-[#1A6DB5]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Reason</label>
                <input
                  type="text" value={form.reason}
                  onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="e.g. Damaged goods"
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 outline-none focus:border-[#1A6DB5]"
                />
              </div>
            </div>

            {showSerialInput && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1.5">
                  <Barcode className="h-3.5 w-3.5 text-purple-600" />
                  Serial Numbers Being Removed
                  {qty > 0 && <span className="text-gray-400 font-normal">(enter {qty} serial numbers, one per line)</span>}
                </label>
                <textarea
                  className={`w-full rounded-xl border px-3 py-2 text-sm font-mono resize-none outline-none focus:ring-1 bg-gray-50 ${
                    !serialCountOk ? "border-red-400 focus:ring-red-300" : "border-gray-200 focus:border-[#1A6DB5]"
                  }`}
                  rows={Math.min(6, Math.max(3, qty || 3))}
                  value={serialInput}
                  onChange={e => setSerialInput(e.target.value)}
                  placeholder={`One serial number per line\nSN123456789\nSN987654321`}
                />
                <div className="flex justify-between text-xs">
                  <span className={serialCountOk ? "text-gray-400" : "text-red-500"}>
                    {serialCount > 0 ? `${serialCount} entered` : "Optional — leave blank to skip serial tracking"}
                  </span>
                  {qty > 0 && serialCount > 0 && !serialCountOk && (
                    <span className="text-red-500">Need exactly {qty}</span>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting || !serialCountOk}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#1A6DB5] text-white text-sm font-semibold hover:bg-[#155ea0] transition disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Adjustment
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setSerialInput(""); }}
                className="px-5 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition"
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
                {["Date", "Item", "Category", "Type", "Quantity", "Reason"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Loading...</td></tr>
              )}
              {!isLoading && (!adjustments || adjustments.length === 0) && (
                <tr>
                  <td colSpan={6} className="py-14 text-center">
                    <SlidersHorizontal className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No adjustments yet. Record your first one above.</p>
                  </td>
                </tr>
              )}
              {adjustments?.map(adj => (
                <tr key={adj.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {fmtDate(adj.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{adj.itemName || `Item #${adj.itemId}`}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">{(adj as any).category || "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      adj.adjustmentType === "in" ? "bg-green-100 text-green-700"
                        : adj.adjustmentType === "out" ? "bg-red-100 text-red-700"
                        : "bg-blue-100 text-blue-700"
                    }`}>
                      {adj.adjustmentType === "in" ? "Stock In" : adj.adjustmentType === "out" ? "Stock Out" : "Correction"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold">{adj.quantity}</td>
                  <td className="px-4 py-3 text-gray-500">{adj.reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
