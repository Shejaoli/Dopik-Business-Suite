import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useFeatureFlags, type FeatureFlags } from "@/lib/use-feature-flags";
import {
  Package, History, Archive, SlidersHorizontal, RotateCcw, AlertTriangle,
  ShoppingCart, ShoppingBag, Scale,
  Building2, Users, CreditCard, Wallet, HandCoins,
  Receipt, BookOpen,
  BarChart2,
  LayoutDashboard, Settings, LogOut, Menu, X,
  UserCog, FileText, Landmark, Wrench,
  Brain, ClipboardList, ScanLine, Megaphone, Activity,
  ArrowLeftRight, ChevronDown, ChevronRight
} from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { cn } from "@/lib/utils";

type Role = "owner" | "manager" | "cashier" | "stock_manager" | "admin";

type NavItem = {
  href: string;
  label: string;
  icon: React.FC<any>;
  minRole?: Role[];
  flagKey?: keyof FeatureFlags;
};

type NavSection = {
  label: string;
  icon: React.FC<any>;
  items: NavItem[];
  minRole?: Role[];
  flagKey?: keyof FeatureFlags;
};

const navSections: NavSection[] = [
  {
    label: "Inventory",
    icon: Archive,
    items: [
      { href: "/items", label: "Items", icon: Package, flagKey: "showItemsPage" },
      { href: "/item-history", label: "Item History", icon: History },
      { href: "/stock", label: "Stock", icon: Archive },
      { href: "/stock-adjustment", label: "Stock Adjustment", icon: SlidersHorizontal },
      { href: "/adjustment-history", label: "Adjustment History", icon: RotateCcw },
      { href: "/stock-alerts", label: "Stock Alerts", icon: AlertTriangle },
      { href: "/stock-count", label: "Stock Count", icon: ClipboardList, minRole: ["owner", "manager", "admin"], flagKey: "stockCount" },
    ],
  },
  {
    label: "Transactions",
    icon: ShoppingBag,
    items: [
      { href: "/purchases", label: "New Purchase", icon: ShoppingCart, minRole: ["owner", "manager", "admin"] },
      { href: "/purchase-history", label: "Purchase History", icon: ShoppingBag, minRole: ["owner", "manager", "admin", "stock_manager"] },
      { href: "/multi-sale", label: "New Sale", icon: ShoppingCart },
      { href: "/sales-history", label: "Sales History", icon: Scale },
      { href: "/consignment", label: "Consignment", icon: ArrowLeftRight, minRole: ["owner", "manager", "admin"], flagKey: "consignment" },
    ],
  },
  {
    label: "Contacts",
    icon: Users,
    flagKey: "customerCRM",
    items: [
      { href: "/vendors", label: "Vendors", icon: Building2, minRole: ["owner", "manager", "admin"] },
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/payables", label: "Payables", icon: CreditCard, minRole: ["owner", "manager", "admin"] },
      { href: "/receivables", label: "Receivables", icon: Wallet, minRole: ["owner", "manager", "admin"] },
    ],
  },
  {
    label: "Loans",
    icon: HandCoins,
    flagKey: "loans",
    items: [
      { href: "/loans", label: "Loans", icon: HandCoins, minRole: ["owner", "manager", "admin"] },
    ],
  },
  {
    label: "Accounting",
    icon: Wallet,
    flagKey: "expenseTracking",
    items: [
      { href: "/balances", label: "Balances", icon: Wallet, minRole: ["owner", "manager", "admin"] },
      { href: "/expenses", label: "Pay Expense", icon: Receipt, minRole: ["owner", "manager", "admin"] },
      { href: "/expense-accounts", label: "Expense Accounts", icon: BookOpen, minRole: ["owner", "manager", "admin"] },
    ],
  },
  {
    label: "Repairs",
    icon: Wrench,
    flagKey: "repairTracking",
    items: [
      { href: "/repairs", label: "Repairs", icon: Wrench },
    ],
  },
  {
    label: "Credit",
    icon: Landmark,
    flagKey: "creditInstallments",
    items: [
      { href: "/credit", label: "Credit Accounts", icon: Landmark, minRole: ["owner", "manager", "admin"] },
      { href: "/receipts", label: "Receipts", icon: FileText },
    ],
  },
  {
    label: "Analytics",
    icon: BarChart2,
    flagKey: "chartsAnalytics",
    items: [
      { href: "/charts", label: "Charts & Analytics", icon: BarChart2, minRole: ["owner", "manager", "admin"] },
      { href: "/restock-intelligence", label: "Restock Intelligence", icon: Brain, minRole: ["owner", "manager", "admin", "stock_manager"], flagKey: "restockIntelligence" },
      { href: "/usage-analytics", label: "Usage Analytics", icon: Activity, minRole: ["owner", "admin"], flagKey: "usageAnalytics" },
    ],
  },
  {
    label: "Reports",
    icon: BarChart2,
    minRole: ["owner", "manager", "admin"],
    flagKey: "reports",
    items: [
      { href: "/reports/sales", label: "Sales Report", icon: BarChart2 },
      { href: "/reports/purchases", label: "Purchase Report", icon: BarChart2 },
      { href: "/reports/expenses", label: "Expense Report", icon: BarChart2 },
      { href: "/reports/summary", label: "Summary Report", icon: BarChart2 },
    ],
  },
  {
    label: "Tools",
    icon: ScanLine,
    items: [
      { href: "/announcements", label: "Announcements", icon: Megaphone, flagKey: "announcements" },
      { href: "/receipt-scanner", label: "Receipt Scanner", icon: ScanLine, flagKey: "receiptScanner" },
    ],
  },
  {
    label: "Admin",
    icon: UserCog,
    minRole: ["owner", "manager", "admin"],
    flagKey: "staffPermissions",
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
  const { flags } = useFeatureFlags();

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location === href || location.startsWith(href + "/");
  };

  const isSectionActive = (section: NavSection) =>
    section.items.some(item => isActive(item.href));

  // Which sections start expanded: the one containing the active route, plus all others default open
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    navSections.forEach(s => {
      init[s.label] = true;
    });
    return init;
  });

  // When route changes, ensure the section containing the active item is expanded
  useEffect(() => {
    navSections.forEach(s => {
      if (isSectionActive(s)) {
        setExpandedSections(prev => ({ ...prev, [s.label]: true }));
      }
    });
  }, [location]);

  const toggleSection = (label: string) => {
    setExpandedSections(prev => ({ ...prev, [label]: !prev[label] }));
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
          {navSections.map((section) => {
            if (!canSeeItem(userRole, section.minRole)) return null;
            if (section.flagKey && !flags[section.flagKey]) return null;

            const visibleItems = section.items.filter(item =>
              canSeeItem(userRole, item.minRole) &&
              (!item.flagKey || flags[item.flagKey])
            );
            if (visibleItems.length === 0) return null;

            const expanded = expandedSections[section.label] ?? true;
            const active = isSectionActive(section);
            const SectionIcon = section.icon;

            return (
              <div key={section.label} className="mt-1">
                {/* Section header — clickable */}
                <button
                  type="button"
                  onClick={() => toggleSection(section.label)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all",
                    active
                      ? "text-white bg-white/5"
                      : "text-white/50 hover:text-white/80 hover:bg-white/5"
                  )}
                >
                  <SectionIcon className={cn("h-4 w-4 flex-shrink-0", active ? "text-[#F5A800]" : "text-white/40")} />
                  <span className="flex-1 text-left font-semibold tracking-wide text-[11px] uppercase">
                    {section.label}
                  </span>
                  {expanded
                    ? <ChevronDown className="h-3.5 w-3.5 text-white/30" />
                    : <ChevronRight className="h-3.5 w-3.5 text-white/30" />
                  }
                </button>

                {/* Sub-items */}
                {expanded && (
                  <div className="ml-3 pl-2 border-l border-white/10 space-y-0.5 mt-0.5 mb-1">
                    {visibleItems.map(({ href, label, icon: Icon }) => {
                      const itemActive = isActive(href);
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[12.5px] transition-all",
                            itemActive
                              ? "bg-[#1A6DB5]/25 text-white border-l-2 border-[#F5A800] font-medium -ml-px pl-2"
                              : "text-white/50 hover:text-white hover:bg-white/8 border-l-2 border-transparent -ml-px pl-2"
                          )}
                        >
                          <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", itemActive ? "text-[#F5A800]" : "text-white/40")} />
                          <span className="truncate">{label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Settings — owner/manager/admin only */}
          {canSeeSettings && (
            <div className="mt-2">
              <div className="border-t border-white/10 mb-2" />
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
            <NotificationBell />
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
