import { useQuery } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import type { OrganizationMembership } from '../../entities/auth-types';
import { useAppSelector } from '../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../../features/auth/authSlice';
import { apiJsonAuth } from '../api/axiosClient';

export function WorkplaceBadge() {
  const tokenOk = useAppSelector(selectIsAuthenticated);
  const snap = useAppSelector(selectWorkplaceSnapshot);

  const q = useQuery({
    queryKey: ['org-memberships', snap?.tenantId, snap?.organizationId],
    queryFn: () => apiJsonAuth<OrganizationMembership[]>('/v1/organizations/my-memberships'),
    enabled: Boolean(tokenOk && snap),
    staleTime: 60_000,
  });

  if (!tokenOk || !snap) return null;

  const current = q.data?.find((m) => m.organizationId === snap.organizationId && m.tenantId === snap.tenantId);
  const label = current ? current.organizationCode : q.isLoading ? '…' : `#${snap.organizationId}`;

  return (
    <div
      className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400 sm:flex"
      title={`Tenant ${snap.tenantId} · Organization ${snap.organizationId}`}
    >
      <Building2 size={14} className="shrink-0 text-blue-400/90" aria-hidden />
      <span className="font-mono text-[11px] text-slate-500">T{snap.tenantId}</span>
      <span className="max-w-[140px] truncate font-medium text-slate-200">{label}</span>
    </div>
  );
}
