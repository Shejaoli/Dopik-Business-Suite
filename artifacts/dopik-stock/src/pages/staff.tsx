import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmtDateTime } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Pencil, Trash2, Shield, ShieldCheck, ShieldAlert, UserCog } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const ROLES = [
  { value: "owner", label: "Owner", color: "bg-purple-100 text-purple-800" },
  { value: "manager", label: "Manager", color: "bg-blue-100 text-blue-800" },
  { value: "cashier", label: "Cashier", color: "bg-green-100 text-green-800" },
  { value: "stock_manager", label: "Stock Manager", color: "bg-amber-100 text-amber-800" },
];

const ROLE_PERMISSIONS: Record<string, { label: string; allowed: boolean }[]> = {
  owner: [
    { label: "View dashboard", allowed: true },
    { label: "Create sales", allowed: true },
    { label: "View costs & profit", allowed: true },
    { label: "Create purchases", allowed: true },
    { label: "Manage stock", allowed: true },
    { label: "View customers", allowed: true },
    { label: "Manage repairs", allowed: true },
    { label: "View reports", allowed: true },
    { label: "Manage staff", allowed: true },
    { label: "Access settings", allowed: true },
    { label: "Delete records", allowed: true },
    { label: "Export data", allowed: true },
  ],
  manager: [
    { label: "View dashboard", allowed: true },
    { label: "Create sales", allowed: true },
    { label: "View costs & profit", allowed: true },
    { label: "Create purchases", allowed: true },
    { label: "Manage stock", allowed: true },
    { label: "View customers", allowed: true },
    { label: "Manage repairs", allowed: true },
    { label: "View reports", allowed: true },
    { label: "Manage staff", allowed: false },
    { label: "Access settings", allowed: false },
    { label: "Delete records", allowed: false },
    { label: "Export data", allowed: true },
  ],
  cashier: [
    { label: "View dashboard", allowed: true },
    { label: "Create sales", allowed: true },
    { label: "View costs & profit", allowed: false },
    { label: "Create purchases", allowed: false },
    { label: "Manage stock", allowed: false },
    { label: "View customers", allowed: true },
    { label: "Manage repairs", allowed: false },
    { label: "View reports", allowed: false },
    { label: "Manage staff", allowed: false },
    { label: "Access settings", allowed: false },
    { label: "Delete records", allowed: false },
    { label: "Export data", allowed: false },
  ],
  stock_manager: [
    { label: "View dashboard", allowed: true },
    { label: "Create sales", allowed: false },
    { label: "View costs & profit", allowed: true },
    { label: "Create purchases", allowed: true },
    { label: "Manage stock", allowed: true },
    { label: "View customers", allowed: false },
    { label: "Manage repairs", allowed: false },
    { label: "View reports", allowed: true },
    { label: "Manage staff", allowed: false },
    { label: "Access settings", allowed: false },
    { label: "Delete records", allowed: false },
    { label: "Export data", allowed: true },
  ],
};

type StaffMember = {
  id: number; name: string; email: string; phone?: string;
  role: string; status: string; lastLogin?: string; createdAt: string;
};

function roleInfo(role: string) {
  return ROLES.find((r) => r.value === role) || { label: role, color: "bg-gray-100 text-gray-700" };
}

function RoleIcon({ role }: { role: string }) {
  if (role === "owner") return <Shield className="w-4 h-4 text-purple-600" />;
  if (role === "manager") return <ShieldCheck className="w-4 h-4 text-blue-600" />;
  if (role === "cashier") return <UserCog className="w-4 h-4 text-green-600" />;
  return <ShieldAlert className="w-4 h-4 text-amber-600" />;
}

function StaffFormDialog({
  open, onClose, editing,
}: {
  open: boolean; onClose: () => void; editing?: StaffMember | null;
}) {
  const [name, setName] = useState(editing?.name || "");
  const [email, setEmail] = useState(editing?.email || "");
  const [phone, setPhone] = useState(editing?.phone || "");
  const [role, setRole] = useState(editing?.role || "cashier");
  const [status, setStatus] = useState(editing?.status || "active");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) { toast({ title: "Name and email required", variant: "destructive" }); return; }
    if (!editing && !password) { toast({ title: "Password required for new staff", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const body: any = { name, email, phone, role, status };
      if (password) body.password = password;
      if (editing) {
        await api.put(`/staff/${editing.id}`, body);
        toast({ title: "Staff updated" });
      } else {
        await api.post("/staff", body);
        toast({ title: "Staff account created" });
      }
      qc.invalidateQueries({ queryKey: ["staff"] });
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Staff Member" : "Add New Staff"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Full Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" />
            </div>
            <div className="col-span-2">
              <Label>Email *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+250 7xx xxx xxx" />
            </div>
            <div>
              <Label>Role *</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {editing && (
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className={editing ? "" : "col-span-2"}>
              <Label>{editing ? "New Password (leave blank to keep)" : "Temporary Password *"}</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
          </div>
          {role && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-600 mb-2">Permissions for {roleInfo(role).label}</p>
              <div className="grid grid-cols-2 gap-1">
                {(ROLE_PERMISSIONS[role] || []).map((p) => (
                  <div key={p.label} className="flex items-center gap-1.5 text-xs">
                    <span className={p.allowed ? "text-green-600" : "text-gray-300"}>
                      {p.allowed ? "✓" : "✗"}
                    </span>
                    <span className={p.allowed ? "text-gray-700" : "text-gray-400"}>{p.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-[#1A6DB5] hover:bg-[#155a96]">
              {loading ? "Saving..." : editing ? "Update" : "Create Staff"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function StaffPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [deleting, setDeleting] = useState<StaffMember | null>(null);
  const [activeTab, setActiveTab] = useState<"staff" | "log">("staff");
  const [logSearch, setLogSearch] = useState("");

  const { data: staff = [], isLoading } = useQuery<StaffMember[]>({
    queryKey: ["staff"],
    queryFn: () => api.get("/staff"),
  });

  const { data: activityLog = [], isLoading: logLoading } = useQuery<any[]>({
    queryKey: ["activity-log", logSearch],
    queryFn: () => api.get(`/activity-log?limit=200${logSearch ? `&action=${encodeURIComponent(logSearch)}` : ""}`),
    enabled: activeTab === "log",
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.del(`/staff/${id}`),
    onSuccess: () => {
      toast({ title: "Staff member deleted" });
      qc.invalidateQueries({ queryKey: ["staff"] });
      setDeleting(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const canManageStaff = user?.role === "owner";

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F1A2E]">Staff Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage team members, roles, and permissions</p>
        </div>
        {canManageStaff && (
          <Button onClick={() => { setEditing(null); setShowForm(true); }}
            className="bg-[#1A6DB5] hover:bg-[#155a96] gap-2">
            <UserPlus className="w-4 h-4" /> Add Staff
          </Button>
        )}
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {[{ key: "staff", label: "Team Members" }, { key: "log", label: "Activity Log" }].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? "border-[#1A6DB5] text-[#1A6DB5]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "staff" && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : staff.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No staff members yet</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {staff.map((s) => {
                const ri = roleInfo(s.role);
                return (
                  <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#1A6DB5]/10 flex items-center justify-center text-[#1A6DB5] font-bold text-sm">
                          {s.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-[#0F1A2E] text-sm">{s.name}</p>
                          <p className="text-xs text-gray-500">{s.email}</p>
                          {s.phone && <p className="text-xs text-gray-400">{s.phone}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <RoleIcon role={s.role} />
                        <Badge className={`text-xs ${ri.color}`}>{ri.label}</Badge>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                          s.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.status === "active" ? "bg-green-500" : "bg-gray-400"}`} />
                          {s.status === "active" ? "Active" : "Inactive"}
                        </span>
                        {s.lastLogin && (
                          <span className="text-xs text-gray-400">Last: {fmtDateTime(s.lastLogin)}</span>
                        )}
                      </div>
                      {canManageStaff && user?.id !== s.id && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                            onClick={() => { setEditing(s); setShowForm(true); }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                            onClick={() => setDeleting(s)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="font-semibold text-[#0F1A2E] mb-4">Permissions Matrix</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 pr-4 font-medium text-gray-600">Feature</th>
                    {ROLES.map((r) => (
                      <th key={r.value} className="text-center py-2 px-3 font-medium text-gray-600">{r.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(ROLE_PERMISSIONS.owner || []).map((p, i) => (
                    <tr key={p.label} className={i % 2 === 0 ? "bg-gray-50/50" : ""}>
                      <td className="py-2 pr-4 text-gray-700">{p.label}</td>
                      {ROLES.map((r) => {
                        const allowed = (ROLE_PERMISSIONS[r.value] || [])[i]?.allowed;
                        return (
                          <td key={r.value} className="text-center py-2 px-3">
                            <span className={allowed ? "text-green-600 font-bold" : "text-gray-300"}>
                              {allowed ? "✓" : "✗"}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "log" && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <Input
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              placeholder="Filter by action..."
              className="max-w-xs"
            />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Who</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">IP</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logLoading ? (
                    <tr><td colSpan={5} className="text-center py-8 text-gray-400">Loading...</td></tr>
                  ) : activityLog.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-gray-400">No activity logged yet</td></tr>
                  ) : activityLog.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#0F1A2E] text-xs">{log.userName || "—"}</div>
                        {log.userRole && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${roleInfo(log.userRole).color}`}>
                            {roleInfo(log.userRole).label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-xs max-w-xs truncate">{log.description}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs font-mono">{log.ipAddress || "—"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDateTime(log.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <StaffFormDialog open={showForm} onClose={() => setShowForm(false)} editing={editing} />

      <Dialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Staff Member</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">
            Remove <strong>{deleting?.name}</strong> from the system? They will lose access immediately.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleting && deleteMut.mutate(deleting.id)}
              disabled={deleteMut.isPending}>
              {deleteMut.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
