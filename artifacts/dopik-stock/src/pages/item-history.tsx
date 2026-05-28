import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useListItems, useGetItemHistory } from "@workspace/api-client-react";
import { fmtRWF } from "@/lib/api";
import { History, ArrowLeft, X, ChevronDown } from "lucide-react";

function typeBadge(type: string, adjustmentType?: string | null) {
  if (type === "purchase") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">
        Purchase
      </span>
    );
  }
  if (type === "sale") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">
        Sale
      </span>
    );
  }
  if (type === "sale_multi") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-teal-100 text-teal-700">
        Sale (multi)
      </span>
    );
  }
  if (type === "adjustment") {
    if (adjustmentType === "in") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-700">
          Stock In
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">
        Stock Out
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600 capitalize">
      {type}
    </span>
  );
}

function fmtDate(dateStr: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  }) + " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function ItemHistoryPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const urlItemId = params.get("itemId");

  const [selectedId, setSelectedId] = useState<number | null>(urlItemId ? Number(urlItemId) : null);

  useEffect(() => {
    if (urlItemId) setSelectedId(Number(urlItemId));
  }, [urlItemId]);

  const { data: itemsData } = useListItems({ limit: 500 });
  const items = itemsData?.items ?? [];

  const selectedItem = items.find(i => i.id === selectedId) ?? null;

  const { data: history, isLoading: histLoading } = useGetItemHistory(
    selectedId ?? 0,
    { query: { enabled: !!selectedId } as any }
  );

  const handleClear = () => {
    setSelectedId(null);
    navigate("/item-history");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Item History</h1>
        <button
          onClick={() => navigate("/items")}
          className="h-9 px-4 rounded-xl bg-[#0F1A2E] hover:bg-[#1A3060] text-white text-sm font-medium transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Items
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Select item</label>
          <div className="relative w-72">
            <select
              className="w-full h-9 pl-3 pr-8 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:border-[#1A6DB5] appearance-none"
              value={selectedId ?? ""}
              onChange={e => {
                const val = e.target.value;
                setSelectedId(val ? Number(val) : null);
                if (val) navigate(`/item-history?itemId=${val}`);
                else navigate("/item-history");
              }}
            >
              <option value="">— Select an item —</option>
              {items.map(i => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            {selectedId && (
              <button
                onClick={handleClear}
                className="absolute right-7 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100 transition-colors"
              >
                <X className="h-3.5 w-3.5 text-gray-500" />
              </button>
            )}
          </div>
        </div>
      </div>

      {selectedItem && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/40">
            <h2 className="text-lg font-bold text-gray-800">{selectedItem.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {selectedItem.qtyType} &bull; Purchase: {fmtRWF(selectedItem.purchasePrice)} &bull; Sale: {fmtRWF(selectedItem.salePrice)}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {["DATE", "TYPE", "QUANTITY", "AMOUNT", "DETAILS"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {histLoading && (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-gray-400">Loading history...</td>
                  </tr>
                )}
                {!histLoading && (!history || history.length === 0) && (
                  <tr>
                    <td colSpan={5} className="py-16 text-center">
                      <History className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                      <p className="text-gray-400 text-sm">No history recorded for this item</p>
                    </td>
                  </tr>
                )}
                {history?.map((entry, i) => {
                  const isOut = entry.type === "sale" || entry.type === "sale_multi" || (entry.type === "adjustment" && entry.adjustmentType === "out");
                  const qtyColor = isOut ? "text-red-500" : "text-green-600";
                  const qtyPrefix = isOut ? "-" : "+";

                  let details = "—";
                  if (entry.type === "purchase" && entry.vendorName) details = entry.vendorName;
                  else if ((entry.type === "sale" || entry.type === "sale_multi") && entry.customerName) details = entry.customerName;
                  else if (entry.type === "adjustment" && entry.reason) details = entry.reason;

                  return (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {fmtDate(entry.date)}
                      </td>
                      <td className="px-4 py-3">
                        {typeBadge(entry.type, entry.adjustmentType)}
                      </td>
                      <td className={`px-4 py-3 font-mono font-medium ${qtyColor}`}>
                        {qtyPrefix}{entry.quantity} {selectedItem.qtyType}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-700">
                        {entry.amount ? fmtRWF(entry.amount) : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {details}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!selectedItem && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 py-20 text-center">
          <History className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Select an item to view its history</p>
          <p className="text-gray-400 text-xs mt-1">All stock movements will be shown here</p>
        </div>
      )}
    </div>
  );
}
