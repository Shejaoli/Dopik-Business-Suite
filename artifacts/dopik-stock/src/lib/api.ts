const BASE = "/api";

async function req<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.error || j.message || msg; } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => req<T>(path),
  post: <T>(path: string, body?: unknown) =>
    req<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    req<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  del: <T>(path: string) => req<T>(path, { method: "DELETE" }),
};

export function fmtRWF(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "—";
  return n.toLocaleString("en-RW", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " RWF";
}

export function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-RW", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(v: string | null | undefined): string {
  if (!v) return "—";
  return new Date(v).toLocaleString("en-RW", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function paymentBadgeColor(m: string | null | undefined) {
  switch ((m || "").toLowerCase()) {
    case "cash": return "bg-green-100 text-green-800";
    case "bank": return "bg-blue-100 text-blue-800";
    case "mobile_money": return "bg-yellow-100 text-yellow-800";
    case "credit": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-700";
  }
}

export function statusBadgeColor(s: string | null | undefined) {
  switch ((s || "").toLowerCase()) {
    case "paid": return "bg-green-100 text-green-800";
    case "partial": return "bg-yellow-100 text-yellow-800";
    case "unpaid": return "bg-red-100 text-red-800";
    case "in_stock": return "bg-green-100 text-green-800";
    case "low_stock": return "bg-yellow-100 text-yellow-800";
    case "out_of_stock": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-700";
  }
}
