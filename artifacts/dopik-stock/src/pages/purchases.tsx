import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useListPurchases, useListVendors, useListStock, getListPurchasesQueryKey } from "@workspace/api-client-react";
import { api, fmtRWF, fmtDateTime, paymentBadgeColor } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Search, ShoppingCart, Loader2, Barcode, Trash2,
  ChevronDown, ChevronUp, AlertTriangle, X, Printer,
  FileCheck, Save, ArrowLeft, CheckCircle2, Building2
} from "lucide-react";

const PAYMENT_METHODS = ["cash", "bank", "mobile_money", "credit"];
const CONDITIONS = [
  "Brand New", "Screen Issue", "Battery below 70%",
  "Battery 70% – 80%", "Battery 80% – 90%", "Battery above 90%",
];
const SIMPLE_CONDITIONS = ["Brand New", "Good Condition", "Refurbished"];

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

// ── Searchable Dropdown with Create ──────────────────────────────────────────
function SearchableSelect({
  options, value, onChange, placeholder, onCreate, label,
}: {
  options: { id: string | number; name: string }[];
  value: string; onChange: (v: string) => void;
  placeholder?: string; onCreate?: (name: string) => Promise<void>;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const filtered = options.filter(o => o.name.toLowerCase().includes(q.toLowerCase()));
  const selected = options.find(o => String(o.id) === value);
  const showCreate = onCreate && q.trim() && !filtered.find(o => o.name.toLowerCase() === q.toLowerCase());

  return (
    <div ref={ref} className="relative">
      {label && <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>}
      <button
        type="button"
        onClick={() => { setOpen(!open); setQ(""); }}
        className="w-full h-8 text-left flex items-center justify-between rounded border border-input bg-background px-2 text-xs"
      >
        <span className={selected ? "text-foreground" : "text-muted-foreground truncate"}>
          {selected?.name ?? placeholder ?? "Select…"}
        </span>
        <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 w-full min-w-[180px] bg-white border border-border rounded-lg shadow-lg">
          <div className="p-1.5">
            <Input
              autoFocus
              className="h-7 text-xs"
              placeholder="Search…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>
          <div className="max-h-40 overflow-y-auto">
            {value && (
              <button type="button" className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                onClick={() => { onChange(""); setOpen(false); }}>
                — None —
              </button>
            )}
            {filtered.map(o => (
              <button key={o.id} type="button"
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted"
                onClick={() => { onChange(String(o.id)); setOpen(false); setQ(""); }}>
                {o.name}
              </button>
            ))}
            {showCreate && (
              <button type="button"
                className="w-full text-left px-3 py-1.5 text-xs text-purple-600 hover:bg-purple-50 font-medium"
                onClick={async () => { await onCreate!(q.trim()); setOpen(false); setQ(""); }}>
                + Create "{q.trim()}"
              </button>
            )}
            {filtered.length === 0 && !showCreate && (
              <p className="px-3 py-2 text-xs text-muted-foreground">No results</p>
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
  imeiOrSerial: string;
  condition: string;
  vendorId: string;
  paymentMethod: string;
  unitCost: string;
};

type SimpleForm = {
  itemId: string;
  quantity: string;
  unitCost: string;
  vendorId: string;
  paymentMethod: string;
  condition: string;
};

function emptyRow(): PurchaseRow {
  return {
    id: Math.random().toString(36).slice(2),
    itemId: "", color: "", storage: "",
    imeiOrSerial: "", condition: "",
    vendorId: "", paymentMethod: "cash", unitCost: "",
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
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    w.document.write(`<html><head><title>Purchase Order</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #000; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 8px; font-size: 12px; text-align: left; }
        th { background: #f5f5f5; font-weight: 600; }
        .banner { background: #fffbeb; border: 2px solid #f59e0b; padding: 10px; border-radius: 6px; margin: 12px 0; }
        .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .po-number { font-size: 20px; font-weight: bold; }
        .total-row { font-weight: bold; background: #f5f5f5; }
      </style>
    </head><body>${content}</body></html>`);
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl">
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
          {/* Header */}
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

          {/* Warning banner */}
          <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 flex gap-3 items-start">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-bold text-amber-800">
              ⚠️ This is an internal document for record-keeping purposes only. It must not be shared, posted, or distributed externally.
            </p>
          </div>

          {/* Items table */}
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
                    ? [row.color, row.storage, row.imeiOrSerial ? `IMEI/SN: ${row.imeiOrSerial}` : ""].filter(Boolean).join(" / ")
                    : row.description;
                  return (
                    <tr key={row.id} className="border-b border-gray-100">
                      <td className="border border-gray-200 px-3 py-2 text-xs">{i + 1}</td>
                      <td className="border border-gray-200 px-3 py-2 text-xs font-medium">{item?.itemName ?? item?.name ?? "—"}</td>
                      <td className="border border-gray-200 px-3 py-2 text-xs">{desc || "—"}</td>
                      <td className="border border-gray-200 px-3 py-2 text-xs">{row.condition || "—"}</td>
                      <td className="border border-gray-200 px-3 py-2 text-xs">{vendor?.name ?? "—"}</td>
                      <td className="border border-gray-200 px-3 py-2 text-xs capitalize">{(row.paymentMethod || "").replace(/_/g, " ")}</td>
                      <td className="border border-gray-200 px-3 py-2 text-xs font-semibold">{fmtRWF(row.unitCost || "0")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex justify-end">
            <div className="w-72 space-y-2 bg-gray-50 rounded-xl p-4 border">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Quantity</span>
                <span className="font-semibold">{totalQty} units</span>
              </div>
              <div className="border-t pt-2 space-y-1">
                {Object.entries(byPayment).map(([m, amt]) => (
                  <div key={m} className="flex justify-between text-xs">
                    <span className="text-gray-500 capitalize">{m.replace(/_/g, " ")}</span>
                    <span>{fmtRWF(String(amt))}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between border-t pt-2 font-bold">
                <span>Grand Total</span>
                <span className="text-[#1A6DB5]">{fmtRWF(String(grandTotal))}</span>
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
          <Button
            variant="destructive"
            className="flex-1"
            disabled={!matches}
            onClick={onConfirm}
          >
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
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const v = await api.post<any>("/vendors", { name: name.trim(), phone: phone.trim(), address: notes.trim() });
    onSave(v);
    setSaving(false);
  };

  return (
    <div className="border border-dashed border-purple-300 rounded-xl p-3 bg-purple-50 space-y-2 mt-1">
      <p className="text-xs font-semibold text-purple-700">New Vendor</p>
      <Input className="h-7 text-xs" placeholder="Name *" value={name} onChange={e => setName(e.target.value)} />
      <Input className="h-7 text-xs" placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
      <Input className="h-7 text-xs" placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs flex-1" onClick={save} disabled={!name.trim() || saving}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onClose}>Cancel</Button>
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

  // Cancel flow
  const [cancelStep, setCancelStep] = useState<0 | 1 | 2>(0);
  const [cancelCode] = useState(generateCode);
  const [activeCancelCode, setActiveCancelCode] = useState("");

  // Cost breakdown expand
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Per-unit rows (serialized mode)
  const [rows, setRows] = useState<PurchaseRow[]>([emptyRow()]);

  // Simple form (non-serialized mode)
  const [simple, setSimple] = useState<SimpleForm>({
    itemId: "", quantity: "", unitCost: "",
    vendorId: "", paymentMethod: "cash", condition: "Brand New",
  });

  // Detected mode based on selected item
  const [isSerial, setIsSerial] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState("");

  // Inline vendor add
  const [addVendorForRow, setAddVendorForRow] = useState<string | null>(null); // row id or "simple"

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

  const purchases: any[] = (data as any) ?? [];
  const vendorList: any[] = (vendors as any) ?? [];
  const stockItems: any[] = (stock as any) ?? [];
  const colors: any[] = colorsData ?? [];
  const storageOptions: any[] = storageData ?? [];

  const filtered = purchases.filter(p =>
    !search || (p.itemName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  // Detect if item requires serial tracking
  const handleItemSelect = (itemId: string, rowId?: string) => {
    const item = stockItems.find((s: any) => String(s.itemId ?? s.id) === itemId);
    const serial = item?.trackSerial === true;
    setSelectedItemId(itemId);
    setIsSerial(serial);
    setVerified(false);

    if (rowId) {
      setRows(rs => rs.map(r => r.id === rowId ? { ...r, itemId } : r));
    } else {
      setSimple(f => ({ ...f, itemId }));
    }
  };

  const updateRow = (id: string, field: keyof PurchaseRow, val: string) => {
    setVerified(false);
    setRows(rs => rs.map(r => r.id === id ? { ...r, [field]: val } : r));
  };
  const addRow = () => { setVerified(false); setRows(rs => [...rs, emptyRow()]); };
  const removeRow = (id: string) => { setVerified(false); setRows(rs => rs.filter(r => r.id !== id)); };

  // Totals
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
    const itemId = isSerial ? (rows[0]?.itemId ? Number(rows[0].itemId) : null) : (simple.itemId ? Number(simple.itemId) : null);
    if (!itemId) { toast({ title: "Select an item first", variant: "destructive" }); return; }

    setSaving(true);
    try {
      const payload = {
        itemId,
        quantity: String(totalQty || 1),
        totalCost: String(totalCost),
        paymentMethod: isSerial ? (rows[0]?.paymentMethod || "cash") : simple.paymentMethod,
        vendorId: isSerial ? (rows[0]?.vendorId ? Number(rows[0].vendorId) : null) : (simple.vendorId ? Number(simple.vendorId) : null),
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

      toast({ title: "Purchase saved as draft" });
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
        vendorId: isSerial ? (rows[0]?.vendorId ? Number(rows[0].vendorId) : null) : (simple.vendorId ? Number(simple.vendorId) : null),
        status: "confirmed",
        poNumber,
        units: isSerial ? rows.map(r => ({
          imeiOrSerial: r.imeiOrSerial,
          color: r.color,
          storage: r.storage,
          condition: r.condition,
          vendorId: r.vendorId ? Number(r.vendorId) : null,
          costPrice: r.unitCost,
          paymentMethod: r.paymentMethod,
        })) : undefined,
      };

      if (draftId) {
        await api.patch<any>(`/purchases/${draftId}`, { ...payload });
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
    setSimple({ itemId: "", quantity: "", unitCost: "", vendorId: "", paymentMethod: "cash", condition: "Brand New" });
    setIsSerial(false);
    setSelectedItemId("");
    setVerified(false);
    setPoNumber("");
    setDraftId(null);
    setShowBreakdown(false);
    setAddVendorForRow(null);
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

  // Load draft
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
  const createVendor = async (vendor: any) => {
    await refetchVendors();
    setAddVendorForRow(null);
  };

  const itemOptions = stockItems.map((s: any) => ({
    id: s.itemId ?? s.id,
    name: `${s.itemName} (in stock: ${parseFloat(s.quantity).toLocaleString()})`,
  }));

  const itemSelected = stockItems.find((s: any) => String(s.itemId ?? s.id) === selectedItemId);

  return (
    <div className="space-y-5">
      {/* Cancel Modals */}
      {cancelStep === 1 && (
        <CancelModal1
          onBack={() => setCancelStep(0)}
          onProceed={() => setCancelStep(2)}
        />
      )}
      {cancelStep === 2 && (
        <CancelModal2
          code={activeCancelCode}
          onBack={() => setCancelStep(1)}
          onConfirm={handleCancelConfirm}
        />
      )}

      {/* PO Preview */}
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
                          {p.paymentMethod?.replace(/_/g, " ")}
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
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button onClick={handleCancelClick} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold font-sora">Record New Purchase</h1>
              {draftId && <p className="text-xs text-amber-600 font-medium">Editing draft #{draftId}</p>}
            </div>
          </div>

          {/* Item selector (only in simple mode or before any row has an item) */}
          {!isSerial && (
            <div className="glass-panel p-5 space-y-4">
              <h2 className="font-semibold">Item Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Item *</p>
                  <SearchableSelect
                    options={itemOptions}
                    value={simple.itemId}
                    onChange={v => handleItemSelect(v)}
                    placeholder="Select item…"
                  />
                </div>
                {simple.itemId && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Condition</p>
                    <select className="w-full h-8 rounded border border-input bg-background px-2 text-xs"
                      value={simple.condition} onChange={e => setSimple(f => ({ ...f, condition: e.target.value }))}>
                      {SIMPLE_CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}
              </div>
              {simple.itemId && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Quantity *</p>
                    <Input type="number" min={1} className="h-8 text-xs" value={simple.quantity}
                      onChange={e => { setSimple(f => ({ ...f, quantity: e.target.value })); setVerified(false); }} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Unit Cost (RWF) *</p>
                    <Input type="number" min={0} className="h-8 text-xs" value={simple.unitCost}
                      onChange={e => { setSimple(f => ({ ...f, unitCost: e.target.value })); setVerified(false); }} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Payment Method</p>
                    <select className="w-full h-8 rounded border border-input bg-background px-2 text-xs"
                      value={simple.paymentMethod} onChange={e => { setSimple(f => ({ ...f, paymentMethod: e.target.value })); setVerified(false); }}>
                      {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Vendor</p>
                    <SearchableSelect
                      options={vendorList}
                      value={simple.vendorId}
                      onChange={v => { if (v === "__add__") { setAddVendorForRow("simple"); } else { setSimple(f => ({ ...f, vendorId: v })); setVerified(false); } }}
                      placeholder="Select vendor…"
                    />
                    {addVendorForRow === "simple" && (
                      <AddVendorInline
                        onSave={v => { refetchVendors(); setSimple(f => ({ ...f, vendorId: String(v.id) })); setAddVendorForRow(null); setVerified(false); }}
                        onClose={() => setAddVendorForRow(null)}
                      />
                    )}
                    {addVendorForRow !== "simple" && (
                      <button type="button" className="mt-1 text-xs text-purple-600 hover:underline flex items-center gap-1"
                        onClick={() => setAddVendorForRow("simple")}>
                        <Building2 className="h-3 w-3" />Add new vendor
                      </button>
                    )}
                  </div>
                </div>
              )}
              {simple.itemId && stockItems.find((s: any) => String(s.itemId ?? s.id) === simple.itemId)?.trackSerial && (
                <p className="text-xs text-purple-600 flex items-center gap-1 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
                  <Barcode className="h-3 w-3" />
                  This item requires IMEI / serial number tracking — switch to "Serialized Entry" above
                </p>
              )}
            </div>
          )}

          {/* Per-unit table (serialized mode) */}
          {isSerial && (
            <div className="glass-panel p-5 space-y-4 overflow-x-auto">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Per-Unit Entry</h2>
                <Badge className="bg-purple-100 text-purple-700 border border-purple-200 text-xs">
                  <Barcode className="h-3 w-3 mr-1" />Serialized Item
                </Badge>
              </div>

              <div className="min-w-[900px]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/60 rounded">
                      <th className="text-left px-2 py-2 font-medium text-muted-foreground w-36">Item</th>
                      <th className="text-left px-2 py-2 font-medium text-muted-foreground w-28">Color</th>
                      <th className="text-left px-2 py-2 font-medium text-muted-foreground w-28">Storage</th>
                      <th className="text-left px-2 py-2 font-medium text-muted-foreground w-36">IMEI / Serial</th>
                      <th className="text-left px-2 py-2 font-medium text-muted-foreground w-36">Condition</th>
                      <th className="text-left px-2 py-2 font-medium text-muted-foreground w-32">Vendor</th>
                      <th className="text-left px-2 py-2 font-medium text-muted-foreground w-28">Payment</th>
                      <th className="text-left px-2 py-2 font-medium text-muted-foreground w-28">Unit Cost</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((row, idx) => (
                      <tr key={row.id} className="group">
                        <td className="px-1 py-1.5">
                          <SearchableSelect
                            options={itemOptions}
                            value={row.itemId}
                            onChange={v => { updateRow(row.id, "itemId", v); if (idx === 0) handleItemSelect(v, row.id); else updateRow(row.id, "itemId", v); }}
                            placeholder="Item…"
                          />
                          {row.itemId && stockItems.find((s: any) => String(s.itemId ?? s.id) === row.itemId)?.trackSerial && (
                            <p className="text-[10px] text-purple-600 mt-0.5 flex items-center gap-0.5">
                              <Barcode className="h-2.5 w-2.5" />Requires IMEI/serial
                            </p>
                          )}
                        </td>
                        <td className="px-1 py-1.5">
                          <SearchableSelect
                            options={colors}
                            value={row.color ? String(colors.find(c => c.name === row.color)?.id ?? "") : ""}
                            onChange={v => { const c = colors.find(c => String(c.id) === v); updateRow(row.id, "color", c?.name ?? ""); }}
                            placeholder="Color…"
                            onCreate={async name => { await createColor(name); const fresh = await api.get<any[]>("/colors"); const found = fresh.find((c: any) => c.name === name); if (found) updateRow(row.id, "color", found.name); }}
                          />
                        </td>
                        <td className="px-1 py-1.5">
                          <SearchableSelect
                            options={storageOptions}
                            value={row.storage ? String(storageOptions.find(s => s.name === row.storage)?.id ?? "") : ""}
                            onChange={v => { const s = storageOptions.find(s => String(s.id) === v); updateRow(row.id, "storage", s?.name ?? ""); }}
                            placeholder="Storage…"
                            onCreate={async name => { await createStorage(name); const fresh = await api.get<any[]>("/storage-options"); const found = fresh.find((s: any) => s.name === name); if (found) updateRow(row.id, "storage", found.name); }}
                          />
                        </td>
                        <td className="px-1 py-1.5">
                          <Input
                            className="h-8 text-xs font-mono"
                            value={row.imeiOrSerial}
                            onChange={e => updateRow(row.id, "imeiOrSerial", e.target.value)}
                            placeholder={itemSelected?.category?.includes("Laptop") || row.itemId && stockItems.find((s: any) => String(s.itemId ?? s.id) === row.itemId)?.category?.toLowerCase().includes("laptop") ? "Serial Number…" : "IMEI…"}
                          />
                        </td>
                        <td className="px-1 py-1.5">
                          <select className="w-full h-8 rounded border border-input bg-background px-1.5 text-xs"
                            value={row.condition} onChange={e => updateRow(row.id, "condition", e.target.value)}>
                            <option value="">Condition…</option>
                            {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td className="px-1 py-1.5">
                          <SearchableSelect
                            options={vendorList}
                            value={row.vendorId}
                            onChange={v => updateRow(row.id, "vendorId", v)}
                            placeholder="Vendor…"
                          />
                          {addVendorForRow !== row.id && (
                            <button type="button" className="mt-0.5 text-[10px] text-purple-600 hover:underline"
                              onClick={() => setAddVendorForRow(row.id)}>
                              + New vendor
                            </button>
                          )}
                          {addVendorForRow === row.id && (
                            <AddVendorInline
                              onSave={v => { refetchVendors(); updateRow(row.id, "vendorId", String(v.id)); setAddVendorForRow(null); setVerified(false); }}
                              onClose={() => setAddVendorForRow(null)}
                            />
                          )}
                        </td>
                        <td className="px-1 py-1.5">
                          <select className="w-full h-8 rounded border border-input bg-background px-1.5 text-xs"
                            value={row.paymentMethod} onChange={e => { updateRow(row.id, "paymentMethod", e.target.value); setVerified(false); }}>
                            {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
                          </select>
                        </td>
                        <td className="px-1 py-1.5">
                          <Input
                            type="number" min={0} className="h-8 text-xs"
                            value={row.unitCost}
                            onChange={e => { updateRow(row.id, "unitCost", e.target.value); setVerified(false); }}
                            placeholder="0"
                          />
                        </td>
                        <td className="px-1 py-1.5">
                          {rows.length > 1 && (
                            <button onClick={() => removeRow(row.id)} className="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={addRow}
                className="flex items-center gap-2 text-sm text-[#1A6DB5] hover:text-[#1A6DB5]/80 font-medium"
              >
                <Plus className="h-4 w-4" />Add Item
              </button>
            </div>
          )}

          {/* Summary Section */}
          {(isSerial ? rows.some(r => r.itemId) : simple.itemId) && (
            <div className="glass-panel p-5 space-y-3">
              <h2 className="font-semibold text-sm">Summary</h2>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Quantity</span>
                <span className="font-bold">{totalQty} {totalQty === 1 ? "unit" : "units"}</span>
              </div>
              <div>
                <button
                  className="flex items-center justify-between w-full text-sm group"
                  onClick={() => setShowBreakdown(b => !b)}
                >
                  <span className="text-muted-foreground">Total Cost (RWF)</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#1A6DB5]">{fmtRWF(String(totalCost))}</span>
                    {showBreakdown ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                </button>
                {showBreakdown && (
                  <div className="mt-2 pl-4 space-y-1 border-l-2 border-border">
                    {Object.entries(byPayment).map(([m, amt]) => (
                      <div key={m} className="flex justify-between text-xs text-muted-foreground">
                        <span className="capitalize">{m.replace(/_/g, " ")}</span>
                        <span>{fmtRWF(String(amt))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pb-8">
            <Button
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={handleCancelClick}
            >
              <X className="h-4 w-4 mr-1.5" />Cancel Purchase
            </Button>
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
              Save
            </Button>
            <Button
              className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90"
              onClick={handleVerify}
              disabled={
                isSerial
                  ? !rows.some(r => r.itemId && r.unitCost)
                  : !simple.itemId || !simple.quantity || !simple.unitCost
              }
            >
              <FileCheck className="h-4 w-4 mr-1.5" />Verify
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              disabled={!verified}
              onClick={handleConfirm}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />Confirm Purchase
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
