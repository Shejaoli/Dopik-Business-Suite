import { useState, useRef, useEffect } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useListPurchases, useListVendors, useListStock, getListPurchasesQueryKey } from "@workspace/api-client-react";
import { api, fmtRWF, fmtDateTime, paymentBadgeColor } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Search, ShoppingCart, Loader2, Barcode, Trash2,
  ChevronDown, ChevronUp, AlertTriangle, X, Printer,
  FileCheck, Save, ArrowLeft, CheckCircle2, Building2, Zap
} from "lucide-react";

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "mobile_money", label: "MoMo" },
  { value: "bank", label: "Bank Transfer" },
  { value: "credit", label: "Other" },
];
const CONDITIONS = [
  "Brand New",
  "Screen Issue",
  "Battery below 70%",
  "Battery 70–80%",
  "Battery 80–90%",
  "Battery above 90%",
];

function generatePO() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `PO-${ymd}-${rand}`;
}

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${part(4)}-${part(4)}`;
}

function pmLabel(val: string) {
  return PAYMENT_METHODS.find(m => m.value === val)?.label ?? val.replace(/_/g, " ");
}

// ── Searchable Dropdown with Create ──────────────────────────────────────────
function SearchableSelect({
  options, value, onChange, placeholder, onCreate,
}: {
  options: { id: string | number; name: string; outOfStock?: boolean }[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onCreate?: (name: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const filtered = options.filter(o => o.name.toLowerCase().includes(q.toLowerCase()));
  const selected = options.find(o => String(o.id) === value);
  const showCreate = onCreate && q.trim() && !filtered.find(o => o.name.toLowerCase() === q.trim().toLowerCase());

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); setQ(""); }}
        className="w-full h-9 text-left flex items-center justify-between rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <span className={selected ? (selected.outOfStock ? "text-muted-foreground italic" : "text-foreground") : "text-muted-foreground"}>
          {selected?.name ?? placeholder ?? "Select…"}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 w-full min-w-[200px] bg-white border border-border rounded-lg shadow-lg">
          <div className="p-2">
            <Input
              autoFocus
              className="h-8 text-sm"
              placeholder="Search…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {value && (
              <button type="button"
                className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                onClick={() => { onChange(""); setOpen(false); }}>
                — None —
              </button>
            )}
            {filtered.map(o => (
              <button key={o.id} type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${o.outOfStock ? "text-muted-foreground italic" : ""}`}
                onClick={() => { onChange(String(o.id)); setOpen(false); setQ(""); }}>
                {o.name}
              </button>
            ))}
            {showCreate && (
              <button type="button"
                className="w-full text-left px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 font-medium"
                onClick={async () => { await onCreate!(q.trim()); setOpen(false); setQ(""); }}>
                + Create "{q.trim()}"
              </button>
            )}
            {filtered.length === 0 && !showCreate && (
              <p className="px-3 py-2 text-sm text-muted-foreground">No results</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type PurchaseRow = {
  id: string;
  itemId: string;
  color: string;
  storage: string;
  ram: string;
  imeiOrSerial: string;
  condition: string;
  vendorId: string;
  paymentMethod: string;
  unitCost: string;
  additionalInfo: string;
};

type SimpleForm = {
  itemId: string;
  quantity: string;
  unitCost: string;
  vendorId: string;
  paymentMethod: string;
  condition: string;
  additionalInfo: string;
};

function emptyRow(): PurchaseRow {
  return {
    id: Math.random().toString(36).slice(2),
    itemId: "", color: "", storage: "", ram: "",
    imeiOrSerial: "", condition: "Brand New",
    vendorId: "", paymentMethod: "cash", unitCost: "",
    additionalInfo: "",
  };
}

// ── PO Preview ────────────────────────────────────────────────────────────────
function POPreview({
  rows, simpleForm, items, vendors, isSerial, poNumber, onConfirm, onBack, saving,
}: {
  rows: PurchaseRow[]; simpleForm: SimpleForm;
  items: any[]; vendors: any[];
  isSerial: boolean; poNumber: string;
  onConfirm: () => void; onBack: () => void; saving: boolean;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML ?? "";
    const w = window.open("", "_blank", "width=820,height=950");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Purchase Order ${poNumber}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; padding: 28px; color: #000; background: #fff; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        th, td { border: 1px solid #ccc; padding: 8px 10px; font-size: 11px; text-align: left; }
        th { background: #f5f5f5; font-weight: 600; }
        .banner { background: #fffbeb !important; border: 2px solid #f59e0b !important; padding: 12px; border-radius: 6px; margin: 14px 0; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        .banner-text { color: #92400e; font-weight: bold; font-size: 12px; }
        .header-flex { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
        .company-name { font-size: 18px; font-weight: bold; }
        .po-label { font-size: 18px; font-weight: bold; text-align: right; }
        .po-number { font-family: monospace; color: #444; }
        .summary-box { margin-left: auto; width: 300px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-top: 16px; }
        .summary-row { display: flex; justify-content: space-between; font-size: 12px; padding: 4px 0; }
        .summary-divider { border-top: 1px solid #e5e7eb; margin: 8px 0; }
        .grand-total { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; padding-top: 8px; }
        .grand-total-amount { color: #1A6DB5; font-size: 18px; }
        .watermark { text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; }
        @media print {
          body { padding: 20px; }
          .banner { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      </style>
    </head><body>${content}
    <div class="watermark">Printed from Dopik Electronics Management System</div>
    </body></html>`);
    w.document.close();
    w.print();
  };

  const getItem = (id: string) => items.find(i => String(i.itemId ?? i.id) === id);
  const getVendor = (id: string) => vendors.find(v => String(v.id) === id);

  const lineItems = isSerial
    ? rows.filter(r => r.itemId)
    : [{
        id: "1", itemId: simpleForm.itemId,
        description: `Qty: ${simpleForm.quantity}`,
        condition: simpleForm.condition,
        vendorId: simpleForm.vendorId,
        paymentMethod: simpleForm.paymentMethod,
        unitCost: simpleForm.unitCost,
        imeiOrSerial: "", color: "", storage: "",
      }];

  const totalQty = isSerial ? lineItems.length : parseFloat(simpleForm.quantity || "0");
  const grandTotal = isSerial
    ? rows.reduce((s, r) => s + parseFloat(r.unitCost || "0"), 0)
    : parseFloat(simpleForm.unitCost || "0") * parseFloat(simpleForm.quantity || "0");

  const byPayment: Record<string, number> = {};
  if (isSerial) {
    for (const r of rows) {
      const m = r.paymentMethod || "cash";
      byPayment[m] = (byPayment[m] ?? 0) + parseFloat(r.unitCost || "0");
    }
  } else {
    const m = simpleForm.paymentMethod || "cash";
    byPayment[m] = grandTotal;
  }

  const today = new Date().toLocaleDateString("en-RW", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-4">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg">Purchase Order Preview</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" />Print
            </Button>
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-1" />Back
            </Button>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={onConfirm}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Confirm &amp; Save Purchase
            </Button>
          </div>
        </div>

        <div ref={printRef} className="p-6 space-y-5">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <img src="/dopik-logo-transparent.png" alt="Dopik" className="w-12 h-12 object-contain" />
              <div>
                <p className="font-bold text-lg">Dopik Electronics Ltd</p>
                <p className="text-xs text-gray-500">Kigali, Rwanda</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-xl">PURCHASE ORDER — INTERNAL RECORD</p>
              <p className="text-sm text-gray-600 font-mono">{poNumber}</p>
              <p className="text-xs text-gray-500">{today}</p>
            </div>
          </div>

          <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 flex gap-3 items-start" style={{ printColorAdjust: "exact" }}>
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-bold text-amber-800">
              ⚠️ This is an internal document for record-keeping purposes only. It must not be shared, posted, or distributed externally.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  {["#", "Item", "Description", "Condition", "Vendor", "Payment", "Unit Cost"].map(h => (
                    <th key={h} className="border border-gray-200 px-3 py-2 text-left font-semibold text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineItems.map((row: any, i: number) => {
                  const item = getItem(row.itemId);
                  const vendor = getVendor(row.vendorId);
                  const desc = isSerial
                    ? [row.color, row.ram, row.storage, row.imeiOrSerial ? `IMEI/SN: ${row.imeiOrSerial}` : ""].filter(Boolean).join(" / ")
                    : row.description;
                  return (
                    <tr key={row.id} className="border-b border-gray-100">
                      <td className="border border-gray-200 px-3 py-2 text-xs">{i + 1}</td>
                      <td className="border border-gray-200 px-3 py-2 text-xs font-medium">{item?.itemName ?? item?.name ?? "—"}</td>
                      <td className="border border-gray-200 px-3 py-2 text-xs">
                        {desc || "—"}
                        {row.additionalInfo && <div className="text-gray-400 italic mt-0.5">ℹ️ {row.additionalInfo}</div>}
                      </td>
                      <td className="border border-gray-200 px-3 py-2 text-xs">{row.condition || "—"}</td>
                      <td className="border border-gray-200 px-3 py-2 text-xs">{vendor?.name ?? "—"}</td>
                      <td className="border border-gray-200 px-3 py-2 text-xs capitalize">{pmLabel(row.paymentMethod || "")}</td>
                      <td className="border border-gray-200 px-3 py-2 text-xs font-semibold">{fmtRWF(row.unitCost || "0")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="w-80 space-y-3 bg-gray-50 rounded-xl p-5 border">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Quantity</span>
                <span className="font-semibold">{totalQty} {totalQty === 1 ? "unit" : "units"}</span>
              </div>
              <div className="border-t pt-3 space-y-2">
                {Object.entries(byPayment).map(([m, amt]) => (
                  <div key={m} className="flex justify-between text-sm">
                    <span className="text-gray-500">{pmLabel(m)}</span>
                    <span className="font-medium">{fmtRWF(String(amt))}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between border-t pt-3">
                <span className="font-bold text-base">Grand Total</span>
                <span className="font-black text-xl text-[#1A6DB5]">{fmtRWF(String(grandTotal))}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Cancel Modals ─────────────────────────────────────────────────────────────
function CancelModal1({ onBack, onProceed }: { onBack: () => void; onProceed: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-amber-600" />
          </div>
          <h2 className="text-lg font-bold">Are you sure you want to cancel this purchase?</h2>
          <p className="text-sm text-muted-foreground">
            This action cannot be undone. Before cancelling, consider whether you can simply edit or modify this purchase instead.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onBack}>Go Back &amp; Edit</Button>
          <Button variant="destructive" className="flex-1" onClick={onProceed}>Yes, I want to cancel</Button>
        </div>
      </div>
    </div>
  );
}

function CancelModal2({ code, onBack, onConfirm }: { code: string; onBack: () => void; onConfirm: () => void }) {
  const [input, setInput] = useState("");
  const matches = input === code;
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-bold">Confirm Cancellation</h2>
          <p className="text-sm text-muted-foreground">To confirm cancellation, type the code below exactly as shown:</p>
          <div className="my-3 inline-block bg-red-50 border-2 border-red-200 rounded-xl px-6 py-3">
            <span className="font-mono text-2xl font-black text-red-700 tracking-[0.15em]">{code}</span>
          </div>
          <p className="text-xs text-muted-foreground">Case-sensitive</p>
        </div>
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type the code here…"
          className="text-center font-mono tracking-widest"
        />
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onBack}>Go Back</Button>
          <Button variant="destructive" className="flex-1" disabled={!matches} onClick={onConfirm}>
            Confirm Cancellation
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Add Vendor Inline ─────────────────────────────────────────────────────────
function AddVendorInline({ onSave, onClose }: { onSave: (v: any) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const v = await api.post<any>("/vendors", { name: name.trim(), phone: phone.trim() });
    onSave(v);
    setSaving(false);
  };

  return (
    <div className="border border-dashed border-purple-300 rounded-xl p-3 bg-purple-50 space-y-2 mt-2">
      <p className="text-xs font-semibold text-purple-700">New Vendor</p>
      <Input className="h-8 text-sm" placeholder="Name *" value={name} onChange={e => setName(e.target.value)} />
      <Input className="h-8 text-sm" placeholder="Phone (optional)" value={phone} onChange={e => setPhone(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" className="h-8 text-xs flex-1" onClick={save} disabled={!name.trim() || saving}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save Vendor"}
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Unit Card (Serialized) ─────────────────────────────────────────────────────
function UnitCard({
  row, index, total, stockItems, itemOptions, colors, storageOptions, ramOptions, vendorList,
  onUpdate, onRemove, onCreateColor, onCreateStorage, onCreateRam, onAddVendorSave, duplicateItemId,
}: {
  row: PurchaseRow; index: number; total: number;
  stockItems: any[]; itemOptions: any[];
  colors: any[]; storageOptions: any[]; ramOptions: any[]; vendorList: any[];
  onUpdate: (id: string, field: keyof PurchaseRow, val: string) => void;
  onRemove: (id: string) => void;
  onCreateColor: (name: string) => Promise<void>;
  onCreateStorage: (name: string) => Promise<void>;
  onCreateRam: (name: string) => Promise<void>;
  onAddVendorSave: (rowId: string, vendor: any) => void;
  duplicateItemId?: boolean;
}) {
  const [showAddVendor, setShowAddVendor] = useState(false);

  const selectedItem = row.itemId ? stockItems.find((s: any) => String(s.itemId ?? s.id) === row.itemId) : null;
  const requiresSerial = selectedItem?.trackSerial === true;

  return (
    <div className={`bg-white border rounded-xl shadow-sm overflow-hidden ${duplicateItemId ? "border-amber-300" : "border-border"}`}>
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">Unit #{index + 1}</span>
          {duplicateItemId && (
            <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
              <AlertTriangle className="h-3 w-3" />Same item in another unit
            </span>
          )}
        </div>
        {total > 1 && (
          <button
            type="button"
            onClick={() => onRemove(row.id)}
            className="flex items-center gap-1.5 text-red-500 hover:text-red-700 text-sm font-medium transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Remove</span>
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        <div>
          <p className="text-sm font-medium mb-1.5">Item</p>
          <SearchableSelect
            options={itemOptions}
            value={row.itemId}
            onChange={v => onUpdate(row.id, "itemId", v)}
            placeholder="Select item…"
          />
          {requiresSerial && (
            <p className="mt-1.5 text-xs text-purple-600 flex items-center gap-1">
              <Zap className="h-3 w-3" />Requires IMEI/serial tracking
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <p className="text-sm font-medium mb-1.5">Color</p>
            <SearchableSelect
              options={colors}
              value={row.color ? String(colors.find(c => c.name === row.color)?.id ?? "") : ""}
              onChange={v => { const c = colors.find(c => String(c.id) === v); onUpdate(row.id, "color", c?.name ?? ""); }}
              placeholder="Select color…"
              onCreate={async name => {
                await onCreateColor(name);
                const fresh = await api.get<any[]>("/colors");
                const found = (fresh as any[]).find((c: any) => c.name === name);
                if (found) onUpdate(row.id, "color", found.name);
              }}
            />
          </div>
          <div>
            <p className="text-sm font-medium mb-1.5">RAM</p>
            <SearchableSelect
              options={ramOptions}
              value={row.ram ? String(ramOptions.find(r => r.name === row.ram)?.id ?? "") : ""}
              onChange={v => { const r = ramOptions.find(r => String(r.id) === v); onUpdate(row.id, "ram", r?.name ?? ""); }}
              placeholder="Select RAM…"
              onCreate={async name => {
                await onCreateRam(name);
                const fresh = await api.get<any[]>("/ram-options");
                const found = (fresh as any[]).find((r: any) => r.name === name);
                if (found) onUpdate(row.id, "ram", found.name);
              }}
            />
          </div>
          <div>
            <p className="text-sm font-medium mb-1.5">Storage</p>
            <SearchableSelect
              options={storageOptions}
              value={row.storage ? String(storageOptions.find(s => s.name === row.storage)?.id ?? "") : ""}
              onChange={v => { const s = storageOptions.find(s => String(s.id) === v); onUpdate(row.id, "storage", s?.name ?? ""); }}
              placeholder="Select storage…"
              onCreate={async name => {
                await onCreateStorage(name);
                const fresh = await api.get<any[]>("/storage-options");
                const found = (fresh as any[]).find((s: any) => s.name === name);
                if (found) onUpdate(row.id, "storage", found.name);
              }}
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-1.5">IMEI / Serial Number</p>
          <Input
            className="font-mono"
            value={row.imeiOrSerial}
            onChange={e => onUpdate(row.id, "imeiOrSerial", e.target.value)}
            placeholder="Enter IMEI or serial number…"
          />
        </div>

        <div>
          <p className="text-sm font-medium mb-1.5">Condition</p>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={row.condition}
            onChange={e => onUpdate(row.id, "condition", e.target.value)}
          >
            <option value="">Select condition…</option>
            {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-sm font-medium mb-1.5">Vendor</p>
            <SearchableSelect
              options={vendorList}
              value={row.vendorId}
              onChange={v => onUpdate(row.id, "vendorId", v)}
              placeholder="Select vendor…"
            />
            {!showAddVendor ? (
              <button
                type="button"
                className="mt-1.5 text-xs text-purple-600 hover:underline flex items-center gap-1"
                onClick={() => setShowAddVendor(true)}
              >
                <Building2 className="h-3 w-3" />+ Add new vendor
              </button>
            ) : (
              <AddVendorInline
                onSave={v => { onAddVendorSave(row.id, v); setShowAddVendor(false); }}
                onClose={() => setShowAddVendor(false)}
              />
            )}
          </div>
          <div>
            <p className="text-sm font-medium mb-1.5">Payment Method</p>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={row.paymentMethod}
              onChange={e => onUpdate(row.id, "paymentMethod", e.target.value)}
            >
              {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-1.5">Unit Cost (RWF)</p>
          <Input
            type="number"
            min={0}
            value={row.unitCost}
            onChange={e => onUpdate(row.id, "unitCost", e.target.value)}
            placeholder="0"
          />
        </div>

        <div>
          <p className="text-sm font-medium mb-1.5">Additional Information <span className="text-xs font-normal text-muted-foreground">(optional)</span></p>
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            rows={2}
            value={row.additionalInfo}
            onChange={e => onUpdate(row.id, "additionalInfo", e.target.value)}
            placeholder="Any extra details about this unit…"
          />
        </div>
      </div>
    </div>
  );
}

// ── Simple Card (Non-Serialized) ──────────────────────────────────────────────
function SimpleCard({
  form, itemOptions, vendorList, stockItems,
  onChange, onAddVendorSave,
}: {
  form: SimpleForm;
  itemOptions: any[];
  vendorList: any[];
  stockItems: any[];
  onChange: (field: keyof SimpleForm, val: string) => void;
  onAddVendorSave: (vendor: any) => void;
}) {
  const [showAddVendor, setShowAddVendor] = useState(false);

  return (
    <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-border">
        <span className="font-semibold text-sm">Item Details</span>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <p className="text-sm font-medium mb-1.5">Item</p>
          <SearchableSelect
            options={itemOptions}
            value={form.itemId}
            onChange={v => onChange("itemId", v)}
            placeholder="Select item…"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-sm font-medium mb-1.5">Quantity</p>
            <Input
              type="number" min={1}
              value={form.quantity}
              onChange={e => onChange("quantity", e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <p className="text-sm font-medium mb-1.5">Condition</p>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.condition}
              onChange={e => onChange("condition", e.target.value)}
            >
              {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-sm font-medium mb-1.5">Vendor</p>
            <SearchableSelect
              options={vendorList}
              value={form.vendorId}
              onChange={v => onChange("vendorId", v)}
              placeholder="Select vendor…"
            />
            {!showAddVendor ? (
              <button
                type="button"
                className="mt-1.5 text-xs text-purple-600 hover:underline flex items-center gap-1"
                onClick={() => setShowAddVendor(true)}
              >
                <Building2 className="h-3 w-3" />+ Add new vendor
              </button>
            ) : (
              <AddVendorInline
                onSave={v => { onAddVendorSave(v); setShowAddVendor(false); }}
                onClose={() => setShowAddVendor(false)}
              />
            )}
          </div>
          <div>
            <p className="text-sm font-medium mb-1.5">Payment Method</p>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.paymentMethod}
              onChange={e => onChange("paymentMethod", e.target.value)}
            >
              {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-1.5">Unit Cost (RWF)</p>
          <Input
            type="number" min={0}
            value={form.unitCost}
            onChange={e => onChange("unitCost", e.target.value)}
            placeholder="0"
          />
        </div>

        <div>
          <p className="text-sm font-medium mb-1.5">Additional Information <span className="text-xs font-normal text-muted-foreground">(optional)</span></p>
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            rows={2}
            value={form.additionalInfo}
            onChange={e => onChange("additionalInfo", e.target.value)}
            placeholder="Any extra details about this purchase…"
          />
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PurchasesPage() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showPO, setShowPO] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verified, setVerified] = useState(false);
  const [poNumber, setPoNumber] = useState("");
  const [draftId, setDraftId] = useState<number | null>(null);

  const [cancelStep, setCancelStep] = useState<0 | 1 | 2>(0);
  const [activeCancelCode, setActiveCancelCode] = useState("");

  const [showBreakdown, setShowBreakdown] = useState(false);

  const [rows, setRows] = useState<PurchaseRow[]>([emptyRow()]);
  const [simple, setSimple] = useState<SimpleForm>({
    itemId: "", quantity: "", unitCost: "",
    vendorId: "", paymentMethod: "cash", condition: "Brand New",
    additionalInfo: "",
  });

  const [isSerial, setIsSerial] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState("");

  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useListPurchases({});
  const { data: vendors, refetch: refetchVendors } = useListVendors();
  const { data: stock } = useListStock({});

  const { data: colorsData, refetch: refetchColors } = useQuery({
    queryKey: ["colors"],
    queryFn: () => api.get<any[]>("/colors"),
  });
  const { data: storageData, refetch: refetchStorage } = useQuery({
    queryKey: ["storage-options"],
    queryFn: () => api.get<any[]>("/storage-options"),
  });
  const { data: ramData, refetch: refetchRam } = useQuery({
    queryKey: ["ram-options"],
    queryFn: () => api.get<any[]>("/ram-options"),
  });

  const purchases: any[] = (data as any) ?? [];
  const vendorList: any[] = (vendors as any) ?? [];
  const stockItems: any[] = (stock as any) ?? [];
  const colors: any[] = colorsData ?? [];
  const storageOptions: any[] = storageData ?? [];
  const ramOptions: any[] = ramData ?? [];

  const filtered = purchases.filter(p =>
    !search || (p.itemName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const itemOptions = stockItems.map((s: any) => {
    const qty = parseFloat(s.quantity ?? "0");
    const outOfStock = qty <= 0;
    return {
      id: s.itemId ?? s.id,
      name: outOfStock
        ? `${s.itemName} (out of stock)`
        : `${s.itemName} (in stock: ${qty.toLocaleString()})`,
      outOfStock,
    };
  });

  const handleItemSelect = (itemId: string) => {
    const item = stockItems.find((s: any) => String(s.itemId ?? s.id) === itemId);
    const serial = item?.trackSerial === true;
    setSelectedItemId(itemId);
    setIsSerial(serial);
    setVerified(false);
  };

  const updateRow = (id: string, field: keyof PurchaseRow, val: string) => {
    setVerified(false);
    setRows(rs => rs.map(r => r.id === id ? { ...r, [field]: val } : r));
    if (field === "itemId") handleItemSelect(val);
  };

  const addRow = () => {
    setVerified(false);
    setRows(rs => [...rs, emptyRow()]);
  };

  const removeRow = (id: string) => {
    setVerified(false);
    setRows(rs => rs.filter(r => r.id !== id));
  };

  const updateSimple = (field: keyof SimpleForm, val: string) => {
    setVerified(false);
    if (field === "itemId") {
      const item = stockItems.find((s: any) => String(s.itemId ?? s.id) === val);
      const serial = item?.trackSerial === true;
      setSelectedItemId(val);
      setIsSerial(serial);
    }
    setSimple(f => ({ ...f, [field]: val }));
  };

  const totalQty = isSerial ? rows.length : parseFloat(simple.quantity || "0");
  const totalCost = isSerial
    ? rows.reduce((s, r) => s + parseFloat(r.unitCost || "0"), 0)
    : parseFloat(simple.unitCost || "0") * parseFloat(simple.quantity || "0");

  const byPayment: Record<string, number> = {};
  if (isSerial) {
    for (const r of rows) {
      const m = r.paymentMethod || "cash";
      byPayment[m] = (byPayment[m] ?? 0) + parseFloat(r.unitCost || "0");
    }
  } else {
    byPayment[simple.paymentMethod || "cash"] = totalCost;
  }

  const handleVerify = () => {
    const po = generatePO();
    setPoNumber(po);
    setVerified(true);
    setShowPO(true);
  };

  const handleSaveDraft = async () => {
    const notes = JSON.stringify({ mode: isSerial ? "serial" : "simple", rows, simple });
    const itemId = isSerial
      ? (rows[0]?.itemId ? Number(rows[0].itemId) : null)
      : (simple.itemId ? Number(simple.itemId) : null);
    if (!itemId) { toast({ title: "Select an item first", variant: "destructive" }); return; }

    setSaving(true);
    try {
      const payload = {
        itemId,
        quantity: String(totalQty || 1),
        totalCost: String(totalCost),
        paymentMethod: isSerial ? (rows[0]?.paymentMethod || "cash") : simple.paymentMethod,
        vendorId: isSerial
          ? (rows[0]?.vendorId ? Number(rows[0].vendorId) : null)
          : (simple.vendorId ? Number(simple.vendorId) : null),
        status: "draft",
        poNumber: poNumber || null,
        notes,
      };

      if (draftId) {
        await api.patch<any>(`/purchases/${draftId}`, payload);
      } else {
        const saved = await api.post<any>("/purchases", payload);
        setDraftId(saved.id);
      }

      toast({ title: "Draft saved successfully" });
      qc.invalidateQueries({ queryKey: getListPurchasesQueryKey() });
    } catch (e: any) {
      toast({ title: "Error saving draft", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const itemId = isSerial
        ? Number(rows[0]?.itemId || selectedItemId)
        : Number(simple.itemId || selectedItemId);
      const payload: any = {
        itemId,
        quantity: String(totalQty),
        totalCost: String(totalCost),
        paymentMethod: isSerial ? Object.keys(byPayment)[0] || "cash" : simple.paymentMethod,
        vendorId: isSerial
          ? (rows[0]?.vendorId ? Number(rows[0].vendorId) : null)
          : (simple.vendorId ? Number(simple.vendorId) : null),
        status: "confirmed",
        poNumber,
        units: isSerial ? rows.map(r => ({
          imeiOrSerial: r.imeiOrSerial,
          color: r.color,
          storage: r.storage,
          ram: r.ram,
          additionalInfo: r.additionalInfo,
          condition: r.condition,
          vendorId: r.vendorId ? Number(r.vendorId) : null,
          costPrice: r.unitCost,
          paymentMethod: r.paymentMethod,
        })) : undefined,
      };

      if (draftId) {
        await api.patch<any>(`/purchases/${draftId}`, payload);
      } else {
        await api.post<any>("/purchases", payload);
      }

      toast({ title: "Purchase confirmed!", description: `PO ${poNumber} recorded successfully.` });
      setShowPO(false);
      setShowForm(false);
      resetForm();
      qc.invalidateQueries({ queryKey: getListPurchasesQueryKey() });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const resetForm = () => {
    setRows([emptyRow()]);
    setSimple({ itemId: "", quantity: "", unitCost: "", vendorId: "", paymentMethod: "cash", condition: "Brand New", additionalInfo: "" });
    setIsSerial(false);
    setSelectedItemId("");
    setVerified(false);
    setPoNumber("");
    setDraftId(null);
    setShowBreakdown(false);
  };

  const handleCancelClick = () => {
    const code = generateCode();
    setActiveCancelCode(code);
    setCancelStep(1);
  };

  const handleCancelConfirm = () => {
    setCancelStep(0);
    setShowForm(false);
    resetForm();
    toast({ title: "Purchase cancelled." });
  };

  const loadDraft = async (purchase: any) => {
    if (purchase.status !== "draft") return;
    setDraftId(purchase.id);
    try {
      const detail = await api.get<any>(`/purchases/${purchase.id}`);
      if (detail.notes) {
        const saved = JSON.parse(detail.notes);
        if (saved.mode === "serial" && saved.rows) {
          setRows(saved.rows);
          setIsSerial(true);
          setSelectedItemId(saved.rows[0]?.itemId || "");
        } else if (saved.mode === "simple" && saved.simple) {
          setSimple(saved.simple);
          setIsSerial(false);
          setSelectedItemId(saved.simple.itemId || "");
        }
      }
      setPoNumber(detail.poNumber || "");
      setShowForm(true);
    } catch (e: any) {
      toast({ title: "Could not load draft", description: e.message, variant: "destructive" });
    }
  };

  const createColor = async (name: string) => {
    await api.post("/colors", { name });
    refetchColors();
  };

  const createStorage = async (name: string) => {
    await api.post("/storage-options", { name });
    refetchStorage();
  };

  const createRam = async (name: string) => {
    await api.post("/ram-options", { name });
    refetchRam();
  };

  const handleVendorSaveForRow = async (rowId: string, vendor: any) => {
    await refetchVendors();
    setRows(rs => rs.map(r => r.id === rowId ? { ...r, vendorId: String(vendor.id) } : r));
    setVerified(false);
  };

  const handleVendorSaveSimple = async (vendor: any) => {
    await refetchVendors();
    setSimple(f => ({ ...f, vendorId: String(vendor.id) }));
    setVerified(false);
  };

  const canVerify = isSerial
    ? rows.some(r => r.itemId && r.unitCost)
    : !!(simple.itemId && simple.quantity && simple.unitCost);

  return (
    <div className="space-y-5">
      {cancelStep === 1 && (
        <CancelModal1 onBack={() => setCancelStep(0)} onProceed={() => setCancelStep(2)} />
      )}
      {cancelStep === 2 && (
        <CancelModal2 code={activeCancelCode} onBack={() => setCancelStep(1)} onConfirm={handleCancelConfirm} />
      )}

      {showPO && (
        <POPreview
          rows={rows} simpleForm={simple}
          items={stockItems} vendors={vendorList}
          isSerial={isSerial} poNumber={poNumber}
          onConfirm={handleConfirm}
          onBack={() => setShowPO(false)}
          saving={saving}
        />
      )}

      {/* List view */}
      {!showForm && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold font-sora">Purchases</h1>
              <p className="text-sm text-muted-foreground">Record stock purchases from vendors</p>
            </div>
            <Button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90 self-start sm:self-auto"
            >
              <Plus className="h-4 w-4 mr-2" />New Purchase
            </Button>
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by item..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="glass-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {["#", "Item", "Category", "Quantity", "Total Cost", "Vendor", "Payment", "Status", "Date"].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        {[...Array(9)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">
                      <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-30" />No purchases found
                    </td></tr>
                  ) : filtered.map(p => (
                    <tr
                      key={p.id}
                      className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => p.status === "draft" && loadDraft(p)}
                    >
                      <td className="px-4 py-3 text-muted-foreground">#{p.id}</td>
                      <td className="px-4 py-3 font-medium max-w-[160px]">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{p.itemName}</span>
                          {p.trackSerial && <Barcode className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">{p.category || "—"}</span>
                      </td>
                      <td className="px-4 py-3">{parseFloat(p.quantity).toLocaleString()}</td>
                      <td className="px-4 py-3 font-semibold">{fmtRWF(p.totalCost)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.vendorName ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${paymentBadgeColor(p.paymentMethod)}`}>
                          {pmLabel(p.paymentMethod ?? "")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {p.status === "draft" ? (
                          <Badge className="text-xs bg-amber-100 text-amber-800 border border-amber-200">Draft</Badge>
                        ) : (
                          <Badge className="text-xs bg-green-100 text-green-800 border border-green-200">Confirmed</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmtDateTime(p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Purchase Form */}
      {showForm && (
        <div className="space-y-5 max-w-3xl">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <button
                onClick={handleCancelClick}
                className="mt-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold font-sora">Record New Purchase</h1>
                {draftId && (
                  <p className="text-xs text-amber-600 font-medium mt-0.5">Editing draft #{draftId}</p>
                )}
              </div>
            </div>
            {isSerial && (
              <Badge className="bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1.5 px-3 py-1.5 mt-1 shrink-0">
                <Barcode className="h-3.5 w-3.5" />Serialized Item
              </Badge>
            )}
          </div>

          {/* Item Cards */}
          <div className="space-y-4">
            {isSerial ? (
              <>
                {(() => {
                  const itemCounts: Record<string, number> = {};
                  rows.forEach(r => { if (r.itemId) itemCounts[r.itemId] = (itemCounts[r.itemId] ?? 0) + 1; });
                  return rows.map((row, idx) => (
                  <UnitCard
                    key={row.id}
                    row={row}
                    index={idx}
                    total={rows.length}
                    stockItems={stockItems}
                    itemOptions={itemOptions}
                    colors={colors}
                    storageOptions={storageOptions}
                    ramOptions={ramOptions}
                    vendorList={vendorList}
                    onUpdate={updateRow}
                    onRemove={removeRow}
                    onCreateColor={createColor}
                    onCreateStorage={createStorage}
                    onCreateRam={createRam}
                    onAddVendorSave={handleVendorSaveForRow}
                    duplicateItemId={!!row.itemId && (itemCounts[row.itemId] ?? 0) > 1}
                  />
                  ));
                })()}
                <button
                  type="button"
                  onClick={addRow}
                  className="w-full py-3 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-[#1A6DB5] hover:text-[#1A6DB5] transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                >
                  <Plus className="h-4 w-4" />Add Item
                </button>
              </>
            ) : (
              <SimpleCard
                form={simple}
                itemOptions={itemOptions}
                vendorList={vendorList}
                stockItems={stockItems}
                onChange={updateSimple}
                onAddVendorSave={handleVendorSaveSimple}
              />
            )}
          </div>

          {/* Summary */}
          <div className="bg-white border border-border rounded-xl shadow-sm p-5 space-y-3">
            <h2 className="font-semibold">Summary</h2>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Units</span>
              <span className="font-bold">{totalQty}</span>
            </div>
            <div>
              <button
                type="button"
                className="flex items-center justify-between w-full text-sm"
                onClick={() => setShowBreakdown(b => !b)}
              >
                <span className="text-muted-foreground">Total Cost</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#1A6DB5]">{fmtRWF(String(totalCost))}</span>
                  {showBreakdown
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>
              {showBreakdown && (
                <div className="mt-2 pl-4 space-y-1 border-l-2 border-border">
                  {PAYMENT_METHODS.map(m => {
                    const amt = byPayment[m.value] ?? 0;
                    return (
                      <div key={m.value} className="flex justify-between text-xs text-muted-foreground">
                        <span>{m.label}</span>
                        <span>{fmtRWF(String(amt))}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pb-8">
            {/* Desktop layout */}
            <div className="hidden sm:flex items-center gap-3">
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleCancelClick}
              >
                <X className="h-4 w-4 mr-1.5" />Cancel Purchase
              </Button>
              <div className="flex-1" />
              <Button variant="outline" onClick={handleSaveDraft} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                Save
              </Button>
              <Button
                className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90"
                onClick={handleVerify}
                disabled={!canVerify}
              >
                <FileCheck className="h-4 w-4 mr-1.5" />Verify
              </Button>
              <div className="relative group">
                <Button
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!verified}
                  onClick={handleConfirm}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />Confirm Purchase
                </Button>
                {!verified && (
                  <div className="absolute bottom-full mb-2 right-0 hidden group-hover:block bg-gray-800 text-white text-xs rounded-lg px-3 py-1.5 whitespace-nowrap z-10">
                    Please verify first
                  </div>
                )}
              </div>
            </div>

            {/* Mobile layout — Confirm on top */}
            <div className="flex flex-col gap-3 sm:hidden">
              <div className="relative group">
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!verified}
                  onClick={handleConfirm}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />Confirm Purchase
                </Button>
                {!verified && (
                  <p className="text-center text-xs text-muted-foreground mt-1">Please verify first</p>
                )}
              </div>
              <Button
                className="w-full bg-[#1A6DB5] hover:bg-[#1A6DB5]/90"
                onClick={handleVerify}
                disabled={!canVerify}
              >
                <FileCheck className="h-4 w-4 mr-1.5" />Verify
              </Button>
              <Button className="w-full" variant="outline" onClick={handleSaveDraft} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                Save
              </Button>
              <Button
                className="w-full text-red-600 border-red-200 hover:bg-red-50"
                variant="outline"
                onClick={handleCancelClick}
              >
                <X className="h-4 w-4 mr-1.5" />Cancel Purchase
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
