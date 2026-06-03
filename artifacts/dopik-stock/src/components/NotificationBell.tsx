import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Bell, X, CheckCheck, Package, Megaphone, CreditCard, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
}

function typeIcon(type: string) {
  if (type === "low_stock") return <Package className="h-4 w-4 text-orange-500" />;
  if (type === "announcement") return <Megaphone className="h-4 w-4 text-blue-500" />;
  if (type === "credit_due") return <CreditCard className="h-4 w-4 text-red-500" />;
  return <AlertTriangle className="h-4 w-4 text-gray-400" />;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data } = useQuery<{ notifications: Notification[]; unreadCount: number }>({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications"),
    refetchInterval: 60_000,
  });

  const readMut = useMutation({
    mutationFn: (id: number) => api.post(`/notifications/${id}/read`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const readAllMut = useMutation({
    mutationFn: () => api.post("/notifications/mark-all-read", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/notifications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unread = data?.unreadCount ?? 0;
  const notifications = data?.notifications ?? [];

  return (
    <div className="relative" ref={ref}>
      <button
        className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 relative transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-sm text-gray-800">
              Notifications {unread > 0 && <span className="text-blue-600">({unread} new)</span>}
            </span>
            {unread > 0 && (
              <button
                className="text-xs text-[#1A6DB5] hover:underline flex items-center gap-1"
                onClick={() => readAllMut.mutate()}
              >
                <CheckCheck className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No notifications</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 group hover:bg-gray-50 transition-colors",
                    !n.read && "bg-blue-50/50"
                  )}
                  onClick={() => { if (!n.read) readMut.mutate(n.id); }}
                >
                  <div className="w-8 h-8 rounded-full bg-white border border-gray-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                    {typeIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm leading-snug", !n.read ? "font-semibold text-gray-900" : "text-gray-700")}>
                      {n.title}
                    </p>
                    {n.body && <p className="text-xs text-gray-400 mt-0.5 truncate">{n.body}</p>}
                    <p className="text-[10px] text-gray-300 mt-1">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
                  </div>
                  {!n.read && <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />}
                  <button
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-gray-500 flex-shrink-0 transition-opacity"
                    onClick={e => { e.stopPropagation(); deleteMut.mutate(n.id); }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-400">Showing latest {notifications.length} notifications</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
