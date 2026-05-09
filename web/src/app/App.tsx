import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { LoginPage } from '../features/auth/LoginPage';
import { LandingPage } from '../features/landing/LandingPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { InvoiceCreatePage } from '../features/invoices/InvoiceCreatePage';
import { InvoiceDetailPage } from '../features/invoices/InvoiceDetailPage';
import { InvoicesListPage } from '../features/invoices/InvoicesListPage';
import { CustomersPage } from '../features/customers/CustomersPage';
import { ProductsPage } from '../features/products/ProductsPage';
import { AppLayout } from '../shared/layout/AppLayout';
import { RequireAuth } from '../shared/auth/RequireAuth';

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
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/invoices" element={<InvoicesListPage />} />
          <Route path="/invoices/new" element={<InvoiceCreatePage />} />
          <Route path="/invoices/:invoiceId" element={<InvoiceDetailPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
