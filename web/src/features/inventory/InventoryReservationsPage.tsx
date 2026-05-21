import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Loader2, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { inventoryApi } from './inventoryApi';
import { fmtDateTime, fmtQty } from './inventoryHelpers';
import type {
  CreateReservationBody,
  CreateReservationLineBody,
  ReservationSummaryDto,
} from '../../entities/inventory';
import { useAppSelector } from '../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../auth/authSlice';

type LineForm = {
  productVariantId: number | null;
  warehouseId: number | null;
  quantity: string;
};

const EMPTY_LINE: LineForm = { productVariantId: null, warehouseId: null, quantity: '1' };

const STATUS_OPTIONS = [
  { value: 'Active', label: 'Active' },
  { value: 'Expired', label: 'Expired' },
  { value: 'Released', label: 'Released' },
  { value: 'Committed', label: 'Committed' },
];

function parseDecimal(v: string, fallback = 0): number {
  if (!v.trim()) return fallback;
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : fallback;
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
    case 'Active':
      return 'bg-violet-500/10 text-violet-300 ring-violet-500/30';
    case 'Expired':
      return 'bg-amber-500/10 text-amber-300 ring-amber-500/30';
    case 'Released':
      return 'bg-slate-500/10 text-slate-300 ring-slate-500/30';
    case 'Committed':
      return 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30';
    default:
      return 'bg-slate-500/10 text-slate-300 ring-slate-500/30';
  }
}

export function InventoryReservationsPage() {
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const orgId = workplace?.organizationId ?? 0;
  const qc = useQueryClient();
  const queryReady = authed && workplace != null;

  const [statusFilter, setStatusFilter] = useState<string>('Active');
  const [creating, setCreating] = useState(false);
  const [referenceCode, setReferenceCode] = useState('');
  const [customerLabel, setCustomerLabel] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineForm[]>([EMPTY_LINE]);
  const [error, setError] = useState<string | null>(null);

  const warehousesQ = useQuery({
    queryKey: ['inv-warehouses-list', orgId, true],
    queryFn: () => inventoryApi.warehouses.list(true),
    enabled: queryReady,
    retry: 1,
  });

  const variantsQ = useQuery({
    queryKey: ['variants-for-reservation', orgId],
    queryFn: () => inventoryApi.variants.browse({ activeOnly: true, take: 500 }),
    enabled: queryReady && creating,
    retry: 1,
  });

  const listQ = useQuery({
    queryKey: ['inv-reservations', orgId, statusFilter],
    queryFn: () => inventoryApi.reservations.list({ status: statusFilter || undefined, take: 100 }),
    enabled: queryReady,
    retry: 1,
  });

  const createM = useMutation({
    mutationFn: (body: CreateReservationBody) => inventoryApi.reservations.create(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inv-reservations'] });
      setCreating(false);
      setReferenceCode('');
      setCustomerLabel('');
      setValidUntil('');
      setNotes('');
      setLines([EMPTY_LINE]);
      setError(null);
    },
    onError: (e) => setError(extractAxiosError(e)),
  });

  const releaseM = useMutation({
    mutationFn: (id: number) => inventoryApi.reservations.release(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inv-reservations'] });
    },
  });

  useEffect(() => {
    if (!creating) return;
    const w = warehousesQ.data;
    if (!w || w.length === 0) return;
    setLines((curr) =>
      curr.map((l) =>
        l.warehouseId == null
          ? { ...l, warehouseId: (w.find((x) => x.isDefault) ?? w[0]).warehouseId }
          : l,
      ),
    );
  }, [creating, warehousesQ.data]);

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const payloadLines: CreateReservationLineBody[] = lines
      .filter((l) => l.productVariantId != null && l.warehouseId != null)
      .map((l) => ({
        productVariantId: l.productVariantId!,
        warehouseId: l.warehouseId!,
        quantity: parseDecimal(l.quantity),
      }));
    if (payloadLines.length === 0) {
      setError('Add at least one line.');
      return;
    }
    if (payloadLines.some((l) => l.quantity <= 0)) {
      setError('Each line must have a positive quantity.');
      return;
    }
    createM.mutate({
      referenceCode: referenceCode.trim() || null,
      customerLabel: customerLabel.trim() || null,
      validUntilUtc: validUntil ? new Date(validUntil).toISOString() : null,
      notes: notes.trim() || null,
      lines: payloadLines,
    });
  }

  function updateLine(idx: number, patch: Partial<LineForm>) {
    setLines((s) => s.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((s) => [
      ...s,
      { ...EMPTY_LINE, warehouseId: s[0]?.warehouseId ?? null },
    ]);
  }

  function removeLine(idx: number) {
    setLines((s) => s.filter((_, i) => i !== idx));
  }

  const variantOptions = useMemo(() => variantsQ.data?.items ?? [], [variantsQ.data]);
  const rows: ReservationSummaryDto[] = listQ.data ?? [];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-12">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-400/90">Inventory · reservations</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white lg:text-3xl">
            Stock reservations
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Hold quantity for specific customers, quotations, or pickup slots. Posts ledger
            RESERVE / RELEASE_RESERVATION entries so available stock reflects holds.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="block text-xs font-semibold text-slate-300">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setError(null);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New reservation
          </button>
        </div>
      </header>

      <section className="workspace-panel border border-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Reference</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Reserved on</th>
                <th className="px-4 py-3 text-left">Valid until</th>
                <th className="px-4 py-3 text-right">Lines</th>
                <th className="px-4 py-3 text-right">Total qty</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {listQ.isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" aria-hidden />
                    Loading reservations…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    No reservations for this filter.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.inventoryReservationId} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-slate-100">
                        <ShieldAlert className="h-4 w-4 text-violet-300" aria-hidden />
                        <span className="font-mono text-xs">{r.referenceCode ?? `RSV-${r.inventoryReservationId}`}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{r.customerLabel ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{fmtDateTime(r.reservationDateUtc)}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{r.validUntilUtc ? fmtDateTime(r.validUntilUtc) : '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-200">{r.lineCount}</td>
                    <td className="px-4 py-3 text-right font-mono text-violet-300">{fmtQty(r.totalQuantity)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ${statusTone(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.status === 'Active' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm('Release this reservation? Reserved qty will return to Available.')) {
                              releaseM.mutate(r.inventoryReservationId);
                            }
                          }}
                          disabled={releaseM.isPending}
                          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/10 disabled:opacity-40"
                        >
                          Release
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {creating && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/70 backdrop-blur-sm sm:items-center">
          <div className="workspace-panel w-full max-w-3xl border border-white/10 p-6">
            <header className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">New reservation</h2>
                <p className="text-xs text-slate-400">
                  Permission required: <span className="font-mono">inventory.reserve</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setError(null);
                }}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10"
              >
                Cancel
              </button>
            </header>

            <form onSubmit={submit} className="space-y-3">
              <div className="grid gap-3 lg:grid-cols-3">
                <label className="block text-xs font-semibold text-slate-300">
                  Reference code
                  <input
                    type="text"
                    value={referenceCode}
                    onChange={(e) => setReferenceCode(e.target.value)}
                    placeholder="QUO-2025-001 or order-9842"
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-300">
                  Customer label
                  <input
                    type="text"
                    value={customerLabel}
                    onChange={(e) => setCustomerLabel(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-300">
                  Valid until
                  <input
                    type="datetime-local"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                  />
                </label>
              </div>
              <label className="block text-xs font-semibold text-slate-300">
                Notes
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                />
              </label>

              <div className="rounded-xl border border-white/10">
                <header className="flex items-center justify-between border-b border-white/5 px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Lines</span>
                  <button
                    type="button"
                    onClick={addLine}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-300 hover:text-blue-200"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden /> Add line
                  </button>
                </header>
                <div className="space-y-2 p-3">
                  {lines.map((line, idx) => (
                    <div key={idx} className="grid gap-2 lg:grid-cols-[2fr_1fr_120px_36px] lg:items-end">
                      <label className="block text-xs font-semibold text-slate-300">
                        Variant
                        <select
                          value={line.productVariantId ?? ''}
                          onChange={(e) =>
                            updateLine(idx, {
                              productVariantId: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs text-white focus:border-blue-400 focus:outline-none"
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
                      <label className="block text-xs font-semibold text-slate-300">
                        Warehouse
                        <select
                          value={line.warehouseId ?? ''}
                          onChange={(e) =>
                            updateLine(idx, { warehouseId: e.target.value ? Number(e.target.value) : null })
                          }
                          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs text-white focus:border-blue-400 focus:outline-none"
                        >
                          <option value="">—</option>
                          {(warehousesQ.data ?? []).map((w) => (
                            <option key={w.warehouseId} value={w.warehouseId}>
                              {w.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-xs font-semibold text-slate-300">
                        Quantity
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          value={line.quantity}
                          onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-2 py-1.5 text-right font-mono text-xs text-white focus:border-blue-400 focus:outline-none"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        disabled={lines.length === 1}
                        className="h-9 rounded-lg border border-white/10 bg-white/5 px-2 text-xs text-rose-300 hover:bg-rose-500/10 disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  disabled={createM.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 disabled:opacity-50"
                >
                  {createM.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  Reserve stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
