import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Loader2,
  Plus,
  Receipt,
  Save,
  Search,
  Trash2,
  Truck,
  Undo2,
} from 'lucide-react';
import { inventoryApi } from './inventoryApi';
import { fmtInr } from './inventoryHelpers';
import {
  type CreateReturnBody,
  type ReturnLineBody,
  type ReturnType,
  ReturnTypes,
} from '../../entities/inventory';
import { useAppSelector } from '../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../auth/authSlice';
import { apiJsonAuth } from '../../shared/api/axiosClient';
import type { InvoiceSummaryDto, PurchaseBillSummaryDto } from '../../entities/billing';

type ComposerFlavor = 'sales' | 'purchase';

const FLAVORS: Record<
  ComposerFlavor,
  {
    title: string;
    subtitle: string;
    documentLabel: string;
    documentIcon: typeof Receipt;
    refundLabel: string;
    accentClass: string;
    returnType: ReturnType;
    partyType: 'customer' | 'supplier';
    sourceDocType: string;
    newDocPath: string;
  }
> = {
  sales: {
    title: 'Create Sales Return / Credit Note',
    subtitle:
      'Accept customer returns, issue credit notes, restock or scrap items. Posts SALE_RETURN ledger entries on completion.',
    documentLabel: 'Original invoice',
    documentIcon: Receipt,
    refundLabel: 'Refund / credit',
    accentClass: 'text-blue-300',
    returnType: ReturnTypes.CustomerReturn,
    partyType: 'customer',
    sourceDocType: 'invoice',
    newDocPath: '/inventory/returns',
  },
  purchase: {
    title: 'Create Purchase Return / Debit Note',
    subtitle:
      'Return goods to suppliers, issue debit notes, recover credit. Posts PURCHASE_RETURN ledger entries on completion.',
    documentLabel: 'Original purchase bill',
    documentIcon: Truck,
    refundLabel: 'Debit / credit due',
    accentClass: 'text-violet-300',
    returnType: ReturnTypes.SupplierReturn,
    partyType: 'supplier',
    sourceDocType: 'purchase',
    newDocPath: '/inventory/returns',
  },
};

const REASONS = [
  'Damaged',
  'Defective',
  'Wrong item',
  'Quality issue',
  'Excess quantity',
  'Customer dissatisfaction',
  'Expired',
  'Other',
];

const DISPOSITIONS = ['Restock', 'Scrap', 'Repair', 'Return to supplier', 'Damaged'];

type LineForm = {
  productVariantId: number | null;
  productLabel: string;
  quantity: string;
  unitPrice: string;
  reason: string;
  disposition: string;
  notes: string;
};

const EMPTY_LINE: LineForm = {
  productVariantId: null,
  productLabel: '',
  quantity: '1',
  unitPrice: '',
  reason: 'Damaged',
  disposition: 'Restock',
  notes: '',
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

export function ReturnComposerPage({ flavor }: { flavor: ComposerFlavor }) {
  const params = useParams();
  const navigate = useNavigate();
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const ready = authed && workplace != null;
  const qc = useQueryClient();

  const cfg = FLAVORS[flavor];
  const SourceIcon = cfg.documentIcon;

  const [sourceDocumentId, setSourceDocumentId] = useState<number | null>(
    params.docId ? Number(params.docId) : null,
  );
  const [partyName, setPartyName] = useState('');
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [reason, setReason] = useState('Damaged');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineForm[]>([EMPTY_LINE]);
  const [error, setError] = useState<string | null>(null);
  const [docSearch, setDocSearch] = useState('');

  const warehousesQ = useQuery({
    queryKey: ['composer-warehouses'],
    queryFn: () => inventoryApi.warehouses.list(true),
    enabled: ready,
    retry: 1,
  });

  const variantsQ = useQuery({
    queryKey: ['composer-variants'],
    queryFn: () => inventoryApi.variants.browse({ activeOnly: true, take: 500 }),
    enabled: ready,
    retry: 1,
  });

  type SourceDoc = InvoiceSummaryDto | PurchaseBillSummaryDto;

  const docsQ = useQuery({
    queryKey: ['composer-source-docs', flavor],
    queryFn: async (): Promise<SourceDoc[]> => {
      if (flavor === 'sales') {
        return apiJsonAuth<InvoiceSummaryDto[]>('/v1/invoices?take=100');
      }
      return apiJsonAuth<PurchaseBillSummaryDto[]>('/v1/purchases?take=100');
    },
    enabled: ready,
    retry: 1,
  });

  const docs: SourceDoc[] = docsQ.data ?? [];

  const filteredDocs = useMemo(() => {
    if (!docSearch) return docs;
    const s = docSearch.toLowerCase();
    return docs.filter((d) => {
      if (flavor === 'sales') {
        const inv = d as InvoiceSummaryDto;
        return (
          (inv.invoiceNumber ?? '').toLowerCase().includes(s) ||
          inv.customerName.toLowerCase().includes(s)
        );
      }
      const po = d as PurchaseBillSummaryDto;
      return (
        (po.purchaseNumber ?? '').toLowerCase().includes(s) ||
        po.supplierName.toLowerCase().includes(s)
      );
    });
  }, [docs, docSearch, flavor]);

  const selectedDoc = useMemo(() => {
    if (sourceDocumentId == null) return null;
    if (flavor === 'sales') {
      return (
        (docs as InvoiceSummaryDto[]).find((d) => d.invoiceId === sourceDocumentId) ?? null
      );
    }
    return (
      (docs as PurchaseBillSummaryDto[]).find((d) => d.purchaseBillId === sourceDocumentId) ??
      null
    );
  }, [sourceDocumentId, docs, flavor]);

  const createM = useMutation({
    mutationFn: (body: CreateReturnBody) => inventoryApi.returns.create(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inv-returns'] });
      navigate('/inventory/returns');
    },
    onError: (e) => setError(extractAxiosError(e)),
  });

  const totalQty = lines.reduce((s, l) => s + parseDecimal(l.quantity), 0);
  const totalAmount = lines.reduce((s, l) => s + parseDecimal(l.quantity) * parseDecimal(l.unitPrice), 0);

  function updateLine(idx: number, patch: Partial<LineForm>) {
    setLines((s) => s.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((s) => [...s, { ...EMPTY_LINE }]);
  }

  function removeLine(idx: number) {
    setLines((s) => (s.length === 1 ? s : s.filter((_, i) => i !== idx)));
  }

  function pickDoc(id: number, name: string) {
    setSourceDocumentId(id);
    setPartyName(name);
  }

  function submit(e: FormEvent, status: 'draft' | 'submit') {
    e.preventDefault();
    setError(null);

    const payloadLines: ReturnLineBody[] = lines
      .filter((l) => l.productVariantId != null)
      .map((l) => ({
        productVariantId: l.productVariantId,
        quantity: parseDecimal(l.quantity),
        unitRefundAmount: parseOptional(l.unitPrice),
        reason: l.reason || null,
        disposition: l.disposition || null,
        notes: l.notes.trim() || null,
      }));

    if (payloadLines.length === 0) {
      setError('Add at least one line with a product.');
      return;
    }
    if (payloadLines.some((l) => l.quantity <= 0)) {
      setError('Each line must have a positive quantity.');
      return;
    }

    void status;
    createM.mutate({
      returnType: cfg.returnType,
      sourceDocumentType: cfg.sourceDocType,
      sourceDocumentId: sourceDocumentId,
      warehouseId: warehouseId,
      reason: reason || null,
      notes: notes.trim() || null,
      lines: payloadLines,
    });
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-16">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Link
            to="/inventory/returns"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" /> Back to returns
          </Link>
          <p className={`mt-1 text-sm font-medium ${cfg.accentClass}`}>
            Returns · {flavor === 'sales' ? 'sales return / credit note' : 'purchase return / debit note'}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white lg:text-3xl">{cfg.title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">{cfg.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={(e) => submit(e as unknown as FormEvent, 'draft')}
            disabled={createM.isPending}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> Save as draft
          </button>
          <button
            type="button"
            onClick={(e) => submit(e as unknown as FormEvent, 'submit')}
            disabled={createM.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 disabled:opacity-60"
          >
            {createM.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {flavor === 'sales' ? 'Submit credit note' : 'Submit debit note'}
          </button>
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
        <div className="space-y-4">
          {/* Source document picker */}
          <section className="workspace-panel border border-white/10 p-4">
            <header className="mb-3 flex items-center gap-2">
              <SourceIcon className="h-4 w-4 text-amber-300" />
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
                {cfg.documentLabel}
              </h2>
            </header>

            {selectedDoc ? (
              <div className="flex items-start justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-emerald-200/80">Linked</p>
                  <p className="font-mono text-sm font-semibold text-emerald-200">
                    {flavor === 'sales'
                      ? (selectedDoc as InvoiceSummaryDto).invoiceNumber ?? `INV-${(selectedDoc as InvoiceSummaryDto).invoiceId}`
                      : (selectedDoc as PurchaseBillSummaryDto).purchaseNumber ?? `PO-${(selectedDoc as PurchaseBillSummaryDto).purchaseBillId}`}
                  </p>
                  <p className="mt-1 text-xs text-slate-200">
                    {flavor === 'sales'
                      ? (selectedDoc as InvoiceSummaryDto).customerName
                      : (selectedDoc as PurchaseBillSummaryDto).supplierName}{' '}
                    · {fmtInr((selectedDoc as InvoiceSummaryDto | PurchaseBillSummaryDto).totalAmount)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSourceDocumentId(null);
                    setPartyName('');
                  }}
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
                    placeholder={`Search ${flavor === 'sales' ? 'invoices' : 'POs'} by number or party`}
                    className="w-full rounded-lg border border-white/10 bg-slate-900/80 py-2 pl-9 pr-3 text-sm text-white focus:border-blue-400 focus:outline-none"
                  />
                </div>
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto pr-1">
                  {filteredDocs.slice(0, 30).map((d) => {
                    if (flavor === 'sales') {
                      const inv = d as InvoiceSummaryDto;
                      return (
                        <li key={inv.invoiceId}>
                          <button
                            type="button"
                            onClick={() => pickDoc(inv.invoiceId, inv.customerName)}
                            className="flex w-full items-center justify-between gap-3 rounded-md border border-transparent px-3 py-2 text-left text-xs hover:border-blue-500/30 hover:bg-blue-500/10"
                          >
                            <span>
                              <span className="block font-mono text-slate-100">
                                {inv.invoiceNumber ?? `INV-${inv.invoiceId}`}
                              </span>
                              <span className="block text-[11px] text-slate-400">
                                {inv.customerName}
                              </span>
                            </span>
                            <span className="font-mono text-emerald-300">
                              {fmtInr(inv.totalAmount)}
                            </span>
                          </button>
                        </li>
                      );
                    }
                    const po = d as PurchaseBillSummaryDto;
                    return (
                      <li key={po.purchaseBillId}>
                        <button
                          type="button"
                          onClick={() => pickDoc(po.purchaseBillId, po.supplierName)}
                          className="flex w-full items-center justify-between gap-3 rounded-md border border-transparent px-3 py-2 text-left text-xs hover:border-blue-500/30 hover:bg-blue-500/10"
                        >
                          <span>
                            <span className="block font-mono text-slate-100">
                              {po.purchaseNumber ?? `PO-${po.purchaseBillId}`}
                            </span>
                            <span className="block text-[11px] text-slate-400">
                              {po.supplierName}
                            </span>
                          </span>
                          <span className="font-mono text-emerald-300">{fmtInr(po.totalAmount)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>

          {/* Lines table */}
          <section className="workspace-panel border border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-4 py-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">Items</h2>
                <p className="text-[11px] text-slate-500">
                  Add the products being returned, reason, and disposition.
                </p>
              </div>
              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/15 px-3 py-1.5 text-xs font-semibold text-blue-200 hover:bg-blue-500/25"
              >
                <Plus className="h-3 w-3" /> Add line
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10 text-sm">
                <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">{cfg.refundLabel} (₹)</th>
                    <th className="px-3 py-2 text-left">Reason</th>
                    <th className="px-3 py-2 text-left">Disposition</th>
                    <th className="px-3 py-2 text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {lines.map((l, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 text-xs text-slate-500">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <select
                          value={l.productVariantId ?? ''}
                          onChange={(e) => {
                            const id = Number(e.target.value);
                            const v = variantsQ.data?.items.find((x) => x.productVariantId === id);
                            updateLine(idx, {
                              productVariantId: id || null,
                              productLabel: v ? v.productName : '',
                            });
                          }}
                          className="w-56 rounded-md border border-white/10 bg-slate-900/80 px-2 py-1.5 text-xs text-white focus:border-blue-400 focus:outline-none"
                        >
                          <option value="">Select product…</option>
                          {variantsQ.data?.items.map((v) => (
                            <option key={v.productVariantId} value={v.productVariantId}>
                              {v.productName}
                              {v.sku ? ` (${v.sku})` : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={l.quantity}
                          onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                          className="w-20 rounded-md border border-white/10 bg-slate-900/80 px-2 py-1.5 text-right text-xs font-mono text-white focus:border-blue-400 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={l.unitPrice}
                          onChange={(e) => updateLine(idx, { unitPrice: e.target.value })}
                          placeholder="0.00"
                          className="w-24 rounded-md border border-white/10 bg-slate-900/80 px-2 py-1.5 text-right text-xs font-mono text-white focus:border-blue-400 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={l.reason}
                          onChange={(e) => updateLine(idx, { reason: e.target.value })}
                          className="w-32 rounded-md border border-white/10 bg-slate-900/80 px-2 py-1.5 text-xs text-white focus:border-blue-400 focus:outline-none"
                        >
                          {REASONS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={l.disposition}
                          onChange={(e) => updateLine(idx, { disposition: e.target.value })}
                          className="w-32 rounded-md border border-white/10 bg-slate-900/80 px-2 py-1.5 text-xs text-white focus:border-blue-400 focus:outline-none"
                        >
                          {DISPOSITIONS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          disabled={lines.length === 1}
                          className="rounded p-1 text-rose-300 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label="Remove line"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-white/[0.03] text-xs">
                  <tr>
                    <td colSpan={2} className="px-3 py-2 font-semibold text-slate-300">
                      Totals
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-100">
                      {totalQty.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-300">
                      {fmtInr(totalAmount)}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* Notes */}
          <section className="workspace-panel border border-white/10 p-4">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
              <FileText className="mr-1 inline h-3.5 w-3.5" /> Internal notes
            </h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add internal notes, references, links…"
              className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            />
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <section className="workspace-panel border border-white/10 p-4">
            <header className="mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-300" />
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
                {cfg.partyType === 'customer' ? 'Customer' : 'Supplier'}
              </h2>
            </header>
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
              {partyName || <span className="text-slate-500">Select a {cfg.documentLabel.toLowerCase()} to populate.</span>}
            </div>
          </section>

          <section className="workspace-panel border border-white/10 p-4">
            <header className="mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-300" />
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
                Warehouse
              </h2>
            </header>
            <select
              value={warehouseId ?? ''}
              onChange={(e) =>
                setWarehouseId(e.target.value ? Number(e.target.value) : null)
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            >
              <option value="">Default warehouse</option>
              {warehousesQ.data?.map((w) => (
                <option key={w.warehouseId} value={w.warehouseId}>
                  {w.code} — {w.name}
                </option>
              ))}
            </select>
          </section>

          <section className="workspace-panel border border-white/10 p-4">
            <header className="mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-300" />
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
                Primary reason
              </h2>
            </header>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
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
                <dt className="text-slate-400">Line count</dt>
                <dd className="font-mono text-slate-100">{lines.length}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">Total quantity</dt>
                <dd className="font-mono text-slate-100">{totalQty.toFixed(2)}</dd>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-2">
                <dt className="font-semibold text-slate-300">{cfg.refundLabel}</dt>
                <dd className="font-mono text-base font-bold text-emerald-300">
                  {fmtInr(totalAmount)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="workspace-panel border border-white/10 p-4">
            <header className="mb-2">
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
                <Undo2 className="mr-1 inline h-3.5 w-3.5" /> Workflow
              </h2>
            </header>
            <ol className="space-y-1.5 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-500/20 text-[10px] text-blue-300 ring-1 ring-blue-500/40">
                  1
                </span>
                Requested
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500/20 text-[10px] text-amber-300 ring-1 ring-amber-500/40">
                  2
                </span>
                Approved
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-violet-500/20 text-[10px] text-violet-300 ring-1 ring-violet-500/40">
                  3
                </span>
                Received & inspected
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] text-emerald-300 ring-1 ring-emerald-500/40">
                  4
                </span>
                Completed · ledger posted
              </li>
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

export function SalesReturnComposerPage() {
  return <ReturnComposerPage flavor="sales" />;
}

export function PurchaseReturnComposerPage() {
  return <ReturnComposerPage flavor="purchase" />;
}
