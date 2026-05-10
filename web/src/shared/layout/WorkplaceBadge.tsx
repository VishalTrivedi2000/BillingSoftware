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
      className="theme-header-chip hidden items-center gap-2 rounded-xl px-3 py-2 text-xs sm:flex"
      title={`Tenant ${snap.tenantId} · Organization ${snap.organizationId}`}
    >
      <Building2 size={14} className="shrink-0 text-[rgb(var(--accent-rgb))]" aria-hidden />
      <span className="text-app-crumb font-mono text-[11px]">T{snap.tenantId}</span>
      <span className="text-app-page-title max-w-[140px] truncate font-medium">{label}</span>
    </div>
  );
}
