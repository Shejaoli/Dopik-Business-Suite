import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { useGetSalesReport, useGetPurchasesReport, useGetExpensesReport, useGetSummaryReport } from "@workspace/api-client-react";
import { fmtRWF, fmtDateTime, fmtDate, api } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line } from "recharts";
import { BarChart3, Printer, Download, FileSpreadsheet, TrendingUp, TrendingDown } from "lucide-react";
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

// ── CSV / Excel export helpers ─────────────────────────────────────────────
function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return s.includes(",") || s.includes("\n") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
}
function downloadCSV(filename: string, headers: string[], rows: unknown[][]) {
  const csv = "\uFEFF" + [headers.map(csvEscape).join(","), ...rows.map(r => (r as unknown[]).map(csvEscape).join(","))].join("\n");
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" })), download: filename });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function downloadExcel(filename: string, summarySheet: unknown[][], detailHeaders: string[], detailRows: unknown[][]) {
  const wb = XLSX.utils.book_new();
  const summaryWs = XLSX.utils.aoa_to_sheet(summarySheet);
  summaryWs["!cols"] = [{ wch: 34 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");
  if (detailHeaders.length) {
    const detailWs = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
    detailWs["!cols"] = detailHeaders.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, detailWs, "Detail");
  }
  XLSX.writeFile(wb, filename);
}
function fileLabel(start: string, end: string): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const s = new Date(start + "T00:00:00"), e = new Date(end + "T00:00:00");
  if (start === end) return `${String(s.getDate()).padStart(2,"0")}-${months[s.getMonth()]}-${s.getFullYear()}`;
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) return `${months[s.getMonth()]}-${s.getFullYear()}`;
  return `${String(s.getDate()).padStart(2,"0")}-${months[s.getMonth()]}-to-${String(e.getDate()).padStart(2,"0")}-${months[e.getMonth()]}-${e.getFullYear()}`;
}

// ── Mini stat bar ──────────────────────────────────────────────────────────
function MiniStatBar({ stats }: { stats: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map(s => (
        <div key={s.label} className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
          <p className="text-xs text-muted-foreground">{s.label}</p>
          <p className={`text-base font-bold mt-0.5 ${s.color || "text-foreground"} truncate`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Export button row ──────────────────────────────────────────────────────
function ExportRow({ onCSV, onExcel }: { onCSV: () => void; onExcel: () => void }) {
  return (
    <div className="flex gap-2 no-print flex-shrink-0">
      <Button size="sm" variant="outline" onClick={onCSV} className="gap-1.5 text-xs h-8">
        <Download className="h-3.5 w-3.5" /> CSV
      </Button>
      <Button size="sm" variant="outline" onClick={onExcel} className="gap-1.5 text-xs h-8 text-green-700 border-green-200 hover:bg-green-50">
        <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
      </Button>
    </div>
  );
}

// ── P&L Statement display ──────────────────────────────────────────────────
function PnLStatement({ data, isLoading }: { data: any; isLoading: boolean }) {
  if (isLoading) return <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>;
  if (!data) return (
    <div className="text-center py-12 text-gray-400">
      <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-20" />
      <p className="text-sm">Select a period above to generate the P&L statement</p>
    </div>
  );
  const revenue = parseFloat(data.revenue ?? "0");
  const cogs = parseFloat(data.cogs ?? "0");
  const gp = parseFloat(data.grossProfit ?? "0");
  const gpM = parseFloat(data.grossMargin ?? "0");
  const exp = parseFloat(data.totalExpenses ?? "0");
  const np = parseFloat(data.netProfit ?? "0");
  const npM = parseFloat(data.netMargin ?? "0");
  const chg = data.changes ?? {};
  const Chg = ({ pct }: { pct?: number | null }) => {
    if (pct == null) return null;
    const pos = pct >= 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded ${pos ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
        {pos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {pos ? "+" : ""}{pct.toFixed(1)}%
      </span>
    );
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-4 rounded-xl bg-blue-50 border border-blue-100">
          <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Gross Profit</p>
          <p className="text-xl font-bold text-blue-700 mt-1 truncate">{fmtRWF(data.grossProfit)}</p>
          <p className="text-xs text-blue-500 mt-0.5">{gpM.toFixed(1)}% margin</p>
        </div>
        <div className={`text-center p-4 rounded-xl border ${np >= 0 ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"}`}>
          <p className={`text-xs font-medium uppercase tracking-wide ${np >= 0 ? "text-green-600" : "text-red-600"}`}>Net Profit</p>
          <p className={`text-xl font-bold mt-1 truncate ${np >= 0 ? "text-green-700" : "text-red-700"}`}>{fmtRWF(data.netProfit)}</p>
          <p className={`text-xs mt-0.5 ${np >= 0 ? "text-green-500" : "text-red-500"}`}>{npM.toFixed(1)}% margin</p>
        </div>
        <div className="text-center p-4 rounded-xl bg-orange-50 border border-orange-100">
          <p className="text-xs text-orange-600 font-medium uppercase tracking-wide">Expenses</p>
          <p className="text-xl font-bold text-orange-700 mt-1 truncate">{fmtRWF(data.totalExpenses)}</p>
          <p className="text-xs text-orange-500 mt-0.5">{revenue > 0 ? ((exp / revenue) * 100).toFixed(1) : "0.0"}% of revenue</p>
        </div>
      </div>
      <div className="glass-panel overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="px-5 py-3 text-gray-600">Revenue (Total Sales)</td>
              <td className="px-5 py-3 text-right font-semibold tabular-nums">{fmtRWF(data.revenue)}</td>
              <td className="px-5 py-3 text-right w-28"><Chg pct={chg.revenue} /></td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="px-5 py-3 text-gray-600">Cost of Goods Sold (COGS)</td>
              <td className="px-5 py-3 text-right font-semibold text-red-600 tabular-nums">− {fmtRWF(String(cogs))}</td>
              <td className="px-5 py-3" />
            </tr>
            <tr className="bg-blue-50/60 border-t-2 border-b-2 border-blue-200">
              <td className="px-5 py-3.5 font-bold text-gray-800">GROSS PROFIT</td>
              <td className="px-5 py-3.5 text-right font-bold text-blue-700 tabular-nums">{fmtRWF(data.grossProfit)}</td>
              <td className="px-5 py-3.5 text-right">
                <span className="text-xs text-blue-500 mr-1">{gpM.toFixed(1)}%</span><Chg pct={chg.grossProfit} />
              </td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="px-5 py-3 text-gray-600">Operating Expenses</td>
              <td className="px-5 py-3 text-right font-semibold text-red-600 tabular-nums">− {fmtRWF(data.totalExpenses)}</td>
              <td className="px-5 py-3" />
            </tr>
            <tr className={`border-t-2 border-gray-700 ${np >= 0 ? "bg-green-50" : "bg-red-50"}`}>
              <td className="px-5 py-4 font-extrabold text-gray-900 text-base">NET PROFIT</td>
              <td className={`px-5 py-4 text-right font-extrabold text-base tabular-nums ${np >= 0 ? "text-green-700" : "text-red-700"}`}>{fmtRWF(data.netProfit)}</td>
              <td className="px-5 py-4 text-right">
                <span className={`text-xs font-semibold mr-1 ${np >= 0 ? "text-green-600" : "text-red-600"}`}>{npM.toFixed(1)}%</span>
                <Chg pct={chg.netProfit} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 text-center">↑↓ badges show change vs. equivalent previous period of same duration</p>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
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

  const [pnlPeriod, setPnlPeriod] = useState<Period>("month");
  const [pnlCustomStart, setPnlCustomStart] = useState(firstOfMonth());
  const [pnlCustomEnd, setPnlCustomEnd] = useState(today());
  const pnlRange = getPeriodRange(pnlPeriod, pnlCustomStart, pnlCustomEnd);
  const { data: pnlData, isLoading: pnlLoading } = useQuery({
    queryKey: ["pnl", pnlRange.start, pnlRange.end],
    queryFn: () => api.get<any>(`/reports/pnl?start=${pnlRange.start}&end=${pnlRange.end}`),
    staleTime: 30_000,
    enabled: activeTab === "pnl",
  });

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

  // ── Computed stats (client-side) ──────────────────────────────────────────
  const salesCount = salesRows.length;
  const salesRevenue = salesRows.reduce((s: number, r: any) => s + parseFloat(r.totalSale ?? "0"), 0);
  const salesAvg = salesCount > 0 ? salesRevenue / salesCount : 0;
  const salesMax = salesRows.reduce((m: number, r: any) => Math.max(m, parseFloat(r.totalSale ?? "0")), 0);

  const purchCount = purchRows.length;
  const purchTotal = purchRows.reduce((s: number, r: any) => s + parseFloat(r.totalCost ?? "0"), 0);
  const purchUnits = purchRows.reduce((s: number, r: any) => s + parseFloat(r.quantity ?? "0"), 0);
  const purchAvg = purchCount > 0 ? purchTotal / purchCount : 0;

  const expCount = expRows.length;
  const expTotal = expRows.reduce((s: number, r: any) => s + parseFloat(r.amount ?? "0"), 0);
  const topExpCat = (() => {
    const byCat: Record<string, number> = {};
    expRows.forEach((r: any) => { const k = r.accountName || "Other"; byCat[k] = (byCat[k] ?? 0) + parseFloat(r.amount ?? "0"); });
    const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : "—";
  })();

  // ── Export callbacks ──────────────────────────────────────────────────────
  const exportSalesCSV = () => {
    const lb = fileLabel(salesRange.start, salesRange.end);
    downloadCSV(`Dopik-Sales-${lb}.csv`, ["Item", "Category", "Quantity", "Revenue (RWF)", "Date"],
      salesRows.map((r: any) => [r.itemName, (r as any).category || "—", r.quantity, r.totalSale, fmtDate(r.saleDate)]));
  };
  const exportSalesExcel = () => {
    const lb = fileLabel(salesRange.start, salesRange.end);
    downloadExcel(`Dopik-Sales-${lb}.xlsx`, [
      ["Dopik Electronics — Sales Report"], [lb], [],
      ["Total Transactions", salesCount], ["Total Revenue (RWF)", salesRevenue.toFixed(2)],
      ["Average Sale (RWF)", salesAvg.toFixed(2)], ["Largest Sale (RWF)", salesMax.toFixed(2)],
    ], ["Item", "Category", "Quantity", "Revenue (RWF)", "Date"],
      salesRows.map((r: any) => [r.itemName, (r as any).category || "—", parseFloat(r.quantity), parseFloat(r.totalSale), fmtDate(r.saleDate)]));
  };
  const exportPurchCSV = () => {
    const lb = fileLabel(purchRange.start, purchRange.end);
    downloadCSV(`Dopik-Purchases-${lb}.csv`, ["Item", "Category", "Quantity", "Cost (RWF)", "Vendor", "Date"],
      purchRows.map((r: any) => [r.itemName, (r as any).category || "—", r.quantity, r.totalCost, r.vendorName ?? "—", fmtDate(r.purchaseDate)]));
  };
  const exportPurchExcel = () => {
    const lb = fileLabel(purchRange.start, purchRange.end);
    downloadExcel(`Dopik-Purchases-${lb}.xlsx`, [
      ["Dopik Electronics — Purchases Report"], [lb], [],
      ["Total Purchases", purchCount], ["Total Spent (RWF)", purchTotal.toFixed(2)],
      ["Total Units", purchUnits], ["Average Cost (RWF)", purchAvg.toFixed(2)],
    ], ["Item", "Category", "Quantity", "Cost (RWF)", "Vendor", "Date"],
      purchRows.map((r: any) => [r.itemName, (r as any).category || "—", parseFloat(r.quantity), parseFloat(r.totalCost), r.vendorName ?? "—", fmtDate(r.purchaseDate)]));
  };
  const exportExpCSV = () => {
    const lb = fileLabel(expRange.start, expRange.end);
    downloadCSV(`Dopik-Expenses-${lb}.csv`, ["Account", "Description", "Amount (RWF)", "Date"],
      expRows.map((r: any) => [r.accountName, r.description ?? "—", r.amount, fmtDate(r.date)]));
  };
  const exportExpExcel = () => {
    const lb = fileLabel(expRange.start, expRange.end);
    downloadExcel(`Dopik-Expenses-${lb}.xlsx`, [
      ["Dopik Electronics — Expenses Report"], [lb], [],
      ["Total Entries", expCount], ["Total Amount (RWF)", expTotal.toFixed(2)], ["Top Category", topExpCat],
    ], ["Account", "Description", "Amount (RWF)", "Date"],
      expRows.map((r: any) => [r.accountName, r.description ?? "—", parseFloat(r.amount), fmtDate(r.date)]));
  };

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
          <TabsTrigger value="pnl">P&L Statement</TabsTrigger>
          <TabsTrigger value="summary">Monthly P&L</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>

        {/* P&L Statement */}
        <TabsContent value="pnl" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 no-print">
            <PeriodFilter period={pnlPeriod} onPeriod={setPnlPeriod} customStart={pnlCustomStart} customEnd={pnlCustomEnd} onStart={setPnlCustomStart} onEnd={setPnlCustomEnd} />
            {pnlData && (
              <ExportRow
                onCSV={() => {
                  const lb = fileLabel(pnlRange.start, pnlRange.end);
                  downloadCSV(`Dopik-PnL-${lb}.csv`, ["Item", "Value (RWF)"], [
                    ["Revenue (Total Sales)", pnlData.revenue], ["Cost of Goods Sold", pnlData.cogs],
                    ["Gross Profit", pnlData.grossProfit], [`Gross Margin`, `${parseFloat(pnlData.grossMargin).toFixed(1)}%`],
                    ["Operating Expenses", pnlData.totalExpenses],
                    ["Net Profit", pnlData.netProfit], ["Net Margin", `${parseFloat(pnlData.netMargin).toFixed(1)}%`],
                  ]);
                }}
                onExcel={() => {
                  const lb = fileLabel(pnlRange.start, pnlRange.end);
                  downloadExcel(`Dopik-PnL-${lb}.xlsx`, [
                    ["Dopik Electronics — P&L Statement"], [`Period: ${lb}`], [],
                    ["Revenue (Total Sales)", parseFloat(pnlData.revenue)],
                    ["Cost of Goods Sold (COGS)", parseFloat(pnlData.cogs)],
                    ["GROSS PROFIT", parseFloat(pnlData.grossProfit)],
                    ["Gross Margin", `${parseFloat(pnlData.grossMargin).toFixed(1)}%`], [],
                    ["Operating Expenses", parseFloat(pnlData.totalExpenses)],
                    ["NET PROFIT", parseFloat(pnlData.netProfit)],
                    ["Net Margin", `${parseFloat(pnlData.netMargin).toFixed(1)}%`],
                  ], [], []);
                }}
              />
            )}
          </div>
          <PnLStatement data={pnlData} isLoading={pnlLoading} />
        </TabsContent>

        {/* Monthly P&L Summary */}
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
          <div className="flex flex-wrap items-center justify-between gap-3 no-print">
            <PeriodFilter period={salesPeriod} onPeriod={setSalesPeriod} customStart={salesCustomStart} customEnd={salesCustomEnd} onStart={setSalesCustomStart} onEnd={setSalesCustomEnd} />
            <ExportRow onCSV={exportSalesCSV} onExcel={exportSalesExcel} />
          </div>
          <MiniStatBar stats={[
            { label: "Transactions", value: String(salesCount), color: "text-gray-800" },
            { label: "Total Revenue", value: fmtRWF(salesRevenue.toFixed(2)), color: "text-green-600" },
            { label: "Average Sale", value: fmtRWF(salesAvg.toFixed(2)), color: "text-blue-600" },
            { label: "Largest Sale", value: fmtRWF(salesMax.toFixed(2)), color: "text-purple-600" },
          ]} />
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
          <div className="flex flex-wrap items-center justify-between gap-3 no-print">
            <PeriodFilter period={purchPeriod} onPeriod={setPurchPeriod} customStart={purchCustomStart} customEnd={purchCustomEnd} onStart={setPurchCustomStart} onEnd={setPurchCustomEnd} />
            <ExportRow onCSV={exportPurchCSV} onExcel={exportPurchExcel} />
          </div>
          <MiniStatBar stats={[
            { label: "Purchases", value: String(purchCount), color: "text-gray-800" },
            { label: "Total Spent", value: fmtRWF(purchTotal.toFixed(2)), color: "text-blue-600" },
            { label: "Total Units", value: String(Math.round(purchUnits)), color: "text-indigo-600" },
            { label: "Average Cost", value: fmtRWF(purchAvg.toFixed(2)), color: "text-purple-600" },
          ]} />
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
          <div className="flex flex-wrap items-center justify-between gap-3 no-print">
            <PeriodFilter period={expPeriod} onPeriod={setExpPeriod} customStart={expCustomStart} customEnd={expCustomEnd} onStart={setExpCustomStart} onEnd={setExpCustomEnd} />
            <ExportRow onCSV={exportExpCSV} onExcel={exportExpExcel} />
          </div>
          <MiniStatBar stats={[
            { label: "Entries", value: String(expCount), color: "text-gray-800" },
            { label: "Total Amount", value: fmtRWF(expTotal.toFixed(2)), color: "text-red-600" },
            { label: "Top Category", value: topExpCat, color: "text-orange-600" },
          ]} />
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
