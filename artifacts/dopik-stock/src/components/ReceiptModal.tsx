import { useQuery } from "@tanstack/react-query";
import { api, fmtRWF, fmtDate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, MessageSquare, Download, Receipt } from "lucide-react";

export type ReceiptDetail = {
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

export function paymentLabel(m: string) {
  const map: Record<string, string> = {
    cash: "Cash", bank: "Bank Transfer", mobile_money: "Mobile Money", credit: "Credit",
  };
  return map[m] || m;
}

function buildReceiptHTML(receipt: ReceiptDetail): string {
  const s = receipt.sale;
  const store = receipt.store;
  const date = new Date(s.createdAt);
  const dateStr = date.toLocaleDateString("en-RW", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = date.toLocaleTimeString("en-RW", { hour: "2-digit", minute: "2-digit" });
  const hasSerials = receipt.items.some((i) => i.serialNumbers.length > 0);

  const itemRows = receipt.items.map((item, idx) => `
    <tr style="border-bottom:1px solid #f0f0f0">
      <td style="padding:6px 4px;color:#999">${idx + 1}</td>
      <td style="padding:6px 4px">
        <div style="font-weight:600">${item.itemName}</div>
        ${item.serialNumbers.length > 0 ? `<div style="font-size:10px;color:#aaa">IMEI: ${item.serialNumbers.join(", ")}</div>` : ""}
      </td>
      <td style="padding:6px 4px;text-align:right">${item.quantity}</td>
      <td style="padding:6px 4px;text-align:right">${parseFloat(item.unitPrice).toLocaleString()}</td>
      <td style="padding:6px 4px;text-align:right;font-weight:600">${parseFloat(item.lineTotal).toLocaleString()}</td>
    </tr>
  `).join("");

  const warrantyRows = receipt.items
    .filter((i) => i.serialNumbers.length > 0)
    .map((item) => item.serialNumbers.map((sn) =>
      `<div style="margin-bottom:4px"><span style="font-weight:600">${item.itemName}</span> — IMEI: ${sn}<br><span style="font-size:10px;color:#888">Warranty: ${store.warrantyPeriod} from date of purchase</span></div>`
    ).join("")).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <title>Receipt ${receipt.receiptNumber}</title>
  <meta charset="utf-8">
  <style>
    @page { margin: 12mm; size: 80mm auto; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; background: white; padding: 16px; max-width: 380px; margin: 0 auto; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 6px 4px; font-size: 11px; color: #555; border-bottom: 1px solid #ddd; }
    th.right, td.right { text-align: right; }
    .logo { width: 48px; height: 48px; border-radius: 50%; background: #1A6DB5; color: white; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 900; margin: 0 auto 8px; line-height: 48px; text-align: center; }
    .center { text-align: center; }
    .dashed { border-top: 1px dashed #ccc; border-bottom: 1px dashed #ccc; padding: 8px 0; margin: 12px 0; }
    .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
    .label { color: #777; }
    .total-box { background: #f8f8f8; border-radius: 6px; padding: 8px 12px; margin: 12px 0; }
    .grand { font-size: 16px; font-weight: 900; display: flex; justify-content: space-between; }
    .warranty-box { border: 1px dashed #ddd; border-radius: 4px; padding: 8px; margin: 10px 0; font-size: 11px; }
    .footer { text-align: center; font-size: 10px; color: #aaa; border-top: 1px dashed #ddd; padding-top: 10px; margin-top: 12px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="center" style="margin-bottom:14px">
    <div class="logo">D</div>
    <div style="font-size:18px;font-weight:900;color:#1A6DB5">${store.name}</div>
    <div style="font-size:11px;color:#777">${store.address}</div>
    <div style="font-size:11px;color:#777">${store.phone} | ${store.email}</div>
  </div>

  <div class="dashed">
    <div class="row"><span class="label">Receipt No.</span><strong>${receipt.receiptNumber}</strong></div>
    <div class="row"><span class="label">Date</span><span>${dateStr}</span></div>
    <div class="row"><span class="label">Time</span><span>${timeStr}</span></div>
    <div class="row"><span class="label">Customer</span><strong>${s.customerName}</strong></div>
    ${s.customerPhone ? `<div class="row"><span class="label">Phone</span><span>${s.customerPhone}</span></div>` : ""}
    <div class="row"><span class="label">Payment</span><span>${paymentLabel(s.paymentMethod)}</span></div>
  </div>

  <table>
    <thead><tr>
      <th>#</th><th>Item</th><th class="right">Qty</th><th class="right">Price</th><th class="right">Total</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="total-box">
    <div class="grand"><span>GRAND TOTAL</span><span>${parseFloat(s.totalAmount).toLocaleString()} RWF</span></div>
  </div>

  ${hasSerials ? `
  <div class="warranty-box">
    <div style="font-weight:700;margin-bottom:6px;font-size:11px">Warranty Information</div>
    ${warrantyRows}
  </div>
  ` : ""}

  <div class="footer">
    <p style="font-weight:600;color:#555;margin-bottom:4px">Thank you for shopping at ${store.name}!</p>
    <p>${store.address} | ${store.phone}</p>
    ${hasSerials ? `<p style="margin-top:6px">Check your warranty at: ${window.location.origin}/warranty</p>` : ""}
    <p style="margin-top:6px">Keep this receipt as proof of purchase and warranty</p>
  </div>
</body>
</html>`;
}

function openPrintWindow(receipt: ReceiptDetail, autoClose = false) {
  const html = buildReceiptHTML(receipt);
  const win = window.open("", "_blank", "width=480,height=700");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    if (autoClose) setTimeout(() => win.close(), 500);
  }, 350);
}

function buildWhatsAppMessage(r: ReceiptDetail) {
  const itemList = r.items.map((i) => `${i.itemName} x${i.quantity}`).join(", ");
  const msg = `Hello ${r.sale.customerName}, thank you for your purchase at ${r.store.name}! 🎉\n\nReceipt No: ${r.receiptNumber}\nDate: ${fmtDate(r.sale.createdAt)}\nItems: ${itemList}\nTotal: ${fmtRWF(r.sale.totalAmount)}\nPayment: ${paymentLabel(r.sale.paymentMethod)}\n\nFor warranty or support, contact us: ${r.store.phone}\n\nCheck your warranty at: ${window.location.origin}/warranty`;
  return encodeURIComponent(msg);
}

export function ReceiptModal({ saleId, open, onClose }: { saleId: number; open: boolean; onClose: () => void }) {
  const { data: receipt, isLoading } = useQuery<ReceiptDetail>({
    queryKey: ["receipt", saleId],
    queryFn: () => api.get(`/receipts/${saleId}`),
    enabled: open && !!saleId,
  });

  const s = receipt?.sale;
  const date = s ? new Date(s.createdAt) : null;
  const dateStr = date?.toLocaleDateString("en-RW", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = date?.toLocaleTimeString("en-RW", { hour: "2-digit", minute: "2-digit" });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#1A6DB5]" />
            Receipt {receipt?.receiptNumber || ""}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 text-center text-gray-400">Loading receipt...</div>
        ) : !receipt ? (
          <div className="py-12 text-center text-gray-400">Receipt not found</div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => openPrintWindow(receipt)} variant="outline" className="gap-2">
                <Printer className="w-4 h-4" /> Print
              </Button>
              <Button onClick={() => openPrintWindow(receipt)} variant="outline" className="gap-2 text-[#1A6DB5] border-[#1A6DB5]/30 hover:bg-[#1A6DB5]/5">
                <Download className="w-4 h-4" /> Save as PDF
              </Button>
              {receipt.sale.customerPhone && (
                <a href={`https://wa.me/${receipt.sale.customerPhone.replace(/\D/g, "")}?text=${buildWhatsAppMessage(receipt)}`}
                  target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="gap-2 text-green-600 border-green-200 hover:bg-green-50">
                    <MessageSquare className="w-4 h-4" /> Share via WhatsApp
                  </Button>
                </a>
              )}
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <div className="p-5 max-w-sm mx-auto font-sans text-sm">
                <div className="text-center mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#1A6DB5] text-white flex items-center justify-center text-xl font-extrabold mx-auto mb-2">D</div>
                  <h2 className="text-lg font-extrabold text-[#1A6DB5]">{receipt.store.name}</h2>
                  <p className="text-xs text-gray-500">{receipt.store.address}</p>
                  <p className="text-xs text-gray-500">{receipt.store.phone} | {receipt.store.email}</p>
                </div>

                <div className="border-t border-b border-dashed border-gray-300 py-3 mb-4 space-y-1.5">
                  {[
                    ["Receipt No.", <strong>{receipt.receiptNumber}</strong>],
                    ["Date", dateStr],
                    ["Time", timeStr],
                    ["Customer", <strong>{receipt.sale.customerName}</strong>],
                    ...(receipt.sale.customerPhone ? [["Phone", receipt.sale.customerPhone] as any] : []),
                    ["Payment", paymentLabel(receipt.sale.paymentMethod)],
                  ].map(([label, value], i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-gray-500">{label}</span>
                      <span>{value}</span>
                    </div>
                  ))}
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
                            <div className="text-gray-400 text-[10px]">IMEI: {item.serialNumbers.join(", ")}</div>
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
                  <div className="flex justify-between text-base font-extrabold text-[#0F1A2E]">
                    <span>GRAND TOTAL</span>
                    <span>{fmtRWF(receipt.sale.totalAmount)}</span>
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
                            IMEI: {sn} — Warranty: {receipt.store.warrantyPeriod} from purchase date
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                <div className="text-center text-xs text-gray-400 space-y-1 border-t border-dashed border-gray-200 pt-3">
                  <p className="font-medium text-gray-600">Thank you for shopping at {receipt.store.name}!</p>
                  <p>{receipt.store.address} | {receipt.store.phone}</p>
                  {receipt.items.some((i) => i.serialNumbers.length > 0) && (
                    <p className="text-[10px] mt-1">Check your warranty at: {window.location.origin}/warranty</p>
                  )}
                  <p className="text-[10px]">Keep this receipt as proof of purchase and warranty</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
