import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import axios from 'axios';
import type { ProductDto } from '../../entities/billing';
import { useAppSelector } from '../../app/hooks';
import { selectWorkplaceSnapshot } from '../../features/auth/authSlice';
import { authApi } from '../../shared/api/axiosClient';

function fmtInr(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);
}

function loadProductsErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : '';
  const status = Number.parseInt(raw, 10);
  if (status === 401) return 'Sign in again to load products.';
  if (status === 403)
    return 'You do not have access to the product catalog (invoice access or products.read is required). Try signing out and back in after your role was updated.';
  if (Number.isFinite(status) && status >= 500)
    return 'The server could not load products. Check that billing migrations ran and try again.';
  if (raw) return `Could not load products (${raw}).`;
  return 'Could not load products.';
}

export function ProductsPage() {
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const workplaceOrgId = workplace?.organizationId ?? 0;

  const q = useQuery({
    queryKey: ['products-directory', workplaceOrgId],
    queryFn: async () => {
      try {
        const { data } = await authApi.get<ProductDto[]>('/v1/products?activeOnly=false&max=400');
        return data;
      } catch (e) {
        if (axios.isAxiosError(e)) throw new Error(String(e.response?.status ?? 'network'));
        throw e;
      }
    },
    retry: 1,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-blue-400/90">Masters</p>
          <h2 className="mt-1 flex items-center gap-3 text-2xl font-bold text-white">
            <Package className="h-8 w-8 text-violet-400" aria-hidden />
            Products
          </h2>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            SKU catalog used when composing invoice lines. Unit prices flow into line totals with workspace rounding rules.
          </p>
        </div>
        <Link to="/invoices/new" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">
          Use on invoice
        </Link>
      </header>

      <div className="workspace-panel overflow-hidden">
        {q.isLoading && (
          <div className="flex items-center gap-3 px-6 py-16 text-slate-400">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-violet-400/30 border-t-violet-400" />
            Loading catalog…
          </div>
        )}
        {q.isError && (
          <div role="alert" className="border border-rose-500/20 bg-rose-500/10 px-6 py-8 text-sm text-rose-200">
            {loadProductsErrorMessage(q.error)}
          </div>
        )}
        {q.data && q.data.length === 0 && (
          <p className="px-6 py-16 text-center text-sm text-slate-500">No products defined for this organization.</p>
        )}
        {q.data && q.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">SKU</th>
                  <th className="px-6 py-4 text-right">Unit price</th>
                  <th className="px-6 py-4">Active</th>
                  <th className="px-6 py-4 font-mono text-xs">ID</th>
                </tr>
              </thead>
              <tbody>
                {q.data.map((p) => (
                  <tr key={p.productId} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="px-6 py-3 font-medium text-slate-100">{p.name}</td>
                    <td className="px-6 py-3 font-mono text-xs text-slate-400">{p.sku ?? '—'}</td>
                    <td className="px-6 py-3 text-right tabular-nums text-slate-200">{fmtInr(p.unitPrice)}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          p.isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-500/20 text-slate-400'
                        }`}
                      >
                        {p.isActive ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-mono text-xs text-slate-500">{p.productId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
