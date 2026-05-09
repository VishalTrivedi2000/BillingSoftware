import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Check, Loader2 } from 'lucide-react';
import type { AuthUserSummary, OrganizationMembership } from '../../entities/auth-types';
import { apiJsonAuth, switchWorkplaceOrganization } from '../../shared/api/axiosClient';
import { useAppSelector } from '../../app/hooks';
import { selectWorkplaceSnapshot } from '../../features/auth/authSlice';

export function WorkplaceCard() {
  const qc = useQueryClient();
  const workplace = useAppSelector(selectWorkplaceSnapshot);

  const summaryQ = useQuery({
    queryKey: ['auth-me', workplace?.tenantId, workplace?.organizationId],
    queryFn: () => apiJsonAuth<AuthUserSummary>('/v1/auth/me'),
    retry: 1,
  });

  const memQ = useQuery({
    queryKey: ['org-memberships', workplace?.organizationId],
    queryFn: () => apiJsonAuth<OrganizationMembership[]>('/v1/organizations/my-memberships'),
    retry: 1,
  });

  const switchMut = useMutation({
    mutationFn: (organizationId: number) => switchWorkplaceOrganization(organizationId),
    onSuccess: async () => {
      await qc.invalidateQueries();
    },
  });

  const summary = summaryQ.data;
  const memberships = memQ.data ?? [];
  const activeOrgId = summary?.organizationId ?? workplace?.organizationId;

  return (
    <div className="workspace-panel p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg shadow-blue-600/25">
          <Building2 size={22} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-white">Workplace</h2>
          <p className="mt-1 text-sm text-slate-400">
            JWT carries <code className="rounded bg-white/10 px-1 font-mono text-xs text-blue-200">tenant_id</code> and{' '}
            <code className="rounded bg-white/10 px-1 font-mono text-xs text-blue-200">org_id</code>. Switching organization re-issues tokens via refresh.
          </p>
        </div>
      </div>

      {(summaryQ.isLoading || memQ.isLoading) && (
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading workplace…
        </div>
      )}

      {(summaryQ.isError || memQ.isError) && (
        <p className="mt-6 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Could not load workplace data — refresh after signing in again if needed.
        </p>
      )}

      {summary && !summaryQ.isLoading && (
        <dl className="mt-6 grid gap-3 rounded-xl bg-white/5 px-4 py-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Tenant ID</dt>
            <dd className="mt-1 font-mono text-sm font-semibold text-slate-100">{summary.tenantId}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Organization ID</dt>
            <dd className="mt-1 font-mono text-sm font-semibold text-slate-100">{summary.organizationId}</dd>
          </div>
        </dl>
      )}

      {memberships.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-200">Your organizations</h3>
          <ul className="mt-3 divide-y divide-white/10 rounded-xl border border-white/10">
            {memberships.map((m) => {
              const isActive = activeOrgId === m.organizationId;
              return (
                <li key={`${m.tenantId}-${m.organizationId}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-100">{m.organizationName}</p>
                    <p className="truncate font-mono text-xs text-slate-500">
                      {m.organizationCode} · tenant {m.tenantId} · org {m.organizationId}
                      {m.isDefault ? ' · default' : ''}
                    </p>
                  </div>
                  {isActive ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300">
                      <Check size={14} aria-hidden />
                      Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={switchMut.isPending}
                      onClick={() => switchMut.mutate(m.organizationId)}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
                    >
                      {switchMut.isPending ? 'Switching…' : 'Switch here'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
