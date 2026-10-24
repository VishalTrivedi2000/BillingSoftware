import { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { rbacApi } from './rbac-api';
import type { RoleSummary } from './rbac.types';
import { usePermissions } from '../../shared/auth/usePermissions';

function formatErr(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Request failed.';
}

export function RolesListPage() {
  const { can } = usePermissions();
  const canManage = can('roles.manage');

  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    rbacApi
      .listRoles()
      .then((data) => {
        if (!cancel) setRoles(data);
      })
      .catch((err) => {
        if (!cancel) setError(formatErr(err));
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8 pb-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
            <KeyRound className="h-8 w-8 text-teal-400" aria-hidden />
            Roles &amp; permissions
          </h1>
          <p className="max-w-2xl text-sm text-slate-400">
            Workspace roles map to permission sets enforced by the API and JWT claims.
            {canManage ? ' Open a role to edit its permissions.' : ' You have read-only access to this catalog.'}
          </p>
        </div>
        <Link
          to="/settings/rbac/permissions"
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/[0.06]"
        >
          <ShieldCheck className="h-4 w-4 text-teal-400" aria-hidden />
          Permissions catalog
        </Link>
      </div>

      {error ? (
        <div role="alert" className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="workspace-panel overflow-hidden">
        <div className="border-b border-white/10 px-6 py-5">
          <div className="text-sm font-semibold text-white">All roles</div>
          <div className="mt-1 text-xs text-slate-500">
            User counts include direct assignments and active scheduled role grants.
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 px-6 py-16 text-sm text-slate-400">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-teal-400/30 border-t-teal-400" aria-hidden />
            Loading roles…
          </div>
        ) : roles.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">No roles returned.</div>
        ) : (
          <ul className="divide-y divide-white/10">
            {roles.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/settings/rbac/roles/${r.id}`}
                  className="flex flex-col gap-3 px-6 py-5 transition hover:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-white">{r.displayName || r.name}</span>
                      <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-slate-400">
                        {r.scopeLevel}
                      </span>
                    </div>
                    {r.description ? <p className="mt-1 text-sm text-slate-500">{r.description}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-4 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-teal-400/80" aria-hidden />
                      {r.permissionCount} permissions
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-sky-400/80" aria-hidden />
                      {r.userCount} users
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
