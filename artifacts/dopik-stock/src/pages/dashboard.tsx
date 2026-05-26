import { useGetDashboard } from "@workspace/api-client-react";
import { fmtRWF, fmtDateTime } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package, TrendingUp, Wallet, AlertTriangle,
  Banknote, Landmark, Smartphone, ShoppingCart
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

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

export default function DashboardPage() {
  const { data, isLoading } = useGetDashboard();

  const recentSalesChart = (data?.recentSales ?? [])
    .filter(s => !s.reverted)
    .slice(0, 7)
    .reverse()
    .map((s, i) => ({
      name: `Sale ${i + 1}`,
      amount: parseFloat(s.totalAmount),
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-sora text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Welcome back — here's what's happening today.</p>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Total Items"
            value={String(data?.totalItems ?? 0)}
            icon={Package}
            color="bg-[#1A6DB5]/10 text-[#1A6DB5]"
          />
          <StatCard
            label="Stock Value"
            value={fmtRWF(data?.totalStockValue)}
            icon={ShoppingCart}
            color="bg-purple-100 text-purple-600"
          />
          <StatCard
            label="Today's Sales"
            value={fmtRWF(data?.todaySales)}
            icon={TrendingUp}
            color="bg-green-100 text-green-600"
          />
          <StatCard
            label="Receivables"
            value={fmtRWF(data?.outstandingReceivables)}
            icon={Wallet}
            color="bg-orange-100 text-orange-600"
            sub="Outstanding"
          />
        </div>
      )}

      {/* Balances + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Balances */}
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

          {/* Chart */}
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

        {/* Alerts */}
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
        {/* Recent Sales */}
        <div className="glass-panel p-5">
          <h2 className="text-base font-semibold font-sora mb-4">Recent Sales</h2>
          {isLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <div className="space-y-2">
              {(data?.recentSales ?? []).slice(0, 6).map(sale => (
                <div key={sale.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {sale.customerName ?? "Walk-in"}
                    </p>
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

        {/* Recent Purchases */}
        <div className="glass-panel p-5">
          <h2 className="text-base font-semibold font-sora mb-4">Recent Purchases</h2>
          {isLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <div className="space-y-2">
              {(data?.recentPurchases ?? []).slice(0, 6).map(p => (
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
