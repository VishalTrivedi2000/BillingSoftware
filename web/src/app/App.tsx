import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ReportsLayout } from '../features/reports/ReportsLayout';
import { SaleInvoicesReportPage } from '../features/reports/SaleInvoicesReportPage';
import { PurchaseBillsReportPage } from '../features/reports/PurchaseBillsReportPage';
import { MergedLedgerReportPage } from '../features/reports/MergedLedgerReportPage';
import { ReportPlaceholderPage } from '../features/reports/ReportPlaceholderPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { LoginPage } from '../features/auth/LoginPage';
import { LandingPage } from '../features/landing/LandingPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { SalesHubPage } from '../features/sales/SalesHubPage';
import { InvoiceComposerIndexRedirect } from '../features/invoices/InvoiceComposerIndexRedirect';
import { InvoiceComposerLayout } from '../features/invoices/InvoiceComposerLayout';
import { InvoiceCreatePage } from '../features/invoices/InvoiceCreatePage';
import { InvoiceDetailPage } from '../features/invoices/InvoiceDetailPage';
import { InvoicesListPage } from '../features/invoices/InvoicesListPage';
import { CustomersPage } from '../features/customers/CustomersPage';
import { PartiesPage } from '../features/parties/PartiesPage';
import { ProductsPage } from '../features/products/ProductsPage';
import { PurchaseComposerIndexRedirect } from '../features/purchases/PurchaseComposerIndexRedirect';
import { PurchaseComposerLayout } from '../features/purchases/PurchaseComposerLayout';
import { PurchaseCreatePage } from '../features/purchases/PurchaseCreatePage';
import { PurchaseDraftRedirect } from '../features/purchases/PurchaseDraftRedirect';
import { PurchaseDetailPage } from '../features/purchases/PurchaseDetailPage';
import { PurchasePrintStudioPage } from '../features/purchases/PurchasePrintStudioPage';
import { PurchasesListPage } from '../features/purchases/PurchasesListPage';
import { PermissionsCatalogPage } from '../features/rbac/PermissionsCatalogPage';
import { RoleDetailPage } from '../features/rbac/RoleDetailPage';
import { RolesListPage } from '../features/rbac/RolesListPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { AppLayout } from '../shared/layout/AppLayout';
import { RequireAuth } from '../shared/auth/RequireAuth';
import { RequirePermission } from '../shared/auth/RequirePermission';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/reports" element={<ReportsLayout />}>
            <Route index element={<Navigate to="sale-invoices" replace />} />
            <Route path="sale-invoices" element={<SaleInvoicesReportPage />} />
            <Route path="purchase-bills" element={<PurchaseBillsReportPage />} />
            <Route
              path="day-book"
              element={
                <MergedLedgerReportPage headline="Day book" sub="Chronological movement — sales by invoice issue date and purchases by bill received date." />
              }
            />
            <Route
              path="all-transactions"
              element={
                <MergedLedgerReportPage
                  headline="All transactions"
                  sub="Combined ledger across invoices and purchase bills for the selected window."
                />
              }
            />
            <Route
              path="party-statement"
              element={
                <ReportPlaceholderPage
                  title="Party statement"
                  bullets={[
                    'Running balances per counterparty (customer & supplier)',
                    'Drill-down into vouchers mapped from invoices and purchase bills',
                    'Opening / closing balance filters aligned with GST filing periods',
                  ]}
                />
              }
            />
            <Route
              path="gst-summary"
              element={
                <ReportPlaceholderPage
                  title="GST summary"
                  bullets={[
                    'Outward taxable supplies grouped by GST rate / HSN from invoices',
                    'Purchase eligibility cues once inward GST linking lands',
                    'JSON exports suited for reconciliation tooling',
                  ]}
                />
              }
            />
            <Route
              path="profit-loss"
              element={
                <ReportPlaceholderPage
                  title="Profit & loss"
                  bullets={[
                    'Income vs expense grouping mapped from billing postings',
                    'Comparison periods with variance badges similar to competitor dashboards',
                    'Exports suitable for advisors once costing hooks exist',
                  ]}
                />
              }
            />
          </Route>
          <Route path="/settings" element={<SettingsPage />} />
          <Route
            path="/settings/rbac/roles"
            element={
              <RequirePermission permission="roles.read">
                <RolesListPage />
              </RequirePermission>
            }
          />
          <Route
            path="/settings/rbac/roles/:roleId"
            element={
              <RequirePermission permission="roles.read">
                <RoleDetailPage />
              </RequirePermission>
            }
          />
          <Route
            path="/settings/rbac/permissions"
            element={
              <RequirePermission permission="roles.read">
                <PermissionsCatalogPage />
              </RequirePermission>
            }
          />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/parties" element={<PartiesPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/sales" element={<SalesHubPage />} />
          <Route path="/invoices" element={<InvoicesListPage />} />
          <Route path="/invoices/new" element={<InvoiceComposerLayout />}>
            <Route index element={<InvoiceComposerIndexRedirect />} />
            <Route path=":tabId" element={<InvoiceCreatePage />} />
          </Route>
          <Route path="/invoices/:invoiceId" element={<InvoiceDetailPage />} />
          <Route path="/purchases" element={<PurchasesListPage />} />
          <Route path="/purchases/new" element={<PurchaseComposerLayout />}>
            <Route index element={<PurchaseComposerIndexRedirect />} />
            <Route path=":tabId" element={<PurchaseCreatePage />} />
          </Route>
          <Route path="/purchases/drafts/:draftPurchaseBillId" element={<PurchaseDraftRedirect />} />
          <Route path="/purchases/:purchaseBillId/print" element={<PurchasePrintStudioPage />} />
          <Route path="/purchases/:purchaseBillId" element={<PurchaseDetailPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
