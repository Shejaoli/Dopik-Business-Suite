import { useQuery } from "@tanstack/react-query";
import { api, fmtRWF, fmtDate, fmtDateTime } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, MessageSquare, Download, Receipt, X } from "lucide-react";

export type ReceiptDetail = {
  receiptNumber: string;
  siteUrl?: string;
  sale: {
    id: number;
    customerName: string;
    customerPhone?: string | null;
    paymentMethod: string;
    totalAmount: string;
    discountAmount?: string | null;
    discountType?: string | null;
    amountReceived?: string | null;
    changeGiven?: string | null;
    paymentTermsDays?: number | null;
    splitPaymentMethod2?: string | null;
    splitPaymentAmount1?: string | null;
    splitPaymentAmount2?: string | null;
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
    additionalInfo?: string | null;
    serializedUnit?: {
      imeiOrSerial: string | null;
      color: string | null;
      ram: string | null;
      storage: string | null;
      condition: string | null;
    } | null;
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
    cash: "Cash", bank: "Bank Transfer", mobile_money: "Mobile Money", momo: "MoMo",
    credit: "Credit", split: "Split Payment",
  };
  return map[m] || m;
}

function getItemImei(item: ReceiptDetail["items"][0]): string | null {
  if (item.serializedUnit?.imeiOrSerial) return item.serializedUnit.imeiOrSerial;
  if (item.serialNumbers.length > 0) return item.serialNumbers[0];
  return null;
}

function getItemDescription(item: ReceiptDetail["items"][0]): string | null {
  if (item.serializedUnit) {
    const { color, ram, storage, condition, imeiOrSerial } = item.serializedUnit;
    const parts = [
      color,
      ram ? `${ram} RAM` : null,
      storage,
      imeiOrSerial ? `IMEI: ${imeiOrSerial}` : null,
      condition,
    ].filter(Boolean);
    return parts.join(" / ") || null;
  }
  if (item.serialNumbers.length > 0) return `IMEI: ${item.serialNumbers.join(", ")}`;
  return null;
}

function buildReceiptHTML(receipt: ReceiptDetail): string {
  const s = receipt.sale;
  const store = receipt.store;
  const date = new Date(s.createdAt);
  const dateStr = date.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const discount = parseFloat(s.discountAmount ?? "0");
  const hasSerial = receipt.items.some(i => i.serializedUnit?.imeiOrSerial || i.serialNumbers.length > 0);

  const paymentInfo = s.paymentMethod === "split"
    ? `${paymentLabel(s.paymentMethod)}: ${parseFloat(s.splitPaymentAmount1 ?? "0").toLocaleString()} RWF (${paymentLabel(s.paymentMethod || "cash")}) + ${parseFloat(s.splitPaymentAmount2 ?? "0").toLocaleString()} RWF (${paymentLabel(s.splitPaymentMethod2 || "cash")})`
    : paymentLabel(s.paymentMethod);

  const itemRows = receipt.items.map((item, idx) => {
    const desc = getItemDescription(item);
    return `
    <tr style="border-bottom:1px solid #f0f0f0">
      <td style="padding:6px 4px;color:#999">${idx + 1}</td>
      <td style="padding:6px 4px">
        <div style="font-weight:600">${item.itemName}</div>
        ${desc ? `<div style="font-size:10px;color:#aaa">${desc}</div>` : ""}
        ${item.additionalInfo ? `<div style="font-size:10px;color:#999;font-style:italic;margin-top:2px">ℹ️ ${item.additionalInfo}</div>` : ""}
      </td>
      <td style="padding:6px 4px;text-align:right">${item.quantity}</td>
      <td style="padding:6px 4px;text-align:right">${parseFloat(item.unitPrice).toLocaleString()}</td>
      <td style="padding:6px 4px;text-align:right;font-weight:600">${parseFloat(item.lineTotal).toLocaleString()}</td>
    </tr>`;
  }).join("");

  const warrantyRows = receipt.items
    .filter(i => i.serializedUnit?.imeiOrSerial || i.serialNumbers.length > 0)
    .map(item => {
      const imei = getItemImei(item);
      return `<div style="margin-bottom:4px">✅ <span style="font-weight:600">${item.itemName}</span> — 6 months warranty<br><span style="font-size:10px;color:#888">IMEI: ${imei}</span></div>`;
    }).join("");

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
    @media print { body { padding: 0; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="center" style="margin-bottom:14px">
    <div class="logo">D</div>
    <div style="font-size:18px;font-weight:900;color:#1A6DB5">${store.name}</div>
    <div style="font-size:11px;color:#777">${store.address}</div>
    <div style="font-size:11px;color:#777">${store.phone} | ${store.email}</div>
    <div style="font-size:13px;font-weight:700;margin-top:6px;letter-spacing:1px">WARRANTY RECEIPT</div>
  </div>

  <div class="dashed">
    <div class="row"><span class="label">Receipt No.</span><strong>${receipt.receiptNumber}</strong></div>
    <div class="row"><span class="label">Date</span><span>${dateStr}</span></div>
    <div class="row"><span class="label">Time</span><span>${timeStr}</span></div>
    <div class="row"><span class="label">Customer</span><strong>${s.customerName}</strong></div>
    ${s.customerPhone ? `<div class="row"><span class="label">Phone</span><span>${s.customerPhone}</span></div>` : ""}
    <div class="row"><span class="label">Payment</span><span>${paymentInfo}</span></div>
    ${s.paymentMethod === "credit" ? `<div class="row"><span class="label">Terms</span><span>${s.paymentTermsDays ?? 30} days</span></div>` : ""}
  </div>

  <table>
    <thead><tr>
      <th>#</th><th>Item</th><th class="right">Qty</th><th class="right">Price</th><th class="right">Total</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="total-box">
    ${discount > 0 ? `<div class="row" style="color:#e07800"><span>Discount</span><span>-${discount.toLocaleString()} RWF</span></div>` : ""}
    ${s.amountReceived ? `<div class="row"><span class="label">Received</span><span>${parseFloat(s.amountReceived).toLocaleString()} RWF</span></div>` : ""}
    ${s.changeGiven ? `<div class="row"><span class="label">Change</span><span>${parseFloat(s.changeGiven).toLocaleString()} RWF</span></div>` : ""}
    <div class="grand"><span>GRAND TOTAL</span><span>${parseFloat(s.totalAmount).toLocaleString()} RWF</span></div>
  </div>

  ${hasSerial ? `
  <div class="warranty-box">
    <div style="font-weight:700;margin-bottom:6px;font-size:11px">🔧 Warranty Information</div>
    ${warrantyRows}
    <div style="font-size:10px;color:#888;margin-top:6px">Check warranty at: ${receipt.siteUrl || "https://dopikelectronics.com"}/warranty</div>
  </div>
  ` : ""}

  <div class="footer">
    <p style="font-weight:600;color:#555;margin-bottom:4px">Thank you for shopping at ${store.name}! 🇷🇼</p>
    <p>Kigali, Rwanda | ${store.phone}</p>
    <p style="margin-top:4px">For support or warranty claims, contact us: ${store.phone}</p>
    <p style="margin-top:4px">Keep this receipt as proof of purchase</p>
  </div>
</body>
</html>`;
}

function openPrintWindow(receipt: ReceiptDetail) {
  const html = buildReceiptHTML(receipt);
  const win = window.open("", "_blank", "width=480,height=700");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 350);
}

function buildWhatsAppMessage(r: ReceiptDetail) {
  const store = r.store;
  const date = new Date(r.sale.createdAt);
  const dateStr = date.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  const itemList = r.items.map(i => {
    const imei = getItemImei(i);
    return `- ${i.itemName} x${i.quantity} — ${parseFloat(i.lineTotal).toLocaleString()} RWF${imei ? ` (IMEI: ${imei})` : ""}`;
  }).join("\n");

  const warrantyItems = r.items
    .filter(i => i.serializedUnit?.imeiOrSerial || i.serialNumbers.length > 0)
    .map(i => {
      const imei = getItemImei(i);
      return `${i.itemName} — 6 months warranty (IMEI: ${imei})`;
    }).join("\n");

  const discount = parseFloat(r.sale.discountAmount ?? "0");

  let msg = `Hello ${r.sale.customerName} 👋\n\nThank you for your purchase at ${store.name}! 🎉\n\n`;
  msg += `📋 Receipt No: ${r.receiptNumber}\n📅 Date: ${dateStr} at ${timeStr}\n\n`;
  msg += `🛍 Items purchased:\n${itemList}\n\n`;
  msg += `💰 Total Paid: ${parseFloat(r.sale.totalAmount).toLocaleString()} RWF\n`;
  msg += `💳 Payment: ${paymentLabel(r.sale.paymentMethod)}\n`;
  if (discount > 0) msg += `🏷 Discount applied: -${discount.toLocaleString()} RWF\n`;
  if (warrantyItems) {
    msg += `\n🔧 Warranty:\n${warrantyItems}\n`;
    msg += `\nCheck your warranty: ${r.siteUrl || "https://dopikelectronics.com"}/warranty\n`;
  }
  msg += `\nFor support contact us: ${store.phone}\n\nThank you for choosing ${store.name}! 🙏`;
  return encodeURIComponent(msg);
}

export function ReceiptModal({ saleId, open, onClose }: { saleId: number; open: boolean; onClose: () => void }) {
  const { data: receipt, isLoading } = useQuery<ReceiptDetail>({
    queryKey: ["receipt", saleId],
    queryFn: () => api.get(`/receipts/${saleId}`),
    enabled: open && !!saleId,
  });

  const s = receipt?.sale;
  const dateStr = s ? fmtDate(s.createdAt) : null;
  const timeStr = s ? new Date(s.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null;
  const discount = parseFloat(s?.discountAmount ?? "0");
  const hasWhatsApp = !!receipt?.sale.customerPhone;

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
              {hasWhatsApp ? (
                <a href={`https://wa.me/${receipt.sale.customerPhone!.replace(/\D/g, "")}?text=${buildWhatsAppMessage(receipt)}`}
                  target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="gap-2 text-green-600 border-green-200 hover:bg-green-50">
                    <MessageSquare className="w-4 h-4" /> Share via WhatsApp
                  </Button>
                </a>
              ) : (
                <div className="relative group">
                  <Button variant="outline" disabled className="gap-2 text-gray-400 border-gray-200">
                    <MessageSquare className="w-4 h-4" /> Share via WhatsApp
                  </Button>
                  <div className="absolute bottom-full mb-1 left-0 bg-gray-800 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none">
                    No phone number available for walk-in customer
                  </div>
                </div>
              )}
              <Button onClick={onClose} variant="outline" className="gap-2 ml-auto">
                <X className="w-4 h-4" /> Close
              </Button>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <div className="p-5 max-w-sm mx-auto font-sans text-sm">
                <div className="text-center mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#1A6DB5] text-white flex items-center justify-center text-xl font-extrabold mx-auto mb-2">D</div>
                  <h2 className="text-lg font-extrabold text-[#1A6DB5]">{receipt.store.name}</h2>
                  <p className="text-xs text-gray-500">{receipt.store.address}</p>
                  <p className="text-xs text-gray-500">{receipt.store.phone} | {receipt.store.email}</p>
                  <p className="text-xs font-bold tracking-widest mt-1">WARRANTY RECEIPT</p>
                </div>

                <div className="border-t border-b border-dashed border-gray-300 py-3 mb-4 space-y-1.5">
                  {[
                    ["Receipt No.", <strong key="rn">{receipt.receiptNumber}</strong>],
                    ["Date", dateStr],
                    ["Time", timeStr],
                    ["Customer", <strong key="cn">{receipt.sale.customerName}</strong>],
                    ...(receipt.sale.customerPhone ? [["Phone", receipt.sale.customerPhone] as any] : []),
                    ["Payment", (() => {
                      if (s?.paymentMethod === "split") {
                        return `Split: ${fmtRWF(s.splitPaymentAmount1)} (${paymentLabel(s.paymentMethod || "cash")}) + ${fmtRWF(s.splitPaymentAmount2)} (${paymentLabel(s.splitPaymentMethod2 || "cash")})`;
                      }
                      return paymentLabel(s?.paymentMethod || "");
                    })()],
                    ...(s?.paymentMethod === "credit" ? [["Terms", `${s.paymentTermsDays ?? 30} days`]] : []),
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
                    {receipt.items.map((item, idx) => {
                      const desc = getItemDescription(item);
                      return (
                        <tr key={item.id} className="border-b border-gray-100">
                          <td className="py-1.5 text-gray-400">{idx + 1}</td>
                          <td className="py-1.5">
                            <div className="font-medium">{item.itemName}</div>
                            {desc && <div className="text-gray-400 text-[10px]">{desc}</div>}
                            {item.additionalInfo && <div className="text-gray-400 text-[10px] italic mt-0.5">ℹ️ {item.additionalInfo}</div>}
                          </td>
                          <td className="py-1.5 text-right">{item.quantity}</td>
                          <td className="py-1.5 text-right">{parseFloat(item.unitPrice).toLocaleString()}</td>
                          <td className="py-1.5 text-right font-medium">{parseFloat(item.lineTotal).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1">
                  {discount > 0 && (
                    <div className="flex justify-between text-xs text-orange-600">
                      <span>Discount</span>
                      <span>-{fmtRWF(String(discount))}</span>
                    </div>
                  )}
                  {s?.amountReceived && parseFloat(s.amountReceived) > 0 && (
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Amount Received</span>
                      <span>{fmtRWF(s.amountReceived)}</span>
                    </div>
                  )}
                  {s?.changeGiven && parseFloat(s.changeGiven) > 0 && (
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Change Given</span>
                      <span>{fmtRWF(s.changeGiven)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-extrabold text-[#0F1A2E] pt-1 border-t border-gray-200">
                    <span>GRAND TOTAL</span>
                    <span>{fmtRWF(receipt.sale.totalAmount)}</span>
                  </div>
                </div>

                {receipt.items.some(i => i.serializedUnit?.imeiOrSerial || i.serialNumbers.length > 0) && (
                  <div className="border border-dashed border-gray-200 rounded p-2 mb-4 text-xs text-gray-500">
                    <p className="font-medium text-gray-700 mb-1">🔧 Warranty Information</p>
                    {receipt.items
                      .filter(i => i.serializedUnit?.imeiOrSerial || i.serialNumbers.length > 0)
                      .map((item) => {
                        const imei = getItemImei(item);
                        return (
                          <div key={item.id} className="mb-1">
                            ✅ <span className="font-medium">{item.itemName}</span> — {receipt.store.warrantyPeriod} from purchase date
                            {imei && <div className="ml-4 text-[10px]">IMEI: {imei}</div>}
                          </div>
                        );
                      })}
                    <div className="text-[10px] mt-2 text-gray-400">Check warranty at: {receipt.siteUrl || "https://dopikelectronics.com"}/warranty</div>
                  </div>
                )}

                <div className="text-center text-xs text-gray-400 space-y-1 border-t border-dashed border-gray-200 pt-3">
                  <p className="font-medium text-gray-600">Thank you for shopping at {receipt.store.name} 🇷🇼</p>
                  <p>For support or warranty claims, contact us: {receipt.store.phone}</p>
                  <p className="text-[10px] mt-1">Keep this receipt as proof of purchase</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
