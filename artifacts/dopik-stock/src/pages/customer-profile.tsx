import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, fmtRWF, fmtDate, fmtDateTime } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, User, Phone, Mail, MapPin, Calendar,
  ShoppingBag, CreditCard, Shield, CheckCircle2, XCircle, AlertCircle
} from "lucide-react";

type CustomerProfile = {
  customer: {
    id: number; name: string; phone?: string; email?: string;
    address?: string; contactPerson?: string; createdAt: string;
  };
  stats: { totalOrders: number; totalSpent: number; avgOrderValue: number; creditBalance: number };
  sales: {
    id: number; paymentMethod: string; totalAmount: string;
    reverted: boolean; createdAt: string;
    items: { itemName: string; quantity: string; unitPrice: string; lineTotal: string }[];
  }[];
  creditAccounts: {
    id: number; totalAmount: string; amountPaid: string; balance: string;
    dueDate?: string; status: string; createdAt: string;
  }[];
  warranties: {
    id: number; imeiOrSerial?: string; color?: string; storage?: string;
    dateReceived?: string; status: string; itemName?: string;
  }[];
};

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

function paymentLabel(m: string) {
  return { cash: "Cash", bank: "Bank", mobile_money: "Mobile Money", credit: "Credit" }[m] || m;
}

function pmColor(m: string) {
  return { cash: "bg-green-100 text-green-700", bank: "bg-blue-100 text-blue-700", mobile_money: "bg-amber-100 text-amber-700", credit: "bg-red-100 text-red-700" }[m] || "bg-gray-100 text-gray-700";
}

function WarrantyStatus({ dateReceived }: { dateReceived?: string }) {
  if (!dateReceived) return <span className="text-xs text-gray-400">Unknown</span>;
  const expiry = new Date(dateReceived);
  expiry.setMonth(expiry.getMonth() + 6);
  const days = Math.ceil((expiry.getTime() - Date.now()) / 86400000);
  if (days > 0) return <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle2 className="w-3.5 h-3.5" />Active ({days}d left)</span>;
  return <span className="flex items-center gap-1 text-red-500 text-xs"><XCircle className="w-3.5 h-3.5" />Expired</span>;
}

export default function CustomerProfilePage() {
  const [, params] = useRoute("/customers/:id");
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"purchases" | "credit" | "warranties">("purchases");

  const id = params?.id ? parseInt(params.id) : null;

  const { data, isLoading } = useQuery<CustomerProfile>({
    queryKey: ["customer-profile", id],
    queryFn: () => api.get(`/customers/${id}`),
    enabled: !!id,
  });

  if (isLoading) return (
    <div className="p-6 text-center text-gray-400">Loading customer profile...</div>
  );

  if (!data) return (
    <div className="p-6 text-center text-gray-400">Customer not found</div>
  );

  const { customer, stats, sales, creditAccounts, warranties } = data;

  const tabs = [
    { key: "purchases", label: "Purchases", count: sales.filter(s => !s.reverted).length },
    { key: "credit", label: "Credit", count: creditAccounts.filter(c => c.status === "active").length },
    { key: "warranties", label: "Warranties", count: warranties.length },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl">
      <button onClick={() => navigate("/customers")}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#1A6DB5] transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Customers
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col sm:flex-row gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1A6DB5] to-[#F5A800] flex items-center justify-center flex-shrink-0 shadow">
          <span className="text-white text-xl font-bold">{getInitials(customer.name)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-[#0F1A2E]">{customer.name}</h1>
          <div className="flex flex-wrap gap-3 mt-1.5 text-sm text-gray-500">
            {customer.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{customer.phone}</span>}
            {customer.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{customer.email}</span>}
            {customer.address && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{customer.address}</span>}
            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Customer since {fmtDate(customer.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag className="w-4 h-4 text-[#1A6DB5]" />
            <p className="text-xs text-gray-500">Total Orders</p>
          </div>
          <p className="text-2xl font-bold text-[#0F1A2E]">{stats.totalOrders}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag className="w-4 h-4 text-green-500" />
            <p className="text-xs text-gray-500">Total Spent</p>
          </div>
          <p className="text-lg font-bold text-green-600">{fmtRWF(String(stats.totalSpent))}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag className="w-4 h-4 text-amber-500" />
            <p className="text-xs text-gray-500">Avg. Order Value</p>
          </div>
          <p className="text-lg font-bold text-amber-600">{fmtRWF(String(stats.avgOrderValue))}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-4 h-4 text-red-500" />
            <p className="text-xs text-gray-500">Credit Balance</p>
          </div>
          <p className={`text-lg font-bold ${stats.creditBalance > 0 ? "text-red-600" : "text-green-600"}`}>
            {stats.creditBalance > 0 ? fmtRWF(String(stats.creditBalance)) : "Clear"}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                tab === t.key ? "border-b-2 border-[#1A6DB5] text-[#1A6DB5] bg-blue-50/30" : "text-gray-500 hover:text-gray-700"
              }`}>
              {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${tab === t.key ? "bg-[#1A6DB5]/10 text-[#1A6DB5]" : "bg-gray-100 text-gray-500"}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        <div className="p-4">
          {tab === "purchases" && (
            <div className="space-y-3">
              {sales.filter(s => !s.reverted).length === 0 ? (
                <p className="text-center text-gray-400 py-8">No purchases yet</p>
              ) : sales.filter(s => !s.reverted).map(s => (
                <div key={s.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-[#1A6DB5] font-semibold">Sale #{s.id}</span>
                      <Badge className={`text-xs ${pmColor(s.paymentMethod)}`}>{paymentLabel(s.paymentMethod)}</Badge>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">{fmtRWF(s.totalAmount)}</p>
                      <p className="text-xs text-gray-400">{fmtDate(s.createdAt)}</p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 space-y-0.5">
                    {s.items.map((item, i) => (
                      <div key={i} className="flex justify-between">
                        <span>{item.itemName} × {parseFloat(item.quantity)}</span>
                        <span>{fmtRWF(item.lineTotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "credit" && (
            <div className="space-y-3">
              {creditAccounts.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No credit accounts</p>
              ) : creditAccounts.map(c => {
                const balance = parseFloat(String(c.balance));
                const total = parseFloat(String(c.totalAmount));
                const paid = parseFloat(String(c.amountPaid));
                const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
                return (
                  <div key={c.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <Badge className={c.status === "paid" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}>
                        {c.status}
                      </Badge>
                      <span className="font-bold text-sm">{fmtRWF(String(balance))} remaining</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{fmtRWF(String(paid))} paid of {fmtRWF(String(total))}</span>
                      {c.dueDate && <span>Due: {fmtDate(c.dueDate)}</span>}
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="bg-[#1A6DB5] h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === "warranties" && (
            <div className="space-y-3">
              {warranties.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No warranty records found for serialized items</p>
              ) : warranties.map(w => (
                <div key={w.id} className="border border-gray-100 rounded-lg p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm">{w.itemName || "Unknown Device"}</p>
                    <p className="text-xs text-gray-500">
                      {[w.color, w.storage].filter(Boolean).join(" · ")}
                      {w.imeiOrSerial && ` · IMEI: ${w.imeiOrSerial}`}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">Purchased: {fmtDate(w.dateReceived)}</p>
                  </div>
                  <WarrantyStatus dateReceived={w.dateReceived} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
