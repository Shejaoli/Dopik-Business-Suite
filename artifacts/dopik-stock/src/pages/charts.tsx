import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, fmtRWF } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend
} from "recharts";
import {
  TrendingUp, DollarSign, PieChart as PieIcon, Award,
  Layers, CreditCard, AlertCircle, Target, Users,
  Clock, BarChart2, Calendar, Thermometer, Package, AlertTriangle
} from "lucide-react";
import { CategoryTabs } from "@/components/CategoryTabs";
import { useCategoryTab, type SuperCat } from "@/lib/categories";

const PERIODS = [
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
];

const COLORS = ["#1A6DB5", "#06b6d4", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#ec4899", "#14b8a6"];

function useAnalytics<T = any>(endpoint: string, params?: Record<string, string>) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return useQuery<T>({
    queryKey: ["analytics", endpoint, params],
    queryFn: () => api.get<T>(`/analytics/${endpoint}${qs}`),
  });
}

function ChartCard({ title, subtitle, children, period, onPeriod, icon: Icon }: {
  title: string; subtitle?: string; children: React.ReactNode;
  period?: string; onPeriod?: (p: string) => void; icon?: any;
}) {
  return (
    <div className="glass-panel p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          {Icon && <div className="w-8 h-8 rounded-lg bg-[#1A6DB5]/10 flex items-center justify-center flex-shrink-0">
            <Icon className="h-4 w-4 text-[#1A6DB5]" />
          </div>}
          <div>
            <h2 className="font-semibold text-base font-sora">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {period && onPeriod && (
          <div className="flex gap-1">
            {PERIODS.map(p => (
              <button key={p.key}
                onClick={() => onPeriod(p.key)}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                  period === p.key
                    ? "bg-[#1A6DB5] text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}>
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Revenue Over Time ─────────────────────────────────────────────────────────
function RevenueChart() {
  const [period, setPeriod] = useState("month");
  const { data, isLoading } = useAnalytics("revenue", { period });
  const rows: any[] = data ?? [];
  return (
    <ChartCard title="Revenue Over Time" subtitle="Daily revenue for the selected period"
      period={period} onPeriod={setPeriod} icon={TrendingUp}>
      {isLoading ? <Skeleton className="h-52 w-full" /> : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d?.slice(5) ?? ""} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
            <Tooltip formatter={(v: any) => fmtRWF(v)} labelFormatter={l => `Date: ${l}`} />
            <Line type="monotone" dataKey="revenue" stroke="#1A6DB5" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

// ── Gross Profit vs Expenses ─────────────────────────────────────────────────
function ProfitVsExpensesChart() {
  const [period, setPeriod] = useState("month");
  const { data, isLoading } = useAnalytics("profit-vs-expenses", { period });
  const rows: any[] = data ?? [];
  return (
    <ChartCard title="Gross Profit vs Expenses" subtitle="Compare profitability and costs over time"
      period={period} onPeriod={setPeriod} icon={DollarSign}>
      {isLoading ? <Skeleton className="h-52 w-full" /> : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d?.slice(5) ?? ""} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
            <Tooltip formatter={(v: any) => fmtRWF(v)} />
            <Area type="monotone" dataKey="grossProfit" stroke="#10b981" fill="#10b981" fillOpacity={0.15} name="Gross Profit" />
            <Area type="monotone" dataKey="expenses" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} name="Expenses" />
            <Legend />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

// ── Sales by Category ─────────────────────────────────────────────────────────
function CategoryChart() {
  const [period, setPeriod] = useState("month");
  const { data, isLoading } = useAnalytics("categories", { period });
  const rows: any[] = data ?? [];
  return (
    <ChartCard title="Sales by Category" subtitle="Revenue split across product categories"
      period={period} onPeriod={setPeriod} icon={PieIcon}>
      {isLoading ? <Skeleton className="h-64 w-full" /> : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No data for this period</p>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ResponsiveContainer width={200} height={200}>
            <PieChart>
              <Pie data={rows} dataKey="total" nameKey="category" cx="50%" cy="50%" innerRadius={55} outerRadius={90}>
                {rows.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => fmtRWF(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-2">
            {rows.map((r: any, i: number) => (
              <div key={r.category} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-muted-foreground">{r.category}</span>
                </div>
                <div className="text-right">
                  <span className="font-semibold">{r.pct}%</span>
                  <span className="text-xs text-muted-foreground ml-1">{fmtRWF(String(r.total))}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  );
}

// ── Top Selling Products ──────────────────────────────────────────────────────
function TopProductsChart({ superCat }: { superCat: SuperCat }) {
  const [period, setPeriod] = useState("month");
  const params: Record<string, string> = { period, limit: "10" };
  if (superCat !== "all") params.superCategory = superCat;
  const { data, isLoading } = useAnalytics("top-products", params);
  const rows: any[] = (data ?? []).slice(0, 10);
  return (
    <ChartCard title="Top Selling Products" subtitle="Top 10 products by revenue"
      period={period} onPeriod={setPeriod} icon={Award}>
      {isLoading ? <Skeleton className="h-64 w-full" /> : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No data for this period</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={rows} layout="vertical" margin={{ left: 60, right: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={60} />
            <Tooltip formatter={(v: any) => fmtRWF(v)} />
            <Bar dataKey="total" fill="#1A6DB5" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

// ── Payment Method Breakdown ─────────────────────────────────────────────────
function PaymentChart() {
  const [period, setPeriod] = useState("month");
  const { data, isLoading } = useAnalytics("payment-methods", { period });
  const rows: any[] = data ?? [];
  return (
    <ChartCard title="Payment Method Breakdown" subtitle="Sales split by payment type"
      period={period} onPeriod={setPeriod} icon={CreditCard}>
      {isLoading ? <Skeleton className="h-64 w-full" /> : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No data for this period</p>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ResponsiveContainer width={200} height={200}>
            <PieChart>
              <Pie data={rows} dataKey="total" nameKey="method" cx="50%" cy="50%" innerRadius={55} outerRadius={90}>
                {rows.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => fmtRWF(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-2">
            {rows.map((r: any, i: number) => (
              <div key={r.method} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-muted-foreground capitalize">{(r.method || "other").replace(/_/g, " ")}</span>
                </div>
                <div className="text-right">
                  <span className="font-semibold">{r.pct}%</span>
                  <span className="text-xs text-muted-foreground ml-1">{fmtRWF(String(r.total))}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  );
}

// ── Stock Health ──────────────────────────────────────────────────────────────
function StockHealthCard() {
  const [, navigate] = useLocation();
  const { data, isLoading } = useAnalytics("stock-health");
  const d: any = data ?? {};
  return (
    <ChartCard title="Stock Health Overview" subtitle="Current inventory status" icon={Package}>
      {isLoading ? <Skeleton className="h-28 w-full" /> : (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{d.totalProducts ?? 0}</p>
            <p className="text-xs text-blue-600 mt-1">Total Products</p>
          </div>
          <button
            onClick={() => navigate("/stock-alerts")}
            className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center hover:bg-amber-100 transition-colors"
          >
            <p className="text-2xl font-bold text-amber-700">{d.lowStock ?? 0}</p>
            <p className="text-xs text-amber-600 mt-1">Low Stock</p>
          </button>
          <button
            onClick={() => navigate("/stock-alerts")}
            className="bg-red-50 border border-red-100 rounded-xl p-4 text-center hover:bg-red-100 transition-colors"
          >
            <p className="text-2xl font-bold text-red-700">{d.outOfStock ?? 0}</p>
            <p className="text-xs text-red-600 mt-1">Out of Stock</p>
          </button>
        </div>
      )}
    </ChartCard>
  );
}

// ── Stock Value ───────────────────────────────────────────────────────────────
function StockValueCard() {
  const { data, isLoading } = useAnalytics("stock-health");
  const d: any = data ?? {};
  return (
    <ChartCard title="Total Stock Value" subtitle="Sum of all in-stock units × purchase price" icon={Layers}>
      {isLoading ? <Skeleton className="h-20 w-full" /> : (
        <div className="text-center py-4">
          <p className="text-4xl font-black font-sora text-[#1A6DB5]">{fmtRWF(String(d.stockValue ?? 0))}</p>
          <p className="text-xs text-muted-foreground mt-1">Total inventory value at cost</p>
        </div>
      )}
    </ChartCard>
  );
}

// ── Outstanding Credit ────────────────────────────────────────────────────────
function CreditCard_() {
  const [, navigate] = useLocation();
  const { data, isLoading } = useAnalytics("credit-summary");
  const d: any = data ?? {};
  const records: any[] = d.records ?? [];
  return (
    <ChartCard title="Outstanding Credit" subtitle="Customers with unpaid receivables" icon={AlertCircle}>
      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-red-700">{fmtRWF(String(d.totalOutstanding ?? 0))}</p>
              <p className="text-xs text-red-600 mt-0.5">Total Outstanding</p>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-orange-700">{d.customerCount ?? 0}</p>
              <p className="text-xs text-orange-600 mt-0.5">Customers with Credit</p>
            </div>
          </div>
          {records.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">All Credit Customers</p>
              {records.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
                  <div>
                    <p className="font-medium">{r.customer ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{r.daysOverdue} days overdue</p>
                  </div>
                  <p className="font-semibold text-red-600">{fmtRWF(String(r.remaining ?? r.amount ?? 0))}</p>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => navigate("/receivables")}
            className="w-full text-xs text-[#1A6DB5] hover:underline text-center"
          >
            View all credit → Receivables page
          </button>
        </div>
      )}
    </ChartCard>
  );
}

// ── Daily Sales Heatmap ───────────────────────────────────────────────────────
function HeatmapCard() {
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const { data, isLoading } = useAnalytics("heatmap", { month: monthStr });
  const rows: any[] = data ?? [];
  const map: Record<string, number> = {};
  for (const r of rows) map[r.date] = r.total;
  const maxVal = Math.max(...rows.map((r: any) => r.total), 1);

  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const getColor = (day: number | null) => {
    if (!day) return "";
    const k = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const v = map[k] ?? 0;
    if (v === 0) return "bg-gray-100";
    const pct = v / maxVal;
    if (pct < 0.25) return "bg-teal-100";
    if (pct < 0.5) return "bg-teal-300";
    if (pct < 0.75) return "bg-teal-500";
    return "bg-teal-700";
  };

  return (
    <ChartCard title="Daily Sales Heatmap" subtitle={`${now.toLocaleString("default", { month: "long" })} ${year}`} icon={Calendar}>
      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="space-y-2">
          <div className="grid grid-cols-7 gap-1 text-center">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
              <div key={d} className="text-[10px] text-muted-foreground font-medium">{d}</div>
            ))}
            {cells.map((day, i) => (
              <div
                key={i}
                className={`aspect-square rounded text-[10px] flex items-center justify-center ${day ? getColor(day) : ""}`}
                title={day ? `${day} ${now.toLocaleString("default", { month: "short" })}: ${fmtRWF(String(map[`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`] ?? 0))}` : ""}
              >
                {day && <span className={`${getColor(day) === "bg-teal-700" || getColor(day) === "bg-teal-500" ? "text-white" : "text-gray-600"}`}>{day}</span>}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 justify-end text-xs text-muted-foreground">
            <span>Low</span>
            {["bg-gray-100", "bg-teal-100", "bg-teal-300", "bg-teal-500", "bg-teal-700"].map(c => (
              <div key={c} className={`w-4 h-4 rounded ${c}`} />
            ))}
            <span>High</span>
          </div>
        </div>
      )}
    </ChartCard>
  );
}

// ── Monthly Target Progress ───────────────────────────────────────────────────
function TargetCard() {
  const [target, setTarget] = useState(() => Number(localStorage.getItem("monthlyTarget") || "0"));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const { data } = useAnalytics("revenue", { period: "month" });
  const rows: any[] = data ?? [];
  const achieved = rows.reduce((s: number, r: any) => s + (r.revenue ?? 0), 0);
  const pct = target > 0 ? Math.min(100, (achieved / target) * 100) : 0;
  const remaining = Math.max(0, target - achieved);

  return (
    <ChartCard title="Monthly Target Progress" subtitle="Sales progress toward your monthly target" icon={Target}>
      <div className="space-y-4">
        {editing ? (
          <div className="flex gap-2">
            <input className="flex-1 h-8 rounded border border-input px-2 text-sm" type="number"
              value={draft} onChange={e => setDraft(e.target.value)} placeholder="Enter target (RWF)" />
            <button className="px-3 py-1.5 bg-[#1A6DB5] text-white text-xs rounded hover:bg-[#1A6DB5]/90"
              onClick={() => { const t = Number(draft); setTarget(t); localStorage.setItem("monthlyTarget", String(t)); setEditing(false); }}>
              Save
            </button>
          </div>
        ) : (
          <button onClick={() => { setDraft(String(target)); setEditing(true); }}
            className="text-xs text-[#1A6DB5] hover:underline">
            {target ? `Target: ${fmtRWF(String(target))} — Click to edit` : "Set monthly target"}
          </button>
        )}
        {target > 0 && (
          <>
            <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: pct >= 100 ? "#10b981" : "#1A6DB5" }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mix-blend-normal" style={{ textShadow: "0 1px 2px rgba(0,0,0,.4)" }}>
                {pct.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Achieved</p>
                <p className="font-bold text-green-600">{fmtRWF(String(achieved))}</p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground text-xs">Remaining</p>
                <p className="font-bold text-[#1A6DB5]">{fmtRWF(String(remaining))}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </ChartCard>
  );
}

// ── New vs Returning Customers ────────────────────────────────────────────────
function CustomerTypesCard() {
  const [period, setPeriod] = useState("month");
  const { data, isLoading } = useAnalytics("customer-types", { period });
  const d: any = data ?? {};
  return (
    <ChartCard title="New vs Returning Customers" subtitle="Customer activity this period"
      period={period} onPeriod={setPeriod} icon={Users}>
      {isLoading ? <Skeleton className="h-24 w-full" /> : (
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <p className="text-4xl font-black text-[#1A6DB5]">{d.new ?? 0}</p>
            <p className="text-sm text-muted-foreground mt-1">New Customers</p>
          </div>
          <div className="text-center p-4 bg-green-50 border border-green-100 rounded-xl">
            <p className="text-4xl font-black text-green-700">{d.returning ?? 0}</p>
            <p className="text-sm text-muted-foreground mt-1">Returning Customers</p>
          </div>
        </div>
      )}
    </ChartCard>
  );
}

// ── Best Performing Day & Time ────────────────────────────────────────────────
function BestTimesCard() {
  const [period, setPeriod] = useState("month");
  const { data, isLoading } = useAnalytics("best-times", { period });
  const d: any = data ?? {};
  const byDay: any[] = d.byDay ?? [];
  const byHour: any[] = (d.byHour ?? []).filter((h: any) => h.hour >= 6 && h.hour <= 22);
  return (
    <ChartCard title="Best Performing Day & Time" subtitle="Sales volume by day of week and hour"
      period={period} onPeriod={setPeriod} icon={Clock}>
      {isLoading ? <Skeleton className="h-64 w-full" /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">By Day of Week</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={byDay}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: any) => fmtRWF(v)} />
                <Bar dataKey="total" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">By Hour of Day</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={byHour}>
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={h => `${h}h`} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: any) => fmtRWF(v)} labelFormatter={h => `${h}:00`} />
                <Bar dataKey="total" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </ChartCard>
  );
}

// ── Main Charts Page ──────────────────────────────────────────────────────────
export default function ChartsPage() {
  const [superCat, setSuperCat] = useCategoryTab("charts");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold font-sora">Charts & Analytics</h1>
        <p className="text-sm text-muted-foreground">Full business intelligence dashboard</p>
      </div>
      <div className="glass-panel p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Filter by Product Category</p>
        <CategoryTabs value={superCat} onChange={setSuperCat} />
      </div>
      <RevenueChart />
      <ProfitVsExpensesChart />
      <CategoryChart />
      <TopProductsChart superCat={superCat} />
      <PaymentChart />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <StockHealthCard />
        <StockValueCard />
      </div>
      <CreditCard_ />
      <HeatmapCard />
      <TargetCard />
      <CustomerTypesCard />
      <BestTimesCard />
    </div>
  );
}
