import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  CheckCircle2,
  Circle,
  CircleDollarSign,
  Download,
  Loader2,
  PackageMinus,
  PackageX,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Wrench,
  XCircle,
} from 'lucide-react';
import { inventoryApi } from './inventoryApi';
import { fmtDateTime, fmtInr, fmtQty } from './inventoryHelpers';
import {
  type CreateReturnBody,
  type ReturnLineBody,
  type ReturnSummaryDto,
  type ReturnType,
  ReturnTypes,
} from '../../entities/inventory';
import { useAppSelector } from '../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../auth/authSlice';
import { KpiTile } from '../../shared/ui/charts';

const RETURN_TYPE_OPTIONS: { value: ReturnType; label: string }[] = [
  { value: ReturnTypes.CustomerReturn, label: 'Customer return' },
  { value: ReturnTypes.SupplierReturn, label: 'Supplier return' },
  { value: ReturnTypes.Exchange, label: 'Exchange' },
  { value: ReturnTypes.WarrantyClaim, label: 'Warranty claim' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'Requested', label: 'Requested' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Received', label: 'Received' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Rejected', label: 'Rejected' },
];

type LineForm = {
  productVariantId: number | null;
  quantity: string;
  unitRefundAmount: string;
  reason: string;
  disposition: string;
};

const EMPTY_LINE: LineForm = {
  productVariantId: null,
  quantity: '1',
  unitRefundAmount: '',
  reason: '',
  disposition: 'Restock',
};

function parseDecimal(v: string, fallback = 0): number {
  if (!v.trim()) return fallback;
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : fallback;
}

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
    case 'Requested':
      return 'bg-amber-500/10 text-amber-300 ring-amber-500/30';
    case 'Approved':
      return 'bg-blue-500/10 text-blue-300 ring-blue-500/30';
    case 'Received':
      return 'bg-violet-500/10 text-violet-300 ring-violet-500/30';
    case 'Completed':
      return 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30';
    case 'Rejected':
      return 'bg-rose-500/10 text-rose-300 ring-rose-500/30';
    default:
      return 'bg-slate-500/10 text-slate-300 ring-slate-500/30';
  }
}

export function ReturnsPage() {
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const orgId = workplace?.organizationId ?? 0;
  const qc = useQueryClient();
  const queryReady = authed && workplace != null;

  const [returnTypeFilter, setReturnTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [returnType, setReturnType] = useState<ReturnType>(ReturnTypes.CustomerReturn);
  const [warehouseId, setWarehouseId] = useState<number | undefined>();
  const [reason, setReason] = useState('');
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
    queryKey: ['variants-for-return', orgId],
    queryFn: () => inventoryApi.variants.browse({ activeOnly: true, take: 500 }),
    enabled: queryReady && creating,
    retry: 1,
  });

  const listQ = useQuery({
    queryKey: ['inv-returns', orgId, returnTypeFilter, statusFilter, search],
    queryFn: () =>
      inventoryApi.returns.browse({
        returnType: returnTypeFilter || undefined,
        status: statusFilter || undefined,
        search: search.trim() || undefined,
        take: 50,
      }),
    enabled: queryReady,
    retry: 1,
  });

  const createM = useMutation({
    mutationFn: (body: CreateReturnBody) => inventoryApi.returns.create(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inv-returns'] });
      setCreating(false);
      setLines([EMPTY_LINE]);
      setReason('');
      setNotes('');
      setError(null);
    },
    onError: (e) => setError(extractAxiosError(e)),
  });

  const approveM = useMutation({
    mutationFn: (id: number) => inventoryApi.returns.approve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inv-returns'] }),
  });
  const receiveM = useMutation({
    mutationFn: (id: number) => inventoryApi.returns.receive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inv-returns'] }),
  });
  const completeM = useMutation({
    mutationFn: (id: number) => inventoryApi.returns.inspectComplete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inv-returns'] }),
  });

  const rows: ReturnSummaryDto[] = listQ.data?.items ?? [];
  const [selectedReturn, setSelectedReturn] = useState<ReturnSummaryDto | null>(null);

  const kpis = useMemo(() => {
    const open = rows.filter((r) => r.status === 'Requested' || r.status === 'Approved').length;
    const approvedRefunds = rows
      .filter((r) => r.status !== 'Rejected' && r.returnType !== ReturnTypes.WarrantyClaim)
      .reduce((s, r) => s + (r.totalRefundAmount ?? 0), 0);
    const repairs = rows.filter((r) => r.returnType === ReturnTypes.WarrantyClaim).length;
    const warranty = rows.filter((r) => r.returnType === ReturnTypes.WarrantyClaim).length;
    const replacements = rows.filter((r) => r.returnType === ReturnTypes.Exchange).length;
    const rejected = rows.filter((r) => r.status === 'Rejected').length;
    return { open, approvedRefunds, repairs, warranty, replacements, rejected };
  }, [rows]);

  function updateLine(idx: number, patch: Partial<LineForm>) {
    setLines((s) => s.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((s) => [...s, EMPTY_LINE]);
  }
  function removeLine(idx: number) {
    setLines((s) => s.filter((_, i) => i !== idx));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const payloadLines: ReturnLineBody[] = lines
      .filter((l) => l.productVariantId != null)
      .map((l) => ({
        productVariantId: l.productVariantId,
        quantity: parseDecimal(l.quantity),
        unitRefundAmount: parseOptional(l.unitRefundAmount),
        reason: l.reason.trim() || null,
        disposition: l.disposition.trim() || null,
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
      returnType,
      warehouseId: warehouseId ?? null,
      reason: reason.trim() || null,
      notes: notes.trim() || null,
      lines: payloadLines,
    });
  }

  const variantOptions = useMemo(() => variantsQ.data?.items ?? [], [variantsQ.data]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-12">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-400/90">Inventory · RMA</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white lg:text-3xl">
            Returns & RMA
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Customer returns, supplier returns, exchanges, warranty claims. Workflow: Requested →
            Approved → Received → Completed. Completion posts SALE_RETURN / PURCHASE_RETURN ledger
            entries.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              const csv = rows
                .map((r) =>
                  [
                    r.returnNumber ?? r.returnAuthorizationId,
                    r.returnType,
                    JSON.stringify(r.partyName ?? ''),
                    r.warehouseName ?? '',
                    r.status,
                    r.totalQuantity,
                    r.totalRefundAmount ?? '',
                  ].join(','),
                )
                .join('\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `returns-${Date.now()}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
          >
            <Download className="h-4 w-4" /> Export
          </button>
          <button
            type="button"
            onClick={() => {
              setReturnType(ReturnTypes.Exchange);
              setCreating(true);
              setError(null);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
          >
            <RotateCcw className="h-4 w-4" /> Exchange
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setError(null);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Create return
          </button>
        </div>
      </header>

      <section aria-label="Returns KPIs" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiTile
          title="Open returns"
          value={kpis.open.toLocaleString()}
          hint="Requested + Approved"
          icon={PackageMinus}
          tone="blue"
        />
        <KpiTile
          title="Approved refunds"
          value={fmtInr(kpis.approvedRefunds)}
          hint="Customer + supplier"
          icon={CircleDollarSign}
          tone="emerald"
        />
        <KpiTile
          title="Repair cases"
          value={kpis.repairs.toLocaleString()}
          hint="Warranty repairs"
          icon={Wrench}
          tone="amber"
        />
        <KpiTile
          title="Warranty claims"
          value={kpis.warranty.toLocaleString()}
          hint="Manufacturer warranty"
          icon={ShieldCheck}
          tone="violet"
        />
        <KpiTile
          title="Replacements"
          value={kpis.replacements.toLocaleString()}
          hint="Exchanges + swaps"
          icon={RotateCcw}
          tone="cyan"
        />
        <KpiTile
          title="Rejected / declined"
          value={kpis.rejected.toLocaleString()}
          hint="Not approved"
          icon={PackageX}
          tone="rose"
        />
      </section>

      <section className="workspace-panel border border-white/10 p-4">
        <div className="grid gap-3 lg:grid-cols-3">
          <label className="block text-xs font-semibold text-slate-300">
            Type
            <select
              value={returnTypeFilter}
              onChange={(e) => setReturnTypeFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            >
              <option value="">All types</option>
              {RETURN_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-300">
            Status
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-300">
            Search
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search return number, party, notes…"
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            />
          </label>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
      <section className="workspace-panel border border-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Return #</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Party</th>
                <th className="px-4 py-3 text-left">Warehouse</th>
                <th className="px-4 py-3 text-left">Requested</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Refund</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {listQ.isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" aria-hidden />
                    Loading returns…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                    No returns recorded.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.returnAuthorizationId}
                    onClick={() => setSelectedReturn(r)}
                    className={`cursor-pointer hover:bg-white/[0.02] ${
                      selectedReturn?.returnAuthorizationId === r.returnAuthorizationId
                        ? 'bg-blue-500/5'
                        : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-slate-100">
                        <PackageMinus className="h-4 w-4 text-amber-300" aria-hidden />
                        <span className="font-mono text-xs">{r.returnNumber ?? `RMA-${r.returnAuthorizationId}`}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">{r.returnType}</td>
                    <td className="px-4 py-3 text-xs text-slate-300">{r.partyName ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-300">{r.warehouseName ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{fmtDateTime(r.requestedUtc)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-200">{fmtQty(r.totalQuantity)}</td>
                    <td className="px-4 py-3 text-right font-mono text-amber-300">
                      {r.totalRefundAmount != null ? fmtInr(r.totalRefundAmount) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ${statusTone(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        {r.status === 'Requested' && (
                          <button
                            type="button"
                            onClick={() => approveM.mutate(r.returnAuthorizationId)}
                            disabled={approveM.isPending}
                            className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-200 hover:bg-blue-500/20 disabled:opacity-40"
                          >
                            Approve
                          </button>
                        )}
                        {r.status === 'Approved' && (
                          <button
                            type="button"
                            onClick={() => receiveM.mutate(r.returnAuthorizationId)}
                            disabled={receiveM.isPending}
                            className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-xs font-semibold text-violet-200 hover:bg-violet-500/20 disabled:opacity-40"
                          >
                            Receive
                          </button>
                        )}
                        {r.status === 'Received' && (
                          <button
                            type="button"
                            onClick={() => completeM.mutate(r.returnAuthorizationId)}
                            disabled={completeM.isPending}
                            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40"
                          >
                            Complete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="workspace-panel border border-white/10 p-4">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
              Return workflow
            </h2>
            {selectedReturn && (
              <button
                type="button"
                onClick={() => setSelectedReturn(null)}
                className="text-[11px] font-semibold text-blue-300 hover:text-blue-200"
              >
                Clear
              </button>
            )}
          </header>
          <ReturnWorkflowStepper status={selectedReturn?.status ?? 'Requested'} />
        </div>

        {selectedReturn && (
          <div className="workspace-panel border border-white/10 p-4">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
              Selected return
            </h2>
            <dl className="space-y-1.5 text-xs">
              <KV
                k="Return no."
                v={selectedReturn.returnNumber ?? `RMA-${selectedReturn.returnAuthorizationId}`}
              />
              <KV k="Type" v={selectedReturn.returnType} />
              <KV k="Customer / Supplier" v={selectedReturn.partyName ?? '—'} />
              <KV k="Warehouse" v={selectedReturn.warehouseName ?? '—'} />
              <KV k="Status" v={selectedReturn.status} />
              <KV
                k="Total amount"
                v={
                  selectedReturn.totalRefundAmount != null
                    ? fmtInr(selectedReturn.totalRefundAmount)
                    : '—'
                }
              />
            </dl>
            <button
              type="button"
              className="mt-3 w-full rounded-lg border border-blue-500/40 bg-blue-500/10 py-1.5 text-xs font-semibold text-blue-100 hover:bg-blue-500/20"
            >
              View return details
            </button>
          </div>
        )}
      </aside>
      </div>

      {creating && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/70 backdrop-blur-sm sm:items-center">
          <div className="workspace-panel w-full max-w-3xl border border-white/10 p-6">
            <header className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">New return / RMA</h2>
                <p className="text-xs text-slate-400">
                  Permission required: <span className="font-mono">inventory.return</span>
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
                  Return type *
                  <select
                    value={returnType}
                    onChange={(e) => setReturnType(e.target.value as ReturnType)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                  >
                    {RETURN_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-300">
                  Warehouse
                  <select
                    value={warehouseId ?? ''}
                    onChange={(e) =>
                      setWarehouseId(e.target.value ? Number(e.target.value) : undefined)
                    }
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
                  Reason
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Damaged on arrival / Wrong size"
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
                    <div
                      key={idx}
                      className="grid gap-2 lg:grid-cols-[2fr_100px_120px_1fr_120px_36px] lg:items-end"
                    >
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
                        Qty
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          value={line.quantity}
                          onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-2 py-1.5 text-right font-mono text-xs text-white focus:border-blue-400 focus:outline-none"
                        />
                      </label>
                      <label className="block text-xs font-semibold text-slate-300">
                        Refund / unit
                        <input
                          type="number"
                          step="0.01"
                          value={line.unitRefundAmount}
                          onChange={(e) => updateLine(idx, { unitRefundAmount: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-2 py-1.5 text-right font-mono text-xs text-white focus:border-blue-400 focus:outline-none"
                        />
                      </label>
                      <label className="block text-xs font-semibold text-slate-300">
                        Reason
                        <input
                          type="text"
                          value={line.reason}
                          onChange={(e) => updateLine(idx, { reason: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-2 py-1.5 text-xs text-white focus:border-blue-400 focus:outline-none"
                        />
                      </label>
                      <label className="block text-xs font-semibold text-slate-300">
                        Disposition
                        <select
                          value={line.disposition}
                          onChange={(e) => updateLine(idx, { disposition: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs text-white focus:border-blue-400 focus:outline-none"
                        >
                          <option value="Restock">Restock</option>
                          <option value="Quarantine">Quarantine</option>
                          <option value="Damaged">Damaged</option>
                          <option value="Scrap">Scrap</option>
                          <option value="ReturnToVendor">Return to vendor</option>
                        </select>
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
                  Create return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-right font-medium text-slate-100">{v}</dd>
    </div>
  );
}

function ReturnWorkflowStepper({ status }: { status: string }) {
  const steps = [
    { key: 'Requested', label: 'Requested', hint: 'Return requested by customer', icon: Circle },
    { key: 'Approved', label: 'Approved', hint: 'Return approved', icon: CheckCircle2 },
    { key: 'Received', label: 'Received', hint: 'Item received at warehouse', icon: CheckCircle2 },
    { key: 'Inspected', label: 'Inspected', hint: 'Item inspection in progress', icon: Wrench },
    { key: 'Refund', label: 'Refund / Replace', hint: 'Refund or replacement processed', icon: CircleDollarSign },
    { key: 'Completed', label: 'Completed', hint: 'Return case closed', icon: CheckCircle2 },
  ];
  const order = ['Requested', 'Approved', 'Received', 'Inspected', 'Refund', 'Completed', 'Rejected'];
  let activeIdx = order.indexOf(status);
  if (status === 'Rejected') activeIdx = 1;
  if (activeIdx === -1) activeIdx = 0;
  return (
    <ol className="space-y-3">
      {steps.map((s, idx) => {
        const done = idx < activeIdx;
        const active = idx === activeIdx;
        const Icon = s.icon;
        const colorBg = done
          ? 'bg-emerald-500 text-white'
          : active
            ? 'bg-blue-500 text-white'
            : 'bg-slate-700 text-slate-300';
        const lineCls = done ? 'bg-emerald-500/50' : 'bg-slate-700/50';
        return (
          <li key={s.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] ${colorBg}`}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
              </span>
              {idx < steps.length - 1 && <span className={`mt-1 h-7 w-px ${lineCls}`} />}
            </div>
            <div className="pb-1">
              <p
                className={`text-xs font-semibold ${
                  done
                    ? 'text-emerald-200'
                    : active
                      ? 'text-blue-200'
                      : 'text-slate-300'
                }`}
              >
                {s.label}
              </p>
              <p className="text-[11px] text-slate-500">{s.hint}</p>
              {status === 'Rejected' && idx === 1 && (
                <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-rose-300">
                  <XCircle className="h-3 w-3" /> Rejected
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
