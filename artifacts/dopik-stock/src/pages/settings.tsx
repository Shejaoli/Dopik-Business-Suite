import { useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, fmtRWF, fmtDateTime } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Lock, Download, Upload, Database, CheckCircle2, AlertTriangle, Wallet, PencilLine, CloudUpload, Clock, HardDrive, Activity, Search, ShieldAlert, Trash2 } from "lucide-react";
import { useGetBalances } from "@workspace/api-client-react";

type ActivityLog = {
  id: number; userId?: number; userName?: string; userRole?: string;
  action: string; description: string; ipAddress?: string; createdAt: string;
};

const BALANCE_METHODS = [
  { key: "cash", label: "Cash" },
  { key: "bank", label: "Bank" },
  { key: "mobile_money", label: "Mobile Money" },
];

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const [profileForm, setProfileForm] = useState({ name: user?.name ?? "", email: user?.email ?? "" });
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: balances, refetch: refetchBalances } = useGetBalances();
  const balList: any[] = (balances as any) ?? [];

  const [adjustForms, setAdjustForms] = useState<Record<string, string>>({});
  const [savingBalance, setSavingBalance] = useState<string | null>(null);

  const handleProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const updated = await api.put<any>("/users/profile", profileForm);
      setUser(updated);
      toast({ title: "Profile updated" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSavingProfile(false); }
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (pwForm.newPassword.length < 6) {
      toast({ title: "Password too short", description: "Minimum 6 characters", variant: "destructive" });
      return;
    }
    setSavingPw(true);
    try {
      await api.put("/users/password", { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      toast({ title: "Password updated" });
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSavingPw(false); }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const BASE = (window as any).__BASE_URL__ ?? "";
      const resp = await fetch(`${BASE}api/backup/export`, { credentials: "include" });
      if (!resp.ok) throw new Error("Export failed");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dopik-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Backup downloaded", description: "Keep this file safe — it contains all your data." });
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    } finally { setExporting(false); }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);
    setImporting(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const result = await api.post<any>("/backup/import", json);
      setImportResult({ ok: true, msg: result.message ?? "Restored successfully" });
      toast({ title: "Database restored", description: "All data has been restored from the backup." });
    } catch (e: any) {
      setImportResult({ ok: false, msg: e.message });
      toast({ title: "Restore failed", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleBalanceAdjust = async (method: string) => {
    const rawVal = adjustForms[method];
    if (rawVal === undefined || rawVal === "") return;
    const amount = parseFloat(rawVal);
    if (isNaN(amount)) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    setSavingBalance(method);
    try {
      await api.put(`/balances/${method}`, { amount });
      await refetchBalances();
      setAdjustForms(f => ({ ...f, [method]: "" }));
      toast({ title: "Balance updated", description: `${method.replace(/_/g, " ")} balance set to ${fmtRWF(amount)}` });
    } catch (e: any) {
      toast({ title: "Failed to update balance", description: e.message, variant: "destructive" });
    } finally {
      setSavingBalance(null);
    }
  };

  const [backupStatus, setBackupStatus] = useState<any>(null);
  const [runningBackup, setRunningBackup] = useState(false);

  // Activity Log state
  const [activitySearch, setActivitySearch] = useState("");
  const [activityAction, setActivityAction] = useState("all");
  const [activityPage, setActivityPage] = useState(1);
  const ACTIVITY_LIMIT = 50;

  const { data: activityLogs, isLoading: logsLoading } = useQuery<ActivityLog[]>({
    queryKey: ["activity-log", activityAction, activityPage],
    queryFn: () => api.get(`/activity-log?limit=${ACTIVITY_LIMIT}&page=${activityPage}${activityAction !== "all" ? `&action=${activityAction}` : ""}`),
  });

  const fetchBackupStatus = async () => {
    try {
      const s = await api.get<any>("/admin/backup/status");
      setBackupStatus(s);
    } catch { /* non-admin or not available */ }
  };

  const handleRunBackup = async () => {
    setRunningBackup(true);
    try {
      const result = await api.post<any>("/admin/backup/run");
      toast({ title: result.success ? "Backup completed" : "Backup failed", description: result.file ?? result.error, variant: result.success ? "default" : "destructive" });
      await fetchBackupStatus();
    } catch (e: any) {
      toast({ title: "Backup failed", description: e.message, variant: "destructive" });
    } finally { setRunningBackup(false); }
  };

  const isAdmin = user?.role === "owner" || user?.role === "admin" || user?.role === "manager";
  const isOwner = user?.role === "owner";

  // Danger Zone state
  const [resetStep, setResetStep] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const generateResetCode = () => `RESET-DOPIK-${Math.floor(1000 + Math.random() * 9000)}`;

  const handleReset = async () => {
    setResetting(true);
    try {
      await api.post<any>("/admin/reset-data", { password: resetPassword });
      setResetDone(true);
      setResetStep(5);
      toast({ title: "Data reset complete", description: "All transaction data has been wiped. Balances and stock are now at zero." });
    } catch (e: any) {
      toast({ title: "Reset failed", description: e.message, variant: "destructive" });
      setResetStep(4);
    } finally {
      setResetting(false);
    }
  };

  const resetDangerState = () => {
    setResetStep(0);
    setResetConfirmText("");
    setResetCode("");
    setResetPassword("");
    setResetting(false);
    setResetDone(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold font-sora">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account, preferences and data</p>
      </div>

      <Tabs defaultValue="profile" onValueChange={v => { if (v === "backup-cloud" && isAdmin) fetchBackupStatus(); }}>
        <TabsList className="mb-2 flex-wrap h-auto">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          {isAdmin && <TabsTrigger value="balances">Balances</TabsTrigger>}
          <TabsTrigger value="backup">Backup</TabsTrigger>
          {isAdmin && <TabsTrigger value="backup-cloud">Cloud Backup</TabsTrigger>}
          {isAdmin && <TabsTrigger value="activity-log">Activity Log</TabsTrigger>}
          <TabsTrigger value="system">System</TabsTrigger>
          {isOwner && (
            <TabsTrigger value="danger-zone" className="text-red-600 data-[state=active]:bg-red-50 data-[state=active]:text-red-700">
              Danger Zone
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Profile ─────────────────────── */}
        <TabsContent value="profile" className="space-y-4 mt-4">
          <div className="glass-panel p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-[#1A6DB5]/10 flex items-center justify-center">
                <User className="h-4 w-4 text-[#1A6DB5]" />
              </div>
              <div><h2 className="font-semibold font-sora">Profile</h2><p className="text-xs text-muted-foreground">Update your account information</p></div>
            </div>
            <form onSubmit={handleProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Full Name</Label><Input value={profileForm.name} onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={profileForm.email} onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))} /></div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground">Role: <strong>{user?.role}</strong></span>
              </div>
              <Button type="submit" disabled={savingProfile} className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90">
                {savingProfile && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save Profile
              </Button>
            </form>
          </div>

          {/* Balance summary */}
          <div className="glass-panel p-6">
            <h2 className="font-semibold font-sora mb-4">Cash Balances</h2>
            <div className="space-y-3">
              {balList.map(b => (
                <div key={b.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm font-medium capitalize">{b.method.replace(/_/g, " ")}</span>
                  <span className={`font-bold ${parseFloat(b.amount) < 0 ? "text-red-600" : "text-foreground"}`}>{fmtRWF(b.amount)}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">Balances update automatically with each transaction.</p>
          </div>
        </TabsContent>

        {/* ── Security ────────────────────── */}
        <TabsContent value="security" className="mt-4">
          <div className="glass-panel p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                <Lock className="h-4 w-4 text-orange-600" />
              </div>
              <div><h2 className="font-semibold font-sora">Change Password</h2><p className="text-xs text-muted-foreground">Keep your account secure</p></div>
            </div>
            <form onSubmit={handlePassword} className="space-y-4">
              <div className="space-y-1.5"><Label>Current Password</Label><Input type="password" value={pwForm.currentPassword} onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>New Password</Label><Input type="password" value={pwForm.newPassword} onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Confirm Password</Label><Input type="password" value={pwForm.confirmPassword} onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))} /></div>
              </div>
              <Button type="submit" disabled={savingPw || !pwForm.currentPassword || !pwForm.newPassword} variant="outline">
                {savingPw && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Update Password
              </Button>
            </form>
          </div>
        </TabsContent>

        {/* ── Balances (Admin only) ────────── */}
        {isAdmin && (
          <TabsContent value="balances" className="mt-4 space-y-4">
            <div className="glass-panel p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-lg bg-[#1A6DB5]/10 flex items-center justify-center">
                  <Wallet className="h-4 w-4 text-[#1A6DB5]" />
                </div>
                <div>
                  <h2 className="font-semibold font-sora">Adjust Balances</h2>
                  <p className="text-xs text-muted-foreground">Manually set the opening or corrected balance for each payment method</p>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 mb-5">
                <strong>Admin only:</strong> This directly overwrites the stored balance. Use this to correct discrepancies or set an opening balance.
              </div>

              <div className="space-y-5">
                {BALANCE_METHODS.map(({ key, label }) => {
                  const current = balList.find(b => b.method === key);
                  return (
                    <div key={key} className="border border-border rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <PencilLine className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{label}</span>
                        </div>
                        <span className={`text-sm font-bold ${current && parseFloat(current.amount) < 0 ? "text-red-600" : "text-foreground"}`}>
                          Current: {current ? fmtRWF(current.amount) : "—"}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder={`New ${label} balance (RWF)`}
                          value={adjustForms[key] ?? ""}
                          onChange={e => setAdjustForms(f => ({ ...f, [key]: e.target.value }))}
                          className="flex-1"
                        />
                        <Button
                          onClick={() => handleBalanceAdjust(key)}
                          disabled={savingBalance === key || !adjustForms[key]}
                          className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90 text-white"
                        >
                          {savingBalance === key ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>
        )}

        {/* ── Backup ──────────────────────── */}
        <TabsContent value="backup" className="mt-4 space-y-4">
          {/* Export */}
          <div className="glass-panel p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                <Download className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <h2 className="font-semibold font-sora">Download Backup</h2>
                <p className="text-xs text-muted-foreground">Export all your data as a JSON file you can save locally or commit to your repository</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              The backup includes everything — items, stock, customers, sales, purchases, receivables,
              payables, loans, expenses, and user accounts. You can use this file to restore the database
              on any device or deployment.
            </p>
            <Button onClick={handleExport} disabled={exporting} className="bg-green-600 hover:bg-green-700 text-white gap-2">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {exporting ? "Preparing backup..." : "Download Backup File"}
            </Button>
          </div>

          {/* Import / Restore */}
          <div className="glass-panel p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <Upload className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <h2 className="font-semibold font-sora">Restore from Backup</h2>
                <p className="text-xs text-muted-foreground">Upload a previously downloaded backup file to restore all data</p>
              </div>
            </div>

            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">
              <strong>Warning:</strong> Restoring from a backup will <strong>permanently replace all current data</strong> in the database. This cannot be undone. Make sure to download a backup of your current data first.
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileSelect}
            />

            <Button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              variant="outline"
              className="border-amber-300 text-amber-700 hover:bg-amber-50 gap-2"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importing ? "Restoring database..." : "Upload & Restore Backup"}
            </Button>

            {importResult && (
              <div className={`mt-4 p-3 rounded-xl border text-sm flex items-center gap-2 ${importResult.ok ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                {importResult.ok ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> : <AlertTriangle className="h-4 w-4 flex-shrink-0" />}
                {importResult.msg}
                {importResult.ok && <span className="ml-1">— Please refresh the page.</span>}
              </div>
            )}
          </div>

          <div className="glass-panel p-4 flex items-start gap-3">
            <Database className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Pro tip: Keep your backup in your repository</p>
              <p>After downloading, you can commit the backup JSON to your Git repo. When you deploy or clone the project, upload it via this page to restore all your data including login credentials.</p>
            </div>
          </div>
        </TabsContent>

        {/* ── Cloud Backup (Admin only) ────── */}
        {isAdmin && (
          <TabsContent value="backup-cloud" className="mt-4 space-y-4">
            {/* Status card */}
            <div className="glass-panel p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-lg bg-[#1A6DB5]/10 flex items-center justify-center">
                  <CloudUpload className="h-4 w-4 text-[#1A6DB5]" />
                </div>
                <div>
                  <h2 className="font-semibold font-sora">Backup &amp; Storage</h2>
                  <p className="text-xs text-muted-foreground">Automated pg_dump backups, uploaded to Google Drive or OneDrive</p>
                </div>
              </div>

              {backupStatus ? (
                <div className="space-y-3 mb-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase">Last Backup</span>
                      </div>
                      <p className="text-sm font-medium">
                        {backupStatus.lastBackupAt ? new Date(backupStatus.lastBackupAt).toLocaleString() : "Never"}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-2 mb-1">
                        <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase">Destination</span>
                      </div>
                      <p className="text-sm font-medium capitalize">{backupStatus.destination?.replace("_", " ") || "Local"}</p>
                    </div>
                  </div>
                  <div className={`p-3 rounded-xl border flex items-center gap-2 text-sm ${backupStatus.lastStatus === "success" ? "bg-green-50 border-green-200 text-green-700" : backupStatus.lastStatus === "failed" ? "bg-red-50 border-red-200 text-red-700" : "bg-gray-50 border-gray-200 text-gray-600"}`}>
                    {backupStatus.lastStatus === "success" ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> : backupStatus.lastStatus === "failed" ? <AlertTriangle className="h-4 w-4 flex-shrink-0" /> : <Clock className="h-4 w-4 flex-shrink-0" />}
                    {backupStatus.lastStatus === "success"
                      ? `Last backup succeeded — ${backupStatus.lastBackupFile ?? ""}`
                      : backupStatus.lastStatus === "failed"
                      ? `Last backup failed: ${backupStatus.lastError ?? "Unknown error"}`
                      : "No backup has run yet"}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 mb-5">
                  Click "Check Status" or "Run Backup Now" to see current backup status.
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleRunBackup}
                  disabled={runningBackup}
                  className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90"
                >
                  {runningBackup
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Running Backup...</>
                    : <><CloudUpload className="h-4 w-4 mr-2" />Run Backup Now</>}
                </Button>
                <Button variant="outline" onClick={fetchBackupStatus}>
                  Check Status
                </Button>
              </div>
            </div>

            {/* Configuration reference */}
            <div className="glass-panel p-5 space-y-3">
              <h3 className="font-semibold text-sm font-sora">Configuration (Environment Variables)</h3>
              <div className="space-y-2 text-xs text-muted-foreground">
                {[
                  { key: "BACKUP_DESTINATION", desc: 'googledrive, onedrive, or local (default: local)' },
                  { key: "BACKUP_CRON_SCHEDULE", desc: 'Cron expression (default: 0 2 * * * — daily at 2 AM)' },
                  { key: "BACKUP_RETENTION_DAYS", desc: 'Number of local backups to keep (default: 7)' },
                  { key: "GOOGLE_SERVICE_ACCOUNT_JSON", desc: 'Service account JSON for Google Drive upload' },
                  { key: "ONEDRIVE_CLIENT_ID", desc: 'Azure app client ID for OneDrive' },
                  { key: "ONEDRIVE_CLIENT_SECRET", desc: 'Azure app client secret for OneDrive' },
                  { key: "ONEDRIVE_TENANT_ID", desc: 'Azure tenant ID for OneDrive' },
                ].map(({ key, desc }) => (
                  <div key={key} className="flex gap-2">
                    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-[11px] font-mono text-gray-700 flex-shrink-0">{key}</code>
                    <span>{desc}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground pt-1">Set these in your Replit environment secrets. Backups are stored in <code className="bg-gray-100 px-1 rounded">/tmp/dopik-backups/</code> locally before cloud upload.</p>
            </div>
          </TabsContent>
        )}

        {/* ── Activity Log (Admin/Owner/Manager) ── */}
        {isAdmin && (
          <TabsContent value="activity-log" className="mt-4 space-y-4">
            <div className="glass-panel p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <h2 className="font-semibold font-sora">Activity Log</h2>
                  <p className="text-xs text-muted-foreground">All staff actions tracked with timestamp and IP address</p>
                </div>
              </div>

              <div className="flex gap-2 mb-4 flex-wrap">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search description..."
                    className="pl-8"
                    value={activitySearch}
                    onChange={e => setActivitySearch(e.target.value)}
                  />
                </div>
                <Select value={activityAction} onValueChange={v => { setActivityAction(v); setActivityPage(1); }}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="login">Login</SelectItem>
                    <SelectItem value="sale">Sales</SelectItem>
                    <SelectItem value="purchase">Purchases</SelectItem>
                    <SelectItem value="create_staff">Create Staff</SelectItem>
                    <SelectItem value="update_staff">Update Staff</SelectItem>
                    <SelectItem value="delete_staff">Delete Staff</SelectItem>
                    <SelectItem value="repair">Repairs</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 shrink-0"
                  disabled={!activityLogs?.length}
                  onClick={() => {
                    const rows = activityLogs ?? [];
                    const header = "ID,User,Role,Action,Description,IP Address,Date/Time";
                    const lines = rows.map(log =>
                      [log.id, `"${log.userName ?? ""}"`, log.userRole ?? "", log.action, `"${log.description.replace(/"/g, '""')}"`, log.ipAddress ?? "", fmtDateTime(log.createdAt)].join(",")
                    );
                    const csv = [header, ...lines].join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `activity-log-${new Date().toISOString().split("T")[0]}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download className="h-4 w-4" /> Export CSV
                </Button>
              </div>

              {logsLoading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" /> Loading activity log...
                </div>
              ) : !activityLogs?.length ? (
                <div className="text-center py-10 text-muted-foreground text-sm">No activity found</div>
              ) : (
                <div className="space-y-2">
                  {activityLogs
                    .filter(log => !activitySearch || log.description.toLowerCase().includes(activitySearch.toLowerCase()) || log.userName?.toLowerCase().includes(activitySearch.toLowerCase()))
                    .map(log => (
                      <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-xs font-semibold text-gray-700">{log.userName ?? "—"}</span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">{log.userRole}</Badge>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{log.action}</Badge>
                          </div>
                          <p className="text-xs text-gray-600 truncate">{log.description}</p>
                          {log.ipAddress && <p className="text-[10px] text-gray-400 mt-0.5">IP: {log.ipAddress}</p>}
                        </div>
                        <div className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5">
                          {fmtDateTime(log.createdAt)}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {(activityLogs?.length ?? 0) >= ACTIVITY_LIMIT && (
                <div className="flex justify-center gap-2 mt-4">
                  <Button variant="outline" size="sm" disabled={activityPage <= 1} onClick={() => setActivityPage(p => p - 1)}>Previous</Button>
                  <span className="text-sm text-muted-foreground flex items-center px-2">Page {activityPage}</span>
                  <Button variant="outline" size="sm" onClick={() => setActivityPage(p => p + 1)}>Next</Button>
                </div>
              )}
            </div>
          </TabsContent>
        )}

        {/* ── System ──────────────────────── */}
        <TabsContent value="system" className="mt-4">
          <div className="glass-panel p-6">
            <h2 className="font-semibold font-sora mb-3">System</h2>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Dopik Electronics Ltd — Stock Management v1.0</p>
              <p>Kigali, Rwanda</p>
            </div>
          </div>
        </TabsContent>

        {/* ── Danger Zone (Owner only) ─────── */}
        {isOwner && (
          <TabsContent value="danger-zone" className="mt-4 space-y-4">
            <div className="border-2 border-red-200 rounded-xl overflow-hidden">
              <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 text-white flex-shrink-0" />
                <div>
                  <h2 className="font-bold text-white font-sora">Danger Zone — Data Reset</h2>
                  <p className="text-red-100 text-xs mt-0.5">Owner access only · Irreversible action</p>
                </div>
              </div>

              <div className="p-6 space-y-5 bg-white">
                {/* Step 0 — info */}
                {resetStep === 0 && (
                  <div className="space-y-4">
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800 space-y-2">
                      <p className="font-semibold">This will permanently delete all of the following:</p>
                      <ul className="list-disc pl-5 space-y-1 text-red-700">
                        <li>All sales, sale items and receipts</li>
                        <li>All purchases and serialized units (IMEIs)</li>
                        <li>All customers and their credit accounts</li>
                        <li>All expenses, loans, payables and receivables</li>
                        <li>All announcements and stock adjustments</li>
                        <li>All repairs, activity logs and audit trails</li>
                        <li>All stock count sessions</li>
                        <li>Stock quantities reset to zero</li>
                        <li>Cash, bank and mobile money balances reset to zero</li>
                      </ul>
                      <p className="font-semibold pt-1">Vendors, staff accounts, product catalog and settings are kept.</p>
                    </div>
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                      <strong>Warning:</strong> This action is irreversible. You are strongly encouraged to download a backup before proceeding.
                    </div>
                    <Button
                      variant="destructive"
                      onClick={() => setResetStep(1)}
                      className="gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      I understand — Begin Data Reset
                    </Button>
                  </div>
                )}

                {/* Step 1 — backup download */}
                {resetStep === 1 && (
                  <div className="space-y-4">
                    <div className="text-center space-y-2">
                      <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
                        <AlertTriangle className="h-7 w-7 text-amber-600" />
                      </div>
                      <h3 className="font-bold text-lg">Step 1 of 4 — Download a Backup</h3>
                      <p className="text-sm text-muted-foreground">
                        Before wiping all data, we strongly recommend downloading a backup. You can use this to recover data if needed.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1" onClick={resetDangerState}>Cancel</Button>
                      <Button
                        variant="outline"
                        className="flex-1 gap-2 border-amber-400 text-amber-700 hover:bg-amber-50"
                        onClick={async () => {
                          await handleExport();
                          const code = generateResetCode();
                          setResetCode(code);
                          setResetStep(2);
                        }}
                        disabled={exporting}
                      >
                        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Download Backup &amp; Continue
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => {
                          const code = generateResetCode();
                          setResetCode(code);
                          setResetStep(2);
                        }}
                      >
                        Skip, Continue Without Backup
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 2 — type random reset code */}
                {resetStep === 2 && (
                  <div className="space-y-4">
                    <div className="text-center space-y-2">
                      <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                        <AlertTriangle className="h-7 w-7 text-red-600" />
                      </div>
                      <h3 className="font-bold text-lg">Step 2 of 4 — Confirm Your Intent</h3>
                      <p className="text-sm text-muted-foreground">
                        To continue, type the reset code below exactly as shown:
                      </p>
                      <div className="inline-block bg-red-50 border-2 border-red-200 rounded-xl px-6 py-3">
                        <span className="font-mono font-black text-red-700 tracking-wider text-base">{resetCode}</span>
                      </div>
                    </div>
                    <Input
                      value={resetConfirmText}
                      onChange={e => setResetConfirmText(e.target.value)}
                      placeholder="Type the code exactly…"
                      className="text-center font-mono tracking-wide"
                    />
                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1" onClick={() => { setResetConfirmText(""); setResetStep(1); }}>← Back</Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        disabled={resetConfirmText !== resetCode}
                        onClick={() => { setResetConfirmText(""); setResetStep(3); }}
                      >
                        Continue →
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 3 — enter owner password */}
                {resetStep === 3 && (
                  <div className="space-y-4">
                    <div className="text-center space-y-2">
                      <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                        <Lock className="h-7 w-7 text-red-600" />
                      </div>
                      <h3 className="font-bold text-lg">Step 3 of 4 — Verify Your Identity</h3>
                      <p className="text-sm text-muted-foreground">
                        Enter your owner account password to authorise this action.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Your Password</Label>
                      <Input
                        type="password"
                        value={resetPassword}
                        onChange={e => setResetPassword(e.target.value)}
                        placeholder="Enter your password…"
                        onKeyDown={e => { if (e.key === "Enter" && resetPassword) setResetStep(4); }}
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1" onClick={() => setResetStep(2)}>← Back</Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        disabled={!resetPassword}
                        onClick={() => setResetStep(4)}
                      >
                        Continue →
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 4 — final confirmation */}
                {resetStep === 4 && !resetDone && (
                  <div className="space-y-4">
                    <div className="text-center space-y-2">
                      <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center mx-auto">
                        <ShieldAlert className="h-7 w-7 text-white" />
                      </div>
                      <h3 className="font-bold text-lg text-red-700">Step 4 of 4 — Final Confirmation</h3>
                      <p className="text-sm text-muted-foreground">
                        This is the last step. Clicking <strong>Delete All Data</strong> below will permanently wipe all transaction data. This cannot be undone.
                      </p>
                    </div>
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-center text-sm font-semibold text-red-800">
                      ⚠️ All sales, purchases, customers, credits, expenses, loans and logs will be deleted permanently.
                    </div>
                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1" onClick={resetDangerState} disabled={resetting}>Cancel</Button>
                      <Button
                        variant="destructive"
                        className="flex-1 gap-2"
                        onClick={handleReset}
                        disabled={resetting}
                      >
                        {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        {resetting ? "Deleting all data…" : "Delete All Data"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 5 — done */}
                {resetStep === 5 && resetDone && (
                  <div className="space-y-4 text-center">
                    <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="h-7 w-7 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-green-700">Data Reset Complete</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        All transaction data has been permanently deleted. Stock quantities and balances have been reset to zero.
                      </p>
                    </div>
                    <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
                      You may now start fresh. Vendors, staff accounts and the product catalog remain intact.
                    </div>
                    <Button onClick={resetDangerState} className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90">
                      Done
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
