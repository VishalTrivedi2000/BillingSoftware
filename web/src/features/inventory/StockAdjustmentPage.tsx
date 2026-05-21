import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import { inventoryApi } from './inventoryApi';
import { fmtQty } from './inventoryHelpers';
import type { StockAdjustmentLineBody, SubmitStockAdjustmentBody } from '../../entities/inventory';
import { useAppSelector } from '../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../auth/authSlice';

type LineForm = {
  productVariantId: number | null;
  actualQty: string;
  systemQty: string;
  reason: string;
};

const EMPTY_LINE: LineForm = {
  productVariantId: null,
  actualQty: '',
  systemQty: '',
  reason: '',
};

function parseNum(v: string): number {
  if (!v.trim()) return 0;
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : 0;
}

function extractAxiosError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const d = e.response?.data;
    if (typeof d === 'string' && d.trim()) return d;
    return e.message || 'Request failed.';
  }
  return e instanceof Error ? e.message : 'Request failed.';
}

export function StockAdjustmentPage() {
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const orgId = workplace?.organizationId ?? 0;
  const navigate = useNavigate();
  const queryReady = authed && workplace != null;

  const [warehouseId, setWarehouseId] = useState<number | undefined>();
  const [reason, setReason] = useState('Cycle count');
  const [notes, setNotes] = useState('');
  const [requireApproval, setRequireApproval] = useState(false);
  const [lines, setLines] = useState<LineForm[]>([EMPTY_LINE]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const warehousesQ = useQuery({
    queryKey: ['inv-warehouses-list', orgId, true],
    queryFn: () => inventoryApi.warehouses.list(true),
    enabled: queryReady,
    retry: 1,
  });

  const variantsQ = useQuery({
    queryKey: ['variants-for-adjustment', orgId],
    queryFn: () => inventoryApi.variants.browse({ activeOnly: true, take: 500 }),
    enabled: queryReady,
    retry: 1,
  });

  useEffect(() => {
    if (warehouseId == null && warehousesQ.data && warehousesQ.data.length > 0) {
      const def = warehousesQ.data.find((w) => w.isDefault) ?? warehousesQ.data[0];
      setWarehouseId(def.warehouseId);
    }
  }, [warehouseId, warehousesQ.data]);

  const submitM = useMutation({
    mutationFn: (body: SubmitStockAdjustmentBody) => inventoryApi.inventory.submitAdjustment(body),
    onSuccess: (dto) => {
      setError(null);
      const msg = dto.adjustmentApprovalId
        ? `Adjustment ${dto.adjustmentNumber ?? `#${dto.adjustmentApprovalId}`} pending approval. ${dto.postedTransactionCount} lines queued.`
        : `${dto.postedTransactionCount} ledger transactions posted.`;
      setResult(msg);
    },
    onError: (e) => setError(extractAxiosError(e)),
  });

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
    setResult(null);
    if (!warehouseId) {
      setError('Pick a warehouse.');
      return;
    }
    const payloadLines: StockAdjustmentLineBody[] = lines
      .filter((l) => l.productVariantId != null)
      .map((l) => ({
        productVariantId: l.productVariantId!,
        actualQty: parseNum(l.actualQty),
        systemQty: parseNum(l.systemQty),
        reason: l.reason.trim() || null,
      }));
    if (payloadLines.length === 0) {
      setError('Add at least one line.');
      return;
    }
    submitM.mutate({
      warehouseId,
      reason: reason.trim() || 'Cycle count',
      notes: notes.trim() || null,
      requireApproval,
      lines: payloadLines,
    });
  }

  const variantOptions = useMemo(() => variantsQ.data?.items ?? [], [variantsQ.data]);

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 pb-12">
      <header className="flex items-center justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back
          </button>
          <p className="mt-2 text-sm font-medium text-emerald-400/90">Inventory · adjustment</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white lg:text-3xl">
            Stock adjustment
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Reconcile system stock against physical count. Posts signed ledger transactions
            (ADJUSTMENT_POSITIVE / ADJUSTMENT_NEGATIVE) so trail is preserved.
          </p>
        </div>
      </header>

      <form onSubmit={submit} className="space-y-4">
        <section className="workspace-panel border border-white/10 p-4">
          <div className="grid gap-3 lg:grid-cols-3">
            <label className="block text-xs font-semibold text-slate-300">
              Warehouse *
              <select
                value={warehouseId ?? ''}
                onChange={(e) => setWarehouseId(e.target.value ? Number(e.target.value) : undefined)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                required
              >
                <option value="">— select warehouse —</option>
                {(warehousesQ.data ?? []).map((w) => (
                  <option key={w.warehouseId} value={w.warehouseId}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-300">
              Reason *
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                placeholder="Cycle count / Damage / Theft / Found"
                required
              />
            </label>
            <label className="flex items-end gap-2 text-xs font-semibold text-slate-300">
              <input
                type="checkbox"
                checked={requireApproval}
                onChange={(e) => setRequireApproval(e.target.checked)}
                className="h-4 w-4 rounded border-white/30 bg-transparent"
              />
              Require approval
            </label>
          </div>
          <label className="mt-3 block text-xs font-semibold text-slate-300">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              rows={2}
            />
          </label>
        </section>

        <section className="workspace-panel border border-white/10">
          <header className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
              Adjustment lines
            </h2>
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-white/10"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add line
            </button>
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">Variant</th>
                  <th className="px-4 py-3 text-right">System qty</th>
                  <th className="px-4 py-3 text-right">Actual qty</th>
                  <th className="px-4 py-3 text-right">Delta</th>
                  <th className="px-4 py-3 text-left">Reason</th>
                  <th className="px-4 py-3 text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {lines.map((line, idx) => {
                  const delta = parseNum(line.actualQty) - parseNum(line.systemQty);
                  return (
                    <tr key={idx} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <select
                          value={line.productVariantId ?? ''}
                          onChange={(e) =>
                            updateLine(idx, {
                              productVariantId: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs text-white focus:border-blue-400 focus:outline-none"
                        >
                          <option value="">— select variant —</option>
                          {variantOptions.map((v) => (
                            <option key={v.productVariantId} value={v.productVariantId}>
                              {v.productName}
                              {v.sku ? ` (${v.sku})` : ''}
                              {v.displayName ? ` · ${v.displayName}` : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          step="0.001"
                          value={line.systemQty}
                          onChange={(e) => updateLine(idx, { systemQty: e.target.value })}
                          className="w-24 rounded-lg border border-white/10 bg-slate-900/80 px-2 py-1.5 text-right font-mono text-xs text-white focus:border-blue-400 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          step="0.001"
                          value={line.actualQty}
                          onChange={(e) => updateLine(idx, { actualQty: e.target.value })}
                          className="w-24 rounded-lg border border-white/10 bg-slate-900/80 px-2 py-1.5 text-right font-mono text-xs text-white focus:border-blue-400 focus:outline-none"
                        />
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono text-xs ${delta > 0 ? 'text-emerald-300' : delta < 0 ? 'text-rose-300' : 'text-slate-400'}`}
                      >
                        {delta === 0 ? '0' : delta > 0 ? `+${fmtQty(delta)}` : `−${fmtQty(Math.abs(delta))}`}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={line.reason}
                          onChange={(e) => updateLine(idx, { reason: e.target.value })}
                          placeholder="optional"
                          className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-2 py-1.5 text-xs text-white focus:border-blue-400 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          disabled={lines.length === 1}
                          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10 disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {error && (
          <div role="alert" className="workspace-panel border border-rose-500/25 bg-rose-500/10 px-5 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}
        {result && (
          <div role="status" className="workspace-panel border border-emerald-500/25 bg-emerald-500/10 px-5 py-3 text-sm text-emerald-100">
            {result}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="submit"
            disabled={submitM.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 disabled:opacity-50"
          >
            {submitM.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {requireApproval ? 'Submit for approval' : 'Post adjustment'}
          </button>
        </div>
      </form>
    </div>
  );
}
