import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import Layout from "@/components/Layout";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import ItemsPage from "@/pages/items";
import ItemHistoryPage from "@/pages/item-history";
import StockPage from "@/pages/stock";
import StockAdjustmentPage from "@/pages/stock-adjustment";
import AdjustmentHistoryPage from "@/pages/adjustment-history";
import StockAlertsPage from "@/pages/stock-alerts";
import PurchasesPage from "@/pages/purchases";
import PurchaseHistoryPage from "@/pages/purchase-history";
import SalesPage from "@/pages/sales";
import MultiSalePage from "@/pages/multi-sale";
import SalesHistoryPage from "@/pages/sales-history";
import VendorsPage from "@/pages/vendors";
import CustomersPage from "@/pages/customers";
import PayablesPage from "@/pages/payables";
import ReceivablesPage from "@/pages/receivables";
import ExpensesPage from "@/pages/expenses";
import ExpenseAccountsPage from "@/pages/expense-accounts";
import ReportsPage from "@/pages/reports";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: unknown) => {
        if (error && typeof error === "object" && "status" in error && (error as { status: number }).status === 401) {
          return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F6FB]">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#1A2540] mx-auto flex items-center justify-center shadow-lg">
            <img src="/dopik-logo-transparent.png" alt="DE" className="w-9 h-9 object-contain" />
          </div>
          <p className="text-sm text-gray-400 animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/items" component={ItemsPage} />
        <Route path="/item-history" component={ItemHistoryPage} />
        <Route path="/stock" component={StockPage} />
        <Route path="/stock-adjustment" component={StockAdjustmentPage} />
        <Route path="/adjustment-history" component={AdjustmentHistoryPage} />
        <Route path="/stock-alerts" component={StockAlertsPage} />
        <Route path="/purchases" component={PurchasesPage} />
        <Route path="/purchase-history" component={PurchaseHistoryPage} />
        <Route path="/sales" component={SalesPage} />
        <Route path="/multi-sale" component={MultiSalePage} />
        <Route path="/sales-history" component={SalesHistoryPage} />
        <Route path="/vendors" component={VendorsPage} />
        <Route path="/customers" component={CustomersPage} />
        <Route path="/payables" component={PayablesPage} />
        <Route path="/receivables" component={ReceivablesPage} />
        <Route path="/expenses" component={ExpensesPage} />
        <Route path="/expense-accounts" component={ExpenseAccountsPage} />
        <Route path="/reports/sales"><ReportsPage defaultTab="sales" /></Route>
        <Route path="/reports/purchases"><ReportsPage defaultTab="purchases" /></Route>
        <Route path="/reports/expenses"><ReportsPage defaultTab="expenses" /></Route>
        <Route path="/reports/summary"><ReportsPage defaultTab="summary" /></Route>
        <Route path="/reports"><ReportsPage /></Route>
        <Route path="/settings" component={SettingsPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
