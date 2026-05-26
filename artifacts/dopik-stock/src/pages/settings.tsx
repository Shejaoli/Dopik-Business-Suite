import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Lock } from "lucide-react";
import { useGetBalances } from "@workspace/api-client-react";
import { fmtRWF, fmtDateTime } from "@/lib/api";

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const [profileForm, setProfileForm] = useState({ name: user?.name ?? "", email: user?.email ?? "" });
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const { data: balances } = useGetBalances();
  const balList: any[] = (balances as any) ?? [];

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

  return (
    <div className="space-y-6 max-w-2xl">
      <div><h1 className="text-2xl font-bold font-sora">Settings</h1><p className="text-sm text-muted-foreground">Manage your account and preferences</p></div>

      {/* Profile */}
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

      {/* Password */}
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

      {/* Balance Summary */}
      <div className="glass-panel p-6">
        <h2 className="font-semibold font-sora mb-4">Cash Balances</h2>
        <div className="space-y-3">
          {balList.map(b => (
            <div key={b.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <span className="text-sm font-medium capitalize">{b.method.replace(/_/g, " ")}</span>
              <span className={`font-bold ${parseFloat(b.amount) < 0 ? "text-red-600" : "text-foreground"}`}>
                {fmtRWF(b.amount)}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">Balances update automatically with each transaction.</p>
      </div>

      {/* System Info */}
      <div className="glass-panel p-6">
        <h2 className="font-semibold font-sora mb-3">System</h2>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Dopik Electronics Ltd — Stock Management v1.0</p>
          <p>Kigali, Rwanda</p>
        </div>
      </div>
    </div>
  );
}
