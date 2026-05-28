import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListSales, useListCustomers, useListStock, getListSalesQueryKey, getListCustomersQueryKey } from "@workspace/api-client-react";
import { api, fmtRWF, fmtDateTime, paymentBadgeColor } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, TrendingUp, Loader2, Trash2, AlertCircle, Undo2, ShieldAlert, UserPlus } from "lucide-react";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash (Payment Now)" },
  { value: "bank", label: "Bank (Payment Now)" },
  { value: "mobile_money", label: "Mobile Money (Payment Now)" },
  { value: "credit", label: "Credit (Payment Later)" },
];

type SaleLineItem = {
  itemId: number; itemName: string; qtyType: string;
  quantity: string; unitPrice: string; availableQty: number;
};

type Sale = {
  id: number;
  customerName?: string | null;
  paymentMethod?: string | null;
  totalAmount?: string | null;
  reverted?: boolean | null;
  createdAt?: string | null;
  items?: { itemName: string; itemId: number; quantity: string }[];
};

function revertPhrase(sale: Sale) {
  return `sudo revert sale #${sale.id}`;
}

/* ── Revert Dialog ────────────────────────────────────────── */
function RevertDialog({ sale, open, onClose, onReverted }: {
  sale: Sale; open: boolean; onClose: () => void; onReverted: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [reverting, setReverting] = useState(false);
  const { toast } = useToast();
  const phrase = revertPhrase(sale);
  const matches = typed === phrase;

  const handleRevert = async () => {
    if (!matches) return;
    setReverting(true);
    try {
      await api.post(`/sales/${sale.id}/revert`);
      toast({ title: "Sale reverted", description: "Stock has been restored." });
      onReverted();
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setReverting(false); setTyped(""); }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setTyped(""); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <ShieldAlert className="h-5 w-5" />Confirm Revert Sale
          </DialogTitle>
          <DialogDescription>
            This will reverse the sale and restore all stock. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm space-y-1">
            <p className="text-red-700 font-medium">Sale #{sale.id} — {sale.customerName ?? "Walk-in"}</p>
            <p className="text-red-600">{fmtRWF(sale.totalAmount)} · {(sale.items ?? []).map(i => i.itemName).join(", ") || "—"}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">
              Type <span className="font-mono font-bold bg-gray-100 px-1.5 py-0.5 rounded text-gray-800">{phrase}</span> to confirm:
            </Label>
            <Input
              value={typed} onChange={e => setTyped(e.target.value)}
              placeholder={phrase}
              className={`font-mono text-sm ${typed && !matches ? "border-red-300 focus-visible:ring-red-300" : typed && matches ? "border-green-400 focus-visible:ring-green-300" : ""}`}
              autoFocus
              onKeyDown={e => e.key === "Enter" && matches && handleRevert()}
            />
            {typed && !matches && <p className="text-xs text-red-500">Phrase does not match</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); setTyped(""); }}>Cancel</Button>
          <Button onClick={handleRevert} disabled={!matches || reverting} className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-40">
            {reverting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Confirm Revert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Quick Add Customer Dialog ────────────────────────────── */
function QuickAddCustomerDialog({ open, onClose, onAdded }: {
  open: boolean; onClose: () => void; onAdded: (customer: { id: number; name: string }) => void;
}) {
  const [form, setForm] = useState({ name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const customer = await api.post("/customers", { name: form.name.trim(), phone: form.phone || null });
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
            <Input placeholder="Customer name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus onKeyDown={e => e.key === "Enter" && handleSave()} />
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

/* ── Main Page ─────────────────────────────────────────────── */
export default function SalesPage() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentTermsDays, setPaymentTermsDays] = useState(30);
  const [lineItems, setLineItems] = useState<SaleLineItem[]>([]);
  const [revertSale, setRevertSale] = useState<Sale | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useListSales({});
  const { data: customers } = useListCustomers();
  const { data: stock } = useListStock({});
  const sales: Sale[] = (data as any) ?? [];
  const customerList: any[] = (customers as any) ?? [];
  const stockItems: any[] = (stock as any) ?? [];

  const isCredit = paymentMethod === "credit";

  const resetForm = () => {
    setLineItems([]);
    setCustomerId("");
    setPaymentMethod("cash");
    setPaymentTermsDays(30);
  };

  const addLineItem = (stockEntry: any) => {
    if (lineItems.find(l => l.itemId === stockEntry.itemId)) return;
    setLineItems(prev => [...prev, {
      itemId: stockEntry.itemId,
      itemName: stockEntry.itemName,
      qtyType: stockEntry.qtyType,
      quantity: "1",
      unitPrice: stockEntry.salePrice,
      availableQty: parseFloat(stockEntry.quantity),
    }]);
  };

  const updateLine = (idx: number, key: string, val: string) => {
    setLineItems(prev => prev.map((l, i) => i === idx ? { ...l, [key]: val } : l));
  };

  const removeLine = (idx: number) => setLineItems(prev => prev.filter((_, i) => i !== idx));

  const totalAmount = lineItems.reduce((sum, l) => {
    return sum + (parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0);
  }, 0);

  const handleCreate = async () => {
    if (lineItems.length === 0 || !paymentMethod) return;

    // Credit requires a customer
    if (isCredit && !customerId) {
      toast({ title: "Customer required", description: "Credit sales must be linked to a customer. Please select or add one.", variant: "destructive" });
      return;
    }

    for (const l of lineItems) {
      if (parseFloat(l.quantity) <= 0) {
        toast({ title: "Invalid quantity", description: `Quantity for ${l.itemName} must be > 0`, variant: "destructive" });
        return;
      }
      if (parseFloat(l.quantity) > l.availableQty) {
        toast({ title: "Insufficient stock", description: `Only ${l.availableQty} ${l.qtyType} available for ${l.itemName}`, variant: "destructive" });
        return;
      }
    }

    setSaving(true);
    try {
      await api.post("/sales", {
        customerId: customerId ? Number(customerId) : null,
        paymentMethod,
        totalAmount: totalAmount.toFixed(2),
        paymentTermsDays: isCredit ? paymentTermsDays : undefined,
        items: lineItems.map(l => ({
          itemId: l.itemId,
          quantity: parseFloat(l.quantity),
          unitPrice: parseFloat(l.unitPrice),
        })),
      });
      toast({ title: "Sale recorded", description: `Total: ${fmtRWF(totalAmount)}` });
      setShowCreate(false);
      resetForm();
      qc.invalidateQueries({ queryKey: getListSalesQueryKey() });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const filtered = sales.filter(s =>
    !search || (s.customerName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-sora">Sales</h1>
          <p className="text-sm text-muted-foreground">Record and manage sales transactions</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90 self-start sm:self-auto">
          <Plus className="h-4 w-4 mr-2" />New Sale
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by customer..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {["#", "Customer", "Items", "Total", "Payment", "Status", "Date", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {[...Array(8)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />No sales found
                </td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} className={`border-b border-border hover:bg-muted/30 transition-colors ${s.reverted ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3 text-muted-foreground">#{s.id}</td>
                  <td className="px-4 py-3 font-medium">{s.customerName ?? "Walk-in"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-[160px]">
                    <span className="truncate block">
                      {(s.items ?? []).map((i: any) => `${i.itemName} ×${parseFloat(i.quantity)}`).join(", ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-green-600">{fmtRWF(s.totalAmount)}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs ${paymentBadgeColor(s.paymentMethod)}`}>
                      {s.paymentMethod?.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {s.reverted
                      ? <Badge className="bg-red-100 text-red-700 text-xs">Reverted</Badge>
                      : <Badge className="bg-green-100 text-green-700 text-xs">Completed</Badge>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmtDateTime(s.createdAt)}</td>
                  <td className="px-4 py-3">
                    {!s.reverted && (
                      <Button size="sm" variant="ghost" className="text-orange-500 hover:text-orange-600 hover:bg-orange-50"
                        onClick={() => setRevertSale(s)} title="Revert sale">
                        <Undo2 className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revert Dialog */}
      {revertSale && (
        <RevertDialog
          sale={revertSale} open={!!revertSale}
          onClose={() => setRevertSale(null)}
          onReverted={() => qc.invalidateQueries({ queryKey: getListSalesQueryKey() })}
        />
      )}

      {/* Quick Add Customer Dialog */}
      <QuickAddCustomerDialog
        open={showAddCustomer}
        onClose={() => setShowAddCustomer(false)}
        onAdded={customer => setCustomerId(String(customer.id))}
      />

      {/* Create Sale Dialog */}
      <Dialog open={showCreate} onOpenChange={open => { if (!open) { setShowCreate(false); resetForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record New Sale</DialogTitle>
            <DialogDescription>Add items, select customer and payment method to record a sale.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Add Item */}
            <div className="space-y-1.5">
              <Label className="font-semibold">Select Item</Label>
              <p className="text-xs text-muted-foreground -mt-1">Out-of-stock items are disabled and cannot be sold.</p>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value=""
                onChange={e => {
                  const s = stockItems.find((s: any) => s.itemId === Number(e.target.value));
                  if (s) addLineItem(s);
                  e.target.value = "";
                }}
              >
                <option value="">Search for an item...</option>
                {stockItems
                  .filter((s: any) => !lineItems.find(l => l.itemId === s.itemId))
                  .map((s: any) => {
                    const qty = parseFloat(s.quantity);
                    const disabled = qty <= 0;
                    return (
                      <option key={s.itemId} value={s.itemId} disabled={disabled}>
                        {disabled ? `[Out of stock] ${s.itemName}` : `${s.itemName} (stock: ${qty.toLocaleString()} ${s.qtyType})`}
                      </option>
                    );
                  })}
              </select>
            </div>

            {/* Line Items table */}
            {lineItems.length > 0 && (
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Item</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Qty Sold</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Unit Price</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Sale Amount</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((l, idx) => (
                      <tr key={l.itemId} className="border-t border-border">
                        <td className="px-3 py-2 font-medium text-xs max-w-[120px]">
                          <span className="truncate block">{l.itemName}</span>
                          <span className="text-muted-foreground">max: {l.availableQty}</span>
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number" min={0.01} step={0.01} max={l.availableQty}
                            value={l.quantity}
                            onChange={e => updateLine(idx, "quantity", e.target.value)}
                            className="h-7 w-20 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number" min={0}
                            value={l.unitPrice}
                            onChange={e => updateLine(idx, "unitPrice", e.target.value)}
                            className="h-7 w-28 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-sm">
                          {fmtRWF((parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0))}
                        </td>
                        <td className="px-3 py-2">
                          <button onClick={() => removeLine(idx)} className="text-muted-foreground hover:text-red-500">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border bg-muted/30">
                      <td colSpan={3} className="px-3 py-2 font-semibold text-right">Total Sale Amount</td>
                      <td className="px-3 py-2 text-right font-bold text-lg text-green-600">{fmtRWF(totalAmount)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {lineItems.length === 0 && (
              <div className="py-6 text-center text-muted-foreground text-sm border-2 border-dashed rounded-xl">
                <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-40" />
                Add items from the dropdown above
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Customer */}
              <div className="space-y-1.5">
                <Label className="font-semibold">
                  Select Customer{" "}
                  {isCredit && <span className="text-red-500 font-medium">(required for credit)</span>}
                </Label>
                <select
                  className={`w-full h-9 rounded-md border bg-background px-3 text-sm ${isCredit && !customerId ? "border-red-300" : "border-input"}`}
                  value={customerId}
                  onChange={e => setCustomerId(e.target.value)}
                >
                  <option value="">{isCredit ? "— Select a customer —" : "Walk-in customer"}</option>
                  {customerList.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <p className="text-xs text-muted-foreground">
                  Select customer if this is a credit sale
                  <button
                    type="button"
                    className="ml-1.5 text-[#1A6DB5] hover:underline font-medium inline-flex items-center gap-0.5"
                    onClick={() => setShowAddCustomer(true)}
                  >
                    <UserPlus className="h-3 w-3" />Add New Customer
                  </button>
                </p>
              </div>

              {/* Payment Method */}
              <div className="space-y-1.5">
                <Label className="font-semibold">Payment Method *</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                >
                  {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>

            {/* Payment Terms — only shown for credit */}
            {isCredit && (
              <div className="space-y-1.5">
                <Label className="font-semibold">Payment Terms (Days)</Label>
                <Input
                  type="number" min={1} max={365} step={1}
                  value={paymentTermsDays}
                  onChange={e => setPaymentTermsDays(Number(e.target.value))}
                  className="w-40"
                />
                <p className="text-xs text-muted-foreground">Number of days until payment is due</p>
              </div>
            )}

            {/* Credit warning */}
            {isCredit && (
              <div className={`p-3 rounded-xl border text-sm ${!customerId ? "bg-red-50 border-red-200 text-red-700" : "bg-yellow-50 border-yellow-200 text-yellow-700"}`}>
                {!customerId
                  ? "⚠ A customer must be selected for credit sales — walk-in customers cannot buy on credit."
                  : `⚠ Credit sale — payment due in ${paymentTermsDays} day${paymentTermsDays !== 1 ? "s" : ""}. This will be recorded as a receivable.`}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={saving || lineItems.length === 0 || (isCredit && !customerId)}
              className="bg-green-600 hover:bg-green-700"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Record Sale — {fmtRWF(totalAmount)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
