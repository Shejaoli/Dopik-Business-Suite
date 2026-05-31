import { useState } from "react";
import { useListCustomers } from "@workspace/api-client-react";
import { api, fmtRWF } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { PackagePlus, Plus, Trash2, Loader2, CheckCircle2 } from "lucide-react";
import { ReceiptModal } from "@/components/ReceiptModal";
import { useQueryClient } from "@tanstack/react-query";

interface LineItem {
  itemId: string;
  quantity: string;
  unitPrice: string;
}

function useInStockItems() {
  return useQuery({
    queryKey: ["items", { inStock: true }],
    queryFn: () => api.get<{ items: any[] }>("/items?inStock=true&limit=500").then(r => r.items ?? []),
  });
}

export default function MultiSalePage() {
  const { data: inStockItems = [] } = useInStockItems();
  const { data: customers } = useListCustomers();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split("T")[0]);
  const [lines, setLines] = useState<LineItem[]>([{ itemId: "", quantity: "", unitPrice: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [receiptSaleId, setReceiptSaleId] = useState<number | null>(null);

  const addLine = () => setLines(l => [...l, { itemId: "", quantity: "", unitPrice: "" }]);
  const removeLine = (i: number) => setLines(l => l.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof LineItem, value: string) =>
    setLines(l => l.map((line, idx) => idx === i ? { ...line, [field]: value } : line));

  const totalAmount = lines.reduce((sum, l) => {
    const qty = parseFloat(l.quantity) || 0;
    const price = parseFloat(l.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  const resetForm = () => {
    setCustomerId("");
    setPaymentMethod("cash");
    setPaymentStatus("paid");
    setSaleDate(new Date().toISOString().split("T")[0]);
    setLines([{ itemId: "", quantity: "", unitPrice: "" }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLines = lines.filter(l => l.itemId && l.quantity && l.unitPrice);
    if (validLines.length === 0) {
      toast({ title: "Add at least one item", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const sale = await api.post<any>("/sales", {
        customerId: customerId ? Number(customerId) : null,
        paymentMethod,
        paymentStatus,
        saleDate,
        totalAmount,
        items: validLines.map(l => ({
          itemId: Number(l.itemId),
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
      });
      toast({ title: "Sale recorded successfully!", description: "Receipt is ready to print or share." });
      qc.invalidateQueries({ queryKey: ["sales"] });
      resetForm();
      setReceiptSaleId(sale.id);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const itemList = Array.isArray(inStockItems) ? inStockItems : [];

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Multi-Item Sale</h1>
        <p className="text-sm text-gray-400 mt-0.5">Record a sale with multiple product lines in one transaction</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">Sale Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">Date</label>
              <input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-[#1A6DB5]" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">Customer</label>
              <select value={customerId} onChange={e => setCustomerId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-[#1A6DB5]">
                <option value="">Walk-in Customer</option>
                {(customers as any[])?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">Payment Method</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-[#1A6DB5]">
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="credit">Credit</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">Payment Status</label>
              <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-[#1A6DB5]">
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Items</h2>
              <p className="text-xs text-gray-400 mt-0.5">Only items with available stock are shown</p>
            </div>
            <button type="button" onClick={addLine}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#1A6DB5] hover:text-[#155ea0] transition">
              <Plus className="h-3.5 w-3.5" /> Add Line
            </button>
          </div>

          <div className="space-y-3">
            <div className="hidden sm:grid grid-cols-12 gap-3 text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
              <div className="col-span-5">Item</div>
              <div className="col-span-3">Quantity</div>
              <div className="col-span-3">Unit Price (RWF)</div>
              <div className="col-span-1" />
            </div>

            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-12 sm:col-span-5">
                  <select value={line.itemId}
                    onChange={e => {
                      const item = itemList.find((it: any) => String(it.id) === e.target.value);
                      updateLine(i, "itemId", e.target.value);
                      if (item?.salePrice) updateLine(i, "unitPrice", String(item.salePrice));
                    }}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-[#1A6DB5]">
                    <option value="">Select item...</option>
                    {itemList.map((item: any) => (
                      <option key={item.id} value={item.id}>
                        {item.name} — {parseFloat(item.stockQuantity ?? 0)} in stock
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-5 sm:col-span-3">
                  <input type="number" min="0.01" step="0.01" value={line.quantity}
                    onChange={e => updateLine(i, "quantity", e.target.value)} placeholder="Qty"
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-[#1A6DB5]" />
                </div>
                <div className="col-span-5 sm:col-span-3">
                  <input type="number" min="0" step="0.01" value={line.unitPrice}
                    onChange={e => updateLine(i, "unitPrice", e.target.value)} placeholder="0"
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-mono outline-none focus:border-[#1A6DB5]" />
                </div>
                <div className="col-span-2 sm:col-span-1 flex justify-center">
                  {lines.length > 1 && (
                    <button type="button" onClick={() => removeLine(i)}
                      className="p-1.5 text-gray-300 hover:text-red-400 transition rounded-lg hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-end gap-4">
            <span className="text-sm font-semibold text-gray-500">Total Amount:</span>
            <span className="text-xl font-bold text-[#1A6DB5]">{fmtRWF(String(totalAmount))}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1A6DB5] text-white font-bold text-sm hover:bg-[#155ea0] transition disabled:opacity-50 shadow">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
            Record Sale
          </button>
        </div>
      </form>

      {receiptSaleId && (
        <ReceiptModal
          saleId={receiptSaleId}
          open={!!receiptSaleId}
          onClose={() => setReceiptSaleId(null)}
        />
      )}
    </div>
  );
}
