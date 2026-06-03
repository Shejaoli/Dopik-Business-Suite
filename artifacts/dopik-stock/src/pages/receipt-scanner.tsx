import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, fmtRWF } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScanLine, Camera, Upload, AlertCircle, CheckCircle, Loader2, X } from "lucide-react";

interface ScannedItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ReceiptScannerPage() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [scannedItems, setScannedItems] = useState<ScannedItem[] | null>(null);
  const [missingKey, setMissingKey] = useState(false);

  const scanMut = useMutation({
    mutationFn: async (file: File) => {
      const imageBase64 = await fileToBase64(file);
      return api.post("/receipt-scanner/scan", { imageBase64, mimeType: file.type || "image/jpeg" });
    },
    onSuccess: (data: any) => {
      if (data.missing_key) {
        setMissingKey(true);
        return;
      }
      setScannedItems(data.items || []);
      if ((data.items || []).length === 0) {
        toast({ title: "No items found", description: "Could not extract items from this image. Try a clearer photo." });
      }
    },
    onError: (e: any) => {
      if (e.missing_key) { setMissingKey(true); return; }
      toast({ title: "Scan failed", description: e.message, variant: "destructive" });
    },
  });

  const handleFile = (file: File) => {
    setSelectedFile(file);
    setScannedItems(null);
    setMissingKey(false);
    const url = URL.createObjectURL(file);
    setPreview(url);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFile(file);
  };

  const reset = () => {
    setPreview(null);
    setSelectedFile(null);
    setScannedItems(null);
    setMissingKey(false);
  };

  const total = scannedItems?.reduce((s, i) => s + (i.total || 0), 0) ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold font-sora flex items-center gap-2">
          <ScanLine className="h-6 w-6 text-[#1A6DB5]" />
          Camera Receipt Scanner
        </h1>
        <p className="text-sm text-muted-foreground">Take a photo of a receipt or invoice to automatically extract item data using AI</p>
      </div>

      {missingKey && (
        <div className="glass-panel p-5 border-l-4 border-amber-400 bg-amber-50">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">AI API Key Required</p>
              <p className="text-sm text-amber-700 mt-1">
                The receipt scanner requires an <strong>ANTHROPIC_API_KEY</strong> environment secret.
                Ask your administrator to add it in the Replit environment secrets panel.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Upload area */}
        <div className="glass-panel p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Upload className="h-4 w-4" /> Upload Receipt Image
          </h2>

          {!preview ? (
            <div
              className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center cursor-pointer hover:border-[#1A6DB5] transition-colors"
              onClick={() => fileRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
            >
              <Camera className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-600">Drop receipt image here</p>
              <p className="text-xs text-gray-400 mt-1">or click to browse · JPG, PNG, WebP</p>
              <Button size="sm" className="mt-4 bg-[#1A6DB5] hover:bg-[#1559a0]">
                Choose File
              </Button>
            </div>
          ) : (
            <div className="relative">
              <img src={preview} alt="Receipt" className="w-full max-h-72 object-contain rounded-lg border border-gray-100" />
              <button
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                onClick={reset}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept="image/*"
            capture="environment"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />

          {selectedFile && (
            <Button
              className="w-full bg-[#1A6DB5] hover:bg-[#1559a0]"
              onClick={() => scanMut.mutate(selectedFile!)}
              disabled={scanMut.isPending}
            >
              {scanMut.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Scanning receipt...</>
              ) : (
                <><ScanLine className="h-4 w-4 mr-2" /> Scan Receipt</>
              )}
            </Button>
          )}
        </div>

        {/* Results */}
        <div className="glass-panel p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" /> Extracted Items
          </h2>

          {scannedItems === null ? (
            <div className="flex flex-col items-center justify-center h-52 text-center">
              <ScanLine className="h-12 w-12 text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">Upload and scan a receipt to extract item data</p>
            </div>
          ) : scannedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-52 text-center">
              <AlertCircle className="h-10 w-10 text-amber-300 mb-3" />
              <p className="text-sm text-gray-500 font-medium">No items found</p>
              <p className="text-xs text-gray-400 mt-1">Try a clearer photo with better lighting</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {scannedItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900">{item.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge className="text-xs px-1.5 py-0 bg-blue-50 text-blue-700">{item.category}</Badge>
                        <span className="text-xs text-gray-400">
                          {item.quantity} × {fmtRWF(item.unitPrice)}
                        </span>
                      </div>
                    </div>
                    <p className="font-semibold text-gray-900 text-sm">{fmtRWF(item.total)}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                <span className="text-sm text-gray-500">{scannedItems.length} items extracted</span>
                <span className="font-bold text-gray-900">{fmtRWF(total)}</span>
              </div>
              <p className="text-xs text-gray-400 text-center">
                Review the data before adding to inventory. AI extraction may not be 100% accurate.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
