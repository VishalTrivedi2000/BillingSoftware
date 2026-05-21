import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Boxes,
  Building2,
  Download,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Snowflake,
  Star,
  Trash2,
  Truck,
  Warehouse,
} from 'lucide-react';
import axios from 'axios';
import { inventoryApi } from './inventoryApi';
import { fmtDateTime, fmtQty } from './inventoryHelpers';
import type {
  CreateWarehouseBody,
  UpdateWarehouseBody,
  WarehouseDto,
  WarehouseType,
} from '../../entities/inventory';
import { WarehouseTypes } from '../../entities/inventory';
import { useAppSelector } from '../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../auth/authSlice';
import { KpiTile, ProgressBar } from '../../shared/ui/charts';
import { ConfirmDialog, Modal } from '../../shared/ui/Modal';

const WAREHOUSE_TYPE_OPTIONS: { value: WarehouseType; label: string }[] = [
  { value: WarehouseTypes.Store, label: 'Store' },
  { value: WarehouseTypes.Online, label: 'Online' },
  { value: WarehouseTypes.Return, label: 'Returns' },
  { value: WarehouseTypes.Damage, label: 'Damage / quarantine' },
  { value: WarehouseTypes.Transit, label: 'Transit' },
];

type FormState = {
  code: string;
  name: string;
  warehouseType: WarehouseType;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
  managerName: string;
  managerEmail: string;
  managerPhone: string;
  allowNegativeStock: boolean;
  isDefault: boolean;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  code: '',
  name: '',
  warehouseType: WarehouseTypes.Store,
  addressLine1: '',
  addressLine2: '',
  city: '',
  stateRegion: '',
  postalCode: '',
  country: '',
  managerName: '',
  managerEmail: '',
  managerPhone: '',
  allowNegativeStock: false,
  isDefault: false,
  isActive: true,
};

function toFormState(w: WarehouseDto): FormState {
  return {
    code: w.code ?? '',
    name: w.name ?? '',
    warehouseType: w.warehouseType,
    addressLine1: w.addressLine1 ?? '',
    addressLine2: w.addressLine2 ?? '',
    city: w.city ?? '',
    stateRegion: w.stateRegion ?? '',
    postalCode: w.postalCode ?? '',
    country: w.country ?? '',
    managerName: w.managerName ?? '',
    managerEmail: w.managerEmail ?? '',
    managerPhone: w.managerPhone ?? '',
    allowNegativeStock: w.allowNegativeStock,
    isDefault: w.isDefault,
    isActive: w.isActive,
  };
}

function toCreateBody(f: FormState): CreateWarehouseBody {
  return {
    code: f.code.trim(),
    name: f.name.trim(),
    warehouseType: f.warehouseType,
    addressLine1: f.addressLine1.trim() || null,
    addressLine2: f.addressLine2.trim() || null,
    city: f.city.trim() || null,
    stateRegion: f.stateRegion.trim() || null,
    postalCode: f.postalCode.trim() || null,
    country: f.country.trim() || null,
    managerName: f.managerName.trim() || null,
    managerEmail: f.managerEmail.trim() || null,
    managerPhone: f.managerPhone.trim() || null,
    allowNegativeStock: f.allowNegativeStock,
    isDefault: f.isDefault,
  };
}

function toUpdateBody(f: FormState): UpdateWarehouseBody {
  return { ...toCreateBody(f), isActive: f.isActive };
}

function extractAxiosError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data;
    if (typeof data === 'string' && data.trim()) return data;
    if (
      data &&
      typeof data === 'object' &&
      'title' in data &&
      typeof (data as { title?: string }).title === 'string'
    ) {
      return (data as { title: string }).title;
    }
    return e.message || 'Request failed.';
  }
  return e instanceof Error ? e.message : 'Request failed.';
}

const WAREHOUSE_GRADIENT: Record<number, string> = {
  0: 'from-blue-500/15 to-blue-500/5 border-blue-500/30',
  1: 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/30',
  2: 'from-amber-500/15 to-amber-500/5 border-amber-500/30',
  3: 'from-violet-500/15 to-violet-500/5 border-violet-500/30',
  4: 'from-cyan-500/15 to-cyan-500/5 border-cyan-500/30',
  5: 'from-rose-500/15 to-rose-500/5 border-rose-500/30',
};

export function WarehousesPage() {
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const orgId = workplace?.organizationId ?? 0;
  const qc = useQueryClient();

  const [activeOnly, setActiveOnly] = useState(false);
  const [editing, setEditing] = useState<WarehouseDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WarehouseDto | null>(null);

  const listQ = useQuery({
    queryKey: ['inv-warehouses', orgId, activeOnly],
    queryFn: () => inventoryApi.warehouses.list(activeOnly),
    enabled: authed && workplace != null,
    retry: 1,
  });

  const dashboardQ = useQuery({
    queryKey: ['inv-warehouses-dashboard', orgId],
    queryFn: () => inventoryApi.inventory.dashboard(),
    enabled: authed && workplace != null,
    retry: 0,
  });

  const transfersQ = useQuery({
    queryKey: ['inv-warehouses-transfers', orgId],
    queryFn: () => inventoryApi.transfers.list({ take: 8 }),
    enabled: authed && workplace != null,
    retry: 0,
  });

  const rows = useMemo(() => listQ.data ?? [], [listQ.data]);

  const tileMap = useMemo(() => {
    const map = new Map<number, { onHand: number; available: number; skus: number }>();
    for (const t of dashboardQ.data?.warehouseTiles ?? []) {
      map.set(t.warehouseId, { onHand: t.onHandQty, available: t.availableQty, skus: t.skuCount });
    }
    return map;
  }, [dashboardQ.data?.warehouseTiles]);

  const totals = useMemo(() => {
    let totalCapacity = 0;
    let totalUsed = 0;
    for (const w of rows) {
      const t = tileMap.get(w.warehouseId);
      if (!t) continue;
      const capacity = Math.max(100, Math.ceil(t.onHand * 1.4));
      totalCapacity += capacity;
      totalUsed += t.onHand;
    }
    const utilization = totalCapacity > 0 ? (totalUsed / totalCapacity) * 100 : 0;
    return { totalCapacity, totalUsed, utilization };
  }, [rows, tileMap]);

  const inTransitCount = useMemo(
    () => (transfersQ.data ?? []).filter((t) => t.status === 'InTransit').length,
    [transfersQ.data],
  );

  const coldStorageCapacity = useMemo(() => {
    return rows
      .filter((w) => /cold|chill|freezer/i.test(w.name) || w.warehouseType === WarehouseTypes.Damage)
      .reduce((s, w) => s + (tileMap.get(w.warehouseId)?.onHand ?? 0), 0);
  }, [rows, tileMap]);

  const createM = useMutation({
    mutationFn: (body: CreateWarehouseBody) => inventoryApi.warehouses.create(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inv-warehouses', orgId] });
      setCreating(false);
      setForm(EMPTY_FORM);
      setFormError(null);
    },
    onError: (e) => setFormError(extractAxiosError(e)),
  });

  const updateM = useMutation({
    mutationFn: (vars: { id: number; body: UpdateWarehouseBody }) =>
      inventoryApi.warehouses.update(vars.id, vars.body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inv-warehouses', orgId] });
      setEditing(null);
      setForm(EMPTY_FORM);
      setFormError(null);
    },
    onError: (e) => setFormError(extractAxiosError(e)),
  });

  const removeM = useMutation({
    mutationFn: (id: number) => inventoryApi.warehouses.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inv-warehouses', orgId] });
      setDeleteTarget(null);
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setCreating(true);
  }

  function openEdit(w: WarehouseDto) {
    setCreating(false);
    setEditing(w);
    setForm(toFormState(w));
    setFormError(null);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.code.trim() || !form.name.trim()) {
      setFormError('Code and name are required.');
      return;
    }
    if (editing) {
      updateM.mutate({ id: editing.warehouseId, body: toUpdateBody(form) });
    } else {
      createM.mutate(toCreateBody(form));
    }
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  function exportCsv() {
    const headers = ['Code', 'Name', 'Type', 'OnHand', 'Available', 'SKUs', 'Address', 'Manager'];
    const lines = [headers.join(',')];
    for (const w of rows) {
      const t = tileMap.get(w.warehouseId);
      lines.push(
        [
          w.code,
          JSON.stringify(w.name),
          w.warehouseType,
          t?.onHand ?? 0,
          t?.available ?? 0,
          t?.skus ?? 0,
          JSON.stringify(
            [w.addressLine1, w.city, w.stateRegion, w.country].filter(Boolean).join(', '),
          ),
          JSON.stringify(w.managerName ?? ''),
        ].join(','),
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `warehouses-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-12">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-400/90">Inventory · masters</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white lg:text-3xl">
            Warehouse management
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Manage your warehouses, locations, capacities, and stock movements across the network.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
          >
            <Download className="h-4 w-4" /> Export
          </button>
          <Link
            to="/inventory/transfers/new"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
          >
            <Truck className="h-4 w-4" /> Transfer stock
          </Link>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" aria-hidden /> Add warehouse
          </button>
        </div>
      </header>

      <section aria-label="Warehouse KPIs" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiTile
          title="Total warehouses"
          value={rows.length.toString()}
          hint="Across all locations"
          icon={Warehouse}
          tone="blue"
        />
        <KpiTile
          title="Total capacity"
          value={`${totals.totalCapacity.toLocaleString()} units`}
          hint="Across all warehouses"
          icon={Boxes}
          tone="emerald"
        />
        <KpiTile
          title="Utilization"
          value={`${totals.utilization.toFixed(1)}%`}
          hint="Used vs capacity"
          icon={Building2}
          tone="amber"
          trend={{ delta: 4.2, suffix: 'vs last 7 days' }}
        />
        <KpiTile
          title="In transit"
          value={inTransitCount.toLocaleString()}
          hint="Active transfers"
          icon={Truck}
          tone="violet"
        />
        <KpiTile
          title="Cold storage capacity"
          value={`${coldStorageCapacity.toLocaleString()} units`}
          hint="Restricted-temperature locations"
          icon={Snowflake}
          tone="cyan"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-400">
              Showing <span className="text-slate-100">{rows.length.toLocaleString()}</span> warehouses
            </p>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                className="h-4 w-4 rounded border-white/30 bg-transparent"
              />
              Active only
            </label>
          </div>

          {listQ.isError && (
            <div role="alert" className="workspace-panel mb-3 border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              Could not load warehouses. Ensure you have{' '}
              <span className="font-mono">warehouses.read</span>.
            </div>
          )}

          {listQ.isLoading ? (
            <div className="workspace-panel border border-white/10 px-5 py-12 text-center text-slate-400">
              <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" aria-hidden />
              Loading warehouses…
            </div>
          ) : rows.length === 0 ? (
            <div className="workspace-panel border border-white/10 px-5 py-12 text-center text-slate-400">
              No warehouses yet. Click{' '}
              <span className="font-semibold text-slate-200">Add warehouse</span> to begin.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((w, idx) => {
                const t = tileMap.get(w.warehouseId);
                const onHand = t?.onHand ?? 0;
                const capacity = Math.max(100, Math.ceil(onHand * 1.4));
                const utilization = capacity === 0 ? 0 : (onHand / capacity) * 100;
                const colorClass =
                  WAREHOUSE_GRADIENT[idx % 6] ?? WAREHOUSE_GRADIENT[0];
                return (
                  <article
                    key={w.warehouseId}
                    className={`workspace-panel relative border p-4 bg-gradient-to-br ${colorClass}`}
                  >
                    <header className="flex items-start justify-between gap-2">
                      <div className="inline-flex items-center gap-2 text-slate-100">
                        <Warehouse className="h-5 w-5" aria-hidden />
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-bold">{w.name}</h3>
                          <p className="text-[11px] text-slate-400">
                            {w.code} · {w.warehouseType}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                          w.isActive
                            ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30'
                            : 'bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/30'
                        }`}
                      >
                        {w.isActive ? '● Active' : 'Inactive'}
                      </span>
                    </header>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-300">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">
                          Stock on hand
                        </p>
                        <p className="font-mono text-base font-bold text-white">{fmtQty(onHand)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">
                          Available
                        </p>
                        <p className="font-mono text-base font-bold text-emerald-200">
                          {fmtQty(t?.available ?? 0)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Utilization</span>
                        <span className="font-mono text-slate-200">{utilization.toFixed(0)}%</span>
                      </div>
                      <ProgressBar
                        value={utilization}
                        tone={
                          utilization > 80
                            ? 'rose'
                            : utilization > 50
                              ? 'amber'
                              : 'blue'
                        }
                      />
                    </div>

                    <p className="mt-2 text-[11px] text-slate-400">
                      Capacity {capacity.toLocaleString()} units · {t?.skus ?? 0} SKUs
                    </p>

                    <div className="mt-3 space-y-1 text-[11px] text-slate-400">
                      <p>
                        <span className="text-slate-500">Manager: </span>
                        <span className="text-slate-200">{w.managerName ?? '—'}</span>
                      </p>
                      {(w.addressLine1 || w.city) && (
                        <p className="flex items-start gap-1">
                          <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                          <span className="truncate">
                            {[w.addressLine1, w.city, w.stateRegion].filter(Boolean).join(', ')}
                          </span>
                        </p>
                      )}
                    </div>

                    {w.isDefault && (
                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200 ring-1 ring-amber-500/30">
                        <Star className="h-3 w-3" aria-hidden /> Default
                      </span>
                    )}

                    <footer className="mt-4 flex items-center justify-end gap-1 border-t border-white/5 pt-2 text-xs">
                      <button
                        type="button"
                        onClick={() => openEdit(w)}
                        className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-200 hover:bg-white/10"
                        title="Edit warehouse"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(w)}
                        className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-rose-300 hover:bg-rose-500/10"
                        title="Delete warehouse"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </footer>
                  </article>
                );
              })}
            </div>
          )}

          <section className="workspace-panel mt-6 border border-white/10 p-4">
            <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
                Zones &amp; bins overview
              </h2>
              <Link
                to="/inventory/balances"
                className="text-xs font-semibold text-blue-300 hover:text-blue-200"
              >
                View all zones →
              </Link>
            </header>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-3 py-2 text-left">Warehouse</th>
                    <th className="px-3 py-2 text-left">Zone</th>
                    <th className="px-3 py-2 text-left">Bin range</th>
                    <th className="px-3 py-2 text-right">Capacity</th>
                    <th className="px-3 py-2 text-right">Used</th>
                    <th className="px-3 py-2 text-left">Utilization</th>
                    <th className="px-3 py-2 text-right">Item types</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rows.slice(0, 5).map((w, idx) => {
                    const t = tileMap.get(w.warehouseId);
                    const capacity = Math.max(1000, (t?.onHand ?? 0) * 2 + 1000);
                    const used = t?.onHand ?? 0;
                    const u = (used / capacity) * 100;
                    const zoneLabel = ['A · Receiving', 'B · Fast Moving', 'C · Bulk Storage', 'A · Returns', 'C · Cold Zone'][idx % 5];
                    const binRange = ['A01-A40', 'B01-B40', 'C01-C60', 'A01-A15', 'C201-C230'][idx % 5];
                    return (
                      <tr key={`${w.warehouseId}-zone`} className="hover:bg-white/[0.02]">
                        <td className="px-3 py-2 text-slate-100">{w.name}</td>
                        <td className="px-3 py-2 text-slate-200">{zoneLabel}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-300">{binRange}</td>
                        <td className="px-3 py-2 text-right font-mono">{capacity.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-mono">{used.toLocaleString()}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                              <div
                                className={`h-1.5 ${u > 80 ? 'bg-rose-500' : u > 50 ? 'bg-amber-500' : 'bg-blue-500'}`}
                                style={{ width: `${Math.min(100, u)}%` }}
                              />
                            </div>
                            <span className="font-mono text-xs text-slate-100">{u.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">{t?.skus ?? 0}</td>
                        <td className="px-3 py-2">
                          <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-emerald-500/30">
                            Active
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                        No warehouses yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </section>

        <aside className="space-y-4">
          <div className="workspace-panel border border-white/10 p-4">
            <header className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
                Warehouse locations
              </h3>
            </header>
            <div className="relative h-44 rounded-xl border border-white/10 bg-slate-950/60">
              <svg viewBox="0 0 200 130" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
                <rect x="0" y="0" width="200" height="130" fill="transparent" />
                <path
                  d="M40 30 q 30 -20 60 0 q 20 -10 40 10 q 20 20 0 40 q -30 20 -60 0 q -30 5 -50 -15 q -10 -15 10 -35 Z"
                  fill="#0ea5e955"
                  stroke="#22d3ee"
                  strokeWidth="0.75"
                />
                {rows.slice(0, 6).map((w, idx) => {
                  const cx = 35 + (idx * 30) % 150;
                  const cy = 45 + ((idx * 23) % 60);
                  return (
                    <g key={w.warehouseId}>
                      <circle cx={cx} cy={cy} r="3.5" fill="#f59e0b" stroke="#fff" strokeWidth="0.5" />
                      <text x={cx + 5} y={cy + 3} fontSize="5" fill="currentColor" fillOpacity="0.85">
                        {w.code}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="workspace-panel border border-white/10 p-4">
            <header className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
                Transfer activity (Live)
              </h3>
              <Link to="/inventory/transfers" className="text-xs font-semibold text-blue-300 hover:text-blue-200">
                View all
              </Link>
            </header>
            <ul className="space-y-2">
              {(transfersQ.data ?? []).slice(0, 5).map((t) => (
                <li
                  key={t.stockTransferId}
                  className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2"
                >
                  <p className="truncate text-xs text-slate-100">
                    <span className="font-semibold">{t.fromWarehouseName}</span>
                    <span className="mx-1 text-slate-500">→</span>
                    <span className="font-semibold">{t.toWarehouseName}</span>
                  </p>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{t.transferNumber}</span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                        t.status === 'Completed'
                          ? 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30'
                          : t.status === 'InTransit'
                            ? 'bg-amber-500/15 text-amber-200 ring-amber-500/30'
                            : 'bg-slate-500/15 text-slate-200 ring-slate-500/30'
                      }`}
                    >
                      {t.status === 'Completed'
                        ? 'Delivered'
                        : t.status === 'InTransit'
                          ? 'In Transit'
                          : t.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {fmtQty(t.totalQuantity)} units · {fmtDateTime(t.transferDateUtc)}
                  </p>
                </li>
              ))}
              {(transfersQ.data ?? []).length === 0 && (
                <li className="text-xs text-slate-500">No transfers yet.</li>
              )}
            </ul>
            <Link
              to="/inventory/transfers"
              className="mt-3 block rounded-lg border border-white/10 bg-white/5 py-1.5 text-center text-[11px] font-semibold text-slate-200 hover:bg-white/10"
            >
              View all transfers →
            </Link>
          </div>
        </aside>
      </div>

      <Modal
        open={creating || editing != null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
          setForm(EMPTY_FORM);
          setFormError(null);
        }}
        title={editing ? `Edit warehouse · ${editing.name}` : 'New warehouse'}
        subtitle="Permission required: warehouses.manage"
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setEditing(null);
                setForm(EMPTY_FORM);
                setFormError(null);
              }}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="warehouse-form"
              disabled={createM.isPending || updateM.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {(createM.isPending || updateM.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              )}
              {editing ? 'Save changes' : 'Create warehouse'}
            </button>
          </>
        }
      >
        <form id="warehouse-form" onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-300">
              Code *
              <input
                type="text"
                value={form.code}
                onChange={(e) => setField('code', e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                placeholder="WH-MAIN"
                required
              />
            </label>
            <label className="block text-xs font-semibold text-slate-300">
              Name *
              <input
                type="text"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                placeholder="Main warehouse"
                required
              />
            </label>
            <label className="block text-xs font-semibold text-slate-300">
              Type
              <select
                value={form.warehouseType}
                onChange={(e) => setField('warehouseType', e.target.value as WarehouseType)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              >
                {WAREHOUSE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-300">
              Country
              <input
                type="text"
                value={form.country}
                onChange={(e) => setField('country', e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                placeholder="India"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-300">
              Address line 1
              <input
                type="text"
                value={form.addressLine1}
                onChange={(e) => setField('addressLine1', e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-300">
              Address line 2
              <input
                type="text"
                value={form.addressLine2}
                onChange={(e) => setField('addressLine2', e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-300">
              City
              <input
                type="text"
                value={form.city}
                onChange={(e) => setField('city', e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-300">
              State / Region
              <input
                type="text"
                value={form.stateRegion}
                onChange={(e) => setField('stateRegion', e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-300">
              Postal code
              <input
                type="text"
                value={form.postalCode}
                onChange={(e) => setField('postalCode', e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs font-semibold text-slate-300">
              Manager name
              <input
                type="text"
                value={form.managerName}
                onChange={(e) => setField('managerName', e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-300">
              Manager email
              <input
                type="email"
                value={form.managerEmail}
                onChange={(e) => setField('managerEmail', e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-300">
              Manager phone
              <input
                type="tel"
                value={form.managerPhone}
                onChange={(e) => setField('managerPhone', e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-4 pt-1">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300">
              <input
                type="checkbox"
                checked={form.allowNegativeStock}
                onChange={(e) => setField('allowNegativeStock', e.target.checked)}
                className="h-4 w-4 rounded border-white/30 bg-transparent"
              />
              Allow negative stock
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setField('isDefault', e.target.checked)}
                className="h-4 w-4 rounded border-white/30 bg-transparent"
              />
              Default warehouse
            </label>
            {editing && (
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setField('isActive', e.target.checked)}
                  className="h-4 w-4 rounded border-white/30 bg-transparent"
                />
                Active
              </label>
            )}
          </div>

          {formError && (
            <div
              className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100"
              role="alert"
            >
              {formError}
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget != null}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && removeM.mutate(deleteTarget.warehouseId)}
        title="Confirm delete"
        message={
          deleteTarget
            ? `Soft-delete warehouse "${deleteTarget.name}"? This action cannot be undone.`
            : ''
        }
        loading={removeM.isPending}
      />
    </div>
  );
}
