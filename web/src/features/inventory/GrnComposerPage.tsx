import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Hash,
  Layers,
  Loader2,
  Package,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Truck,
} from 'lucide-react';
import { inventoryApi } from './inventoryApi';
import { fmtInr } from './inventoryHelpers';
import { useAppSelector } from '../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../auth/authSlice';
import { apiJsonAuth } from '../../shared/api/axiosClient';
import type {
  PurchaseBillDetailDto,
  PurchaseBillSummaryDto,
} from '../../entities/billing';

type LineForm = {
  purchaseLineId: number;
  productId: number | null;
  productLabel: string;
  ordered: number;
  unitCost: number;
  receivedQty: string;
  batchNumber: string;
  expiryDate: string;
  rackBin: string;
  qualityStatus: string;
  notes: string;
};

const QC_OPTIONS = ['Pending', 'Passed', 'Failed', 'Partial'];

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

export function GrnComposerPage() {
  const params = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const ready = authed && workplace != null;

  const purchaseBillIdParam = params.purchaseBillId;
  const [purchaseId, setPurchaseId] = useState<number | null>(
    purchaseBillIdParam ? Number(purchaseBillIdParam) : null,
  );
  const [grnNumber, setGrnNumber] = useState(
    `GRN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 9999)
      .toString()
      .padStart(4, '0')}`,
  );
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [transporter, setTransporter] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [docSearch, setDocSearch] = useState('');
  const [lines, setLines] = useState<LineForm[]>([]);

  const purchasesQ = useQuery({
    queryKey: ['grn-open-purchases'],
    queryFn: () => apiJsonAuth<PurchaseBillSummaryDto[]>('/v1/purchases?take=100'),
    enabled: ready,
    retry: 1,
  });

  const warehousesQ = useQuery({
    queryKey: ['grn-warehouses'],
    queryFn: () => inventoryApi.warehouses.list(true),
    enabled: ready,
    retry: 1,
  });

  const detailQ = useQuery({
    queryKey: ['grn-purchase-detail', purchaseId],
    queryFn: () => apiJsonAuth<PurchaseBillDetailDto>(`/v1/purchases/${purchaseId}`),
    enabled: ready && purchaseId != null,
    retry: 1,
  });

  useEffect(() => {
    if (detailQ.data) {
      const newLines: LineForm[] = detailQ.data.lines.map((l) => ({
        purchaseLineId: l.purchaseLineId,
        productId: l.productId,
        productLabel: l.description,
        ordered: l.quantity,
        unitCost: l.unitCost,
        receivedQty: String(l.quantity),
        batchNumber: '',
        expiryDate: '',
        rackBin: '',
        qualityStatus: 'Pending',
        notes: '',
      }));
      setLines(newLines);
    } else {
      setLines([]);
    }
  }, [detailQ.data]);

  const purchases = purchasesQ.data ?? [];
  const filteredPOs = useMemo(() => {
    if (!docSearch) return purchases;
    const s = docSearch.toLowerCase();
    return purchases.filter(
      (p) =>
        (p.purchaseNumber ?? '').toLowerCase().includes(s) ||
        p.supplierName.toLowerCase().includes(s),
    );
  }, [purchases, docSearch]);

  const selectedPO = useMemo(() => {
    if (!purchaseId) return null;
    return purchases.find((p) => p.purchaseBillId === purchaseId) ?? null;
  }, [purchases, purchaseId]);

  // The GRN posts a stock receipt as an inventory adjustment with reason set.
  const postM = useMutation({
    mutationFn: async () => {
      if (!warehouseId) throw new Error('Select a destination warehouse.');
      const lineBodies = lines
        .filter((l) => parseDecimal(l.receivedQty) > 0)
        .map((l) => ({
          productVariantId: l.productId!, // assume productId == productVariantId for unbundled SKUs
          actualQty: parseDecimal(l.receivedQty),
          systemQty: 0,
          reason: `GRN: ${l.qualityStatus}${l.batchNumber ? ` · batch ${l.batchNumber}` : ''}`,
        }));
      if (lineBodies.length === 0) throw new Error('Enter at least one received quantity.');

      return inventoryApi.inventory.submitAdjustment({
        warehouseId,
        reason: `Goods received against PO ${selectedPO?.purchaseNumber ?? `#${purchaseId}`} (${grnNumber}). Supplier: ${selectedPO?.supplierName ?? '—'}. Vehicle: ${vehicleNumber || '—'}. Transporter: ${transporter || '—'}. Invoice ref: ${invoiceRef || '—'}.${notes ? ' Notes: ' + notes : ''}`,
        notes: notes || null,
        requireApproval: false,
        lines: lineBodies,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inv-ledger'] });
      void qc.invalidateQueries({ queryKey: ['inv-balances'] });
      navigate('/inventory/ledger');
    },
    onError: (e) => setError(extractAxiosError(e)),
  });

  function updateLine(idx: number, patch: Partial<LineForm>) {
    setLines((s) => s.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function removeLine(idx: number) {
    setLines((s) => s.filter((_, i) => i !== idx));
  }

  function pickPO(id: number) {
    setPurchaseId(id);
  }

  function clearPO() {
    setPurchaseId(null);
    setLines([]);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    postM.mutate();
  }

  const totalOrdered = lines.reduce((s, l) => s + l.ordered, 0);
  const totalReceived = lines.reduce((s, l) => s + parseDecimal(l.receivedQty), 0);
  const totalValue = lines.reduce(
    (s, l) => s + parseDecimal(l.receivedQty) * l.unitCost,
    0,
  );

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 pb-16">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Link
            to="/purchases"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" /> Back to purchases
          </Link>
          <p className="mt-1 text-sm font-medium text-amber-300">Receiving · goods received note</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white lg:text-3xl">
            Create GRN / Receive Items
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
            Receive goods against an open purchase order. Records batch / expiry, QC status, and
            posts inventory receipts into the ledger.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={postM.isPending}
            onClick={(e) => submit(e as unknown as FormEvent)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> Save draft
          </button>
          <button
            type="button"
            disabled={postM.isPending}
            onClick={(e) => submit(e as unknown as FormEvent)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 disabled:opacity-60"
          >
            {postM.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Receive & post
          </button>
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr,340px]">
        <div className="space-y-4">
          {/* PO picker */}
          <section className="workspace-panel border border-white/10 p-4">
            <header className="mb-3 flex items-center gap-2">
              <Truck className="h-4 w-4 text-amber-300" />
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
                Source purchase order
              </h2>
            </header>

            {selectedPO ? (
              <div className="flex items-start justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-emerald-200/80">Linked</p>
                  <p className="font-mono text-sm font-semibold text-emerald-200">
                    {selectedPO.purchaseNumber ?? `PO-${selectedPO.purchaseBillId}`}
                  </p>
                  <p className="mt-1 text-xs text-slate-200">
                    {selectedPO.supplierName} · {fmtInr(selectedPO.totalAmount)} ·{' '}
                    {new Date(selectedPO.receivedUtc).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearPO}
                  className="text-xs font-semibold text-rose-300 hover:text-rose-200"
                >
                  Change
                </button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input
                    type="search"
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                    placeholder="Search by PO number or supplier"
                    className="w-full rounded-lg border border-white/10 bg-slate-900/80 py-2 pl-9 pr-3 text-sm text-white focus:border-blue-400 focus:outline-none"
                  />
                </div>
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto pr-1">
                  {filteredPOs.slice(0, 30).map((po) => (
                    <li key={po.purchaseBillId}>
                      <button
                        type="button"
                        onClick={() => pickPO(po.purchaseBillId)}
                        className="flex w-full items-center justify-between gap-3 rounded-md border border-transparent px-3 py-2 text-left text-xs hover:border-blue-500/30 hover:bg-blue-500/10"
                      >
                        <span>
                          <span className="block font-mono text-slate-100">
                            {po.purchaseNumber ?? `PO-${po.purchaseBillId}`}
                          </span>
                          <span className="block text-[11px] text-slate-400">{po.supplierName}</span>
                        </span>
                        <span className="text-right">
                          <span className="block font-mono text-emerald-300">
                            {fmtInr(po.totalAmount)}
                          </span>
                          <span className="block text-[10px] text-slate-500">
                            {new Date(po.receivedUtc).toLocaleDateString()}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                  {filteredPOs.length === 0 && (
                    <li className="rounded-md border border-dashed border-white/10 px-3 py-2 text-center text-[11px] text-slate-500">
                      No purchase orders match.
                    </li>
                  )}
                </ul>
              </div>
            )}
          </section>

          {/* Line items */}
          <section className="workspace-panel border border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-4 py-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
                  <Package className="mr-1 inline h-3.5 w-3.5" /> Lines · receive items
                </h2>
                <p className="text-[11px] text-slate-500">
                  Enter received quantity, batch / expiry, rack location, and QC status per line.
                </p>
              </div>
              {selectedPO && lines.length === 0 && detailQ.isLoading && (
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading lines…
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10 text-sm">
                <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-3 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-right">Ordered</th>
                    <th className="px-3 py-2 text-right">Received</th>
                    <th className="px-3 py-2 text-right">Unit cost</th>
                    <th className="px-3 py-2 text-left">Batch</th>
                    <th className="px-3 py-2 text-left">Expiry</th>
                    <th className="px-3 py-2 text-left">Rack/Bin</th>
                    <th className="px-3 py-2 text-left">QC</th>
                    <th className="px-3 py-2 text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-10 text-center text-slate-500">
                        Select a purchase order to load line items.
                      </td>
                    </tr>
                  ) : (
                    lines.map((l, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2">
                          <p className="font-semibold text-slate-100">{l.productLabel}</p>
                          <p className="font-mono text-[10px] text-slate-500">
                            PV {l.productId ?? '—'}
                          </p>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-200">
                          {l.ordered}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={l.receivedQty}
                            onChange={(e) => updateLine(idx, { receivedQty: e.target.value })}
                            className="w-20 rounded-md border border-white/10 bg-slate-900/80 px-2 py-1.5 text-right text-xs font-mono text-white focus:border-blue-400 focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-300">
                          {fmtInr(l.unitCost)}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={l.batchNumber}
                            onChange={(e) => updateLine(idx, { batchNumber: e.target.value })}
                            placeholder="BATCH-001"
                            className="w-28 rounded-md border border-white/10 bg-slate-900/80 px-2 py-1.5 text-xs text-white focus:border-blue-400 focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={l.expiryDate}
                            onChange={(e) => updateLine(idx, { expiryDate: e.target.value })}
                            className="w-32 rounded-md border border-white/10 bg-slate-900/80 px-2 py-1.5 text-xs text-white focus:border-blue-400 focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={l.rackBin}
                            onChange={(e) => updateLine(idx, { rackBin: e.target.value })}
                            placeholder="A-1-01"
                            className="w-24 rounded-md border border-white/10 bg-slate-900/80 px-2 py-1.5 text-xs text-white focus:border-blue-400 focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={l.qualityStatus}
                            onChange={(e) => updateLine(idx, { qualityStatus: e.target.value })}
                            className="w-24 rounded-md border border-white/10 bg-slate-900/80 px-2 py-1.5 text-xs text-white focus:border-blue-400 focus:outline-none"
                          >
                            {QC_OPTIONS.map((q) => (
                              <option key={q} value={q}>
                                {q}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            className="rounded p-1 text-rose-300 hover:bg-rose-500/15"
                            aria-label="Remove line"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {lines.length > 0 && (
                  <tfoot className="bg-white/[0.03] text-xs">
                    <tr>
                      <td className="px-3 py-2 font-semibold text-slate-300">Totals</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-200">
                        {totalOrdered}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-emerald-300">
                        {totalReceived.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-300" colSpan={6}>
                        {fmtInr(totalValue)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>

          <section className="workspace-panel border border-white/10 p-4">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
              <FileText className="mr-1 inline h-3.5 w-3.5" /> Notes / inspection remarks
            </h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Quality observations, damages noted, partial shipments, etc."
              className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            />
          </section>
        </div>

        <aside className="space-y-4">
          <section className="workspace-panel border border-white/10 p-4">
            <header className="mb-3 flex items-center gap-2">
              <Hash className="h-4 w-4 text-blue-300" />
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
                GRN details
              </h2>
            </header>
            <label className="block text-xs font-semibold text-slate-300">
              GRN number
              <input
                type="text"
                value={grnNumber}
                onChange={(e) => setGrnNumber(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 font-mono text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </label>
            <label className="mt-3 block text-xs font-semibold text-slate-300">
              <Calendar className="mr-1 inline h-3 w-3" /> Received date
              <input
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </label>
          </section>

          <section className="workspace-panel border border-white/10 p-4">
            <header className="mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-300" />
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
                Destination warehouse
              </h2>
            </header>
            <select
              value={warehouseId ?? ''}
              onChange={(e) => setWarehouseId(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            >
              <option value="">Select warehouse…</option>
              {warehousesQ.data?.map((w) => (
                <option key={w.warehouseId} value={w.warehouseId}>
                  {w.code} — {w.name}
                </option>
              ))}
            </select>
          </section>

          <section className="workspace-panel border border-white/10 p-4">
            <header className="mb-3 flex items-center gap-2">
              <Truck className="h-4 w-4 text-blue-300" />
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
                Logistics
              </h2>
            </header>
            <label className="block text-xs font-semibold text-slate-300">
              Transporter
              <input
                type="text"
                value={transporter}
                onChange={(e) => setTransporter(e.target.value)}
                placeholder="e.g. Blue Dart, in-house"
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </label>
            <label className="mt-3 block text-xs font-semibold text-slate-300">
              Vehicle number
              <input
                type="text"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                placeholder="MH-12-AB-1234"
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </label>
            <label className="mt-3 block text-xs font-semibold text-slate-300">
              Supplier invoice ref
              <input
                type="text"
                value={invoiceRef}
                onChange={(e) => setInvoiceRef(e.target.value)}
                placeholder="SUP-INV-001"
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </label>
          </section>

          <section className="workspace-panel border border-white/10 p-4">
            <header className="mb-3 flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4 text-emerald-300" />
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
                Summary
              </h2>
            </header>
            <dl className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">Lines</dt>
                <dd className="font-mono text-slate-100">{lines.length}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">Total ordered</dt>
                <dd className="font-mono text-slate-100">{totalOrdered}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">Total received</dt>
                <dd className="font-mono text-emerald-300">{totalReceived.toFixed(2)}</dd>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-2">
                <dt className="font-semibold text-slate-300">Value received</dt>
                <dd className="font-mono text-base font-bold text-emerald-300">
                  {fmtInr(totalValue)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="workspace-panel border border-white/10 p-4 text-xs">
            <header className="mb-2 flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-violet-300" />
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
                GRN posts
              </h2>
            </header>
            <ul className="space-y-1.5 text-slate-300">
              <li className="flex items-center gap-2">
                <Layers className="h-3 w-3 text-slate-500" /> Creates / updates batches and expiry
              </li>
              <li className="flex items-center gap-2">
                <Layers className="h-3 w-3 text-slate-500" /> Posts PURCHASE_RECEIPT ledger entries
              </li>
              <li className="flex items-center gap-2">
                <Layers className="h-3 w-3 text-slate-500" /> Updates supplier outstanding & PO status
              </li>
              <li className="flex items-center gap-2">
                <Layers className="h-3 w-3 text-slate-500" /> QC failures keep stock as `DAMAGED`
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
