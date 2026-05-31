import { useState, useEffect } from "react";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "pwa-prompt-dismissed-at";
const DISMISS_DAYS = 7;

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const dismissedAt = parseInt(dismissed);
      const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
      if (daysSince < DISMISS_DAYS) return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setShow(false);
    setDeferredPrompt(null);
  };

  if (!show) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-[#1A6DB5] text-white px-4 py-2.5 flex items-center gap-3 shadow-lg">
      <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
        <span className="text-white text-sm font-black">D</span>
      </div>
      <p className="flex-1 text-sm font-medium">Install Dopik Electronics app for faster access</p>
      <Button
        size="sm"
        onClick={install}
        className="bg-white text-[#1A6DB5] hover:bg-white/90 h-7 text-xs gap-1.5 font-semibold flex-shrink-0"
      >
        <Download className="w-3.5 h-3.5" /> Install
      </Button>
      <button onClick={dismiss} className="text-white/70 hover:text-white flex-shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
