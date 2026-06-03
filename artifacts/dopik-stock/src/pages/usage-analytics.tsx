import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line
} from "recharts";
import { Activity, Users, Eye, TrendingUp, Lock } from "lucide-react";

interface UsageData {
  pageViews: { page: string | null; count: number }[];
  byUser: { userId: number | null; userName: string | null; count: number }[];
  byEventType: { eventType: string; count: number }[];
  daily: { date: string; count: number }[];
  days: number;
}

export default function UsageAnalyticsPage() {
  const { user } = useAuth();
  const [days, setDays] = useState("30");

  const isOwner = user?.role === "owner" || user?.role === "admin";

  const { data, isLoading } = useQuery<UsageData>({
    queryKey: ["usage-analytics", days],
    queryFn: () => api.get("/analytics/usage", { days }),
    enabled: isOwner,
  });

  if (!isOwner) {
    return (
      <div className="glass-panel p-16 text-center">
        <Lock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 font-medium">Owner Only</p>
        <p className="text-sm text-gray-400 mt-1">Usage analytics are only visible to owners.</p>
      </div>
    );
  }

  const totalEvents = data?.daily.reduce((s, d) => s + Number(d.count), 0) ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-sora flex items-center gap-2">
            <Activity className="h-6 w-6 text-[#1A6DB5]" />
            Usage Analytics
          </h1>
          <p className="text-sm text-muted-foreground">Track how staff are using the system</p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      ) : !data || totalEvents === 0 ? (
        <div className="glass-panel p-12 text-center">
          <Activity className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No usage data yet</p>
          <p className="text-sm text-gray-400 mt-1">Data will appear as staff navigate the system.</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="glass-panel p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalEvents.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Total events</p>
              </div>
            </div>
            <div className="glass-panel p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.byUser.length}</p>
                <p className="text-xs text-gray-500">Active users</p>
              </div>
            </div>
            <div className="glass-panel p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <Eye className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.pageViews.length}</p>
                <p className="text-xs text-gray-500">Unique pages</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Daily activity chart */}
            <div className="glass-panel p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Daily Activity</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.daily.map(d => ({ date: d.date.slice(5), events: Number(d.count) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="events" stroke="#1A6DB5" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Top pages */}
            <div className="glass-panel p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Most Visited Pages</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.pageViews.slice(0, 8).map(p => ({ page: p.page || "unknown", count: Number(p.count) }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="page" tick={{ fontSize: 10 }} width={80} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1A6DB5" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Active users */}
            <div className="glass-panel p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Most Active Users</h3>
              <div className="space-y-3">
                {data.byUser.slice(0, 8).map((u, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#1A6DB5] to-[#F5A800] flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">{(u.userName || "?")?.[0]?.toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.userName || "Unknown"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#1A6DB5]">{Number(u.count).toLocaleString()}</p>
                      <p className="text-xs text-gray-400">events</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Event types */}
            <div className="glass-panel p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Event Types</h3>
              <div className="space-y-2">
                {data.byEventType.map((e, i) => {
                  const maxCount = Math.max(...data.byEventType.map(x => Number(x.count)));
                  const pct = Math.round((Number(e.count) / maxCount) * 100);
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-24 truncate capitalize">{e.eventType.replace(/_/g, " ")}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className="bg-[#1A6DB5] h-2 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-medium text-gray-700 w-8 text-right">{Number(e.count)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
