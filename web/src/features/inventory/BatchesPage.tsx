import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Layers, Loader2, Plus, Search } from 'lucide-react';
import { inventoryApi } from './inventoryApi';
import { fmtDate, fmtInr } from './inventoryHelpers';
import type { CreateBatchBody } from '../../entities/inventory';
import { useAppSelector } from '../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../auth/authSlice';

const PAGE_SIZE = 25;
const QUALITY_OPTIONS = ['Good', 'Quarantine', 'Damaged', 'Expired'];

type FormState = {
  productVariantId: number | null;
  batchNumber: string;
  lotNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  qualityStatus: string;
  costPerUnit: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  productVariantId: null,
  batchNumber: '',
  lotNumber: '',
  manufacturingDate: '',
  expiryDate: '',
  qualityStatus: 'Good',
  costPerUnit: '',
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

export function BatchesPage() {
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const orgId = workplace?.organizationId ?? 0;
  const qc = useQueryClient();
  const queryReady = authed && workplace != null;

  const [search, setSearch] = useState('');
  const [qualityFilter, setQualityFilter] = useState('');
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const variantsQ = useQuery({
    queryKey: ['variants-for-batches', orgId],
    queryFn: () => inventoryApi.variants.browse({ activeOnly: true, take: 500 }),
    enabled: queryReady,
    retry: 1,
  });

  const listQ = useQuery({
    queryKey: ['inv-batches', orgId, search, qualityFilter, page],
    queryFn: () =>
      inventoryApi.batches.browse({
        search: search.trim() || undefined,
        qualityStatus: qualityFilter || undefined,
        skip: page * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    enabled: queryReady,
    retry: 1,
  });

  const createM = useMutation({
    mutationFn: (body: CreateBatchBody) => inventoryApi.batches.create(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inv-batches'] });
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
    if (!form.batchNumber.trim()) {
      setFormError('Batch number is required.');
      return;
    }
    createM.mutate({
      productVariantId: form.productVariantId,
      batchNumber: form.batchNumber.trim(),
      lotNumber: form.lotNumber.trim() || null,
      manufacturingDate: form.manufacturingDate || null,
      expiryDate: form.expiryDate || null,
      qualityStatus: form.qualityStatus,
      costPerUnit: parseOptional(form.costPerUnit),
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
          <p className="text-sm font-medium text-emerald-400/90">Inventory · batches / lots</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white lg:text-3xl">Batches</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Track stock by manufacturing batch / lot — required for variants whose tracking mode is{' '}
            <span className="font-mono">Batch</span> or <span className="font-mono">BatchAndSerial</span>.
            Expiry data drives the FEFO report.
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
          <Plus className="h-4 w-4" aria-hidden /> New batch
        </button>
      </header>

      <section className="workspace-panel border border-white/10 p-4">
        <div className="grid gap-3 lg:grid-cols-3">
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
                placeholder="Search batch number, lot, product, SKU…"
                className="w-full rounded-lg border border-white/10 bg-slate-900/80 py-2 pl-9 pr-3 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </div>
          </label>
          <label className="block text-xs font-semibold text-slate-300">
            Quality status
            <select
              value={qualityFilter}
              onChange={(e) => {
                setPage(0);
                setQualityFilter(e.target.value);
              }}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            >
              <option value="">All</option>
              {QUALITY_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
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
                <th className="px-4 py-3 text-left">Batch / Lot</th>
                <th className="px-4 py-3 text-left">Variant</th>
                <th className="px-4 py-3 text-left">Mfg</th>
                <th className="px-4 py-3 text-left">Expiry</th>
                <th className="px-4 py-3 text-left">Quality</th>
                <th className="px-4 py-3 text-right">Cost / unit</th>
                <th className="px-4 py-3 text-left">Supplier</th>
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
                    No batches found.
                  </td>
                </tr>
              ) : (
                rows.map((b) => (
                  <tr key={b.batchId} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-slate-100">
                        <Layers className="h-4 w-4 text-blue-300" aria-hidden />
                        <div>
                          <p className="font-semibold">{b.batchNumber}</p>
                          {b.lotNumber && <p className="text-xs text-slate-500">Lot {b.lotNumber}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="text-slate-200">{b.variantDisplay}</div>
                      <div className="text-slate-500">{b.sku ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{fmtDate(b.manufacturingDate)}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{fmtDate(b.expiryDate)}</td>
                    <td className="px-4 py-3 text-xs text-slate-300">{b.qualityStatus}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      {b.costPerUnit != null ? fmtInr(b.costPerUnit) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">{b.supplierName ?? '—'}</td>
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
              <h2 className="text-lg font-bold text-white">New batch</h2>
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
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                  required
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
                  Batch number *
                  <input
                    type="text"
                    value={form.batchNumber}
                    onChange={(e) => setField('batchNumber', e.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-300">
                  Lot number
                  <input
                    type="text"
                    value={form.lotNumber}
                    onChange={(e) => setField('lotNumber', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-300">
                  Manufacturing date
                  <input
                    type="date"
                    value={form.manufacturingDate}
                    onChange={(e) => setField('manufacturingDate', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-300">
                  Expiry date
                  <input
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) => setField('expiryDate', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-300">
                  Quality status
                  <select
                    value={form.qualityStatus}
                    onChange={(e) => setField('qualityStatus', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                  >
                    {QUALITY_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-300">
                  Cost per unit
                  <input
                    type="number"
                    step="0.01"
                    value={form.costPerUnit}
                    onChange={(e) => setField('costPerUnit', e.target.value)}
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
                  Create batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
