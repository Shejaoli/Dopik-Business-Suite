import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { ArrowLeft, ChevronRight, LogOut, UserCog, RefreshCw, FileText, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

function AccountSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<"profile" | "password">("profile");
  const [profileForm, setProfileForm] = useState({ name: user?.name ?? "", email: user?.email ?? "" });
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [saving, setSaving] = useState(false);

  const handleProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.put<any>("/users/profile", profileForm);
      setUser(updated);
      toast({ title: "Profile updated successfully" });
      onClose();
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) { toast({ title: "Passwords don't match", variant: "destructive" }); return; }
    if (pwForm.newPassword.length < 6) { toast({ title: "Minimum 6 characters", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await api.put("/users/password", { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      toast({ title: "Password updated" });
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      onClose();
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Account Settings</DialogTitle></DialogHeader>
        <div className="flex gap-2 mb-4">
          {(["profile", "password"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition ${tab === t ? "bg-[#1A6DB5] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {t === "profile" ? "Profile" : "Password"}
            </button>
          ))}
        </div>
        {tab === "profile" ? (
          <form onSubmit={handleProfile} className="space-y-3">
            <div className="space-y-1.5"><Label>Full Name</Label><Input value={profileForm.name} onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={profileForm.email} onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))} /></div>
            <DialogFooter className="pt-2">
              <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#1A6DB5] hover:bg-[#1A6DB5]/90">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={handlePassword} className="space-y-3">
            <div className="space-y-1.5"><Label>Current Password</Label><Input type="password" value={pwForm.currentPassword} onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>New Password</Label><Input type="password" value={pwForm.newPassword} onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Confirm New Password</Label><Input type="password" value={pwForm.confirmPassword} onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))} /></div>
            <DialogFooter className="pt-2">
              <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving || !pwForm.currentPassword || !pwForm.newPassword} variant="outline">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Update Password
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StaticModal({ open, onClose, title, content }: { open: boolean; onClose: () => void; title: string; content: string }) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[70vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{content}</div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [showSettings, setShowSettings] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const initials = getInitials(user?.name ?? "A");

  const menuItems = [
    {
      icon: RefreshCw, label: "Switch Account",
      sub: "Sign in with a different account",
      onClick: () => logout(),
    },
    {
      icon: UserCog, label: "Account Settings",
      sub: "Name, email, password",
      onClick: () => setShowSettings(true),
    },
    {
      icon: FileText, label: "Terms of Use",
      sub: "Read our terms and conditions",
      onClick: () => setShowTerms(true),
    },
    {
      icon: Shield, label: "Privacy Policy",
      sub: "How we handle your data",
      onClick: () => setShowPrivacy(true),
    },
  ];

  return (
    <div className="max-w-md mx-auto space-y-0">
      {/* Header */}
      <div className="flex items-center gap-3 py-4 mb-2">
        <button onClick={() => navigate("/")}
          className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition -ml-2">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-center text-lg font-bold font-sora pr-9">Profile</h1>
      </div>

      {/* Avatar section */}
      <div className="glass-panel p-8 flex flex-col items-center text-center gap-2 rounded-3xl">
        <div className="w-24 h-24 rounded-full bg-[#1A2540] flex items-center justify-center ring-4 ring-white shadow-xl">
          <span className="text-3xl font-bold text-white font-sora">{initials}</span>
        </div>
        <div className="mt-2">
          <p className="text-xl font-bold font-sora">{user?.name}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{user?.email}</p>
          <span className="inline-block mt-2 px-3 py-0.5 rounded-full text-xs font-semibold capitalize bg-[#1A6DB5]/10 text-[#1A6DB5]">
            {user?.role}
          </span>
        </div>
      </div>

      {/* Menu list */}
      <div className="glass-panel overflow-hidden rounded-3xl mt-4">
        {menuItems.map((item, i) => (
          <button
            key={i}
            onClick={item.onClick}
            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition text-left border-b border-gray-100 last:border-0"
          >
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
              <item.icon className="h-4 w-4 text-gray-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-800">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.sub}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
          </button>
        ))}
      </div>

      {/* Logout */}
      <div className="mt-4 glass-panel p-5 rounded-3xl space-y-4">
        <Button
          variant="outline"
          className="w-full border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 font-semibold"
          onClick={logout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Log Out
        </Button>
        <div className="text-center space-y-0.5">
          <p className="text-xs text-muted-foreground font-medium">Dopik Electronics v1.0</p>
          <p className="text-xs text-muted-foreground">Made in Rwanda 🇷🇼</p>
        </div>
      </div>

      <AccountSettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
      <StaticModal open={showTerms} onClose={() => setShowTerms(false)} title="Terms of Use"
        content={`Dopik Electronics Stock Management System\nTerms of Use\n\nBy using this application, you agree to:\n\n1. Use the system solely for legitimate business purposes at Dopik Electronics Ltd.\n\n2. Keep your login credentials confidential and not share them with unauthorized persons.\n\n3. Ensure all inventory and financial data entered is accurate and complete.\n\n4. Not attempt to bypass, disable, or tamper with any security features.\n\n5. Report any unauthorized access or security concerns to the system administrator immediately.\n\nThis system is proprietary software owned by Dopik Electronics Ltd. Unauthorized use or distribution is strictly prohibited.\n\nKigali, Rwanda · 2026`} />
      <StaticModal open={showPrivacy} onClose={() => setShowPrivacy(false)} title="Privacy Policy"
        content={`Dopik Electronics Privacy Policy\n\nData We Collect\nThis application collects business operational data including inventory records, sales transactions, customer information, and user account details.\n\nHow We Use Your Data\nAll data entered into this system is used exclusively for the internal operations of Dopik Electronics Ltd., including inventory management, financial reporting, and business analytics.\n\nData Storage\nAll data is stored securely in our encrypted PostgreSQL database hosted on Replit's infrastructure. Regular backups are maintained to prevent data loss.\n\nData Access\nOnly authorized staff with valid login credentials can access the system. Admin users have full access; standard users have limited permissions.\n\nData Retention\nBusiness records are retained for as long as required by Rwandan business regulations and internal policy.\n\nContact\nFor privacy concerns, contact your system administrator.\n\nKigali, Rwanda · 2026`} />
    </div>
  );
}
