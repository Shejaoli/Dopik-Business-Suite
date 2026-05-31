import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, fmtRWF, fmtDateTime, fmtDate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Printer, MessageSquare, Search, Receipt, Eye } from "lucide-react";

type ReceiptSummary = {
  id: number;
  receiptNumber: string;
  customerName?: string;
  paymentMethod?: string;
  totalAmount: string;
  createdAt: string;
};

type ReceiptDetail = {
  receiptNumber: string;
  sale: {
    id: number;
    customerName: string;
    customerPhone?: string;
    paymentMethod: string;
    totalAmount: string;
    createdAt: string;
  };
  items: {
    id: number;
    itemName: string;
    category: string;
    quantity: string;
    unitPrice: string;
    lineTotal: string;
    serialNumbers: string[];
  }[];
  store: {
    name: string;
    address: string;
    phone: string;
    email: string;
    warrantyPeriod: string;
  };
};

function paymentLabel(m: string) {
  const map: Record<string, string> = {
    cash: "Cash", bank: "Bank Transfer", mobile_money: "Mobile Money", credit: "Credit",
  };
  return map[m] || m;
}

function ReceiptPrint({ receipt }: { receipt: ReceiptDetail }) {
  const s = receipt.sale;
  const store = receipt.store;
  const date = new Date(s.createdAt);
  const dateStr = date.toLocaleDateString("en-RW", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = date.toLocaleTimeString("en-RW", { hour: "2-digit", minute: "2-digit" });

  return (
    <div id="receipt-print-area" className="bg-white text-black font-sans max-w-[400px] mx-auto p-6 text-sm print:shadow-none">
      <div className="text-center mb-5">
        <div className="w-14 h-14 rounded-full bg-[#1A6DB5] text-white flex items-center justify-center text-2xl font-extrabold mx-auto mb-2">D</div>
        <h1 className="text-xl font-extrabold text-[#1A6DB5]">{store.name}</h1>
        <p className="text-xs text-gray-500">{store.address}</p>
        <p className="text-xs text-gray-500">{store.phone} | {store.email}</p>
      </div>

      <div className="border-t border-b border-dashed border-gray-300 py-3 mb-4 space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Receipt No.</span>
          <span className="font-bold">{receipt.receiptNumber}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Date</span>
          <span>{dateStr}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Time</span>
          <span>{timeStr}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Customer</span>
          <span className="font-medium">{s.customerName}</span>
        </div>
        {s.customerPhone && (
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Phone</span>
            <span>{s.customerPhone}</span>
          </div>
        )}
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Payment</span>
          <span>{paymentLabel(s.paymentMethod)}</span>
        </div>
      </div>

      <table className="w-full text-xs mb-4">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left pb-1.5 font-semibold text-gray-600">#</th>
            <th className="text-left pb-1.5 font-semibold text-gray-600">Item</th>
            <th className="text-right pb-1.5 font-semibold text-gray-600">Qty</th>
            <th className="text-right pb-1.5 font-semibold text-gray-600">Price</th>
            <th className="text-right pb-1.5 font-semibold text-gray-600">Total</th>
          </tr>
        </thead>
        <tbody>
          {receipt.items.map((item, idx) => (
            <tr key={item.id} className="border-b border-gray-100">
              <td className="py-1.5 text-gray-400">{idx + 1}</td>
              <td className="py-1.5">
                <div className="font-medium">{item.itemName}</div>
                {item.serialNumbers.length > 0 && (
                  <div className="text-gray-400 text-[10px]">
                    IMEI: {item.serialNumbers.join(", ")}
                  </div>
                )}
              </td>
              <td className="py-1.5 text-right">{item.quantity}</td>
              <td className="py-1.5 text-right">{parseFloat(item.unitPrice).toLocaleString()}</td>
              <td className="py-1.5 text-right font-medium">{parseFloat(item.lineTotal).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="bg-gray-50 rounded-lg p-3 mb-4">
        <div className="flex justify-between text-lg font-extrabold text-[#0F1A2E]">
          <span>GRAND TOTAL</span>
          <span>{fmtRWF(s.totalAmount)}</span>
        </div>
      </div>

      {receipt.items.some((i) => i.serialNumbers.length > 0) && (
        <div className="border border-dashed border-gray-200 rounded p-2 mb-4 text-xs text-gray-500">
          <p className="font-medium text-gray-700 mb-1">Warranty Information</p>
          {receipt.items.filter((i) => i.serialNumbers.length > 0).map((item) => (
            <div key={item.id} className="mb-1">
              <span className="font-medium">{item.itemName}</span>
              {item.serialNumbers.map((sn) => (
                <div key={sn} className="ml-2 text-[10px]">
                  IMEI: {sn} — Warranty: {store.warrantyPeriod} from purchase date
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="text-center text-xs text-gray-400 space-y-1 mt-4 border-t border-dashed border-gray-200 pt-3">
        <p className="font-medium text-gray-600">Thank you for shopping at {store.name}!</p>
        <p>{store.address}</p>
        <p className="text-[10px] mt-2">Keep this receipt as proof of purchase and warranty</p>
        <p className="text-[10px]">Check your warranty at: /warranty</p>
      </div>
    </div>
  );
}

function ReceiptModal({ saleId, open, onClose }: { saleId: number; open: boolean; onClose: () => void }) {
  const printRef = useRef<HTMLDivElement>(null);

  const { data: receipt, isLoading } = useQuery<ReceiptDetail>({
    queryKey: ["receipt", saleId],
    queryFn: () => api.get(`/receipts/${saleId}`),
    enabled: open && !!saleId,
  });

  const handlePrint = () => {
    const printContents = document.getElementById("receipt-print-area");
    if (!printContents) return;
    const win = window.open("", "_blank", "width=500,height=700");
    if (!win) return;
    win.document.write(`
      <html><head><title>Receipt</title>
      <style>
        body { font-family: sans-serif; margin: 0; padding: 20px; }
        * { box-sizing: border-box; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 4px; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        @media print { body { padding: 0; } }
      </style></head>
      <body>${printContents.innerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  const buildWhatsAppMessage = (r: ReceiptDetail) => {
    const itemList = r.items.map((i) => `${i.itemName} x${i.quantity}`).join(", ");
    const msg = `Hello ${r.sale.customerName}, thank you for your purchase at Dopik Electronics! 🎉 Receipt No: ${r.receiptNumber} | Date: ${fmtDate(r.sale.createdAt)} | Items: ${itemList} | Total: ${fmtRWF(r.sale.totalAmount)} | Payment: ${paymentLabel(r.sale.paymentMethod)}. For warranty or support, contact us anytime.`;
    return encodeURIComponent(msg);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#1A6DB5]" />
            Receipt Preview
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 text-center text-gray-400">Loading receipt...</div>
        ) : !receipt ? (
          <div className="py-12 text-center text-gray-400">Receipt not found</div>
        ) : (
          <>
            <div className="flex gap-2 flex-wrap mb-4">
              <Button onClick={handlePrint} variant="outline" className="gap-2">
                <Printer className="w-4 h-4" /> Print
              </Button>
              {receipt.sale.customerPhone && (
                <a
                  href={`https://wa.me/${receipt.sale.customerPhone.replace(/\D/g, "")}?text=${buildWhatsAppMessage(receipt)}`}
                  target="_blank" rel="noopener noreferrer"
                >
                  <Button variant="outline" className="gap-2 text-green-600 border-green-200 hover:bg-green-50">
                    <MessageSquare className="w-4 h-4" /> Share via WhatsApp
                  </Button>
                </a>
              )}
            </div>
            <div ref={printRef} className="border border-gray-200 rounded-xl overflow-hidden">
              <ReceiptPrint receipt={receipt} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function ReceiptsPage() {
  const [search, setSearch] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);

  const { data: receipts = [], isLoading } = useQuery<ReceiptSummary[]>({
    queryKey: ["receipts"],
    queryFn: () => api.get("/receipts?limit=100"),
  });

  const filtered = receipts.filter((r) => {
    if (!search) return true;
    return (
      r.receiptNumber.toLowerCase().includes(search.toLowerCase()) ||
      (r.customerName || "").toLowerCase().includes(search.toLowerCase())
    );
  });

  function pmBadge(m: string) {
    const colors: Record<string, string> = {
      cash: "bg-green-100 text-green-800",
      bank: "bg-blue-100 text-blue-800",
      mobile_money: "bg-yellow-100 text-yellow-800",
      credit: "bg-red-100 text-red-800",
    };
    return colors[m] || "bg-gray-100 text-gray-700";
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F1A2E]">Receipts</h1>
        <p className="text-sm text-gray-500 mt-0.5">View, print, and share sales receipts</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by receipt # or customer..." className="pl-9" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Receipt #</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Payment</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Loading receipts...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">No receipts found</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-[#1A6DB5]">{r.receiptNumber}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-[#0F1A2E]">{r.customerName || "Walk-in Customer"}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs ${pmBadge(r.paymentMethod || "")}`}>
                      {paymentLabel(r.paymentMethod || "")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{fmtRWF(r.totalAmount)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDateTime(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
                      onClick={() => setSelectedSaleId(r.id)}>
                      <Eye className="w-3.5 h-3.5" /> View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSaleId && (
        <ReceiptModal
          saleId={selectedSaleId}
          open={!!selectedSaleId}
          onClose={() => setSelectedSaleId(null)}
        />
      )}
    </div>
  );
}
