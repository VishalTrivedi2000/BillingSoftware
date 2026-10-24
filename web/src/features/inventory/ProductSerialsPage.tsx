import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Hash, Loader2, Plus, Search } from 'lucide-react';
import { inventoryApi } from './inventoryApi';
import { fmtInr } from './inventoryHelpers';
import type { CreateProductSerialBody } from '../../entities/inventory';
import { useAppSelector } from '../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../auth/authSlice';

const PAGE_SIZE = 25;

const SERIAL_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'Available', label: 'Available' },
  { value: 'Reserved', label: 'Reserved' },
  { value: 'Sold', label: 'Sold' },
  { value: 'Returned', label: 'Returned' },
  { value: 'Damaged', label: 'Damaged' },
];

type FormState = {
  productVariantId: number | null;
  serialNumber: string;
  imei1: string;
  imei2: string;
  warehouseId: number | null;
  batchId: number | null;
  purchaseCostPerUnit: string;
  warrantyStartUtc: string;
  warrantyEndUtc: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  productVariantId: null,
  serialNumber: '',
  imei1: '',
  imei2: '',
  warehouseId: null,
  batchId: null,
  purchaseCostPerUnit: '',
  warrantyStartUtc: '',
  warrantyEndUtc: '',
  notes: '',
};

function parseOptional(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : null;
}

function extractAxiosError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const d = e.response?.data;
    if (typeof d === 'string' && d.trim()) return d;
    return e.message || 'Request failed.';
  }
  return e instanceof Error ? e.message : 'Request failed.';
}

function statusTone(s: string): string {
  switch (s) {
    case 'Available':
      return 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30';
    case 'Reserved':
      return 'bg-violet-500/10 text-violet-300 ring-violet-500/30';
    case 'Sold':
      return 'bg-blue-500/10 text-blue-300 ring-blue-500/30';
    case 'Returned':
      return 'bg-amber-500/10 text-amber-300 ring-amber-500/30';
    case 'Damaged':
      return 'bg-rose-500/10 text-rose-300 ring-rose-500/30';
    default:
      return 'bg-slate-500/10 text-slate-300 ring-slate-500/30';
  }
}

export function ProductSerialsPage() {
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const orgId = workplace?.organizationId ?? 0;
  const qc = useQueryClient();
  const queryReady = authed && workplace != null;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState<number | undefined>();
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const warehousesQ = useQuery({
    queryKey: ['inv-warehouses-list', orgId, true],
    queryFn: () => inventoryApi.warehouses.list(true),
    enabled: queryReady,
    retry: 1,
  });

  const variantsQ = useQuery({
    queryKey: ['variants-for-serials', orgId],
    queryFn: () => inventoryApi.variants.browse({ activeOnly: true, take: 500 }),
    enabled: queryReady && creating,
    retry: 1,
  });

  const listQ = useQuery({
    queryKey: ['inv-serials', orgId, search, statusFilter, warehouseFilter, page],
    queryFn: () =>
      inventoryApi.serials.browse({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        warehouseId: warehouseFilter,
        skip: page * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    enabled: queryReady,
    retry: 1,
  });

  const createM = useMutation({
    mutationFn: (body: CreateProductSerialBody) => inventoryApi.serials.create(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inv-serials'] });
      setCreating(false);
      setForm(EMPTY_FORM);
      setFormError(null);
    },
    onError: (e) => setFormError(extractAxiosError(e)),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (form.productVariantId == null) {
      setFormError('Pick a variant.');
      return;
    }
    if (!form.serialNumber.trim()) {
      setFormError('Serial number is required.');
      return;
    }
    createM.mutate({
      productVariantId: form.productVariantId,
      serialNumber: form.serialNumber.trim(),
      imei1: form.imei1.trim() || null,
      imei2: form.imei2.trim() || null,
      warehouseId: form.warehouseId,
      batchId: form.batchId,
      purchaseCostPerUnit: parseOptional(form.purchaseCostPerUnit),
      warrantyStartUtc: form.warrantyStartUtc ? new Date(form.warrantyStartUtc).toISOString() : null,
      warrantyEndUtc: form.warrantyEndUtc ? new Date(form.warrantyEndUtc).toISOString() : null,
      notes: form.notes.trim() || null,
    });
  }

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  const variantOptions = useMemo(() => variantsQ.data?.items ?? [], [variantsQ.data]);
  const rows = listQ.data?.items ?? [];
  const totalCount = listQ.data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-12">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-400/90">Inventory · serials</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white lg:text-3xl">
            Serial numbers
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Per-unit identity for high-value items. Tracking mode <span className="font-mono">Serial</span> /{' '}
            <span className="font-mono">BatchAndSerial</span> requires one serial row per unit on hand.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreating(true);
            setForm(EMPTY_FORM);
            setFormError(null);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" aria-hidden /> New serial
        </button>
      </header>

      <section className="workspace-panel border border-white/10 p-4">
        <div className="grid gap-3 lg:grid-cols-4">
          <label className="block text-xs font-semibold text-slate-300 lg:col-span-2">
            Search
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setPage(0);
                  setSearch(e.target.value);
                }}
                placeholder="Serial / IMEI / product / SKU"
                className="w-full rounded-lg border border-white/10 bg-slate-900/80 py-2 pl-9 pr-3 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </div>
          </label>
          <label className="block text-xs font-semibold text-slate-300">
            Status
            <select
              value={statusFilter}
              onChange={(e) => {
                setPage(0);
                setStatusFilter(e.target.value);
              }}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            >
              {SERIAL_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-300">
            Warehouse
            <select
              value={warehouseFilter ?? ''}
              onChange={(e) => {
                setPage(0);
                setWarehouseFilter(e.target.value ? Number(e.target.value) : undefined);
              }}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            >
              <option value="">All</option>
              {(warehousesQ.data ?? []).map((w) => (
                <option key={w.warehouseId} value={w.warehouseId}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="workspace-panel border border-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Serial</th>
                <th className="px-4 py-3 text-left">IMEI 1 / 2</th>
                <th className="px-4 py-3 text-left">Variant</th>
                <th className="px-4 py-3 text-left">Warehouse</th>
                <th className="px-4 py-3 text-left">Batch</th>
                <th className="px-4 py-3 text-right">Cost</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {listQ.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" aria-hidden /> Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    No serials found.
                  </td>
                </tr>
              ) : (
                rows.map((s) => (
                  <tr key={s.productSerialId} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-slate-100">
                        <Hash className="h-4 w-4 text-violet-300" aria-hidden />
                        <span className="font-mono text-xs">{s.serialNumber}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      <div className="text-slate-200">{s.imei1 ?? '—'}</div>
                      <div className="text-slate-500">{s.imei2 ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="text-slate-200">{s.variantDisplay}</div>
                      <div className="text-slate-500">{s.sku ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">{s.warehouseName ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-300">{s.batchNumber ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      {s.purchaseCostPerUnit != null ? fmtInr(s.purchaseCostPerUnit) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ${statusTone(s.status)}`}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-white/5 px-4 py-3 text-xs text-slate-400">
          <span>
            {rows.length === 0 ? '0' : `${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + rows.length}`} of {totalCount.toLocaleString()}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-semibold text-slate-200 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Prev
            </button>
            <button
              type="button"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-semibold text-slate-200 disabled:opacity-40"
            >
              Next <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </footer>
      </section>

      {creating && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/70 backdrop-blur-sm sm:items-center">
          <div className="workspace-panel w-full max-w-2xl border border-white/10 p-6">
            <header className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">New serial</h2>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setForm(EMPTY_FORM);
                  setFormError(null);
                }}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10"
              >
                Cancel
              </button>
            </header>
            <form onSubmit={submit} className="space-y-3">
              <label className="block text-xs font-semibold text-slate-300">
                Variant *
                <select
                  value={form.productVariantId ?? ''}
                  onChange={(e) => setField('productVariantId', e.target.value ? Number(e.target.value) : null)}
                  required
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                >
                  <option value="">— select variant —</option>
                  {variantOptions.map((v) => (
                    <option key={v.productVariantId} value={v.productVariantId}>
                      {v.productName}
                      {v.sku ? ` (${v.sku})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Serial number *
                  <input
                    type="text"
                    value={form.serialNumber}
                    onChange={(e) => setField('serialNumber', e.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-300">
                  Warehouse
                  <select
                    value={form.warehouseId ?? ''}
                    onChange={(e) => setField('warehouseId', e.target.value ? Number(e.target.value) : null)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                  >
                    <option value="">Default</option>
                    {(warehousesQ.data ?? []).map((w) => (
                      <option key={w.warehouseId} value={w.warehouseId}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-300">
                  IMEI 1
                  <input
                    type="text"
                    value={form.imei1}
                    onChange={(e) => setField('imei1', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-300">
                  IMEI 2
                  <input
                    type="text"
                    value={form.imei2}
                    onChange={(e) => setField('imei2', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-300">
                  Purchase cost / unit
                  <input
                    type="number"
                    step="0.01"
                    value={form.purchaseCostPerUnit}
                    onChange={(e) => setField('purchaseCostPerUnit', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-300">
                  Warranty start
                  <input
                    type="date"
                    value={form.warrantyStartUtc}
                    onChange={(e) => setField('warrantyStartUtc', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-300">
                  Warranty end
                  <input
                    type="date"
                    value={form.warrantyEndUtc}
                    onChange={(e) => setField('warrantyEndUtc', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                  />
                </label>
              </div>
              <label className="block text-xs font-semibold text-slate-300">
                Notes
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                />
              </label>
              {formError && (
                <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                  {formError}
                </div>
              )}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={createM.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 disabled:opacity-50"
                >
                  {createM.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  Create serial
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
