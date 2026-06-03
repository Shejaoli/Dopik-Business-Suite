import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Megaphone, Plus, Trash2, Pin, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Announcement {
  id: number;
  title: string;
  body: string;
  priority: string;
  pinned: boolean;
  authorName: string | null;
  createdAt: string;
}

function priorityConfig(p: string) {
  if (p === "urgent") return { label: "Urgent", color: "bg-red-100 text-red-700", icon: AlertCircle };
  if (p === "important") return { label: "Important", color: "bg-amber-100 text-amber-700", icon: AlertTriangle };
  return { label: "Info", color: "bg-blue-100 text-blue-700", icon: Info };
}

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isOwner = user?.role === "owner" || user?.role === "admin";
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", priority: "normal", pinned: false });

  const { data: announcements = [], isLoading } = useQuery<Announcement[]>({
    queryKey: ["announcements"],
    queryFn: () => api.get("/announcements"),
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) => api.post("/announcements", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements"] });
      setShowCreate(false);
      setForm({ title: "", body: "", priority: "normal", pinned: false });
      toast({ title: "Announcement posted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/announcements/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements"] });
      toast({ title: "Announcement deleted" });
    },
  });

  const pinMut = useMutation({
    mutationFn: ({ id, pinned }: { id: number; pinned: boolean }) =>
      api.patch(`/announcements/${id}`, { pinned }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-sora">Announcements</h1>
          <p className="text-sm text-muted-foreground">Company-wide announcements for all staff</p>
        </div>
        {isOwner && (
          <Button onClick={() => setShowCreate(true)} className="bg-[#1A6DB5] hover:bg-[#1559a0]">
            <Plus className="h-4 w-4 mr-2" /> Post Announcement
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : announcements.length === 0 ? (
        <div className="glass-panel p-12 text-center">
          <Megaphone className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No announcements yet</p>
          <p className="text-sm text-gray-400 mt-1">
            {isOwner ? "Click 'Post Announcement' to share news with your team." : "Check back later for company updates."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => {
            const { label, color, icon: Icon } = priorityConfig(a.priority ?? "normal");
            return (
              <div key={a.id} className={`glass-panel p-5 ${a.pinned ? "border-l-4 border-[#F5A800]" : ""}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${a.priority === "urgent" ? "bg-red-100" : a.priority === "important" ? "bg-amber-100" : "bg-blue-100"}`}>
                    <Icon className={`h-4 w-4 ${a.priority === "urgent" ? "text-red-600" : a.priority === "important" ? "text-amber-600" : "text-blue-600"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {a.pinned && <Pin className="h-3 w-3 text-[#F5A800]" />}
                      <span className="font-semibold text-gray-900">{a.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{label}</span>
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{a.body}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      By {a.authorName || "Admin"} · {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  {isOwner && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        size="sm" variant="ghost"
                        className={a.pinned ? "text-[#F5A800]" : "text-gray-400"}
                        onClick={() => pinMut.mutate({ id: a.id, pinned: !a.pinned })}
                        title={a.pinned ? "Unpin" : "Pin"}
                      >
                        <Pin className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm" variant="ghost" className="text-red-400 hover:text-red-600"
                        onClick={() => { if (confirm("Delete this announcement?")) deleteMut.mutate(a.id); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Post Announcement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                className="mt-1"
                placeholder="Announcement title..."
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea
                className="mt-1 min-h-[100px]"
                placeholder="Write your announcement here..."
                value={form.body}
                onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="important">Important</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch
                  id="pin"
                  checked={form.pinned}
                  onCheckedChange={v => setForm(p => ({ ...p, pinned: v }))}
                />
                <Label htmlFor="pin" className="cursor-pointer">Pin to top</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              className="bg-[#1A6DB5] hover:bg-[#1559a0]"
              onClick={() => createMut.mutate(form)}
              disabled={!form.title || !form.body || createMut.isPending}
            >
              {createMut.isPending ? "Posting..." : "Post Announcement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
