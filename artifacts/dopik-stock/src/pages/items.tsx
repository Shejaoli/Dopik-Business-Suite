import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useListItems, getListItemsQueryKey, useUpdateItem } from "@workspace/api-client-react";
import { api, fmtRWF } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package, Search, History, Plus, X } from "lucide-react";

type Item = {
  id: number; name: string; qtyType: string;
  purchasePrice: string; salePrice: string;
  alternativeItemId?: number | null;
  alternativeItemName?: string | null;
  createdAt?: string | null;
};

const QTY_TYPES = ["unit", "piece", "box", "kg", "litre", "set", "pair", "roll", "m", "M", "pcs"];

function EditItemModal({ item, items, onClose }: { item: Item; items: Item[]; onClose: () => void }) {
  const [form, setForm] = useState({
    name: item.name,
    qtyType: item.qtyType,
    purchasePrice: item.purchasePrice,
    salePrice: item.salePrice,
    minStock: "",
    alternativeItemId: item.alternativeItemId ? String(item.alternativeItemId) : "",
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name || !form.purchasePrice || !form.salePrice) return;
    setSaving(true);
    try {
      await api.put(`/items/${item.id}`, {
        name: form.name,
        qtyType: form.qtyType,
        purchasePrice: form.purchasePrice,
        salePrice: form.salePrice,
        alternativeItemId: form.alternativeItemId ? Number(form.alternativeItemId) : null,
        ...(form.minStock !== "" && { minStock: form.minStock }),
      });
      toast({ title: "Item updated successfully" });
      qc.invalidateQueries({ queryKey: getListItemsQueryKey() });
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">Edit Item</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Item Name:</label>
            <input
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#1A6DB5] focus:ring-1 focus:ring-[#1A6DB5]/20"
              value={form.name}
              onChange={e => set("name", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Quantity Type:</label>
            <select
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:border-[#1A6DB5]"
              value={form.qtyType}
              onChange={e => set("qtyType", e.target.value)}
            >
              {QTY_TYPES.map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Purchase Price:</label>
            <input
              type="number" min={0} step="0.01"
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#1A6DB5] focus:ring-1 focus:ring-[#1A6DB5]/20"
              value={form.purchasePrice}
              onChange={e => set("purchasePrice", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Sale Price:</label>
            <input
              type="number" min={0} step="0.01"
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#1A6DB5] focus:ring-1 focus:ring-[#1A6DB5]/20"
              value={form.salePrice}
              onChange={e => set("salePrice", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Minimum Stock Level:</label>
            <input
              type="number" min={0} step="1"
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#1A6DB5] focus:ring-1 focus:ring-[#1A6DB5]/20"
              value={form.minStock}
              onChange={e => set("minStock", e.target.value)}
              placeholder="0.00"
            />
            <p className="text-xs text-gray-400">Alert will trigger when stock falls below this level</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Alternative Items (Optional):</label>
            <select
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:border-[#1A6DB5]"
              value={form.alternativeItemId}
              onChange={e => set("alternativeItemId", e.target.value)}
            >
              <option value="">Select alternative items</option>
              {items.filter(i => i.id !== item.id).map(i => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400">These will be suggested when this item is out of stock.</p>
          </div>
        </div>
        <div className="px-6 pb-6">
          <button
            onClick={handleSave}
            disabled={saving || !form.name || !form.purchasePrice || !form.salePrice}
            className="w-full h-11 rounded-xl bg-[#0F1A2E] hover:bg-[#1A6DB5] text-white font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Update Item
          </button>
        </div>
      </div>
    </div>
  );
}

function AddItemModal({ items, onClose }: { items: Item[]; onClose: () => void }) {
  const [form, setForm] = useState({
    name: "", qtyType: "piece", purchasePrice: "", salePrice: "", minStock: "", alternativeItemId: "",
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name || !form.purchasePrice || !form.salePrice) return;
    setSaving(true);
    try {
      await api.post("/items", {
        name: form.name,
        qtyType: form.qtyType,
        purchasePrice: form.purchasePrice,
        salePrice: form.salePrice,
        alternativeItemId: form.alternativeItemId ? Number(form.alternativeItemId) : null,
      });
      toast({ title: "Item added successfully" });
      qc.invalidateQueries({ queryKey: getListItemsQueryKey() });
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">Add New Item</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Item Name:</label>
            <input
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#1A6DB5] focus:ring-1 focus:ring-[#1A6DB5]/20"
              value={form.name}
              placeholder="e.g. Samsung 65 4K TV"
              onChange={e => set("name", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Quantity Type:</label>
            <select
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:border-[#1A6DB5]"
              value={form.qtyType}
              onChange={e => set("qtyType", e.target.value)}
            >
              {QTY_TYPES.map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Purchase Price:</label>
              <input
                type="number" min={0} step="0.01"
                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#1A6DB5] focus:ring-1 focus:ring-[#1A6DB5]/20"
                value={form.purchasePrice}
                placeholder="0"
                onChange={e => set("purchasePrice", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Sale Price:</label>
              <input
                type="number" min={0} step="0.01"
                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#1A6DB5] focus:ring-1 focus:ring-[#1A6DB5]/20"
                value={form.salePrice}
                placeholder="0"
                onChange={e => set("salePrice", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Minimum Stock Level:</label>
            <input
              type="number" min={0}
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#1A6DB5] focus:ring-1 focus:ring-[#1A6DB5]/20"
              value={form.minStock}
              placeholder="0"
              onChange={e => set("minStock", e.target.value)}
            />
            <p className="text-xs text-gray-400">Alert will trigger when stock falls below this level</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Alternative Items (Optional):</label>
            <select
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:border-[#1A6DB5]"
              value={form.alternativeItemId}
              onChange={e => set("alternativeItemId", e.target.value)}
            >
              <option value="">Select alternative items</option>
              {items.map(i => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="px-6 pb-6">
          <button
            onClick={handleSave}
            disabled={saving || !form.name || !form.purchasePrice || !form.salePrice}
            className="w-full h-11 rounded-xl bg-[#1A6DB5] hover:bg-[#1557a0] text-white font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Add Item
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ItemsPage() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [, navigate] = useLocation();

  const { data, isLoading } = useListItems({ search: search || undefined, limit: 200 });
  const items: Item[] = data?.items ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">Items List</h1>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => navigate("/item-history")}
            className="h-9 px-4 rounded-xl bg-[#0F1A2E] hover:bg-[#1A3060] text-white text-sm font-medium transition-colors flex items-center gap-2"
          >
            <History className="h-4 w-4" />
            Item History
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="h-9 px-4 rounded-xl bg-[#1A6DB5] hover:bg-[#1557a0] text-white text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Item
          </button>
        </div>
      </div>

      <div className="relative w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          className="w-full h-10 pl-9 pr-3 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-[#1A6DB5] focus:ring-1 focus:ring-[#1A6DB5]/20 placeholder:text-gray-400"
          placeholder="Search by item name"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {["NO", "NAME", "QTY TYPE", "PURCHASE PRICE", "SALE PRICE", "ALTERNATIVE ITEMS", "ACTIONS"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 animate-pulse rounded w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              )}
              {!isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <Package className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">
                      {search ? `No items matching "${search}"` : "No items yet"}
                    </p>
                  </td>
                </tr>
              )}
              {items.map((item, idx) => (
                <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-800 max-w-[220px]">
                    <span className="truncate block">{item.name}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{item.qtyType}</td>
                  <td className="px-4 py-3 text-gray-700 font-mono">
                    {parseFloat(item.purchasePrice).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-mono">
                    {parseFloat(item.salePrice).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {item.alternativeItemName ?? "None"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/item-history?itemId=${item.id}`)}
                        className="px-3 py-1.5 rounded-lg bg-[#0F1A2E] hover:bg-[#1A3060] text-white text-xs font-medium transition-colors"
                      >
                        History
                      </button>
                      <button
                        onClick={() => setEditItem(item)}
                        className="px-3 py-1.5 rounded-lg bg-[#F5A800] hover:bg-[#e09800] text-white text-xs font-medium transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <AddItemModal items={items} onClose={() => setShowCreate(false)} />
      )}
      {editItem && (
        <EditItemModal item={editItem} items={items} onClose={() => setEditItem(null)} />
      )}
    </div>
  );
}
