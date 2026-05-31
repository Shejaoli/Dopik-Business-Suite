import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import {
  Package, History, Archive, SlidersHorizontal, RotateCcw, AlertTriangle,
  ShoppingCart, ShoppingBag, Tag, PackagePlus, Scale,
  Building2, Users, CreditCard, Wallet, HandCoins,
  Receipt, BookOpen,
  BarChart2,
  LayoutDashboard, Settings, LogOut, Menu, X, Bell,
  UserCog, FileText, Landmark, Wrench, Shield
} from "lucide-react";
import { cn } from "@/lib/utils";

type Role = "owner" | "manager" | "cashier" | "stock_manager" | "admin";

type NavItem = {
  href: string;
  label: string;
  icon: React.FC<any>;
  minRole?: Role[]; // if set, only these roles can see it
};

type NavSection = {
  label: string;
  items: NavItem[];
  minRole?: Role[]; // if set, whole section restricted
};

const navSections: NavSection[] = [
  {
    label: "INVENTORY",
    items: [
      { href: "/items", label: "Items", icon: Package },
      { href: "/item-history", label: "Item History", icon: History },
      { href: "/stock", label: "Stock", icon: Archive },
      { href: "/stock-adjustment", label: "Stock Adjustment", icon: SlidersHorizontal },
      { href: "/adjustment-history", label: "Adjustment History", icon: RotateCcw },
      { href: "/stock-alerts", label: "Stock Alerts", icon: AlertTriangle },
    ],
  },
  {
    label: "TRANSACTIONS",
    items: [
      { href: "/purchases", label: "New Purchase", icon: ShoppingCart, minRole: ["owner", "manager", "admin"] },
      { href: "/purchase-history", label: "Purchase History", icon: ShoppingBag, minRole: ["owner", "manager", "admin", "stock_manager"] },
      { href: "/sales", label: "New Sale", icon: Tag },
      { href: "/multi-sale", label: "Multi-Item Sale", icon: PackagePlus },
      { href: "/sales-history", label: "Sales History", icon: Scale },
    ],
  },
  {
    label: "PAYABLES & RECEIVABLES",
    items: [
      { href: "/vendors", label: "Vendors", icon: Building2, minRole: ["owner", "manager", "admin"] },
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/payables", label: "Payables", icon: CreditCard, minRole: ["owner", "manager", "admin"] },
      { href: "/receivables", label: "Receivables", icon: Wallet, minRole: ["owner", "manager", "admin"] },
    ],
  },
  {
    label: "LOANS",
    items: [
      { href: "/loans", label: "Loans", icon: HandCoins, minRole: ["owner", "manager", "admin"] },
    ],
  },
  {
    label: "ACCOUNTING",
    items: [
      { href: "/balances", label: "Balances", icon: Wallet, minRole: ["owner", "manager", "admin"] },
      { href: "/expenses", label: "Pay Expense", icon: Receipt, minRole: ["owner", "manager", "admin"] },
      { href: "/expense-accounts", label: "Expense Accounts", icon: BookOpen, minRole: ["owner", "manager", "admin"] },
    ],
  },
  {
    label: "REPAIRS",
    items: [
      { href: "/repairs", label: "Repairs", icon: Wrench },
    ],
  },
  {
    label: "CREDIT",
    items: [
      { href: "/credit", label: "Credit Accounts", icon: Landmark, minRole: ["owner", "manager", "admin"] },
      { href: "/receipts", label: "Receipts", icon: FileText },
    ],
  },
  {
    label: "ANALYTICS",
    items: [
      { href: "/charts", label: "Charts & Analytics", icon: BarChart2, minRole: ["owner", "manager", "admin"] },
    ],
  },
  {
    label: "REPORTS",
    minRole: ["owner", "manager", "admin"],
    items: [
      { href: "/reports/sales", label: "Sales Report", icon: BarChart2 },
      { href: "/reports/purchases", label: "Purchase Report", icon: BarChart2 },
      { href: "/reports/expenses", label: "Expense Report", icon: BarChart2 },
      { href: "/reports/summary", label: "Summary Report", icon: BarChart2 },
    ],
  },
  {
    label: "ADMIN",
    minRole: ["owner", "manager", "admin"],
    items: [
      { href: "/staff", label: "Staff & Permissions", icon: UserCog },
    ],
  },
];

function canSeeItem(role: string | undefined, minRole?: Role[]): boolean {
  if (!minRole) return true;
  if (!role) return false;
  return minRole.includes(role as Role);
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location === href || location.startsWith(href + "/");
  };

  const userRole = user?.role;
  const canSeeSettings = canSeeItem(userRole, ["owner", "manager", "admin"]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F6FB]">
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-60 bg-[#0F1A2E] flex flex-col transition-transform duration-300",
          "lg:relative lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10 flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-[#1A2540] flex items-center justify-center flex-shrink-0 ring-2 ring-white/10">
            <img src="/dopik-logo-transparent.png" alt="DE" className="w-7 h-7 object-contain" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight truncate">Dopik Electronics</p>
            <p className="text-white/40 text-[10px] truncate">Stock Management</p>
          </div>
          <button className="ml-auto lg:hidden text-white/40 hover:text-white" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Dashboard shortcut */}
        <div className="px-3 pt-3 pb-1 flex-shrink-0">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all",
              isActive("/") && location === "/"
                ? "bg-[#1A6DB5]/20 text-white border-l-2 border-[#F5A800]"
                : "text-white/60 hover:text-white hover:bg-white/8"
            )}
          >
            <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
            <span>Dashboard</span>
          </Link>
        </div>

        {/* Nav sections */}
        <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-0">
          {navSections.map((section, si) => {
            if (!canSeeItem(userRole, section.minRole)) return null;
            const visibleItems = section.items.filter(item => canSeeItem(userRole, item.minRole));
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.label}>
                {/* Divider + section label */}
                <div className={cn("pt-4 pb-1", si === 0 ? "pt-3" : "")}>
                  <div className="border-t border-white/10 mb-3" />
                  <p className="text-[10px] font-bold tracking-widest text-white/35 uppercase px-3 mb-1">
                    {section.label}
                  </p>
                </div>
                {/* Items */}
                <div className="space-y-0.5">
                  {visibleItems.map(({ href, label, icon: Icon }) => {
                    const active = isActive(href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all",
                          active
                            ? "bg-[#1A6DB5]/20 text-white border-l-2 border-[#F5A800] font-medium"
                            : "text-white/55 hover:text-white hover:bg-white/8 border-l-2 border-transparent"
                        )}
                      >
                        <Icon className={cn("h-4 w-4 flex-shrink-0", active ? "text-[#F5A800]" : "text-white/50")} />
                        <span className="truncate">{label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Settings — owner/manager/admin only */}
          {canSeeSettings && (
            <div className="pt-4">
              <div className="border-t border-white/10 mb-3" />
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all",
                  isActive("/settings")
                    ? "bg-[#1A6DB5]/20 text-white border-l-2 border-[#F5A800] font-medium"
                    : "text-white/55 hover:text-white hover:bg-white/8 border-l-2 border-transparent"
                )}
              >
                <Settings className={cn("h-4 w-4 flex-shrink-0", isActive("/settings") ? "text-[#F5A800]" : "text-white/50")} />
                <span>Settings</span>
              </Link>
            </div>
          )}
        </nav>

        {/* User footer */}
        <div className="px-4 py-3 border-t border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#1A6DB5] to-[#F5A800] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">{(user?.name || "A")[0].toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{user?.name}</p>
              <p className="text-white/35 text-[10px] truncate capitalize">{user?.role}</p>
            </div>
            <button onClick={logout} className="text-white/35 hover:text-red-400 transition-colors" title="Logout">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Topbar */}
        <header className="h-13 flex items-center justify-between px-4 lg:px-6 bg-white shadow-sm border-b border-gray-100 flex-shrink-0">
          <button className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 relative">
              <Bell className="h-4 w-4" />
            </button>
            <Link href="/profile" className="hidden sm:flex items-center gap-2 hover:opacity-80 transition">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#1A6DB5] to-[#F5A800] flex items-center justify-center">
                <span className="text-white text-xs font-bold">{(user?.name || "A")[0].toUpperCase()}</span>
              </div>
              <span className="text-sm font-medium text-gray-700">{user?.name}</span>
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
