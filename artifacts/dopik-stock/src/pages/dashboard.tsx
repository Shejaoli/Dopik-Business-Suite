import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, fmtRWF, fmtDateTime } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package, TrendingUp, Wallet, AlertTriangle,
  Banknote, Landmark, Smartphone, ShoppingCart,
  Tag, ShoppingBag, Receipt, LayoutList,
  Users, BarChart2, HeadphonesIcon, MoreHorizontal, ChevronDown
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";

const PERIODS = [
  { key: "today", label: "TODAY" },
  { key: "month", label: "THIS MONTH" },
  { key: "year", label: "THIS YEAR" },
];

function useDashboard(period: string) {
  return useQuery({
    queryKey: ["dashboard", period],
    queryFn: () => api.get<any>(`/dashboard?period=${period}`),
  });
}

// ── Semicircular Profit Gauge ──────────────────────────────────────────────
function ProfitGauge({ netProfit, grossProfit, totalExpenses, isLoading, period, onPeriodChange }: {
  netProfit: number; grossProfit: number; totalExpenses: number;
  isLoading: boolean; period: string; onPeriodChange: (p: string) => void;
}) {
  const W = 260;
  const H = 155;
  const cx = W / 2;
  const cy = 140;
  const R = 100;
  const strokeW = 14;

  // Arc path helper (counter-clockwise for bottom-out semicircle)
  const polarToXY = (angleDeg: number) => {
    const rad = (angleDeg - 180) * (Math.PI / 180);
    return { x: cx + R * Math.cos(rad), y: cy + R * Math.sin(rad) };
  };

  const start = polarToXY(0);    // left end
  const end = polarToXY(180);    // right end

  const trackPath = `M ${start.x} ${start.y} A ${R} ${R} 0 0 1 ${end.x} ${end.y}`;

  // Fill pct (0–1): how much of gross profit flows to net profit
  const isNeg = netProfit < 0;
  const pct = grossProfit > 0 ? Math.max(0, Math.min(1, netProfit / grossProfit)) : 0;

  // Circumference of semicircle
  const halfCirc = Math.PI * R;
  const dashArray = halfCirc;
  const dashOffset = halfCirc - pct * halfCirc;

  const gaugeColor = isNeg ? "#ef4444" : "#06b6d4"; // red or cyan

  return (
    <div className="glass-panel p-5 flex flex-col items-center">
      {/* Period selector */}
      <div className="flex items-center justify-between w-full mb-4">
        <div className="relative">
          <select
            value={period}
            onChange={e => onPeriodChange(e.target.value)}
            className="appearance-none bg-gray-100 border-0 rounded-lg text-[11px] font-bold uppercase tracking-wider text-gray-600 pl-2 pr-6 py-1.5 cursor-pointer outline-none"
          >
            {PERIODS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">NET PROFIT</span>
      </div>

      {isLoading ? (
        <Skeleton className="w-[260px] h-[155px] rounded-2xl" />
      ) : (
        <div className="relative">
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} overflow="visible">
            {/* Track */}
            <path
              d={trackPath}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth={strokeW}
              strokeLinecap="round"
            />
            {/* Fill */}
            <path
              d={trackPath}
              fill="none"
              stroke={gaugeColor}
              strokeWidth={strokeW}
              strokeLinecap="round"
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 0.6s ease" }}
            />
            {/* Center text */}
            <text x={cx} y={cy - 32} textAnchor="middle" fontSize="22" fontWeight="700"
              fill={isNeg ? "#ef4444" : "#0f172a"} fontFamily="inherit">
              {fmtRWF(String(netProfit))}
            </text>
            <text x={cx} y={cy - 12} textAnchor="middle" fontSize="11" fill="#94a3b8" fontFamily="inherit">
              Net Profit
            </text>
            {/* Gross Profit label - left */}
            <text x={start.x + 4} y={cy + 22} textAnchor="start" fontSize="13" fontWeight="700" fill="#0f172a" fontFamily="inherit">
              {fmtRWF(String(grossProfit))}
            </text>
            <text x={start.x + 4} y={cy + 34} textAnchor="start" fontSize="10" fill="#06b6d4" fontFamily="inherit">
              Gross Profit
            </text>
            {/* Expenses label - right */}
            <text x={end.x - 4} y={cy + 22} textAnchor="end" fontSize="13" fontWeight="700" fill="#0f172a" fontFamily="inherit">
              {fmtRWF(String(totalExpenses))}
            </text>
            <text x={end.x - 4} y={cy + 34} textAnchor="end" fontSize="10" fill="#06b6d4" fontFamily="inherit">
              Expenses
            </text>
          </svg>
        </div>
      )}

      {!isLoading && (
        <p className="text-xs text-muted-foreground mt-2">
          {pct > 0 ? `${(pct * 100).toFixed(1)}% profit margin` : isNeg ? "Net loss this period" : "No sales this period"}
        </p>
      )}
    </div>
  );
}

// ── Quick Action Buttons ───────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: "Sale", icon: Tag, color: "bg-green-500", href: "/sales" },
  { label: "Purchase", icon: ShoppingCart, color: "bg-orange-500", href: "/purchases" },
  { label: "Expenses", icon: Receipt, color: "bg-pink-500", href: "/expenses" },
  { label: "Transactions", icon: LayoutList, color: "bg-fuchsia-500", href: "/sales-history" },
  { label: "Items", icon: Package, color: "bg-purple-600", href: "/items" },
  { label: "Contacts", icon: Users, color: "bg-amber-600", href: "/customers" },
  { label: "Reports", icon: BarChart2, color: "bg-yellow-500", href: "/reports" },
  { label: "Support", icon: HeadphonesIcon, color: "bg-rose-400", href: "/settings" },
  { label: "More", icon: MoreHorizontal, color: "bg-cyan-500", href: "/settings" },
];

function QuickActions() {
  const [, navigate] = useLocation();
  return (
    <div className="glass-panel p-5">
      <h2 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wide">Quick Actions</h2>
      <div className="grid grid-cols-3 gap-3">
        {QUICK_ACTIONS.map(({ label, icon: Icon, color, href }) => (
          <button
            key={label}
            onClick={() => navigate(href)}
            className="flex flex-col items-center gap-2 group"
          >
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center transition-transform active:scale-95 group-hover:scale-105 shadow-sm",
              color
            )}>
              <Icon className="h-6 w-6 text-white" />
            </div>
            <span className="text-[11px] font-medium text-gray-600">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string; icon: any; color: string; sub?: string
}) {
  return (
    <div className="glass-panel p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold font-sora text-foreground mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [period, setPeriod] = useState("month");
  const { data, isLoading } = useDashboard(period);

  const netProfit = parseFloat(data?.netProfit ?? "0");
  const grossProfit = parseFloat(data?.grossProfit ?? "0");
  const totalExpenses = parseFloat(data?.totalExpenses ?? "0");

  const recentSalesChart = (data?.recentSales ?? [])
    .filter((s: any) => !s.reverted)
    .slice(0, 7)
    .reverse()
    .map((s: any, i: number) => ({
      name: `#${i + 1}`,
      amount: parseFloat(s.totalAmount),
    }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold font-sora text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Welcome back — here's what's happening.</p>
      </div>

      {/* Top row: Profit Gauge + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProfitGauge
          netProfit={netProfit}
          grossProfit={grossProfit}
          totalExpenses={totalExpenses}
          isLoading={isLoading}
          period={period}
          onPeriodChange={setPeriod}
        />
        <QuickActions />
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Total Items" value={String(data?.totalItems ?? 0)} icon={Package} color="bg-[#1A6DB5]/10 text-[#1A6DB5]" />
          <StatCard label="Stock Value" value={fmtRWF(data?.totalStockValue)} icon={ShoppingCart} color="bg-purple-100 text-purple-600" />
          <StatCard label="Today's Sales" value={fmtRWF(data?.todaySales)} icon={TrendingUp} color="bg-green-100 text-green-600" />
          <StatCard label="Receivables" value={fmtRWF(data?.outstandingReceivables)} icon={Wallet} color="bg-orange-100 text-orange-600" sub="Outstanding" />
        </div>
      )}

      {/* Balances + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-panel p-5 lg:col-span-2">
          <h2 className="text-base font-semibold font-sora mb-4">Cash Positions</h2>
          {isLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: "Cash", value: data?.cashBalance, icon: Banknote, color: "bg-green-50 border-green-200" },
                { label: "Bank", value: data?.bankBalance, icon: Landmark, color: "bg-blue-50 border-blue-200" },
                { label: "Mobile Money", value: data?.mobileMoney, icon: Smartphone, color: "bg-yellow-50 border-yellow-200" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className={`flex items-center gap-3 p-4 rounded-xl border ${color}`}>
                  <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-bold text-foreground">{fmtRWF(value)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && recentSalesChart.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Recent Sales</h3>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={recentSalesChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v: any) => fmtRWF(v)} />
                  <Bar dataKey="amount" fill="#1A6DB5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="glass-panel p-5">
          <h2 className="text-base font-semibold font-sora mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Stock Alerts
          </h2>
          {isLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100">
                <span className="text-sm font-medium text-red-700">Out of Stock</span>
                <Badge variant="destructive">{data?.outOfStockCount ?? 0}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-xl border border-yellow-100">
                <span className="text-sm font-medium text-yellow-700">Low Stock</span>
                <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">{data?.lowStockCount ?? 0}</Badge>
              </div>
              {(data?.outOfStockCount ?? 0) === 0 && (data?.lowStockCount ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">All stock levels are healthy ✓</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="glass-panel p-5">
          <h2 className="text-base font-semibold font-sora mb-4">Recent Sales</h2>
          {isLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <div className="space-y-2">
              {(data?.recentSales ?? []).slice(0, 6).map((sale: any) => (
                <div key={sale.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{sale.customerName ?? "Walk-in"}</p>
                    <p className="text-xs text-muted-foreground">{fmtDateTime(sale.createdAt)}</p>
                  </div>
                  <div className="text-right ml-2 flex-shrink-0">
                    <p className="text-sm font-semibold text-green-600">{fmtRWF(sale.totalAmount)}</p>
                    <Badge className={`text-xs ${sale.reverted ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                      {sale.reverted ? "Reverted" : sale.paymentMethod}
                    </Badge>
                  </div>
                </div>
              ))}
              {(data?.recentSales ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No sales yet</p>
              )}
            </div>
          )}
        </div>

        <div className="glass-panel p-5">
          <h2 className="text-base font-semibold font-sora mb-4">Recent Purchases</h2>
          {isLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <div className="space-y-2">
              {(data?.recentPurchases ?? []).slice(0, 6).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.itemName ?? "Item"}</p>
                    <p className="text-xs text-muted-foreground">{p.vendorName ?? "—"} · {fmtDateTime(p.createdAt)}</p>
                  </div>
                  <div className="text-right ml-2 flex-shrink-0">
                    <p className="text-sm font-semibold text-blue-600">{fmtRWF(p.totalCost)}</p>
                    <p className="text-xs text-muted-foreground">Qty: {p.quantity}</p>
                  </div>
                </div>
              ))}
              {(data?.recentPurchases ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No purchases yet</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
