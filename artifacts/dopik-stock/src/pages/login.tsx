import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Lock } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const user = await api.post<any>("/auth/login", { email, password });
      setUser(user);
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f0f2f8] relative overflow-hidden p-4">

      {/* Corner decorations */}
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#1A6DB5] rounded-tr-[80px] opacity-90" />
      <div className="absolute bottom-0 right-0 w-48 h-48 bg-[#F5A800] rounded-tl-[60px] opacity-90" />
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#1A6DB5]/20 rounded-bl-[60px]" />

      {/* Logo above card */}
      <div className="flex flex-col items-center mb-6 z-10">
        <img
          src="/dopik-logo.png"
          alt="Dopik Electronics"
          className="h-16 w-16 object-contain drop-shadow-lg"
        />
        <p className="text-gray-600 font-semibold text-sm mt-2 tracking-wide uppercase">Dopik Electronics Ltd</p>
      </div>

      {/* Main card */}
      <div className="relative z-10 w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex overflow-hidden" style={{ minHeight: 420 }}>

        {/* Left panel — illustration */}
        <div className="hidden md:flex flex-col items-center justify-center flex-1 bg-white px-10 py-10 relative">
          {/* Decorative circles */}
          <div className="absolute top-8 left-8 w-3 h-3 rounded-full bg-[#F5A800] opacity-70" />
          <div className="absolute top-16 right-12 w-2 h-2 rounded-full bg-[#1A6DB5] opacity-60" />
          <div className="absolute bottom-12 left-16 w-4 h-4 rounded-full border-2 border-[#1A6DB5]/30" />
          <div className="absolute bottom-20 right-8 w-2 h-2 rounded-full bg-[#F5A800]/50" />

          {/* SVG Illustration */}
          <svg viewBox="0 0 320 260" className="w-full max-w-xs" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Background glow circles */}
            <circle cx="140" cy="140" r="90" fill="#E8F4FF" />
            <circle cx="160" cy="150" r="60" fill="#FFF8E1" opacity="0.8" />

            {/* Dashed orbit */}
            <ellipse cx="148" cy="138" rx="85" ry="60" stroke="#1A6DB5" strokeWidth="1.5" strokeDasharray="6 5" opacity="0.4" />

            {/* Monitor body */}
            <rect x="60" y="80" width="170" height="110" rx="10" fill="#1A2540" />
            <rect x="68" y="88" width="154" height="90" rx="6" fill="#1A6DB5" />

            {/* Screen content — desktop lines */}
            <rect x="80" y="115" width="60" height="6" rx="3" fill="white" opacity="0.4" />
            <rect x="80" y="127" width="40" height="4" rx="2" fill="white" opacity="0.3" />
            <rect x="80" y="137" width="50" height="4" rx="2" fill="white" opacity="0.3" />

            {/* User icon on screen */}
            <circle cx="178" cy="118" r="18" fill="#0F172A" opacity="0.3" />
            <circle cx="178" cy="112" r="9" fill="#F5A800" />
            <path d="M162 134 Q178 124 194 134" stroke="#F5A800" strokeWidth="2" fill="none" />

            {/* Lock badge on user */}
            <circle cx="188" cy="122" r="9" fill="white" />
            <rect x="184" y="123" width="8" height="6" rx="1" fill="#1A6DB5" />
            <path d="M185 123 Q185 119 188 119 Q191 119 191 123" stroke="#1A6DB5" strokeWidth="1.5" fill="none" />

            {/* Monitor stand */}
            <rect x="130" y="190" width="30" height="10" rx="2" fill="#1A2540" />
            <rect x="115" y="199" width="60" height="5" rx="2.5" fill="#2D3748" />

            {/* Monitor green tint bar */}
            <rect x="68" y="162" width="154" height="16" rx="0" fill="#00C7A3" opacity="0.85" />
            <rect x="80" y="166" width="35" height="5" rx="2.5" fill="white" opacity="0.7" />

            {/* Shield (top right of monitor) */}
            <path d="M218 58 L232 64 L232 80 Q232 90 220 96 Q208 90 208 80 L208 64 Z" fill="#7C3AED" />
            <path d="M218 66 L226 70 L226 80 Q226 87 218 91 Q210 87 210 80 L210 70 Z" fill="#8B5CF6" />
            {/* checkmark */}
            <path d="M213 78 L217 82 L224 73" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          <p className="text-center text-[#1A6DB5] font-semibold text-sm mt-3">Secure Admin Access</p>
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px bg-gray-100 my-10" />

        {/* Right panel — form */}
        <div className="flex flex-col justify-center flex-1 px-8 py-10 md:px-12">
          {/* Accent line + title */}
          <div className="w-8 h-0.5 bg-[#1A6DB5] mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-6 font-sora">Login as a Admin User</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="johndoe@xyz.com"
                required
                autoFocus
                autoComplete="username"
                className="w-full h-11 pl-4 pr-11 rounded-full border border-gray-200 bg-gray-50 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#1A6DB5] focus:ring-2 focus:ring-[#1A6DB5]/15 transition"
              />
              <User className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>

            {/* Password */}
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••"
                required
                autoComplete="current-password"
                className="w-full h-11 pl-4 pr-11 rounded-full border border-gray-200 bg-gray-50 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#1A6DB5] focus:ring-2 focus:ring-[#1A6DB5]/15 transition"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                tabIndex={-1}
              >
                <Lock className="h-4 w-4" />
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full h-11 rounded-full bg-[#1A6DB5] hover:bg-[#155ea0] disabled:opacity-50 text-white font-bold text-sm tracking-widest uppercase transition-all shadow-md hover:shadow-lg mt-1 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Login
            </button>
          </form>

          {/* Footer links */}
          <div className="mt-5 text-center">
            <p className="text-xs text-gray-400">Forget your password?</p>
            <p className="text-xs text-[#1A6DB5] font-medium mt-0.5 cursor-pointer hover:underline">
              Contact your system administrator.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <p className="text-[11px] text-gray-300">Terms of use · Privacy policy</p>
          </div>
        </div>
      </div>
    </div>
  );
}
