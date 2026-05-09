import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import type { CustomerDto } from '../../entities/billing';
import { useAppSelector } from '../../app/hooks';
import { selectWorkplaceSnapshot } from '../../features/auth/authSlice';
import { authApi } from '../../shared/api/axiosClient';
import axios from 'axios';

export function CustomersPage() {
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const workplaceOrgId = workplace?.organizationId ?? 0;

  const q = useQuery({
    queryKey: ['customers-directory', workplaceOrgId],
    queryFn: async () => {
      try {
        const { data } = await authApi.get<CustomerDto[]>('/v1/customers?max=400');
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
            <Users className="h-8 w-8 text-blue-400" aria-hidden />
            Customers
          </h2>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            Buyers linked to invoices for the active organization. Create customers via API or extend this screen with edit dialogs later.
          </p>
        </div>
        <Link
          to="/invoices/new"
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
        >
          Invoice a customer
        </Link>
      </header>

      <div className="workspace-panel overflow-hidden">
        {q.isLoading && (
          <div className="flex items-center gap-3 px-6 py-16 text-slate-400">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-400" />
            Loading directory…
          </div>
        )}
        {q.isError && (
          <div role="alert" className="border border-rose-500/20 bg-rose-500/10 px-6 py-8 text-sm text-rose-200">
            Unable to load customers — needs <span className="font-mono">customers.read</span>.
          </div>
        )}
        {q.data && q.data.length === 0 && (
          <p className="px-6 py-16 text-center text-sm text-slate-500">
            No customers yet. Use <span className="font-mono text-xs">POST /v1/customers</span> or seed workflows.
          </p>
        )}
        {q.data && q.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Tax ID</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Phone</th>
                  <th className="px-6 py-4 font-mono text-xs">ID</th>
                </tr>
              </thead>
              <tbody>
                {q.data.map((c) => (
                  <tr key={c.customerId} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="px-6 py-3 font-medium text-slate-100">{c.name}</td>
                    <td className="px-6 py-3 text-slate-400">{c.taxId ?? '—'}</td>
                    <td className="px-6 py-3 text-slate-400">{c.email ?? '—'}</td>
                    <td className="px-6 py-3 text-slate-400">{c.phone ?? '—'}</td>
                    <td className="px-6 py-3 font-mono text-xs text-slate-500">{c.customerId}</td>
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
