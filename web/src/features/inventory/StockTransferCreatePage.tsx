import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import { inventoryApi } from './inventoryApi';
import { fmtInr } from './inventoryHelpers';
import type { CreateStockTransferBody, StockTransferLineBody } from '../../entities/inventory';
import { useAppSelector } from '../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../auth/authSlice';

type LineForm = {
  productVariantId: number | null;
  quantity: string;
  unitCost: string;
};

const EMPTY_LINE: LineForm = { productVariantId: null, quantity: '1', unitCost: '' };

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

export function StockTransferCreatePage() {
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const orgId = workplace?.organizationId ?? 0;
  const navigate = useNavigate();
  const queryReady = authed && workplace != null;

  const [fromWarehouseId, setFromWarehouseId] = useState<number | undefined>();
  const [toWarehouseId, setToWarehouseId] = useState<number | undefined>();
  const [referenceCode, setReferenceCode] = useState('');
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
    queryKey: ['variants-for-transfer', orgId],
    queryFn: () => inventoryApi.variants.browse({ activeOnly: true, take: 500 }),
    enabled: queryReady,
    retry: 1,
  });

  useEffect(() => {
    const data = warehousesQ.data;
    if (!data || data.length < 2) return;
    if (fromWarehouseId == null) {
      const def = data.find((w) => w.isDefault) ?? data[0];
      setFromWarehouseId(def.warehouseId);
    }
    if (toWarehouseId == null) {
      const second = data.find((w) => w.warehouseId !== (fromWarehouseId ?? data[0].warehouseId));
      if (second) setToWarehouseId(second.warehouseId);
    }
  }, [warehousesQ.data, fromWarehouseId, toWarehouseId]);

  const submitM = useMutation({
    mutationFn: (body: CreateStockTransferBody) => inventoryApi.transfers.create(body),
    onSuccess: () => {
      navigate('/inventory/transfers');
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
    if (!fromWarehouseId || !toWarehouseId) {
      setError('Choose source and destination warehouses.');
      return;
    }
    if (fromWarehouseId === toWarehouseId) {
      setError('Source and destination warehouses must differ.');
      return;
    }
    const payloadLines: StockTransferLineBody[] = lines
      .filter((l) => l.productVariantId != null)
      .map((l) => ({
        productVariantId: l.productVariantId!,
        quantity: parseDecimal(l.quantity),
        unitCost: parseOptional(l.unitCost),
      }));
    if (payloadLines.length === 0) {
      setError('Add at least one line with quantity.');
      return;
    }
    if (payloadLines.some((l) => l.quantity <= 0)) {
      setError('Each line must have a positive quantity.');
      return;
    }
    submitM.mutate({
      fromWarehouseId,
      toWarehouseId,
      referenceCode: referenceCode.trim() || null,
      notes: notes.trim() || null,
      lines: payloadLines,
    });
  }

  const variantOptions = useMemo(() => variantsQ.data?.items ?? [], [variantsQ.data]);

  const totalQty = useMemo(
    () => lines.reduce((s, l) => s + parseDecimal(l.quantity, 0), 0),
    [lines],
  );

  const totalValue = useMemo(
    () =>
      lines.reduce((s, l) => {
        const cost = parseOptional(l.unitCost);
        const qty = parseDecimal(l.quantity, 0);
        return s + (cost ?? 0) * qty;
      }, 0),
    [lines],
  );

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 pb-12">
      <header>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back
        </button>
        <p className="mt-2 text-sm font-medium text-emerald-400/90">Inventory · transfer</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white lg:text-3xl">
          New stock transfer
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
          Posts paired ledger entries (TRANSFER_OUT from source, TRANSFER_IN to destination) so
          balances stay reconcilable.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-4">
        <section className="workspace-panel border border-white/10 p-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-300">
              From warehouse *
              <select
                value={fromWarehouseId ?? ''}
                onChange={(e) => setFromWarehouseId(e.target.value ? Number(e.target.value) : undefined)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                required
              >
                <option value="">— select source —</option>
                {(warehousesQ.data ?? []).map((w) => (
                  <option key={w.warehouseId} value={w.warehouseId}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-300">
              To warehouse *
              <select
                value={toWarehouseId ?? ''}
                onChange={(e) => setToWarehouseId(e.target.value ? Number(e.target.value) : undefined)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                required
              >
                <option value="">— select destination —</option>
                {(warehousesQ.data ?? []).map((w) => (
                  <option key={w.warehouseId} value={w.warehouseId}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-300">
              Reference code
              <input
                type="text"
                value={referenceCode}
                onChange={(e) => setReferenceCode(e.target.value)}
                placeholder="e.g. PO-2024-105 or branch-transfer-2024-07"
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-300">
              Notes
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </label>
          </div>
        </section>

        <section className="workspace-panel border border-white/10">
          <header className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">Lines</h2>
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-white/10"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add line
            </button>
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">Variant</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3 text-right">Unit cost</th>
                  <th className="px-4 py-3 text-right">Line value</th>
                  <th className="px-4 py-3 text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {lines.map((line, idx) => {
                  const qty = parseDecimal(line.quantity, 0);
                  const cost = parseOptional(line.unitCost);
                  const value = (cost ?? 0) * qty;
                  return (
                    <tr key={idx}>
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
                          min="0.001"
                          value={line.quantity}
                          onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                          className="w-24 rounded-lg border border-white/10 bg-slate-900/80 px-2 py-1.5 text-right font-mono text-xs text-white focus:border-blue-400 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={line.unitCost}
                          onChange={(e) => updateLine(idx, { unitCost: e.target.value })}
                          placeholder="auto"
                          className="w-24 rounded-lg border border-white/10 bg-slate-900/80 px-2 py-1.5 text-right font-mono text-xs text-white focus:border-blue-400 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-200">
                        {cost != null ? fmtInr(value) : '—'}
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
              <tfoot>
                <tr className="border-t border-white/5 bg-white/[0.02] text-xs font-semibold">
                  <td className="px-4 py-3 text-slate-400">Total</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-100">{totalQty.toFixed(2)}</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right font-mono text-amber-200">{fmtInr(totalValue)}</td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {error && (
          <div role="alert" className="workspace-panel border border-rose-500/25 bg-rose-500/10 px-5 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="submit"
            disabled={submitM.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 disabled:opacity-50"
          >
            {submitM.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Create transfer
          </button>
        </div>
      </form>
    </div>
  );
}
