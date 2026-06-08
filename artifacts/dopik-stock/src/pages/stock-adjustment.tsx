import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useListItems, useListStockAdjustments } from "@workspace/api-client-react";
import { api, fmtDate } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  SlidersHorizontal, TrendingDown, ShoppingCart, Loader2,
  Barcode, ArrowLeft, Search, CheckSquare, Square, AlertCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";

function useInStockUnits(itemId: string | null) {
  return useQuery({
    queryKey: ["stock-units", itemId],
    queryFn: () => api.get<any[]>(`/stock/${itemId}/units`),
    enabled: !!itemId,
  });
}

export default function StockAdjustmentPage() {
  const { data: itemsData } = useListItems();
  const { data: adjustments, isLoading, refetch } = useListStockAdjustments();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedItemId, setSelectedItemId] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [reason, setReason] = useState("");
  const [selectedUnits, setSelectedUnits] = useState<number[]>([]);
  const [nonSerialQty, setNonSerialQty] = useState("");

  const allItems: any[] = itemsData?.items ?? [];
  const filteredItems = allItems.filter(i =>
    !itemSearch || (i.name ?? "").toLowerCase().includes(itemSearch.toLowerCase())
  );
  const selectedItem = allItems.find(i => String(i.id) === selectedItemId);
  const tracksSerial = selectedItem?.trackSerial === true;

  const { data: unitList = [] } = useInStockUnits(tracksSerial && selectedItemId ? selectedItemId : null);
  const inStockUnits: any[] = (unitList as any[]).filter((u: any) => u.status === "in_stock");

  const toggleUnit = (id: number) => {
    setSelectedUnits(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const resetForm = () => {
    setSelectedItemId("");
    setItemSearch("");
    setReason("");
    setSelectedUnits([]);
    setNonSerialQty("");
    setShowForm(false);
  };

  const canSubmit = selectedItemId && reason.trim() &&
    (tracksSerial ? selectedUnits.length > 0 : parseFloat(nonSerialQty) > 0);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (tracksSerial) {
        await api.post("/stock/adjust", {
          itemId: Number(selectedItemId),
          adjustmentType: "out",
          quantity: String(selectedUnits.length),
          reason: reason.trim(),
          serializedUnitIds: selectedUnits,
        });
      } else {
        await api.post("/stock/adjust", {
          itemId: Number(selectedItemId),
          adjustmentType: "out",
          quantity: nonSerialQty,
          reason: reason.trim(),
        });
      }
      toast({ title: "Stock decrease recorded successfully" });
      qc.invalidateQueries({ queryKey: ["stock"] });
      refetch();
      resetForm();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Stock Adjustment</h1>
          <p className="text-sm text-gray-400 mt-0.5">Record stock decreases or go to Purchases to add stock</p>
        </div>
      </div>

      {!showForm && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setShowForm(true)}
            className="flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-red-200 bg-red-50 hover:bg-red-100 transition-colors group"
          >
            <div className="h-12 w-12 rounded-full bg-red-100 group-hover:bg-red-200 flex items-center justify-center transition-colors">
              <TrendingDown className="h-6 w-6 text-red-600" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-red-700 text-base">Record Stock Decrease</p>
              <p className="text-xs text-red-500 mt-1">Damaged, lost, or removed from inventory</p>
            </div>
          </button>

          <button
            onClick={() => navigate("/purchases")}
            className="flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-green-200 bg-green-50 hover:bg-green-100 transition-colors group"
          >
            <div className="h-12 w-12 rounded-full bg-green-100 group-hover:bg-green-200 flex items-center justify-center transition-colors">
              <ShoppingCart className="h-6 w-6 text-green-600" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-green-700 text-base">Record New Purchase</p>
              <p className="text-xs text-green-500 mt-1">Add new stock via the Purchases page</p>
            </div>
          </button>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          <div className="flex items-center gap-3">
            <button
              onClick={resetForm}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" />
                Record Stock Decrease
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Select the item and specify which units were removed</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 uppercase">Search Item *</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Type to search items…"
                value={itemSearch}
                onChange={e => { setItemSearch(e.target.value); setSelectedItemId(""); setSelectedUnits([]); }}
              />
            </div>
            {itemSearch && !selectedItemId && (
              <div className="border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                {filteredItems.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-400">No items found</div>
                ) : filteredItems.map((item: any) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedItemId(String(item.id));
                      setItemSearch(item.name);
                      setSelectedUnits([]);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0 flex items-center justify-between"
                  >
                    <span className="font-medium">{item.name}</span>
                    <div className="flex items-center gap-2">
                      {item.trackSerial && <Barcode className="h-3.5 w-3.5 text-purple-500" />}
                      <span className="text-xs text-muted-foreground">Qty: {parseFloat(item.quantity ?? "0").toLocaleString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selectedItem && (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                <span className="font-medium text-sm">{selectedItem.name}</span>
                {tracksSerial && (
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Barcode className="h-3 w-3" />Serial tracked
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">Stock: {parseFloat(selectedItem.quantity ?? "0").toLocaleString()}</span>
              </div>
            )}
          </div>

          {selectedItem && tracksSerial && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1.5">
                <Barcode className="h-3.5 w-3.5 text-purple-600" />
                Select Units Being Removed
                {inStockUnits.length > 0 && (
                  <span className="font-normal text-gray-400">({selectedUnits.length} of {inStockUnits.length} selected)</span>
                )}
              </label>
              {inStockUnits.length === 0 ? (
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 flex items-center gap-2 text-sm text-amber-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  No serialized units in stock for this item
                </div>
              ) : (
                <div className="border border-gray-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-medium text-gray-500">{inStockUnits.length} units in stock</span>
                    <button
                      onClick={() => setSelectedUnits(
                        selectedUnits.length === inStockUnits.length ? [] : inStockUnits.map(u => u.id)
                      )}
                      className="text-xs text-[#1A6DB5] hover:underline"
                    >
                      {selectedUnits.length === inStockUnits.length ? "Deselect all" : "Select all"}
                    </button>
                  </div>
                  {inStockUnits.map((unit: any) => (
                    <button
                      key={unit.id}
                      onClick={() => toggleUnit(unit.id)}
                      className={`w-full text-left px-4 py-3 text-sm border-b border-gray-50 last:border-0 flex items-center gap-3 transition-colors ${
                        selectedUnits.includes(unit.id) ? "bg-red-50" : "hover:bg-gray-50"
                      }`}
                    >
                      {selectedUnits.includes(unit.id)
                        ? <CheckSquare className="h-4 w-4 text-red-500 flex-shrink-0" />
                        : <Square className="h-4 w-4 text-gray-300 flex-shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <span className="font-mono text-xs font-medium">{unit.imeiOrSerial || "No IMEI"}</span>
                        <div className="flex gap-2 mt-0.5 flex-wrap">
                          {unit.color && <span className="text-xs text-gray-500">{unit.color}</span>}
                          {unit.storage && <span className="text-xs text-gray-500">{unit.storage}</span>}
                          {unit.ram && <span className="text-xs text-gray-500">{unit.ram}</span>}
                          {unit.condition && <span className="text-xs text-gray-400">{unit.condition}</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedItem && !tracksSerial && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase">Quantity to Remove *</label>
              <Input
                type="number" min="0.01" step="0.01"
                value={nonSerialQty}
                onChange={e => setNonSerialQty(e.target.value)}
                placeholder="0"
              />
            </div>
          )}

          {selectedItem && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase">Reason * <span className="font-normal text-gray-400">(required)</span></label>
              <Input
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Damaged, Lost, Returned to vendor…"
              />
            </div>
          )}

          {selectedItem && (
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSubmit}
                disabled={submitting || !canSubmit}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {tracksSerial
                  ? `Remove ${selectedUnits.length} Unit${selectedUnits.length !== 1 ? "s" : ""}`
                  : "Record Decrease"}
              </button>
              <button
                onClick={resetForm}
                className="px-5 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60">
          <h2 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[#1A6DB5]" />
            Adjustment History
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/40">
                {["Date", "Item", "Category", "Type", "Quantity", "Reason"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Loading…</td></tr>
              )}
              {!isLoading && (!adjustments || adjustments.length === 0) && (
                <tr>
                  <td colSpan={6} className="py-14 text-center">
                    <SlidersHorizontal className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No adjustments recorded yet.</p>
                  </td>
                </tr>
              )}
              {adjustments?.map((adj: any) => (
                <tr key={adj.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(adj.createdAt)}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{adj.itemName || `Item #${adj.itemId}`}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">{adj.category || "—"}</span>
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
