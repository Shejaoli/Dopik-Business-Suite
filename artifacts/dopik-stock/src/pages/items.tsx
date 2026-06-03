import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useListItems, getListItemsQueryKey } from "@workspace/api-client-react";
import { api, fmtRWF } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package, Search, History, Plus, X, Barcode, AlertTriangle } from "lucide-react";

const ITEM_CATEGORIES = [
  "Smartphone",
  "Phone Accessories",
  "Laptop",
  "Laptop Accessories",
  "Tablet",
  "Gaming",
  "Gaming Accessories",
  "Smartwatches",
  "Audio",
  "Cameras",
  "Camera Accessories",
  "Others",
];

type Item = {
  id: number; name: string; category: string; trackSerial: boolean;
  purchasePrice: string; salePrice: string;
  alternativeItemId?: number | null;
  alternativeItemName?: string | null;
  createdAt?: string | null;
};

function EditItemModal({ item, items, onClose }: { item: Item; items: Item[]; onClose: () => void }) {
  const [form, setForm] = useState({
    name: item.name,
    category: item.category || "Others",
    trackSerial: item.trackSerial,
    purchasePrice: item.purchasePrice,
    salePrice: item.salePrice,
    minStock: "",
    alternativeItemId: item.alternativeItemId ? String(item.alternativeItemId) : "",
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name || !form.purchasePrice || !form.salePrice) return;
    setSaving(true);
    try {
      await api.put(`/items/${item.id}`, {
        name: form.name,
        category: form.category,
        trackSerial: form.trackSerial,
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
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
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
            <label className="text-sm font-medium text-gray-700">Category:</label>
            <select
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:border-[#1A6DB5]"
              value={form.category}
              onChange={e => set("category", e.target.value)}
            >
              {ITEM_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50">
            <input
              type="checkbox"
              id="trackSerial-edit"
              checked={form.trackSerial}
              onChange={e => set("trackSerial", e.target.checked)}
              className="w-4 h-4 accent-[#1A6DB5]"
            />
            <div>
              <label htmlFor="trackSerial-edit" className="text-sm font-medium text-gray-700 cursor-pointer flex items-center gap-1.5">
                <Barcode className="h-4 w-4 text-[#1A6DB5]" />
                Track Serial Numbers
              </label>
              <p className="text-xs text-gray-400 mt-0.5">Required for items like phones, laptops, cameras</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Purchase Price:</label>
              <input
                type="number" min={0} step="0.01"
                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#1A6DB5]"
                value={form.purchasePrice}
                onChange={e => set("purchasePrice", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Sale Price:</label>
              <input
                type="number" min={0} step="0.01"
                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#1A6DB5]"
                value={form.salePrice}
                onChange={e => set("salePrice", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Minimum Stock Level:</label>
            <input
              type="number" min={0} step="1"
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#1A6DB5]"
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
            <p className="text-xs text-gray-400">Suggested when this item is out of stock.</p>
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
    name: "", category: "Smartphone", trackSerial: false,
    purchasePrice: "", salePrice: "", minStock: "", alternativeItemId: "",
  });
  const [saving, setSaving] = useState(false);
  const [similarItems, setSimilarItems] = useState<{ id: number; name: string; category: string }[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = form.name.trim();
    if (q.length < 2) { setSimilarItems([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await api.get<{ id: number; name: string; category: string }[]>(`/items/search?name=${encodeURIComponent(q)}`);
        setSimilarItems(results);
      } catch { setSimilarItems([]); }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [form.name]);

  const handleSave = async () => {
    if (!form.name || !form.purchasePrice || !form.salePrice) return;
    setSaving(true);
    try {
      await api.post("/items", {
        name: form.name,
        category: form.category,
        trackSerial: form.trackSerial,
        purchasePrice: form.purchasePrice,
        salePrice: form.salePrice,
        alternativeItemId: form.alternativeItemId ? Number(form.alternativeItemId) : null,
      });
      if (form.minStock) {
        const newItems = await api.get("/items?limit=1&search=" + encodeURIComponent(form.name)) as any;
        if (newItems?.items?.[0]?.id) {
          await api.put(`/items/${newItems.items[0].id}`, { minStock: form.minStock });
        }
      }
      toast({ title: "Item added successfully" });
      qc.invalidateQueries({ queryKey: getListItemsQueryKey() });
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
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
              placeholder="e.g. Samsung Galaxy S25"
              onChange={e => set("name", e.target.value)}
            />
            {similarItems.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Similar items already exist — avoid duplicates:
                </p>
                <ul className="space-y-0.5">
                  {similarItems.map(i => (
                    <li key={i.id} className="text-xs text-amber-800 flex items-center gap-1.5">
                      <span className="font-medium">{i.name}</span>
                      <span className="text-amber-500">({i.category})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Category:</label>
            <select
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:border-[#1A6DB5]"
              value={form.category}
              onChange={e => set("category", e.target.value)}
            >
              {ITEM_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50">
            <input
              type="checkbox"
              id="trackSerial-add"
              checked={form.trackSerial}
              onChange={e => set("trackSerial", e.target.checked)}
              className="w-4 h-4 accent-[#1A6DB5]"
            />
            <div>
              <label htmlFor="trackSerial-add" className="text-sm font-medium text-gray-700 cursor-pointer flex items-center gap-1.5">
                <Barcode className="h-4 w-4 text-[#1A6DB5]" />
                Track Serial Numbers
              </label>
              <p className="text-xs text-gray-400 mt-0.5">Enable for phones, laptops, cameras, tablets — not needed for accessories</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Purchase Price:</label>
              <input
                type="number" min={0} step="0.01"
                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#1A6DB5]"
                value={form.purchasePrice}
                placeholder="0"
                onChange={e => set("purchasePrice", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Sale Price:</label>
              <input
                type="number" min={0} step="0.01"
                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#1A6DB5]"
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
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#1A6DB5]"
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
  const items: Item[] = (data?.items as any) ?? [];

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
                {["NO", "NAME", "CATEGORY", "SERIAL TRACKING", "PURCHASE PRICE", "SALE PRICE", "ALTERNATIVE ITEMS", "ACTIONS"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 animate-pulse rounded w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              )}
              {!isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
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
                  <td className="px-4 py-3 font-medium text-gray-800 max-w-[200px]">
                    <span className="truncate block">{item.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                      {item.category || "Others"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {item.trackSerial ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                        <Barcode className="h-3 w-3" />Serial
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-mono">
                    {fmtRWF(item.purchasePrice)}
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-mono">
                    {fmtRWF(item.salePrice)}
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
