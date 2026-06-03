import { useState, useCallback } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useListCustomers, getListCustomersQueryKey } from "@workspace/api-client-react";
import { api, fmtRWF } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  ShoppingCart, Plus, Trash2, Loader2, UserPlus, X, Eye, CheckCircle2,
  AlertCircle, ArrowLeftRight, ChevronDown, Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ReceiptModal } from "@/components/ReceiptModal";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "mobile_money", label: "MoMo" },
  { value: "bank", label: "Bank Transfer" },
  { value: "credit", label: "Credit" },
  { value: "split", label: "Split Payment" },
];

const SPLIT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "mobile_money", label: "MoMo" },
  { value: "bank", label: "Bank Transfer" },
];

let lineCounter = 0;
function newLineKey() { return `line-${++lineCounter}`; }

interface LineItem {
  key: string;
  itemId: string;
  itemName: string;
  isSerial: boolean;
  serializedUnitId: string;
  unitDescription: string;
  quantity: string;
  unitPrice: string;
  availableStock: number;
}

function emptyLine(): LineItem {
  return { key: newLineKey(), itemId: "", itemName: "", isSerial: false, serializedUnitId: "", unitDescription: "", quantity: "1", unitPrice: "", availableStock: 0 };
}

function conditionBadge(condition: string | null) {
  const c = (condition || "").toLowerCase();
  if (!c) return { cls: "bg-gray-100 text-gray-600", label: "Unknown" };
  if (c.includes("brand new")) return { cls: "bg-green-100 text-green-700", label: "Brand New" };
  if (c.includes("screen")) return { cls: "bg-red-100 text-red-700", label: condition! };
  const match = c.match(/(\d+)\s*%/);
  if (match) {
    const pct = parseInt(match[1]);
    if (pct < 70) return { cls: "bg-red-100 text-red-700", label: condition! };
    if (pct < 90) return { cls: "bg-amber-100 text-amber-700", label: condition! };
    return { cls: "bg-green-100 text-green-700", label: condition! };
  }
  return { cls: "bg-gray-100 text-gray-600", label: condition! };
}

function useItems() {
  return useQuery({
    queryKey: ["items", "all"],
    queryFn: () => api.get<{ items: any[] }>("/items?limit=500").then(r => r.items ?? []),
  });
}

function useSerializedUnits(itemId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["item-units", itemId],
    queryFn: () => api.get<any[]>(`/items/${itemId}/units`),
    enabled: enabled && !!itemId,
    staleTime: 30000,
  });
}

function LineItemCard({
  line, allLines, itemList, onUpdate, onRemove, canRemove, onMerge,
}: {
  line: LineItem; allLines: LineItem[]; itemList: any[];
  onUpdate: (key: string, patch: Partial<LineItem>) => void;
  onRemove: (key: string) => void; canRemove: boolean;
  onMerge?: (fromKey: string, intoKey: string) => void;
}) {
  const { data: units = [] } = useSerializedUnits(line.itemId, line.isSerial);

  const selectedUnitIds = allLines
    .filter(l => l.key !== line.key && l.serializedUnitId)
    .map(l => l.serializedUnitId);
  const availableUnits = units.filter((u: any) => !selectedUnitIds.includes(String(u.id)));

  const subtotal = parseFloat(line.quantity || "1") * parseFloat(line.unitPrice || "0");

  const handleItemChange = (itemId: string) => {
    const item = itemList.find((i: any) => String(i.id) === itemId);
    if (!item) { onUpdate(line.key, { itemId: "", itemName: "", isSerial: false, serializedUnitId: "", unitDescription: "", unitPrice: "", availableStock: 0 }); return; }
    const isSerial = item.trackSerial === true;
    onUpdate(line.key, {
      itemId: String(item.id),
      itemName: item.name,
      isSerial,
      serializedUnitId: "",
      unitDescription: "",
      unitPrice: String(item.salePrice || ""),
      quantity: isSerial ? "1" : "1",
      availableStock: parseFloat(item.stockQuantity ?? "0"),
    });
  };

  return (
    <div className="bg-gray-50/80 border border-gray-200 rounded-xl p-4 space-y-3 relative">
      {canRemove && (
        <button type="button" onClick={() => onRemove(line.key)}
          className="absolute top-3 right-3 p-1 text-gray-300 hover:text-red-400 transition rounded">
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pr-6 sm:pr-0">
        <div className="sm:col-span-2 space-y-1">
          <label className="text-xs font-semibold text-gray-500 uppercase">Item</label>
          <select value={line.itemId} onChange={e => handleItemChange(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-[#1A6DB5] focus:ring-1 focus:ring-[#1A6DB5]/20">
            <option value="">Select item...</option>
            {itemList.map((item: any) => {
              const qty = parseFloat(item.stockQuantity ?? "0");
              const disabled = qty <= 0 && !item.trackSerial;
              return (
                <option key={item.id} value={item.id} disabled={disabled}>
                  {disabled ? `[Out of stock] ${item.name}` : `${item.name} — ${item.trackSerial ? `${qty} units` : `${qty} in stock`}`}
                </option>
              );
            })}
          </select>
        </div>

        {line.isSerial ? (
          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Select Unit</label>
            {availableUnits.length === 0 && line.itemId ? (
              <div className="h-10 flex items-center px-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-700">
                No units in stock for this product
              </div>
            ) : (
              <select value={line.serializedUnitId} onChange={e => {
                  const uid = e.target.value;
                  const unit = availableUnits.find((u: any) => String(u.id) === uid);
                  const desc = unit
                    ? [unit.color, unit.storage, unit.imeiOrSerial ? `IMEI: ${unit.imeiOrSerial}` : null, unit.condition].filter(Boolean).join(" / ")
                    : "";
                  onUpdate(line.key, { serializedUnitId: uid, unitDescription: desc });
                }}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-[#1A6DB5] focus:ring-1 focus:ring-[#1A6DB5]/20">
                <option value="">Select unit...</option>
                {availableUnits.map((u: any) => {
                  const label = [u.color, u.storage, u.imeiOrSerial ? `IMEI: ${u.imeiOrSerial}` : null, u.condition]
                    .filter(Boolean).join(" / ");
                  return <option key={u.id} value={u.id}>{label || `Unit #${u.id}`}</option>;
                })}
              </select>
            )}
            {line.serializedUnitId && (() => {
              const unit = availableUnits.find((u: any) => String(u.id) === line.serializedUnitId);
              if (!unit) return null;
              const badge = conditionBadge(unit.condition);
              return (
                <div className="flex gap-1.5 flex-wrap mt-1">
                  {unit.color && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">{unit.color}</span>}
                  {unit.storage && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-700">{unit.storage}</span>}
                  {unit.condition && <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${badge.cls}`}>{badge.label}</span>}
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Quantity</label>
            <input type="number" min="1" step="1" value={line.quantity}
              onChange={e => onUpdate(line.key, { quantity: e.target.value })}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-[#1A6DB5] focus:ring-1 focus:ring-[#1A6DB5]/20" />
            {line.itemId && parseFloat(line.quantity) > line.availableStock && (
              <p className="text-xs text-red-500">Only {line.availableStock} available</p>
            )}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500 uppercase">Unit Price (RWF)</label>
          <input type="number" min="0" step="1" value={line.unitPrice}
            onChange={e => onUpdate(line.key, { unitPrice: e.target.value })} placeholder="0"
            className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm font-mono outline-none focus:border-[#1A6DB5] focus:ring-1 focus:ring-[#1A6DB5]/20" />
        </div>
      </div>

      {/* Duplicate non-serial item warning */}
      {!line.isSerial && line.itemId && (() => {
        const firstDup = allLines.find(l => l.key !== line.key && l.itemId === line.itemId && !l.isSerial);
        if (!firstDup) return null;
        return (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="flex-1">This item is already in another line.</span>
            {onMerge && (
              <button type="button" onClick={() => onMerge(line.key, firstDup.key)}
                className="flex-shrink-0 px-2 py-0.5 rounded-md bg-amber-600 text-white hover:bg-amber-700 transition font-medium">
                Merge
              </button>
            )}
          </div>
        );
      })()}

      {line.itemId && line.unitPrice && (
        <div className="flex justify-end">
          <span className="text-xs text-gray-500">Subtotal: </span>
          <span className="text-sm font-bold text-[#1A6DB5] ml-1">{fmtRWF(String(subtotal))}</span>
        </div>
      )}
    </div>
  );
}

function QuickAddCustomerDialog({ open, onClose, onAdded }: {
  open: boolean; onClose: () => void; onAdded: (c: { id: number; name: string; phone?: string }) => void;
}) {
  const [form, setForm] = useState({ name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const customer = await api.post<any>("/customers", { name: form.name.trim(), phone: form.phone || null });
      toast({ title: `Customer "${customer.name}" added` });
      qc.invalidateQueries({ queryKey: getListCustomersQueryKey() });
      setForm({ name: "", phone: "" });
      onAdded(customer);
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="h-4 w-4" />Add New Customer</DialogTitle>
          <DialogDescription>Create a new customer record quickly.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Full Name *</Label>
            <Input placeholder="Customer name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus
              onKeyDown={e => e.key === "Enter" && handleSave()} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input placeholder="+250 ..." value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Add Customer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function paymentLabel(m: string) {
  const map: Record<string, string> = {
    cash: "Cash", bank: "Bank Transfer", mobile_money: "MoMo",
    momo: "MoMo", credit: "Credit", split: "Split Payment",
  };
  return map[m] || m;
}

function SalePreviewModal({ open, onClose, onConfirm, submitting, data, customers }: {
  open: boolean; onClose: () => void; onConfirm: () => void; submitting: boolean;
  data: any; customers: any[];
}) {
  if (!data) return null;
  const customer = data.customerId ? customers.find((c: any) => String(c.id) === data.customerId) : null;
  const subtotal = data.lines.reduce((s: number, l: LineItem) => s + (parseFloat(l.quantity) || 1) * (parseFloat(l.unitPrice) || 0), 0);
  const total = data.total;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-[#1A6DB5]" />
            Sale Preview — Please Review Before Confirming
          </DialogTitle>
          <DialogDescription>Check all details below before recording this sale.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Provisional receipt number */}
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2 text-sm">
            <Receipt className="h-4 w-4 text-[#1A6DB5] flex-shrink-0" />
            <span className="text-gray-500">Receipt No.:</span>
            <span className="font-mono font-semibold text-[#1A6DB5]">REC-{data.saleDate.replace(/-/g, "")}-****</span>
            <span className="text-xs text-gray-400 ml-1">(assigned on confirmation)</span>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-xl p-4 text-sm">
            <div><span className="text-gray-500">Customer:</span> <span className="font-medium ml-1">{customer ? `${customer.name}${customer.phone ? ` · ${customer.phone}` : ""}` : "Walk-in Customer"}</span></div>
            <div><span className="text-gray-500">Date:</span> <span className="font-medium ml-1">{data.saleDate}</span></div>
            <div><span className="text-gray-500">Payment:</span> <span className="font-medium ml-1">
              {data.paymentMethod === "split"
                ? `Split — ${paymentLabel(data.paymentMethod)}: ${fmtRWF(data.splitAmount1)} + ${paymentLabel(data.splitMethod2)}: ${fmtRWF(data.splitAmount2)}`
                : paymentLabel(data.paymentMethod)}
            </span></div>
            {data.paymentMethod === "credit" && (
              <div><span className="text-gray-500">Terms:</span> <span className="font-medium ml-1">{data.paymentTermsDays} days</span></div>
            )}
          </div>

          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">#</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Item</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Description</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500">Qty</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500">Unit Price</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((line: LineItem, idx: number) => {
                  const lineTotal = (parseFloat(line.quantity) || 1) * (parseFloat(line.unitPrice) || 0);
                  return (
                    <tr key={line.key} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium">{line.itemName || "—"}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">
                        {line.isSerial && line.serializedUnitId ? (
                          <span className="text-purple-700">{line.unitDescription || `Unit #${line.serializedUnitId}`}</span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">{line.isSerial ? 1 : line.quantity}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmtRWF(line.unitPrice)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{fmtRWF(String(lineTotal))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-[#F4F6FB] rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="font-mono">{fmtRWF(String(subtotal))}</span></div>
            {parseFloat(data.discountAmount || "0") > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>Discount ({data.discountType === "percent" ? `${data.discountValue}%` : "fixed"})</span>
                <span className="font-mono">-{fmtRWF(data.discountAmount)}</span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-2 flex justify-between text-base font-extrabold text-[#0F1A2E]">
              <span>TOTAL</span>
              <span className="font-mono text-[#1A6DB5]">{fmtRWF(String(total))}</span>
            </div>
            {data.paymentMethod === "cash" && parseFloat(data.amountReceived || "0") > 0 && (
              <>
                <div className="flex justify-between text-gray-600"><span>Amount Received</span><span className="font-mono">{fmtRWF(data.amountReceived)}</span></div>
                <div className="flex justify-between font-semibold text-green-600"><span>Change Due</span><span className="font-mono">{fmtRWF(String(Math.max(0, parseFloat(data.amountReceived) - total)))}</span></div>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose}>← Back to Edit</Button>
          <Button onClick={onConfirm} disabled={submitting} className="bg-green-600 hover:bg-green-700 text-white">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Confirm & Record Sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function MultiSalePage() {
  const { data: customers = [] } = useListCustomers();
  const { data: itemList = [] } = useItems();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [saleDate, setSaleDate] = useState(new Date().toISOString().split("T")[0]);
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentTermsDays, setPaymentTermsDays] = useState(30);
  const [splitMethod1, setSplitMethod1] = useState("cash");
  const [splitMethod2, setSplitMethod2] = useState("mobile_money");
  const [splitAmount1, setSplitAmount1] = useState("");
  const [splitAmount2, setSplitAmount2] = useState("");
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [discountValue, setDiscountValue] = useState("");
  const [discountType, setDiscountType] = useState<"rwf" | "percent">("rwf");
  const [amountReceived, setAmountReceived] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [hasPreviewedOnce, setHasPreviewedOnce] = useState(false);
  const [previewDirty, setPreviewDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receiptSaleId, setReceiptSaleId] = useState<number | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);

  const customerList = (customers as any[]) ?? [];
  const items = Array.isArray(itemList) ? itemList : (itemList as any)?.items ?? [];

  const isCredit = paymentMethod === "credit";
  const isSplit = paymentMethod === "split";
  const isCash = paymentMethod === "cash";

  const subtotal = lines.reduce((s, l) => {
    const qty = l.isSerial ? 1 : (parseFloat(l.quantity) || 0);
    return s + qty * (parseFloat(l.unitPrice) || 0);
  }, 0);

  const discountNum = parseFloat(discountValue) || 0;
  const discountAmount = discountType === "percent"
    ? Math.min(subtotal, subtotal * discountNum / 100)
    : Math.min(subtotal, discountNum);
  const total = subtotal - discountAmount;

  const amountReceivedNum = parseFloat(amountReceived) || 0;
  const changeDue = amountReceivedNum - total;

  const markDirty = useCallback(() => {
    if (hasPreviewedOnce) setPreviewDirty(true);
  }, [hasPreviewedOnce]);

  const updateLine = useCallback((key: string, patch: Partial<LineItem>) => {
    setLines(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l));
    markDirty();
  }, [markDirty]);

  const removeLine = useCallback((key: string) => {
    setLines(prev => prev.filter(l => l.key !== key));
    markDirty();
  }, [markDirty]);

  const mergeLine = useCallback((fromKey: string, intoKey: string) => {
    setLines(prev => {
      const from = prev.find(l => l.key === fromKey);
      const into = prev.find(l => l.key === intoKey);
      if (!from || !into) return prev;
      const combined = (parseFloat(from.quantity) || 0) + (parseFloat(into.quantity) || 0);
      return prev
        .filter(l => l.key !== fromKey)
        .map(l => l.key === intoKey ? { ...l, quantity: String(combined) } : l);
    });
    markDirty();
  }, [markDirty]);

  const addLine = () => { setLines(prev => [...prev, emptyLine()]); markDirty(); };

  const selectedCustomer = customerList.find((c: any) => String(c.id) === customerId);

  const filteredCustomers = customerList.filter((c: any) =>
    !customerSearch ||
    c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone?.includes(customerSearch)
  );

  const resetForm = () => {
    setSaleDate(new Date().toISOString().split("T")[0]);
    setCustomerId(""); setCustomerSearch("");
    setPaymentMethod("cash"); setPaymentTermsDays(30);
    setSplitMethod1("cash"); setSplitMethod2("mobile_money");
    setSplitAmount1(""); setSplitAmount2("");
    setLines([emptyLine()]);
    setDiscountValue(""); setDiscountType("rwf");
    setAmountReceived("");
    setHasPreviewedOnce(false); setPreviewDirty(false);
  };

  const validate = () => {
    const validLines = lines.filter(l => l.itemId && l.unitPrice);
    if (validLines.length === 0) { toast({ title: "Add at least one item", variant: "destructive" }); return false; }

    for (const l of validLines) {
      if (l.isSerial && !l.serializedUnitId) {
        toast({ title: "Select a unit", description: `Please select a specific unit for ${l.itemName}`, variant: "destructive" });
        return false;
      }
      if (!l.isSerial && (parseFloat(l.quantity) || 0) <= 0) {
        toast({ title: "Invalid quantity", description: `Quantity for ${l.itemName} must be > 0`, variant: "destructive" });
        return false;
      }
      if (!l.isSerial && (parseFloat(l.quantity) || 0) > l.availableStock) {
        toast({ title: "Insufficient stock", description: `Only ${l.availableStock} available for ${l.itemName}`, variant: "destructive" });
        return false;
      }
    }

    if (isCredit && !customerId) {
      toast({ title: "Customer required", description: "A customer is required for credit sales — walk-in customers cannot buy on credit", variant: "destructive" });
      return false;
    }

    if (isSplit) {
      const a1 = parseFloat(splitAmount1) || 0;
      const a2 = parseFloat(splitAmount2) || 0;
      if (Math.abs(a1 + a2 - total) > 0.5) {
        toast({ title: "Split amounts mismatch", description: `Split amounts must equal the total of ${fmtRWF(String(total))}`, variant: "destructive" });
        return false;
      }
    }

    if (discountNum < 0 || discountAmount > subtotal) {
      toast({ title: "Invalid discount", description: "Discount cannot exceed subtotal", variant: "destructive" });
      return false;
    }

    return true;
  };

  const openPreview = () => {
    if (!validate()) return;
    setShowPreview(true);
    setHasPreviewedOnce(true);
    setPreviewDirty(false);
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    const validLines = lines.filter(l => l.itemId && l.unitPrice);
    try {
      const sale = await api.post<any>("/sales", {
        customerId: customerId ? Number(customerId) : null,
        paymentMethod: isSplit ? splitMethod1 : paymentMethod,
        totalAmount: String(total),
        discountAmount: discountAmount > 0 ? String(discountAmount) : undefined,
        discountType: discountAmount > 0 ? discountType : undefined,
        amountReceived: isCash && amountReceivedNum > 0 ? String(amountReceivedNum) : undefined,
        changeGiven: isCash && changeDue >= 0 ? String(changeDue) : undefined,
        paymentTermsDays: isCredit ? paymentTermsDays : undefined,
        splitPaymentMethod2: isSplit ? splitMethod2 : undefined,
        splitPaymentAmount1: isSplit ? String(parseFloat(splitAmount1) || 0) : undefined,
        splitPaymentAmount2: isSplit ? String(parseFloat(splitAmount2) || 0) : undefined,
        saleDate,
        items: validLines.map(l => ({
          itemId: Number(l.itemId),
          quantity: l.isSerial ? 1 : parseFloat(l.quantity),
          unitPrice: parseFloat(l.unitPrice),
          serializedUnitId: l.isSerial && l.serializedUnitId ? Number(l.serializedUnitId) : undefined,
        })),
      });

      setShowPreview(false);
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["item-units"] });
      qc.invalidateQueries({ queryKey: ["items"] });
      resetForm();
      setReceiptSaleId(sale.id);
      toast({ title: "Sale recorded!", description: "Receipt is ready." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const confirmDisabled = !hasPreviewedOnce || previewDirty;

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-[#1A6DB5]" /> New Sale
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">Record a sale — supports serialized items, split payments, credit, and discounts</p>
      </div>

      <div className="space-y-5">
        {/* SALE DETAILS */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">Sale Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase">Date</label>
              <input type="date" value={saleDate} onChange={e => { setSaleDate(e.target.value); markDirty(); }}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-[#1A6DB5]" />
            </div>

            <div className="space-y-1.5 sm:col-span-1 lg:col-span-2">
              <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                Customer
                {isCredit && <span className="text-red-500 font-bold">*</span>}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div
                    className={`w-full h-10 px-3 pr-8 rounded-xl border text-sm bg-white flex items-center cursor-pointer select-none ${isCredit && !customerId ? "border-red-400 ring-1 ring-red-300" : "border-gray-200"}`}
                    onClick={() => setShowCustomerDropdown(v => !v)}
                  >
                    <span className={selectedCustomer ? "text-gray-800 font-medium" : "text-gray-400"}>
                      {selectedCustomer ? `${selectedCustomer.name}${selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ""}` : "Walk-in Customer"}
                    </span>
                    <ChevronDown className="absolute right-2 top-3 h-4 w-4 text-gray-400" />
                  </div>

                  {showCustomerDropdown && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 flex flex-col">
                      <div className="p-2 border-b border-gray-100">
                        <input autoFocus value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                          placeholder="Search by name or phone..."
                          className="w-full h-8 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#1A6DB5]" />
                      </div>
                      <div className="overflow-y-auto">
                        <button type="button" onClick={() => { setCustomerId(""); setCustomerSearch(""); setShowCustomerDropdown(false); markDirty(); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-gray-500 italic">
                          Walk-in Customer
                        </button>
                        {filteredCustomers.map((c: any) => (
                          <button type="button" key={c.id}
                            onClick={() => { setCustomerId(String(c.id)); setCustomerSearch(""); setShowCustomerDropdown(false); markDirty(); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex flex-col">
                            <span className="font-medium text-gray-800">{c.name}</span>
                            {c.phone && <span className="text-xs text-gray-400">{c.phone}</span>}
                          </button>
                        ))}
                        {filteredCustomers.length === 0 && customerSearch && (
                          <div className="px-3 py-2 text-sm text-gray-400">No customers found</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button type="button" onClick={() => setShowAddCustomer(true)}
                  className="h-10 w-10 flex-shrink-0 rounded-xl border border-dashed border-[#1A6DB5] text-[#1A6DB5] hover:bg-[#1A6DB5]/5 flex items-center justify-center transition"
                  title="Add new customer">
                  <UserPlus className="h-4 w-4" />
                </button>
              </div>
              {isCredit && !customerId && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  A customer is required for credit sales — walk-in customers cannot buy on credit
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase">Payment Method</label>
              <select value={paymentMethod} onChange={e => { setPaymentMethod(e.target.value); markDirty(); }}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-[#1A6DB5]">
                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>

            {isCredit && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase">Payment Terms (Days)</label>
                <input type="number" min="1" value={paymentTermsDays} onChange={e => { setPaymentTermsDays(Number(e.target.value)); markDirty(); }}
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-[#1A6DB5]" />
              </div>
            )}
          </div>

          {isSplit && (
            <div className="mt-4 p-4 bg-purple-50/60 border border-purple-100 rounded-xl space-y-3">
              <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Split Payment Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex gap-2">
                  <select value={splitMethod1} onChange={e => { setSplitMethod1(e.target.value); markDirty(); }}
                    className="h-10 px-2 rounded-xl border border-purple-200 bg-white text-sm outline-none focus:border-purple-400 flex-shrink-0">
                    {SPLIT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  <input type="number" min="0" value={splitAmount1} onChange={e => { setSplitAmount1(e.target.value); markDirty(); }}
                    placeholder="Amount RWF" className="flex-1 h-10 px-3 rounded-xl border border-purple-200 bg-white text-sm font-mono outline-none focus:border-purple-400" />
                </div>
                <div className="flex gap-2">
                  <select value={splitMethod2} onChange={e => { setSplitMethod2(e.target.value); markDirty(); }}
                    className="h-10 px-2 rounded-xl border border-purple-200 bg-white text-sm outline-none focus:border-purple-400 flex-shrink-0">
                    {SPLIT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  <input type="number" min="0" value={splitAmount2} onChange={e => { setSplitAmount2(e.target.value); markDirty(); }}
                    placeholder="Amount RWF" className="flex-1 h-10 px-3 rounded-xl border border-purple-200 bg-white text-sm font-mono outline-none focus:border-purple-400" />
                </div>
              </div>
              {splitAmount1 && splitAmount2 && Math.abs((parseFloat(splitAmount1) || 0) + (parseFloat(splitAmount2) || 0) - total) > 0.5 && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Split amounts must equal the total of {fmtRWF(String(total))}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ITEMS */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Items</h2>
              <p className="text-xs text-gray-400 mt-0.5">Serialized items (phones/laptops) show available units with IMEI</p>
            </div>
          </div>

          <div className="space-y-3">
            {lines.map(line => (
              <LineItemCard key={line.key} line={line} allLines={lines} itemList={items}
                onUpdate={updateLine} onRemove={removeLine} canRemove={lines.length > 1} onMerge={mergeLine} />
            ))}
          </div>

          <button type="button" onClick={addLine}
            className="mt-4 w-full h-11 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-[#1A6DB5] hover:text-[#1A6DB5] transition text-sm font-medium flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" /> Add Line
          </button>
        </div>

        {/* ORDER SUMMARY */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">Order Summary</h2>
          <div className="space-y-3 max-w-sm ml-auto">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Items: <span className="font-medium text-gray-700">{lines.filter(l => l.itemId).length}</span></span>
              <span className="text-gray-500">Subtotal: <span className="font-semibold text-gray-800 font-mono">{fmtRWF(String(subtotal))}</span></span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-500 uppercase">Discount</label>
                <button type="button" onClick={() => { setDiscountType(t => t === "rwf" ? "percent" : "rwf"); markDirty(); }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-gray-200 text-xs text-gray-500 hover:border-[#1A6DB5] hover:text-[#1A6DB5] transition">
                  <ArrowLeftRight className="h-3 w-3" />
                  {discountType === "rwf" ? "RWF" : "%"}
                </button>
              </div>
              <div className="flex gap-2">
                <input type="number" min="0" value={discountValue} onChange={e => { setDiscountValue(e.target.value); markDirty(); }}
                  placeholder={discountType === "percent" ? "e.g. 10" : "e.g. 5000"}
                  className="flex-1 h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-mono outline-none focus:border-[#1A6DB5]" />
                <span className="h-10 flex items-center px-3 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-500 font-semibold">
                  {discountType === "percent" ? "%" : "RWF"}
                </span>
              </div>
              {discountAmount > 0 && (
                <p className="text-xs text-orange-600 text-right">Discount: -{fmtRWF(String(discountAmount))}</p>
              )}
              {discountNum > 0 && discountAmount >= subtotal && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Discount cannot exceed subtotal
                </p>
              )}
            </div>

            <div className="border-t border-gray-100 pt-3">
              <div className="flex justify-between text-base font-extrabold text-[#0F1A2E]">
                <span>TOTAL</span>
                <span className="font-mono text-[#1A6DB5]">{fmtRWF(String(total))}</span>
              </div>
            </div>

            {isCash && (
              <div className="space-y-2 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase">Amount Received (RWF)</label>
                  <input type="number" min="0" value={amountReceived} onChange={e => { setAmountReceived(e.target.value); markDirty(); }}
                    placeholder="0" className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-mono outline-none focus:border-[#1A6DB5]" />
                </div>
                {amountReceivedNum > 0 && (
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-gray-500">Change Due</span>
                    <span className={`font-mono ${changeDue >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {fmtRWF(String(Math.abs(changeDue)))} {changeDue < 0 ? "(short)" : ""}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => setShowCancelConfirm(true)}
            className="sm:order-1 order-3">
            <X className="h-4 w-4 mr-2" /> Cancel
          </Button>
          <Button type="button" onClick={openPreview}
            className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90 sm:order-2 order-2">
            <Eye className="h-4 w-4 mr-2" /> Preview Sale
          </Button>
          <div className="relative group sm:order-3 order-1">
            <Button
              type="button"
              onClick={() => !confirmDisabled && handleSubmit()}
              disabled={confirmDisabled || submitting}
              className="w-full bg-green-600 hover:bg-green-700 text-white disabled:opacity-40 disabled:cursor-not-allowed">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Confirm & Record Sale
            </Button>
            {confirmDisabled && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded-lg px-3 py-1.5 opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none">
                Please preview the sale first
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CANCEL CONFIRM */}
      <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel Sale?</DialogTitle>
            <DialogDescription>Are you sure you want to cancel? All entered data will be lost.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelConfirm(false)}>Keep Editing</Button>
            <Button variant="destructive" onClick={() => { resetForm(); setShowCancelConfirm(false); }}>Yes, Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PREVIEW */}
      <SalePreviewModal
        open={showPreview}
        onClose={() => { setShowPreview(false); setPreviewDirty(false); }}
        onConfirm={handleSubmit}
        submitting={submitting}
        customers={customerList}
        data={showPreview ? {
          saleDate, customerId, paymentMethod,
          paymentTermsDays, splitMethod2, splitAmount1, splitAmount2,
          lines: lines.filter(l => l.itemId && l.unitPrice),
          discountAmount: String(discountAmount), discountType, discountValue,
          amountReceived, total,
        } : null}
      />

      {/* ADD CUSTOMER */}
      <QuickAddCustomerDialog
        open={showAddCustomer}
        onClose={() => setShowAddCustomer(false)}
        onAdded={c => { setCustomerId(String(c.id)); markDirty(); }}
      />

      {/* RECEIPT */}
      {receiptSaleId !== null && (
        <ReceiptModal
          saleId={receiptSaleId}
          open={receiptSaleId !== null}
          onClose={() => { setReceiptSaleId(null); qc.invalidateQueries({ queryKey: ["sales"] }); }}
        />
      )}

      {showCustomerDropdown && (
        <div className="fixed inset-0 z-40" onClick={() => setShowCustomerDropdown(false)} />
      )}
    </div>
  );
}
