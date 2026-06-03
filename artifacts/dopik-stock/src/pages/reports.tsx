import { useState, useEffect } from "react";
import { useGetSalesReport, useGetPurchasesReport, useGetExpensesReport, useGetSummaryReport } from "@workspace/api-client-react";
import { fmtRWF, fmtDateTime } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line } from "recharts";
import { BarChart3, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

type Period = "today" | "yesterday" | "week" | "month" | "year" | "custom";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
  { key: "custom", label: "Custom" },
];

function pad(n: number) { return String(n).padStart(2, "0"); }
function fmt(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function today() { return fmt(new Date()); }
function firstOfMonth() { const d = new Date(); d.setDate(1); return fmt(d); }

function getPeriodRange(period: Period, customStart: string, customEnd: string): { start: string; end: string } {
  const now = new Date();
  const todayStr = fmt(now);
  if (period === "today") return { start: todayStr, end: todayStr };
  if (period === "yesterday") { const y = new Date(now); y.setDate(y.getDate() - 1); const s = fmt(y); return { start: s, end: s }; }
  if (period === "week") {
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    return { start: fmt(monday), end: todayStr };
  }
  if (period === "month") return { start: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), end: todayStr };
  if (period === "year") return { start: fmt(new Date(now.getFullYear(), 0, 1)), end: todayStr };
  return { start: customStart, end: customEnd };
}

function getPeriodLabel(period: Period, start: string, end: string): string {
  const now = new Date();
  const loc = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-GB", opts);
  if (period === "today") return `Showing: ${loc(now, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}`;
  if (period === "yesterday") {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    return `Showing: ${loc(y, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}`;
  }
  if (period === "week") {
    const day = now.getDay();
    const monday = new Date(now); monday.setDate(now.getDate() - ((day + 6) % 7));
    return `Showing: ${loc(monday, { day: "2-digit", month: "short" })} – ${loc(now, { day: "2-digit", month: "short", year: "numeric" })}`;
  }
  if (period === "month") return `Showing: ${loc(now, { month: "long", year: "numeric" })}`;
  if (period === "year") return `Showing: Full year ${now.getFullYear()}`;
  if (start && end) {
    const s = new Date(start + "T00:00:00"), e = new Date(end + "T00:00:00");
    const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
    return `${loc(s, { day: "2-digit", month: "short", year: "numeric" })} – ${loc(e, { day: "2-digit", month: "short", year: "numeric" })} (${days} day${days !== 1 ? "s" : ""})`;
  }
  return "";
}

function PeriodFilter({
  period, onPeriod, customStart, customEnd, onStart, onEnd,
}: {
  period: Period; onPeriod: (p: Period) => void;
  customStart: string; customEnd: string;
  onStart: (v: string) => void; onEnd: (v: string) => void;
}) {
  const label = getPeriodLabel(period, customStart, customEnd);
  return (
    <div className="space-y-2 no-print">
      <div className="flex flex-wrap gap-1.5">
        {PERIODS.map(p => (
          <button key={p.key} type="button" onClick={() => onPeriod(p.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
              period === p.key
                ? "bg-[#1A6DB5] text-white border-[#1A6DB5]"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {period === "custom" && (
        <div className="flex gap-3 flex-wrap items-center">
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">From</Label>
            <Input type="date" className="h-8 text-sm w-36" value={customStart} onChange={e => onStart(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">To</Label>
            <Input type="date" className="h-8 text-sm w-36" value={customEnd} onChange={e => onEnd(e.target.value)} />
          </div>
        </div>
      )}
      {label && <p className="text-xs text-gray-400">{label}</p>}
    </div>
  );
}

export default function ReportsPage({ defaultTab = "summary" }: { defaultTab?: string }) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const [salesPeriod, setSalesPeriod] = useState<Period>("month");
  const [salesCustomStart, setSalesCustomStart] = useState(firstOfMonth());
  const [salesCustomEnd, setSalesCustomEnd] = useState(today());
  const [purchPeriod, setPurchPeriod] = useState<Period>("month");
  const [purchCustomStart, setPurchCustomStart] = useState(firstOfMonth());
  const [purchCustomEnd, setPurchCustomEnd] = useState(today());
  const [expPeriod, setExpPeriod] = useState<Period>("month");
  const [expCustomStart, setExpCustomStart] = useState(firstOfMonth());
  const [expCustomEnd, setExpCustomEnd] = useState(today());
  const [summaryYear, setSummaryYear] = useState(new Date().getFullYear());

  const salesRange = getPeriodRange(salesPeriod, salesCustomStart, salesCustomEnd);
  const purchRange = getPeriodRange(purchPeriod, purchCustomStart, purchCustomEnd);
  const expRange = getPeriodRange(expPeriod, expCustomStart, expCustomEnd);

  const { data: salesData, isLoading: salesLoading } = useGetSalesReport({ start: salesRange.start, end: salesRange.end });
  const { data: purchData, isLoading: purchLoading } = useGetPurchasesReport({ start: purchRange.start, end: purchRange.end });
  const { data: expData, isLoading: expLoading } = useGetExpensesReport({ start: expRange.start, end: expRange.end });
  const { data: summaryData, isLoading: summaryLoading } = useGetSummaryReport({ year: summaryYear });

  const salesRows: any[] = (salesData as any)?.rows ?? [];
  const purchRows: any[] = (purchData as any)?.rows ?? [];
  const expRows: any[] = (expData as any)?.rows ?? [];
  const summaryRows: any[] = (summaryData as any)?.rows ?? [];
  const summaryTotals: any = (summaryData as any)?.totals ?? {};

  const chartData = summaryRows.map(r => ({
    name: r.monthName.substring(0, 3),
    grossProfit: parseFloat(r.grossProfit),
    expenses: parseFloat(r.totalExpenses),
    netProfit: parseFloat(r.netProfit),
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold font-sora">Reports</h1><p className="text-sm text-muted-foreground">Business performance analytics</p></div>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="no-print">
          <Printer className="h-4 w-4 mr-2" />Print
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="no-print">
          <TabsTrigger value="summary">P&L Summary</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>

        {/* Summary / P&L */}
        <TabsContent value="summary" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <Label className="text-xs">Year</Label>
            <select
              className="h-8 rounded-md border border-input bg-background px-3 text-sm"
              value={summaryYear}
              onChange={e => setSummaryYear(Number(e.target.value))}
            >
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {summaryLoading ? (
            <Skeleton className="h-48 rounded-2xl" />
          ) : (
            <div className="glass-panel p-5">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">Monthly Profit & Loss — {summaryYear}</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v: any) => fmtRWF(v)} />
                  <Legend />
                  <Bar dataKey="grossProfit" name="Gross Profit" fill="#1A6DB5" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#F5A800" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="netProfit" name="Net Profit" fill="#10B981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="glass-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm print-table">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {["Month", "Gross Profit", "Stock Adj. Cost", "Expenses", "Net Profit"].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summaryLoading ? [...Array(6)].map((_, i) => (
                    <tr key={i} className="border-b border-border">{[...Array(5)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}</tr>
                  )) : summaryRows.map(r => (
                    <tr key={r.month} className="border-b border-border hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{r.monthName}</td>
                      <td className="px-4 py-3 text-blue-600">{fmtRWF(r.grossProfit)}</td>
                      <td className="px-4 py-3 text-orange-600">{fmtRWF(r.stockAdjustmentCost)}</td>
                      <td className="px-4 py-3 text-red-600">{fmtRWF(r.totalExpenses)}</td>
                      <td className={`px-4 py-3 font-bold ${parseFloat(r.netProfit) >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {fmtRWF(r.netProfit)}
                      </td>
                    </tr>
                  ))}
                  {/* Totals */}
                  {!summaryLoading && (
                    <tr className="border-t-2 border-border bg-muted/50 font-bold">
                      <td className="px-4 py-3">Total</td>
                      <td className="px-4 py-3 text-blue-600">{fmtRWF(summaryTotals.grossProfit)}</td>
                      <td className="px-4 py-3 text-orange-600">{fmtRWF(summaryTotals.stockAdjustmentCost)}</td>
                      <td className="px-4 py-3 text-red-600">{fmtRWF(summaryTotals.totalExpenses)}</td>
                      <td className={`px-4 py-3 ${parseFloat(summaryTotals.netProfit ?? "0") >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {fmtRWF(summaryTotals.netProfit)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Sales Report */}
        <TabsContent value="sales" className="mt-4 space-y-4">
          <PeriodFilter period={salesPeriod} onPeriod={setSalesPeriod} customStart={salesCustomStart} customEnd={salesCustomEnd} onStart={setSalesCustomStart} onEnd={setSalesCustomEnd} />
          <div className="glass-panel p-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Sales Revenue</span>
            <span className="text-lg font-bold text-green-600">{fmtRWF((salesData as any)?.totalSales)}</span>
          </div>
          <div className="glass-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {["Item", "Qty Type", "Quantity Sold", "Revenue", "Date"].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {salesLoading ? [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-border">{[...Array(5)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}</tr>
                  )) : salesRows.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No sales in this period</td></tr>
                  ) : salesRows.map((r: any, i: number) => (
                    <tr key={i} className="border-b border-border hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{r.itemName}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{(r as any).category || "—"}</Badge></td>
                      <td className="px-4 py-3">{parseFloat(r.quantity).toLocaleString()}</td>
                      <td className="px-4 py-3 font-semibold text-green-600">{fmtRWF(r.totalSale)}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmtDateTime(r.saleDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Purchases Report */}
        <TabsContent value="purchases" className="mt-4 space-y-4">
          <PeriodFilter period={purchPeriod} onPeriod={setPurchPeriod} customStart={purchCustomStart} customEnd={purchCustomEnd} onStart={setPurchCustomStart} onEnd={setPurchCustomEnd} />
          <div className="glass-panel p-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Purchase Cost</span>
            <span className="text-lg font-bold text-blue-600">{fmtRWF((purchData as any)?.totalCost)}</span>
          </div>
          <div className="glass-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {["Item", "Category", "Quantity", "Total Cost", "Vendor", "Date"].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {purchLoading ? [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-border">{[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}</tr>
                  )) : purchRows.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No purchases in this period</td></tr>
                  ) : purchRows.map((r: any, i: number) => (
                    <tr key={i} className="border-b border-border hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{r.itemName}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{(r as any).category || "—"}</Badge></td>
                      <td className="px-4 py-3">{parseFloat(r.quantity).toLocaleString()}</td>
                      <td className="px-4 py-3 font-semibold text-blue-600">{fmtRWF(r.totalCost)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.vendorName ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmtDateTime(r.purchaseDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Expenses Report */}
        <TabsContent value="expenses" className="mt-4 space-y-4">
          <PeriodFilter period={expPeriod} onPeriod={setExpPeriod} customStart={expCustomStart} customEnd={expCustomEnd} onStart={setExpCustomStart} onEnd={setExpCustomEnd} />
          <div className="glass-panel p-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Expenses</span>
            <span className="text-lg font-bold text-red-600">{fmtRWF((expData as any)?.totalExpenses)}</span>
          </div>
          <div className="glass-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {["Account", "Description", "Amount", "Date"].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expLoading ? [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-border">{[...Array(4)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}</tr>
                  )) : expRows.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No expenses in this period</td></tr>
                  ) : expRows.map((r: any, i: number) => (
                    <tr key={i} className="border-b border-border hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{r.accountName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.description ?? "—"}</td>
                      <td className="px-4 py-3 font-bold text-red-600">{fmtRWF(r.amount)}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmtDateTime(r.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
