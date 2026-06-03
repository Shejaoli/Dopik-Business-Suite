import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, fmtRWF, fmtDateTime, paymentBadgeColor } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package, TrendingUp, Wallet, AlertTriangle,
  Banknote, Landmark, Smartphone, ShoppingCart,
  Tag, ShoppingBag, Receipt, LayoutList,
  Users, BarChart2, HeadphonesIcon, MoreHorizontal, ChevronDown,
  ChevronLeft, ChevronRight, Target, CreditCard,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend
} from "recharts";
import { cn } from "@/lib/utils";

const PERIODS = [
  { key: "today", label: "TODAY" },
  { key: "yesterday", label: "YESTERDAY" },
  { key: "week", label: "THIS WEEK" },
  { key: "month", label: "THIS MONTH" },
  { key: "year", label: "THIS YEAR" },
];

const CHART_PERIODS = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

const COLORS = ["#1A6DB5", "#06b6d4", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"];

function useDashboard(period: string) {
  return useQuery({
    queryKey: ["dashboard", period],
    queryFn: () => api.get<any>(`/dashboard?period=${period}`),
  });
}

function useAnalytics<T = any>(endpoint: string, params?: Record<string, string>) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return useQuery<T>({
    queryKey: ["analytics", endpoint, params],
    queryFn: () => api.get<T>(`/analytics/${endpoint}${qs}`),
  });
}

// ── Semicircular Profit Gauge ──────────────────────────────────────────────
function ProfitGauge({ netProfit, grossProfit, totalExpenses, isLoading, period, onPeriodChange }: {
  netProfit: number; grossProfit: number; totalExpenses: number;
  isLoading: boolean; period: string; onPeriodChange: (p: string) => void;
}) {
  const W = 260; const H = 155; const cx = W / 2; const cy = 140; const R = 100; const strokeW = 14;

  const polarToXY = (angleDeg: number) => {
    const rad = (angleDeg - 180) * (Math.PI / 180);
    return { x: cx + R * Math.cos(rad), y: cy + R * Math.sin(rad) };
  };

  const start = polarToXY(0);
  const end = polarToXY(180);
  const trackPath = `M ${start.x} ${start.y} A ${R} ${R} 0 0 1 ${end.x} ${end.y}`;

  const isNeg = netProfit < 0;
  const pct = grossProfit > 0 ? Math.max(0, Math.min(1, netProfit / grossProfit)) : 0;
  const halfCirc = Math.PI * R;
  const dashArray = halfCirc;
  const dashOffset = halfCirc - pct * halfCirc;
  const gaugeColor = isNeg ? "#ef4444" : "#06b6d4";

  return (
    <div className="glass-panel p-5 flex flex-col items-center">
      <div className="flex items-center justify-between w-full mb-4">
        <div className="relative">
          <select value={period} onChange={e => onPeriodChange(e.target.value)}
            className="appearance-none bg-gray-100 border-0 rounded-lg text-[11px] font-bold uppercase tracking-wider text-gray-600 pl-2 pr-6 py-1.5 cursor-pointer outline-none">
            {PERIODS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">NET PROFIT</span>
      </div>

      {isLoading ? <Skeleton className="w-[260px] h-[155px] rounded-2xl" /> : (
        <div className="relative">
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} overflow="visible">
            <path d={trackPath} fill="none" stroke="#e5e7eb" strokeWidth={strokeW} strokeLinecap="round" />
            <path d={trackPath} fill="none" stroke={gaugeColor} strokeWidth={strokeW} strokeLinecap="round"
              strokeDasharray={dashArray} strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 0.6s ease" }} />
            <text x={cx} y={cy - 32} textAnchor="middle" fontSize="22" fontWeight="700"
              fill={isNeg ? "#ef4444" : "#0f172a"} fontFamily="inherit">
              {fmtRWF(String(netProfit))}
            </text>
            <text x={cx} y={cy - 12} textAnchor="middle" fontSize="11" fill="#94a3b8" fontFamily="inherit">Net Profit</text>
            <text x={start.x + 4} y={cy + 22} textAnchor="start" fontSize="13" fontWeight="700" fill="#0f172a" fontFamily="inherit">{fmtRWF(String(grossProfit))}</text>
            <text x={start.x + 4} y={cy + 34} textAnchor="start" fontSize="10" fill="#06b6d4" fontFamily="inherit">Gross Profit</text>
            <text x={end.x - 4} y={cy + 22} textAnchor="end" fontSize="13" fontWeight="700" fill="#0f172a" fontFamily="inherit">{fmtRWF(String(totalExpenses))}</text>
            <text x={end.x - 4} y={cy + 34} textAnchor="end" fontSize="10" fill="#06b6d4" fontFamily="inherit">Expenses</text>
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

// ── Quick Actions ──────────────────────────────────────────────────────────
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
          <button key={label} onClick={() => navigate(href)} className="flex flex-col items-center gap-2 group">
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-transform active:scale-95 group-hover:scale-105 shadow-sm", color)}>
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

// ── Chart Carousel Slides ──────────────────────────────────────────────────

function SlideRevenue() {
  const [period, setPeriod] = useState("month");
  const { data, isLoading } = useAnalytics("revenue", { period });
  const rows: any[] = data ?? [];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Revenue Over Time</h3>
          <p className="text-xs text-muted-foreground">Daily revenue</p>
        </div>
        <div className="flex gap-1">
          {CHART_PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${period === p.key ? "bg-[#1A6DB5] text-white" : "bg-muted text-muted-foreground"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {isLoading ? <Skeleton className="h-36 w-full" /> : (
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d?.slice(5) ?? ""} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
            <Tooltip formatter={(v: any) => fmtRWF(v)} />
            <Line type="monotone" dataKey="revenue" stroke="#1A6DB5" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function SlideCategories() {
  const [period, setPeriod] = useState("month");
  const { data, isLoading } = useAnalytics("categories", { period });
  const rows: any[] = data ?? [];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Sales by Category</h3>
          <p className="text-xs text-muted-foreground">Revenue split by category</p>
        </div>
        <div className="flex gap-1">
          {CHART_PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${period === p.key ? "bg-[#1A6DB5] text-white" : "bg-muted text-muted-foreground"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {isLoading ? <Skeleton className="h-36 w-full" /> : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No sales data yet</p>
      ) : (
        <div className="flex items-center gap-4">
          <ResponsiveContainer width={140} height={140}>
            <PieChart>
              <Pie data={rows} dataKey="total" nameKey="category" cx="50%" cy="50%" innerRadius={40} outerRadius={65}>
                {rows.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => fmtRWF(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-1.5">
            {rows.slice(0, 5).map((r: any, i: number) => (
              <div key={r.category} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-muted-foreground truncate max-w-[80px]">{r.category}</span>
                </div>
                <span className="font-medium">{r.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SlideTopProducts() {
  const [period, setPeriod] = useState("month");
  const { data, isLoading } = useAnalytics("top-products", { period, limit: "5" });
  const rows: any[] = (data ?? []).slice(0, 5);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Top Selling Products</h3>
          <p className="text-xs text-muted-foreground">Top 5 by revenue</p>
        </div>
        <div className="flex gap-1">
          {CHART_PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${period === p.key ? "bg-[#1A6DB5] text-white" : "bg-muted text-muted-foreground"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {isLoading ? <Skeleton className="h-36 w-full" /> : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No sales data yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={rows} layout="vertical" margin={{ left: 50, right: 30 }}>
            <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={50} />
            <Tooltip formatter={(v: any) => fmtRWF(v)} />
            <Bar dataKey="total" fill="#1A6DB5" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function SlideProfitVsExpenses() {
  const [period, setPeriod] = useState("month");
  const { data, isLoading } = useAnalytics("profit-vs-expenses", { period });
  const rows: any[] = data ?? [];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Gross Profit vs Expenses</h3>
          <p className="text-xs text-muted-foreground">Profitability over time</p>
        </div>
        <div className="flex gap-1">
          {CHART_PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${period === p.key ? "bg-[#1A6DB5] text-white" : "bg-muted text-muted-foreground"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {isLoading ? <Skeleton className="h-36 w-full" /> : (
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d?.slice(5) ?? ""} />
            <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
            <Tooltip formatter={(v: any) => fmtRWF(v)} />
            <Area type="monotone" dataKey="grossProfit" stroke="#10b981" fill="#10b981" fillOpacity={0.15} name="Gross Profit" />
            <Area type="monotone" dataKey="expenses" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} name="Expenses" />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function SlidePaymentMethods() {
  const [period, setPeriod] = useState("month");
  const { data, isLoading } = useAnalytics("payment-methods", { period });
  const rows: any[] = data ?? [];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Payment Method Breakdown</h3>
          <p className="text-xs text-muted-foreground">Sales by payment type</p>
        </div>
        <div className="flex gap-1">
          {CHART_PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${period === p.key ? "bg-[#1A6DB5] text-white" : "bg-muted text-muted-foreground"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {isLoading ? <Skeleton className="h-36 w-full" /> : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No sales data yet</p>
      ) : (
        <div className="flex items-center gap-4">
          <ResponsiveContainer width={140} height={140}>
            <PieChart>
              <Pie data={rows} dataKey="total" nameKey="method" cx="50%" cy="50%" innerRadius={40} outerRadius={65}>
                {rows.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => fmtRWF(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-1.5">
            {rows.map((r: any, i: number) => (
              <div key={r.method} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-muted-foreground capitalize">{(r.method || "other").replace(/_/g, " ")}</span>
                </div>
                <span className="font-medium">{r.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SlideCreditSummary() {
  const [, navigate] = useLocation();
  const { data, isLoading } = useAnalytics("credit-summary");
  const d: any = data ?? {};
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm">Outstanding Credit Summary</h3>
      {isLoading ? <Skeleton className="h-32 w-full" /> : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-red-700">{fmtRWF(String(d.totalOutstanding ?? 0))}</p>
              <p className="text-xs text-red-600 mt-0.5">Outstanding</p>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-orange-700">{d.customerCount ?? 0}</p>
              <p className="text-xs text-orange-600 mt-0.5">Customers</p>
            </div>
          </div>
          {d.oldest && (
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Oldest unpaid:</span>
                <span className="font-medium">{d.oldest.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Most recent:</span>
                <span className="font-medium">{d.newest?.name ?? "—"}</span>
              </div>
            </div>
          )}
          <button onClick={() => navigate("/receivables")}
            className="w-full text-xs text-[#1A6DB5] hover:underline text-center">
            View all credit →
          </button>
        </div>
      )}
    </div>
  );
}

function SlideMonthlyTarget() {
  const [target] = useState(() => Number(localStorage.getItem("monthlyTarget") || "0"));
  const { data } = useAnalytics("revenue", { period: "month" });
  const rows: any[] = data ?? [];
  const achieved = rows.reduce((s: number, r: any) => s + (r.revenue ?? 0), 0);
  const pct = target > 0 ? Math.min(100, (achieved / target) * 100) : 0;
  const remaining = Math.max(0, target - achieved);
  const [, navigate] = useLocation();
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm">Monthly Target Progress</h3>
      {target === 0 ? (
        <div className="text-center py-6 space-y-2">
          <Target className="h-8 w-8 mx-auto text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">No monthly target set</p>
          <button onClick={() => navigate("/charts")} className="text-xs text-[#1A6DB5] hover:underline">
            Set target in Charts page →
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative h-8 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: pct >= 100 ? "#10b981" : "#1A6DB5" }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white"
              style={{ textShadow: "0 1px 2px rgba(0,0,0,.4)" }}>
              {pct.toFixed(1)}%
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Target</p>
              <p className="text-sm font-bold">{fmtRWF(String(target))}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Achieved</p>
              <p className="text-sm font-bold text-green-600">{fmtRWF(String(achieved))}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p className="text-sm font-bold text-[#1A6DB5]">{fmtRWF(String(remaining))}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const SLIDES = [
  { id: "revenue", label: "Revenue Over Time", component: SlideRevenue },
  { id: "categories", label: "Sales by Category", component: SlideCategories },
  { id: "top-products", label: "Top Products", component: SlideTopProducts },
  { id: "profit-expenses", label: "Profit vs Expenses", component: SlideProfitVsExpenses },
  { id: "payments", label: "Payment Methods", component: SlidePaymentMethods },
  { id: "credit", label: "Outstanding Credit", component: SlideCreditSummary },
  { id: "target", label: "Monthly Target", component: SlideMonthlyTarget },
];

// ── Chart Carousel ─────────────────────────────────────────────────────────
function ChartCarousel() {
  const [slide, setSlide] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const prev = useCallback(() => setSlide(s => (s - 1 + SLIDES.length) % SLIDES.length), []);
  const next = useCallback(() => setSlide(s => (s + 1) % SLIDES.length), []);

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchMove = (e: React.TouchEvent) => { touchEndX.current = e.touches[0].clientX; };
  const onTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 40) { if (diff > 0) next(); else prev(); }
    touchStartX.current = null; touchEndX.current = null;
  };

  const CurrentSlide = SLIDES[slide].component;

  return (
    <div className="glass-panel p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-[#1A6DB5]" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Analytics</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prev} className="p-1.5 rounded-full hover:bg-muted transition-colors">
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <span className="text-xs text-muted-foreground font-medium w-12 text-center">
            {slide + 1} / {SLIDES.length}
          </span>
          <button onClick={next} className="p-1.5 rounded-full hover:bg-muted transition-colors">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Slides */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="min-h-[200px]"
      >
        <CurrentSlide />
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5 mt-4">
        {SLIDES.map((s, i) => (
          <button key={s.id} onClick={() => setSlide(i)}
            className={cn(
              "rounded-full transition-all duration-200",
              i === slide ? "w-5 h-2 bg-[#1A6DB5]" : "w-2 h-2 bg-gray-200 hover:bg-gray-300"
            )}
          />
        ))}
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold font-sora text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Welcome back — here's what's happening.</p>
      </div>

      {/* Top row: Profit Gauge + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProfitGauge
          netProfit={netProfit} grossProfit={grossProfit} totalExpenses={totalExpenses}
          isLoading={isLoading} period={period} onPeriodChange={setPeriod}
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
          <StatCard
            label={{ today: "Today's Revenue", yesterday: "Yesterday's Revenue", week: "This Week's Revenue", month: "Month Revenue", year: "Year Revenue" }[period] ?? "Revenue"}
            value={fmtRWF(data?.revenue)}
            icon={TrendingUp}
            color="bg-green-100 text-green-600"
            sub={`Gross profit: ${fmtRWF(data?.grossProfit)}`}
          />
          <StatCard label="Receivables" value={fmtRWF(data?.outstandingReceivables)} icon={Wallet} color="bg-orange-100 text-orange-600" sub="Outstanding" />
        </div>
      )}

      {/* Chart Carousel */}
      <ChartCarousel />

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
        </div>

        <div className="glass-panel p-5">
          <h2 className="text-base font-semibold font-sora mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />Stock Alerts
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
