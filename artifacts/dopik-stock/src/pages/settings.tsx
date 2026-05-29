import { useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, fmtRWF } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Lock, Download, Upload, Database, CheckCircle2, AlertTriangle, Wallet, PencilLine } from "lucide-react";
import { useGetBalances } from "@workspace/api-client-react";

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

  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold font-sora">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account, preferences and data</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="mb-2">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          {isAdmin && <TabsTrigger value="balances">Balances</TabsTrigger>}
          <TabsTrigger value="backup">Backup</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
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
      </Tabs>
    </div>
  );
}
