import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardList, Plus, CheckCircle, Clock, AlertTriangle, ChevronRight, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Session {
  id: number;
  status: string;
  notes: string | null;
  startedByName: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface StockEntry {
  itemId: number;
  itemName: string;
  category: string;
  systemQty: string;
  countedQty: string;
  variance: string;
  notes: string | null;
}

interface RemainingItem {
  itemId: number;
  itemName: string;
  category: string;
  quantity: string;
}

interface SessionDetail {
  session: Session;
  entries: StockEntry[];
  remaining: RemainingItem[];
}

export default function StockCountPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const canManage = ["owner", "manager", "admin"].includes(user?.role ?? "");

  const [activeSession, setActiveSession] = useState<number | null>(null);
  const [showStart, setShowStart] = useState(false);
  const [startNotes, setStartNotes] = useState("");
  const [countInputs, setCountInputs] = useState<Record<number, string>>({});

  const { data: sessions = [], isLoading } = useQuery<Session[]>({
    queryKey: ["stock-count-sessions"],
    queryFn: () => api.get("/stock-count/sessions"),
  });

  const { data: detail, isLoading: detailLoading } = useQuery<SessionDetail>({
    queryKey: ["stock-count-detail", activeSession],
    queryFn: () => api.get(`/stock-count/${activeSession}`),
    enabled: !!activeSession,
  });

  const startMut = useMutation({
    mutationFn: () => api.post("/stock-count/start", { notes: startNotes }),
    onSuccess: (s: any) => {
      qc.invalidateQueries({ queryKey: ["stock-count-sessions"] });
      setShowStart(false);
      setStartNotes("");
      setActiveSession(s.id);
      toast({ title: "Stock count session started" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const recordMut = useMutation({
    mutationFn: ({ itemId, countedQty }: { itemId: number; countedQty: string }) =>
      api.post(`/stock-count/${activeSession}/record`, { itemId, countedQty: parseFloat(countedQty) }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["stock-count-detail", activeSession] });
      setCountInputs(p => {
        const n = { ...p }; delete n[vars.itemId]; return n;
      });
      toast({ title: "Count recorded" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const completeMut = useMutation({
    mutationFn: ({ applyChanges }: { applyChanges: boolean }) =>
      api.post(`/stock-count/${activeSession}/complete`, { applyChanges }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-count-sessions"] });
      qc.invalidateQueries({ queryKey: ["stock-count-detail", activeSession] });
      toast({ title: "Stock count completed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isActive = detail?.session.status === "in_progress";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-sora flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-[#1A6DB5]" />
            Stock Count Mode
          </h1>
          <p className="text-sm text-muted-foreground">Perform physical inventory counts and reconcile variances</p>
        </div>
        {canManage && !activeSession && (
          <Button onClick={() => setShowStart(true)} className="bg-[#1A6DB5] hover:bg-[#1559a0]">
            <Plus className="h-4 w-4 mr-2" /> Start Count
          </Button>
        )}
      </div>

      {/* Active session detail */}
      {activeSession && (
        <div className="glass-panel p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isActive ? (
                <Badge className="bg-blue-100 text-blue-700">In Progress</Badge>
              ) : (
                <Badge className="bg-green-100 text-green-700">Completed</Badge>
              )}
              <span className="text-sm text-gray-500">Session #{activeSession}</span>
            </div>
            <div className="flex items-center gap-2">
              {isActive && canManage && (
                <>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => { if (confirm("Complete without applying changes?")) completeMut.mutate({ applyChanges: false }); }}
                    disabled={completeMut.isPending}
                  >
                    Complete (no changes)
                  </Button>
                  <Button
                    size="sm" className="bg-green-600 hover:bg-green-700"
                    onClick={() => { if (confirm("Apply all counted quantities to actual stock?")) completeMut.mutate({ applyChanges: true }); }}
                    disabled={completeMut.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" /> Apply & Complete
                  </Button>
                </>
              )}
              <Button size="sm" variant="ghost" onClick={() => setActiveSession(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {detailLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="space-y-4">
              {/* Entries so far */}
              {(detail?.entries?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Counted Items ({detail!.entries.length})</p>
                  <div className="overflow-x-auto rounded-lg border border-gray-100">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="text-left py-2 px-3 font-medium">Item</th>
                          <th className="text-right py-2 px-3 font-medium">System</th>
                          <th className="text-right py-2 px-3 font-medium">Counted</th>
                          <th className="text-right py-2 px-3 font-medium">Variance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {detail!.entries.map(e => {
                          const variance = parseFloat(e.variance);
                          return (
                            <tr key={e.itemId} className="hover:bg-gray-50/50">
                              <td className="py-2 px-3">
                                <p className="font-medium">{e.itemName}</p>
                                <p className="text-xs text-gray-400">{e.category}</p>
                              </td>
                              <td className="py-2 px-3 text-right">{parseFloat(e.systemQty)}</td>
                              <td className="py-2 px-3 text-right">{parseFloat(e.countedQty)}</td>
                              <td className={`py-2 px-3 text-right font-semibold ${variance > 0 ? "text-green-600" : variance < 0 ? "text-red-600" : "text-gray-400"}`}>
                                {variance > 0 ? "+" : ""}{variance}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Remaining items to count */}
              {isActive && (detail?.remaining?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Remaining Items ({detail!.remaining.length})
                  </p>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {detail!.remaining.map(item => (
                      <div key={item.itemId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{item.itemName}</p>
                          <p className="text-xs text-gray-400">{item.category} · System: {parseFloat(item.quantity)}</p>
                        </div>
                        <Input
                          type="number"
                          className="w-24 h-8 text-sm"
                          placeholder="Count"
                          value={countInputs[item.itemId] ?? ""}
                          onChange={e => setCountInputs(p => ({ ...p, [item.itemId]: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === "Enter" && countInputs[item.itemId]) {
                              recordMut.mutate({ itemId: item.itemId, countedQty: countInputs[item.itemId] });
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          disabled={!countInputs[item.itemId] || recordMut.isPending}
                          onClick={() => recordMut.mutate({ itemId: item.itemId, countedQty: countInputs[item.itemId] })}
                          className="bg-[#1A6DB5] hover:bg-[#1559a0] h-8"
                        >
                          Save
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isActive && (detail?.remaining?.length ?? 0) === 0 && (
                <div className="text-center py-6">
                  <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-2" />
                  <p className="font-medium text-gray-700">All items counted!</p>
                  <p className="text-sm text-gray-500 mt-1">Click "Apply & Complete" to update stock with the counted values.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Session history */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Session History</h2>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : sessions.length === 0 ? (
          <div className="glass-panel p-10 text-center">
            <ClipboardList className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">No stock count sessions yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSession(s.id)}
                className="glass-panel w-full p-4 text-left hover:shadow-md transition-all flex items-center gap-4"
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${s.status === "completed" ? "bg-green-100" : "bg-blue-100"}`}>
                  {s.status === "completed" ? <CheckCircle className="h-5 w-5 text-green-600" /> : <Clock className="h-5 w-5 text-blue-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">Session #{s.id}</p>
                  <p className="text-xs text-gray-400">
                    By {s.startedByName || "Unknown"} · {formatDistanceToNow(new Date(s.startedAt), { addSuffix: true })}
                    {s.notes && ` · ${s.notes}`}
                  </p>
                </div>
                <Badge className={s.status === "completed" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}>
                  {s.status === "completed" ? "Completed" : "In Progress"}
                </Badge>
                <ChevronRight className="h-4 w-4 text-gray-300" />
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showStart} onOpenChange={setShowStart}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Stock Count</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              className="mt-1"
              placeholder="e.g. Monthly count, Q2 audit..."
              value={startNotes}
              onChange={e => setStartNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStart(false)}>Cancel</Button>
            <Button
              className="bg-[#1A6DB5] hover:bg-[#1559a0]"
              onClick={() => startMut.mutate()}
              disabled={startMut.isPending}
            >
              {startMut.isPending ? "Starting..." : "Start Count"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
