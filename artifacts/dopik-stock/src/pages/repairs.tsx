import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, fmtRWF, fmtDate, fmtDateTime } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import {
  Wrench, Plus, Clock, ChevronRight, AlertTriangle, Trash2,
  MessageSquare, Phone, Printer, CheckCircle2, X
} from "lucide-react";

function buildRepairInvoiceHTML(repair: RepairJob): string {
  const deviceLabel = [repair.brand, repair.model].filter(Boolean).join(" ") || repair.deviceType;
  const balanceDue = parseFloat(repair.totalCost || "0") - parseFloat(repair.depositPaid || "0");
  const dateStr = new Date().toLocaleDateString("en-RW", { day: "2-digit", month: "long", year: "numeric" });
  const partsRows = repair.parts.map((p, i) =>
    `<tr><td style="padding:5px 4px;border-bottom:1px solid #f0f0f0">${i + 1}. ${p.partName}</td><td style="padding:5px 4px;border-bottom:1px solid #f0f0f0;text-align:right">${p.quantity > 1 ? `×${p.quantity}` : ""}</td><td style="padding:5px 4px;border-bottom:1px solid #f0f0f0;text-align:right">${(parseFloat(p.partCost) * p.quantity).toLocaleString()} RWF</td></tr>`
  ).join("");

  return `<!DOCTYPE html><html><head><title>Repair Invoice #${repair.id}</title><meta charset="utf-8">
<style>@page{margin:12mm;size:80mm auto}*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:12px;color:#111;background:white;padding:16px;max-width:380px;margin:0 auto}table{width:100%;border-collapse:collapse}.center{text-align:center}.logo{width:48px;height:48px;border-radius:50%;background:#1A6DB5;color:white;font-size:22px;font-weight:900;margin:0 auto 8px;line-height:48px;text-align:center}.dashed{border-top:1px dashed #ccc;border-bottom:1px dashed #ccc;padding:8px 0;margin:10px 0}.row{display:flex;justify-content:space-between;margin-bottom:3px}.label{color:#777}.total-box{background:#f8f8f8;border-radius:6px;padding:8px 12px;margin:10px 0}.footer{text-align:center;font-size:10px;color:#aaa;border-top:1px dashed #ddd;padding-top:8px;margin-top:10px}@media print{body{padding:0}}</style>
</head><body>
<div class="center" style="margin-bottom:12px">
  <div class="logo">D</div>
  <div style="font-size:18px;font-weight:900;color:#1A6DB5">Dopik Electronics Ltd</div>
  <div style="font-size:11px;color:#777">Kigali, Rwanda | +250 788 000 000</div>
  <div style="font-size:11px;font-weight:700;color:#555;margin-top:4px">REPAIR INVOICE</div>
</div>
<div class="dashed">
  <div class="row"><span class="label">Invoice #</span><strong>REP-${String(repair.id).padStart(4, "0")}</strong></div>
  <div class="row"><span class="label">Date</span><span>${dateStr}</span></div>
  <div class="row"><span class="label">Customer</span><strong>${repair.customerName || "Unknown"}</strong></div>
  ${repair.customerPhone ? `<div class="row"><span class="label">Phone</span><span>${repair.customerPhone}</span></div>` : ""}
  <div class="row"><span class="label">Device</span><span>${deviceLabel}</span></div>
  ${repair.imeiOrSerial ? `<div class="row"><span class="label">IMEI/S/N</span><span>${repair.imeiOrSerial}</span></div>` : ""}
</div>
<div style="margin:8px 0;font-size:11px"><span class="label">Problem: </span>${repair.problem}</div>
${repair.workDone ? `<div style="margin:4px 0;font-size:11px"><span class="label">Work Done: </span>${repair.workDone}</div>` : ""}
<table style="margin:8px 0">
  <thead><tr><th style="text-align:left;font-size:11px;color:#555;padding:4px;border-bottom:1px solid #ddd">Description</th><th style="text-align:right;font-size:11px;color:#555;padding:4px;border-bottom:1px solid #ddd">Qty</th><th style="text-align:right;font-size:11px;color:#555;padding:4px;border-bottom:1px solid #ddd">Amount</th></tr></thead>
  <tbody>
    ${partsRows}
    ${repair.laborCost && parseFloat(repair.laborCost) > 0 ? `<tr><td style="padding:5px 4px">Labor</td><td></td><td style="padding:5px 4px;text-align:right">${parseFloat(repair.laborCost).toLocaleString()} RWF</td></tr>` : ""}
  </tbody>
</table>
<div class="total-box">
  <div style="font-size:15px;font-weight:900;display:flex;justify-content:space-between"><span>TOTAL</span><span>${parseFloat(repair.totalCost || "0").toLocaleString()} RWF</span></div>
  <div class="row" style="margin-top:4px;font-size:11px"><span class="label">Deposit Paid</span><span style="color:green">- ${parseFloat(repair.depositPaid || "0").toLocaleString()} RWF</span></div>
  <div style="font-size:14px;font-weight:900;display:flex;justify-content:space-between;border-top:1px dashed #ddd;margin-top:4px;padding-top:4px;color:${balanceDue > 0 ? "#c00" : "green"}"><span>Balance Due</span><span>${balanceDue.toLocaleString()} RWF</span></div>
</div>
<div class="footer">
  <p>Thank you for choosing Dopik Electronics!</p>
  <p>Kigali, Rwanda | +250 788 000 000</p>
  <p style="margin-top:4px">Keep this invoice as proof of service</p>
</div>
</body></html>`;
}

const STATUSES = [
  { key: "received", label: "Received", color: "bg-gray-100 text-gray-700", bg: "bg-gray-50 border-gray-200" },
  { key: "diagnosing", label: "Diagnosing", color: "bg-blue-100 text-blue-700", bg: "bg-blue-50 border-blue-200" },
  { key: "repairing", label: "Repairing", color: "bg-amber-100 text-amber-700", bg: "bg-amber-50 border-amber-200" },
  { key: "ready", label: "Ready", color: "bg-green-100 text-green-700", bg: "bg-green-50 border-green-200" },
  { key: "collected", label: "Collected", color: "bg-purple-100 text-purple-700", bg: "bg-purple-50 border-purple-200" },
];

type RepairJob = {
  id: number;
  customerId?: number;
  customerName?: string;
  customerPhone?: string;
  deviceType: string;
  brand?: string;
  model?: string;
  imeiOrSerial?: string;
  problem: string;
  status: string;
  technicianId?: number;
  technicianName?: string;
  priority: string;
  estimatedCost?: string;
  depositPaid?: string;
  laborCost?: string;
  totalCost?: string;
  workDone?: string;
  warrantyDays?: number;
  notes?: string;
  receivedDate?: string;
  createdAt: string;
  parts: { id: number; partName: string; partCost: string; quantity: number }[];
  history: { id: number; status: string; notes?: string; changedAt: string; changedByName?: string }[];
  partsCost: number;
  daysInShop: number;
};

function urgencyColor(days: number, priority: string) {
  if (priority === "urgent") return "border-l-4 border-l-red-500";
  if (days >= 7) return "border-l-4 border-l-red-400";
  if (days >= 3) return "border-l-4 border-l-amber-400";
  return "border-l-4 border-l-green-400";
}

function daysColor(days: number) {
  if (days >= 7) return "text-red-600";
  if (days >= 3) return "text-amber-600";
  return "text-green-600";
}

function buildWALink(phone: string, name: string, device: string, totalCost: string) {
  const msg = `Hello ${name}, your ${device} is ready for collection at Dopik Electronics! Total cost: ${parseFloat(totalCost || "0").toLocaleString()} RWF. Please bring your deposit receipt. Contact us: +250 788 000 000`;
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUSES.find(x => x.key === status);
  return <Badge className={`text-xs ${s?.color || "bg-gray-100 text-gray-700"}`}>{s?.label || status}</Badge>;
}

function NewRepairModal({ open, onClose, staff }: { open: boolean; onClose: () => void; staff: any[] }) {
  const [form, setForm] = useState({
    customerName: "", customerPhone: "", deviceType: "Phone", brand: "", model: "",
    imeiOrSerial: "", problem: "", technicianId: "", priority: "normal",
    estimatedCost: "", depositPaid: "", notes: "",
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.problem || !form.deviceType) {
      toast({ title: "Device type and problem are required", variant: "destructive" }); return;
    }
    setLoading(true);
    try {
      await api.post("/repairs", {
        ...form,
        technicianId: form.technicianId ? parseInt(form.technicianId) : undefined,
        estimatedCost: form.estimatedCost ? parseFloat(form.estimatedCost) : undefined,
        depositPaid: form.depositPaid ? parseFloat(form.depositPaid) : undefined,
      });
      toast({ title: "Repair job created" });
      qc.invalidateQueries({ queryKey: ["repairs"] });
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Wrench className="w-5 h-5" /> New Repair Job</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Customer Name</Label>
              <Input value={form.customerName} onChange={e => set("customerName", e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-1.5">
              <Label>Customer Phone</Label>
              <Input value={form.customerPhone} onChange={e => set("customerPhone", e.target.value)} placeholder="+250..." />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Device Type *</Label>
              <Select value={form.deviceType} onValueChange={v => set("deviceType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Phone", "Laptop", "Tablet", "Other"].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Brand</Label>
              <Input value={form.brand} onChange={e => set("brand", e.target.value)} placeholder="Samsung, Apple..." />
            </div>
            <div className="space-y-1.5">
              <Label>Model</Label>
              <Input value={form.model} onChange={e => set("model", e.target.value)} placeholder="Galaxy S24..." />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>IMEI / Serial Number</Label>
            <Input value={form.imeiOrSerial} onChange={e => set("imeiOrSerial", e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-1.5">
            <Label>Problem Description *</Label>
            <Textarea value={form.problem} onChange={e => set("problem", e.target.value)}
              placeholder="Describe the issue in detail..." rows={3} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Technician</Label>
              <Select value={form.technicianId} onValueChange={v => set("technicianId", v)}>
                <SelectTrigger><SelectValue placeholder="Assign technician" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {staff.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => set("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Estimated Cost (RWF)</Label>
              <Input type="number" value={form.estimatedCost} onChange={e => set("estimatedCost", e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Deposit Paid (RWF)</Label>
              <Input type="number" value={form.depositPaid} onChange={e => set("depositPaid", e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Internal notes..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-[#1A6DB5] hover:bg-[#155a96]">
              {loading ? "Creating..." : "Create Repair Job"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RepairDetailModal({ repair, open, onClose, staff }: { repair: RepairJob; open: boolean; onClose: () => void; staff: any[] }) {
  const [addingPart, setAddingPart] = useState(false);
  const [partForm, setPartForm] = useState({ partName: "", partCost: "", quantity: "1" });
  const [editLabor, setEditLabor] = useState(String(repair.laborCost || "0"));
  const [editWorkDone, setEditWorkDone] = useState(repair.workDone || "");
  const [savingDetails, setSavingDetails] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const statusIdx = STATUSES.findIndex(s => s.key === repair.status);
  const nextStatus = statusIdx < STATUSES.length - 1 ? STATUSES[statusIdx + 1] : null;
  const deviceLabel = [repair.brand, repair.model].filter(Boolean).join(" ") || repair.deviceType;
  const waLink = repair.customerPhone && repair.status === "ready"
    ? buildWALink(repair.customerPhone, repair.customerName || "Customer", deviceLabel, repair.totalCost || "0")
    : null;

  const moveStatus = async (status: string) => {
    try {
      await api.patch(`/repairs/${repair.id}/status`, { status });
      qc.invalidateQueries({ queryKey: ["repairs"] });
      toast({ title: `Status updated to "${STATUSES.find(s => s.key === status)?.label}"` });
      onClose();
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const addPart = async () => {
    if (!partForm.partName || !partForm.partCost) return;
    try {
      await api.post(`/repairs/${repair.id}/parts`, { partName: partForm.partName, partCost: parseFloat(partForm.partCost), quantity: parseInt(partForm.quantity) || 1 });
      qc.invalidateQueries({ queryKey: ["repairs"] });
      setPartForm({ partName: "", partCost: "", quantity: "1" });
      setAddingPart(false);
      toast({ title: "Part added" });
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const deletePart = async (partId: number) => {
    await api.del(`/repairs/${repair.id}/parts/${partId}`);
    qc.invalidateQueries({ queryKey: ["repairs"] });
    toast({ title: "Part removed" });
  };

  const saveDetails = async () => {
    setSavingDetails(true);
    try {
      await api.patch(`/repairs/${repair.id}`, { laborCost: parseFloat(editLabor) || 0, workDone: editWorkDone });
      qc.invalidateQueries({ queryKey: ["repairs"] });
      toast({ title: "Details saved" });
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    setSavingDetails(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5" /> Repair #{repair.id} — {deviceLabel}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="flex flex-wrap gap-2 items-center">
            <StatusBadge status={repair.status} />
            {repair.priority === "urgent" && <Badge className="bg-red-100 text-red-700">Urgent</Badge>}
            <span className={`text-xs font-medium ${daysColor(repair.daysInShop)}`}>{repair.daysInShop} days in shop</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-3 space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase">Customer</p>
              <p className="font-semibold">{repair.customerName || "Unknown"}</p>
              {repair.customerPhone && (
                <a href={`tel:${repair.customerPhone}`} className="text-[#1A6DB5] flex items-center gap-1 text-xs">
                  <Phone className="w-3 h-3" /> {repair.customerPhone}
                </a>
              )}
            </div>
            <div className="bg-gray-50 rounded-lg p-3 space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase">Device</p>
              <p className="font-semibold">{deviceLabel}</p>
              {repair.imeiOrSerial && <p className="text-xs text-gray-500">IMEI: {repair.imeiOrSerial}</p>}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">Problem</p>
            <p className="text-sm">{repair.problem}</p>
          </div>

          {/* Status timeline */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Progress</p>
            <div className="flex items-center gap-1">
              {STATUSES.map((s, i) => {
                const done = STATUSES.findIndex(x => x.key === repair.status) >= i;
                return (
                  <div key={s.key} className="flex items-center gap-1 flex-1">
                    <div className={`flex-1 h-1.5 rounded-full ${done ? "bg-[#1A6DB5]" : "bg-gray-200"}`} />
                    <div className={`w-2 h-2 rounded-full ${done ? "bg-[#1A6DB5]" : "bg-gray-200"}`} />
                    {i === STATUSES.length - 1 && null}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1">
              {STATUSES.map(s => (
                <span key={s.key} className="text-[9px] text-gray-400">{s.label}</span>
              ))}
            </div>
            {repair.history.length > 0 && (
              <div className="mt-2 space-y-1 max-h-28 overflow-y-auto">
                {repair.history.map(h => (
                  <div key={h.id} className="flex items-center justify-between text-xs text-gray-500">
                    <span className="capitalize font-medium">{h.status}</span>
                    <span>{fmtDateTime(h.changedAt)}</span>
                    {h.changedByName && <span className="text-gray-400">{h.changedByName}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Parts */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-500 uppercase">Parts Used</p>
              <Button size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={() => setAddingPart(!addingPart)}>
                <Plus className="w-3 h-3" /> Add Part
              </Button>
            </div>
            {addingPart && (
              <div className="flex gap-2 mb-2">
                <Input className="h-7 text-xs" placeholder="Part name" value={partForm.partName} onChange={e => setPartForm(f => ({ ...f, partName: e.target.value }))} />
                <Input className="h-7 text-xs w-24" type="number" placeholder="Cost" value={partForm.partCost} onChange={e => setPartForm(f => ({ ...f, partCost: e.target.value }))} />
                <Input className="h-7 text-xs w-16" type="number" placeholder="Qty" value={partForm.quantity} onChange={e => setPartForm(f => ({ ...f, quantity: e.target.value }))} />
                <Button size="sm" className="h-7 text-xs bg-[#1A6DB5]" onClick={addPart}>Add</Button>
              </div>
            )}
            <div className="space-y-1">
              {repair.parts.map(p => (
                <div key={p.id} className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-1.5">
                  <span>{p.partName} {p.quantity > 1 && `× ${p.quantity}`}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{fmtRWF(String(parseFloat(p.partCost) * p.quantity))}</span>
                    <button onClick={() => deletePart(p.id)} className="text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
              {repair.parts.length === 0 && <p className="text-xs text-gray-400 text-center py-2">No parts added yet</p>}
            </div>
          </div>

          {/* Labor & Work Done */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Labor Cost (RWF)</Label>
              <Input type="number" value={editLabor} onChange={e => setEditLabor(e.target.value)} className="h-8" />
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="text-xs text-gray-500">Total Cost</p>
              <p className="font-bold text-lg text-[#0F1A2E]">{fmtRWF(repair.totalCost)}</p>
              <p className="text-xs text-gray-400">Parts: {fmtRWF(String(repair.partsCost))} + Labor: {fmtRWF(editLabor)}</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Work Done (description)</Label>
            <Textarea value={editWorkDone} onChange={e => setEditWorkDone(e.target.value)} rows={2} placeholder="Describe what was done..." className="text-sm" />
          </div>
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={saveDetails} disabled={savingDetails} className="text-xs h-7">
              {savingDetails ? "Saving..." : "Save Details"}
            </Button>
          </div>

          {/* Financials */}
          <div className="grid grid-cols-3 gap-2 text-xs text-center">
            <div className="bg-blue-50 rounded-lg p-2">
              <p className="text-gray-500">Estimated</p>
              <p className="font-bold text-blue-700">{fmtRWF(repair.estimatedCost)}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-2">
              <p className="text-gray-500">Deposit Paid</p>
              <p className="font-bold text-green-700">{fmtRWF(repair.depositPaid)}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-2">
              <p className="text-gray-500">Balance Due</p>
              <p className="font-bold text-amber-700">{fmtRWF(String(parseFloat(repair.totalCost || "0") - parseFloat(repair.depositPaid || "0")))}</p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-wrap gap-2 mt-4">
          <Button
            type="button"
            variant="outline"
            className="gap-2 text-gray-600 text-sm"
            onClick={() => {
              const html = buildRepairInvoiceHTML(repair);
              const win = window.open("", "_blank", "width=480,height=700");
              if (!win) return;
              win.document.write(html);
              win.document.close();
              win.focus();
              setTimeout(() => { win.print(); }, 350);
            }}
          >
            <Printer className="w-4 h-4" /> Print Invoice
          </Button>
          {waLink && (
            <a href={waLink} target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="outline" className="gap-2 text-green-600 border-green-200 hover:bg-green-50 text-sm">
                <MessageSquare className="w-4 h-4" /> Notify Customer
              </Button>
            </a>
          )}
          {nextStatus && (
            <Button onClick={() => moveStatus(nextStatus.key)} className="bg-[#1A6DB5] hover:bg-[#155a96] gap-2 text-sm">
              Move to {nextStatus.label} <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RepairCard({ job, onOpen }: { job: RepairJob; onOpen: () => void }) {
  const deviceLabel = [job.brand, job.model].filter(Boolean).join(" ") || job.deviceType;
  return (
    <div
      onClick={onOpen}
      className={`bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-shadow ${urgencyColor(job.daysInShop, job.priority)}`}
    >
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <p className="font-semibold text-sm text-[#0F1A2E] truncate">{job.customerName || "Unknown"}</p>
        {job.priority === "urgent" && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
      </div>
      <p className="text-xs text-gray-600 mb-1 truncate">{deviceLabel}</p>
      <p className="text-xs text-gray-500 line-clamp-2">{job.problem}</p>
      <div className="flex items-center justify-between mt-2">
        <span className={`text-xs font-medium ${daysColor(job.daysInShop)}`}>
          <Clock className="w-3 h-3 inline mr-0.5" />{job.daysInShop}d
        </span>
        {job.totalCost && parseFloat(job.totalCost) > 0 && (
          <span className="text-xs font-semibold text-gray-700">{fmtRWF(job.totalCost)}</span>
        )}
      </div>
    </div>
  );
}

export default function RepairsPage() {
  const [showNew, setShowNew] = useState(false);
  const [selectedRepair, setSelectedRepair] = useState<RepairJob | null>(null);
  const { user } = useAuth();

  const { data: repairs = [], isLoading } = useQuery<RepairJob[]>({
    queryKey: ["repairs"],
    queryFn: () => api.get("/repairs"),
  });

  const { data: staff = [] } = useQuery<any[]>({
    queryKey: ["staff"],
    queryFn: () => api.get("/staff"),
  });

  const qc = useQueryClient();
  const { toast } = useToast();

  const byStatus = (status: string) => repairs.filter(r => r.status === status);

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F1A2E] flex items-center gap-2">
            <Wrench className="w-6 h-6" /> Repairs
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Track device repairs and service jobs</p>
        </div>
        <Button onClick={() => setShowNew(true)} className="bg-[#1A6DB5] hover:bg-[#155a96] gap-2">
          <Plus className="w-4 h-4" /> New Repair
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {STATUSES.map(s => (
          <div key={s.key} className={`rounded-lg border p-3 text-center ${s.bg}`}>
            <p className="text-2xl font-bold">{byStatus(s.key).length}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading repairs...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {STATUSES.map(s => (
            <div key={s.key}>
              <div className={`rounded-lg px-3 py-2 mb-2 border ${s.bg}`}>
                <p className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                  {s.label}
                  <span className="text-xs bg-white rounded-full px-2 py-0.5 font-bold shadow-sm">{byStatus(s.key).length}</span>
                </p>
              </div>
              <div className="space-y-2">
                {byStatus(s.key).map(job => (
                  <RepairCard key={job.id} job={job} onOpen={() => setSelectedRepair(job)} />
                ))}
                {byStatus(s.key).length === 0 && (
                  <div className="text-center py-4 text-xs text-gray-300 border border-dashed border-gray-200 rounded-lg">
                    No jobs
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <NewRepairModal open={showNew} onClose={() => setShowNew(false)} staff={staff} />
      {selectedRepair && (
        <RepairDetailModal
          repair={selectedRepair}
          open={!!selectedRepair}
          onClose={() => setSelectedRepair(null)}
          staff={staff}
        />
      )}
    </div>
  );
}
