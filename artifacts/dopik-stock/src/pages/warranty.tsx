import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, AlertCircle, Search, Shield } from "lucide-react";

type WarrantyResult = {
  found: boolean;
  imeiOrSerial?: string;
  productName?: string;
  category?: string;
  color?: string;
  storage?: string;
  condition?: string;
  purchaseDate?: string;
  warrantyMonths?: number;
  expiryDate?: string;
  daysRemaining?: number;
  warrantyStatus?: "active" | "expired" | "unknown";
  store?: { name: string; address: string; phone: string; email: string };
};

export default function WarrantyPage() {
  const [imei, setImei] = useState("");
  const [result, setResult] = useState<WarrantyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imei.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`/api/public/warranty/${encodeURIComponent(imei.trim())}`);
      if (res.status === 429) { setError("Too many requests. Please wait a moment."); return; }
      if (!res.ok) { setError("Error checking warranty. Please try again."); return; }
      const data = await res.json();
      setResult(data);
    } catch {
      setError("Network error. Please check your connection.");
    } finally { setLoading(false); }
  };

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString("en-RW", { day: "2-digit", month: "long", year: "numeric" }) : "—";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F1A2E] via-[#1A2540] to-[#0F1A2E] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#1A6DB5] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#1A6DB5]/30">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Dopik Electronics</h1>
          <p className="text-white/60 text-sm mt-1">Kigali, Rwanda</p>
        </div>

        {/* Check card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <h2 className="text-xl font-bold text-[#0F1A2E] text-center mb-1">Check Your Warranty</h2>
          <p className="text-sm text-gray-500 text-center mb-6">Enter your IMEI or Serial Number to check warranty status</p>

          <form onSubmit={check} className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={imei}
                onChange={e => setImei(e.target.value)}
                placeholder="Enter IMEI or Serial Number"
                className="pl-10 h-12 text-base"
                autoFocus
              />
            </div>
            <Button type="submit" disabled={loading || !imei.trim()} className="w-full h-12 bg-[#1A6DB5] hover:bg-[#155a96] text-base font-semibold">
              {loading ? "Checking..." : "Check Warranty"}
            </Button>
          </form>

          {error && (
            <div className="mt-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          {result && !result.found && (
            <div className="mt-6 text-center">
              <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-2" />
              <p className="font-semibold text-gray-700">Not Found</p>
              <p className="text-sm text-gray-500 mt-1">No device found with IMEI/Serial: <strong>{imei}</strong></p>
              <p className="text-xs text-gray-400 mt-2">Please check the number and try again, or contact our store.</p>
            </div>
          )}

          {result && result.found && (
            <div className="mt-6 space-y-4">
              {/* Status */}
              <div className={`rounded-xl p-4 text-center ${
                result.warrantyStatus === "active" ? "bg-green-50 border border-green-200" :
                result.warrantyStatus === "expired" ? "bg-red-50 border border-red-200" :
                "bg-gray-50 border border-gray-200"
              }`}>
                {result.warrantyStatus === "active" ? (
                  <>
                    <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-1" />
                    <p className="font-bold text-green-700 text-lg">Warranty Active</p>
                    <p className="text-sm text-green-600">{result.daysRemaining} days remaining</p>
                  </>
                ) : result.warrantyStatus === "expired" ? (
                  <>
                    <XCircle className="w-10 h-10 text-red-500 mx-auto mb-1" />
                    <p className="font-bold text-red-700 text-lg">Warranty Expired</p>
                    <p className="text-sm text-red-600">{Math.abs(result.daysRemaining!)} days ago</p>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-10 h-10 text-gray-400 mx-auto mb-1" />
                    <p className="font-bold text-gray-600 text-lg">Status Unknown</p>
                  </>
                )}
              </div>

              {/* Details */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Product</span>
                  <span className="font-semibold text-right">{result.productName || "—"}</span>
                </div>
                {result.color && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">Color</span>
                    <span className="font-medium">{result.color}</span>
                  </div>
                )}
                {result.storage && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">Storage</span>
                    <span className="font-medium">{result.storage}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">IMEI / Serial</span>
                  <span className="font-mono text-xs font-medium">{result.imeiOrSerial}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Purchase Date</span>
                  <span className="font-medium">{fmtDate(result.purchaseDate)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Warranty Period</span>
                  <span className="font-medium">{result.warrantyMonths} months</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-500">Expiry Date</span>
                  <span className="font-medium">{fmtDate(result.expiryDate)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 space-y-1">
          <p className="text-white/60 text-sm">For warranty claims or support, contact us:</p>
          <p className="text-white font-medium">+250 788 000 000</p>
          <p className="text-white/40 text-xs">info@dopikelectronics.com</p>
        </div>
      </div>
    </div>
  );
}
