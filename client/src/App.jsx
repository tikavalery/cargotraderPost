import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ProtectedRoute, AuthRoute, PermissionRoute, PermissionAnyRoute } from './components/ProtectedRoute';
import ClerkHomeRedirect from './components/ClerkHomeRedirect';
import RegisterPage from './views/auth/RegisterPage';
import LoginPage from './views/auth/LoginPage';
import DashboardPage from './views/DashboardPage';
import IndividualItemsPage from './views/inventory/IndividualItemsPage';
import InventoryActivityLogPage from './views/inventory/InventoryActivityLogPage';
import NewPurchasePage from './views/purchasing/NewPurchasePage';
import BulkNewPurchasePage from './views/purchasing/BulkNewPurchasePage';
import AllPurchasesPage from './views/purchasing/AllPurchasesPage';
import SuppliersPage from './views/purchasing/SuppliersPage';
import QuickStatsPage from './views/purchasing/QuickStatsPage';
import WarehousesPage from './views/warehouses/WarehousesPage';
import WarehouseQuickStatsPage from './views/warehouses/WarehouseQuickStatsPage';
import ActiveShipmentsPage from './views/shipping/ActiveShipmentsPage';
import CompletedShipmentsPage from './views/shipping/CompletedShipmentsPage';
import ShippingDocumentsPage from './views/shipping/DocumentsPage';
import PosTerminalPage from './views/stores/PosTerminalPage';
import TransactionsPage from './views/stores/TransactionsPage';
import StoreInventoryPage from './views/stores/StoreInventoryPage';
import StoresPage from './views/stores/StoresPage';
import StoresQuickStatsPage from './views/stores/StoresQuickStatsPage';
import { PosStoreProvider } from './context/PosStoreContext';
import FinanceDashboardPage from './views/finance/FinanceDashboardPage';
import RevenuePage from './views/finance/RevenuePage';
import ExpensesPage from './views/finance/ExpensesPage';
import CashFlowPage from './views/finance/CashFlowPage';
import ProfitLossPage from './views/finance/ProfitLossPage';
import FinanceRoutes from './views/finance/FinanceRoutes';
import SettingsLayout from './views/settings/SettingsLayout';
import UsersStaffPage from './views/settings/UsersStaffPage';
import ProfileSettingsPage from './views/settings/ProfileSettingsPage';
import SettingsIndexRedirect from './views/settings/SettingsIndexRedirect';
import AcceptInvitePage from './views/auth/AcceptInvitePage';
import ForgotPasswordPage from './views/auth/ForgotPasswordPage';
import ResetPasswordPage from './views/auth/ResetPasswordPage';
import PricingPlansPage from './views/pricing/PricingPlansPage';
import PlanGate from './components/plan/PlanGate';
import TermsOfServicePage from './views/legal/TermsOfServicePage';
import PrivacyPolicyPage from './views/legal/PrivacyPolicyPage';
import ContactSupportPage from './views/legal/ContactSupportPage';

export default function App() {
  return (
    <Routes>
      <Route path="/terms" element={<TermsOfServicePage />} />
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/contact" element={<ContactSupportPage />} />
      <Route element={<AuthRoute />}>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        <Route path="/invite/:token" element={<AcceptInvitePage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<ClerkHomeRedirect><DashboardPage /></ClerkHomeRedirect>} />
        <Route path="/inventory/items" element={<IndividualItemsPage />} />
        <Route path="/inventory/activity-log" element={<InventoryActivityLogPage />} />
        <Route path="/inventory/quick-stats" element={<Navigate to="/inventory/items" replace />} />
        <Route path="/inventory/individual-items" element={<Navigate to="/inventory/items" replace />} />
        <Route path="/inventory/grouped-items" element={<Navigate to="/inventory/items" replace />} />
        <Route path="/inventory/grouped" element={<Navigate to="/inventory/items" replace />} />
        <Route path="/inventory/total" element={<Navigate to="/inventory/items" replace />} />
        <Route path="/inventory/returns" element={<Navigate to="/inventory/items" replace />} />
        <Route path="/pricing" element={<PricingPlansPage />} />
        <Route element={<PlanGate feature="purchases" />}>
        <Route element={<PermissionRoute permission="managePurchases" />}>
          <Route path="/purchasing/new" element={<NewPurchasePage />} />
          <Route path="/purchasing/bulk-new" element={<BulkNewPurchasePage />} />
          <Route path="/purchasing/restock" element={<Navigate to="/purchasing/new" replace />} />
        </Route>
        <Route element={<PermissionRoute permission="viewPurchases" redirectTo="/dashboard" />}>
          <Route path="/purchasing/all" element={<AllPurchasesPage />} />
          <Route path="/purchasing/suppliers" element={<SuppliersPage />} />
          <Route path="/purchasing/quick-stats" element={<QuickStatsPage />} />
        </Route>
        </Route>
        <Route element={<PermissionAnyRoute permissions={['manageInventory', 'viewWarehouses']} redirectTo="/dashboard" />}>
          <Route path="/warehouses" element={<WarehousesPage />} />
        </Route>
        <Route element={<PermissionRoute permission="manageWarehouses" redirectTo="/warehouses" />}>
          <Route path="/warehouses/quick-stats" element={<WarehouseQuickStatsPage />} />
        </Route>
        <Route element={<PlanGate feature="shipping" />}>
        <Route element={<PermissionRoute permission="viewShipments" redirectTo="/dashboard" />}>
          <Route path="/shipping" element={<ActiveShipmentsPage />} />
          <Route path="/shipping/completed" element={<CompletedShipmentsPage />} />
          <Route path="/shipping/documents" element={<ShippingDocumentsPage />} />
          <Route path="/shipping/quick-stats" element={<Navigate to="/shipping" replace />} />
        </Route>
        </Route>
        <Route element={<PlanGate feature="pos" />}>
        <Route
          element={
            <PosStoreProvider>
              <Outlet />
            </PosStoreProvider>
          }
        >
          <Route element={<PermissionRoute permission="viewStores" redirectTo="/inventory/items" />}>
            <Route path="/stores" element={<StoresPage />} />
            <Route path="/stores/inventory" element={<StoreInventoryPage />} />
            <Route path="/stores/transactions" element={<TransactionsPage />} />
            <Route path="/stores/quick-stats" element={<StoresQuickStatsPage />} />
          </Route>
          <Route element={<PermissionRoute permission="manageSales" redirectTo="/stores" />}>
            <Route path="/stores/pos" element={<PosTerminalPage />} />
          </Route>
          <Route path="/stores/returns" element={<Navigate to="/stores/transactions" replace />} />
          <Route path="/stores/audit-log" element={<Navigate to="/stores/transactions" replace />} />
        </Route>
        </Route>
        <Route element={<PermissionRoute permission="viewFinance" />}>
          <Route element={<FinanceRoutes />}>
            <Route path="/finance" element={<FinanceDashboardPage />} />
            <Route path="/finance/revenue" element={<RevenuePage />} />
            <Route path="/finance/expenses" element={<ExpensesPage />} />
            <Route path="/finance/cash-flow" element={<CashFlowPage />} />
            <Route path="/finance/profit-loss" element={<ProfitLossPage />} />
          </Route>
        </Route>
        <Route element={<PermissionRoute permission="viewSettings" redirectTo="/dashboard" />}>
          <Route path="/settings" element={<SettingsLayout />}>
            <Route index element={<SettingsIndexRedirect />} />
            <Route element={<PermissionRoute permission="manageUsers" redirectTo="/settings/profile" />}>
              <Route path="users" element={<UsersStaffPage />} />
            </Route>
            <Route path="profile" element={<ProfileSettingsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
