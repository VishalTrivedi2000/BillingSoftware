import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, KeyRound, RotateCcw, Save } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { rbacApi } from './rbac-api';
import type { PermissionCatalogEntry, RoleDetail } from './rbac.types';
import { usePermissions } from '../../shared/auth/usePermissions';

/** Matches backend immutability for `RoleNames.Admin`. */
const IMMUTABLE_ROLES = new Set(['Admin']);

function formatErr(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Request failed.';
}

export function RoleDetailPage() {
  const { roleId } = useParams<{ roleId: string }>();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canManage = can('roles.manage');

  const [role, setRole] = useState<RoleDetail | null>(null);
  const [permissions, setPermissions] = useState<PermissionCatalogEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initialSelected, setInitialSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!roleId) return;
    let cancel = false;
    setLoading(true);
    Promise.all([rbacApi.getRole(roleId), rbacApi.listPermissions()])
      .then(([r, perms]) => {
        if (cancel) return;
        setRole(r);
        setPermissions(perms);
        const s = new Set(r.permissionIds);
        setSelected(s);
        setInitialSelected(new Set(s));
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
  }, [roleId]);

  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(() => setBanner(null), 4200);
    return () => clearTimeout(t);
  }, [banner]);

  const grouped = useMemo(() => {
    const map = new Map<string, PermissionCatalogEntry[]>();
    for (const p of permissions) {
      const list = map.get(p.category) ?? [];
      list.push(p);
      map.set(p.category, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [permissions]);

  const dirty = useMemo(() => {
    if (selected.size !== initialSelected.size) return true;
    for (const id of selected) {
      if (!initialSelected.has(id)) return true;
    }
    return false;
  }, [selected, initialSelected]);

  const immutable = role ? IMMUTABLE_ROLES.has(role.name) : false;
  const readOnly = !canManage || immutable;

  function toggle(permId: string) {
    if (readOnly) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
  }

  async function onSave() {
    if (!role || !dirty) return;
    setSaving(true);
    setError(null);
    setBanner(null);
    try {
      const updated = await rbacApi.setRolePermissions(role.id, {
        permissionIds: Array.from(selected),
      });
      setRole(updated);
      const s = new Set(updated.permissionIds);
      setSelected(s);
      setInitialSelected(new Set(s));
      setBanner('Permissions updated.');
    } catch (err) {
      setError(formatErr(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-sm text-slate-400">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-teal-400/30 border-t-teal-400" aria-hidden />
        Loading role…
      </div>
    );
  }

  if (!role) {
    return (
      <div className="workspace-panel mx-auto max-w-lg border border-rose-500/25 bg-rose-500/10 px-8 py-10 text-center">
        <p className="font-semibold text-rose-100">{error ?? 'Role not found.'}</p>
        <button
          type="button"
          onClick={() => navigate('/settings/rbac/roles')}
          className="mt-6 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
        >
          Back to roles
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8 pb-12">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          to="/settings/rbac/roles"
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.05]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All roles
        </Link>
        <Link
          to="/settings/rbac/permissions"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-300"
        >
          Catalog
        </Link>
      </div>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <KeyRound className="mt-1 h-8 w-8 shrink-0 text-teal-400" aria-hidden />
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
              {role.displayName || role.name}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              {role.description ??
                'Toggle permissions for this role. Changes apply to new JWTs; signed-in users refresh on next login or token refresh.'}
            </p>
            {immutable ? (
              <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                This platform role is immutable — the API rejects edits to prevent accidental lockouts.
              </p>
            ) : null}
            {!canManage ? (
              <p className="mt-3 text-xs text-slate-600">
                Read-only: grant <span className="font-mono text-slate-500">roles.manage</span> to edit permission sets.
              </p>
            ) : null}
          </div>
        </div>

        {!readOnly ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={() => setSelected(new Set(initialSelected))}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/[0.05] disabled:opacity-40"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Reset
            </button>
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={() => void onSave()}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-600/20 hover:from-teal-500 hover:to-emerald-500 disabled:opacity-40"
            >
              <Save className="h-4 w-4" aria-hidden />
              {saving ? 'Saving…' : 'Save permissions'}
            </button>
          </div>
        ) : null}
      </header>

      {banner ? (
        <div role="status" className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {banner}
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="space-y-8">
        {grouped.map(([category, items]) => (
          <section key={category} className="workspace-panel overflow-hidden">
            <div className="border-b border-white/10 px-5 py-4 sm:px-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{category}</h2>
              <p className="mt-1 text-xs text-slate-600">{items.length} permissions</p>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {items.map((p) => {
                const on = selected.has(p.id);
                return (
                  <label
                    key={p.id}
                    className={`flex min-h-[4.5rem] cursor-pointer gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 transition ${
                      readOnly ? 'cursor-default opacity-80' : 'hover:border-teal-500/25 hover:bg-white/[0.04]'
                    } ${on ? 'border-teal-500/30 bg-teal-950/20' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={readOnly}
                      onChange={() => toggle(p.id)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-white/20 bg-[#1a1f2e] text-teal-500 focus:ring-teal-500/40 disabled:opacity-50"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="break-all font-mono text-[13px] leading-snug text-teal-100">{p.name}</p>
                      <p className="mt-1 text-sm text-slate-400">{p.displayName}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
