import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import { rbacApi } from './rbac-api';
import type { PermissionCatalogEntry } from './rbac.types';

function formatErr(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Request failed.';
}

export function PermissionsCatalogPage() {
  const [permissions, setPermissions] = useState<PermissionCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    rbacApi
      .listPermissions()
      .then((data) => {
        if (!cancel) setPermissions(data);
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

  const grouped = useMemo(() => {
    const map = new Map<string, PermissionCatalogEntry[]>();
    for (const p of permissions) {
      const list = map.get(p.category) ?? [];
      list.push(p);
      map.set(p.category, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [permissions]);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8 pb-12">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          to="/settings/rbac/roles"
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.05]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Roles
        </Link>
      </div>

      <header className="flex items-start gap-3">
        <Layers className="mt-1 h-8 w-8 shrink-0 text-teal-400" aria-hidden />
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Permissions catalog
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Canonical permission keys issued on JWTs and checked by API policies. Categories group keys by name prefix.
          </p>
        </div>
      </header>

      {error ? (
        <div role="alert" className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-20 text-sm text-slate-400">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-teal-400/30 border-t-teal-400" aria-hidden />
          Loading permissions…
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([category, items]) => (
            <section key={category} className="workspace-panel overflow-hidden">
              <div className="border-b border-white/10 px-5 py-4 sm:px-6">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{category}</h2>
                <p className="mt-1 text-xs text-slate-600">{items.length} entries</p>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {items.map((p) => (
                  <div
                    key={p.id}
                    className="flex min-h-[4.25rem] flex-col gap-1 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="break-all font-mono text-[13px] font-medium leading-snug text-teal-100">{p.name}</p>
                      <p className="mt-1 text-sm text-slate-300">{p.displayName}</p>
                      {p.description ? <p className="mt-1 text-xs text-slate-500">{p.description}</p> : null}
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-slate-600">id {p.id}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
