import { FormEvent, Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Loader2, Plus, Save, ScanLine, Trash2 } from 'lucide-react';
import axios from 'axios';
import type { AuthUserSummary } from '../../entities/auth-types';
import type { CreateInvoiceBody, CustomerDto, InvoiceDetailDto, ProductDto } from '../../entities/billing';
import { InventoryTrackingModes } from '../../entities/inventory';
import type { ProductVariantDto, WarehouseDto } from '../../entities/inventory';
import { useAppSelector } from '../../app/hooks';
import { selectWorkplaceSnapshot } from '../../features/auth/authSlice';
import { inventoryApi } from '../inventory/inventoryApi';
import { productApi } from '../products/productApi';
import { QuickProductModal } from '../purchases/QuickProductModal';
import { apiJsonAuth, authApi } from '../../shared/api/axiosClient';
import { blockComposerSubmitShortcut } from '../../shared/composer/composerShortcuts';
import { useDismissSuggestionLayer } from '../../shared/hooks/useDismissSuggestionLayer';
import { roundMoney2 } from './invoiceMoney';
import { useInvoiceComposer } from './InvoiceComposerContext';
import type { InvoiceDraftLine } from './invoiceComposerTypes';
import { mapInvoiceLineToDraft, newDraftLine } from './invoiceComposerDefaults';
import { lineAmounts, lineEstCost } from './invoiceLineCalc';
import { InvoiceSerialPickerModal } from './InvoiceSerialPickerModal';

function normalizeProductSearch(q: string): string {
  return q.trim().toLowerCase();
}

function productMatches(p: ProductDto, q: string): boolean {
  if (!q) return false;
  const n = p.name.toLowerCase();
  const sku = (p.sku ?? '').toLowerCase();
  const hsn = (p.hsnCode ?? '').toLowerCase();
  const brand = (p.brand ?? '').toLowerCase();
  const cat = (p.categoryName ?? '').toLowerCase();
  return n.includes(q) || sku.includes(q) || hsn.includes(q) || brand.includes(q) || cat.includes(q);
}

function isSerializedProduct(p: ProductDto | undefined): boolean {
  const m = p?.inventoryTrackingMode;
  return m === InventoryTrackingModes.Serial || m === InventoryTrackingModes.BatchAndSerial;
}

function variantLabel(v: ProductVariantDto): string {
  if (v.attributes?.length) {
    return v.attributes.map((a) => a.value).join(' / ');
  }
  return v.displayName ?? v.sku ?? `Variant #${v.productVariantId}`;
}

const ITEM_PICKER_LIMIT = 500;
const fmtInr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';
const labelClass = 'text-xs font-semibold text-slate-600';

function sortedCatalog(products: ProductDto[]): ProductDto[] {
  return [...products].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

function formatProductLine(p: ProductDto): string {
  return p.sku ? `${p.name} / ${p.sku}` : p.name;
}

function dueDaysLabel(orderDate: string, dueDate: string): string {
  try {
    const a = new Date(orderDate);
    const b = new Date(dueDate);
    const days = Math.round((b.getTime() - a.getTime()) / 86400000);
    if (Number.isFinite(days) && days >= 0) return `(${days} days)`;
  } catch {
    /* ignore */
  }
  return '';
}

export function InvoiceCreatePage() {
  const navigate = useNavigate();
  const { tabId } = useParams<{ tabId: string }>();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const workplaceOrgId = useAppSelector(selectWorkplaceSnapshot)?.organizationId ?? 0;
  const urlCustomerAppliedForTab = useRef(new Set<string>());
  const { patchDraft, renameTab, saveDraftNow, drafts } = useInvoiceComposer();

  const [draftBanner, setDraftBanner] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [suggestLineKey, setSuggestLineKey] = useState<string | null>(null);
  const [productPickDraft, setProductPickDraft] = useState<Record<string, string>>({});
  const [quickProductOpen, setQuickProductOpen] = useState(false);
  const [quickProductLineKey, setQuickProductLineKey] = useState<string | null>(null);
  const [variantsByProduct, setVariantsByProduct] = useState<Record<number, ProductVariantDto[]>>({});
  const [serialPickerLineKey, setSerialPickerLineKey] = useState<string | null>(null);
  const linesShellRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useDismissSuggestionLayer(Boolean(suggestLineKey), linesShellRef, () => setSuggestLineKey(null));

  useEffect(() => {
    setSuggestLineKey(null);
    setProductPickDraft({});
  }, [tabId]);

  useEffect(() => {
    if (!draftBanner) return;
    const t = window.setTimeout(() => setDraftBanner(null), 3800);
    return () => clearTimeout(t);
  }, [draftBanner]);

  const persistDraftBanner = useCallback(() => {
    const iso = saveDraftNow();
    try {
      const t = iso ? new Date(iso).toLocaleTimeString() : '';
      setDraftBanner(t ? `Draft saved · ${t}` : 'Draft saved');
    } catch {
      setDraftBanner('Draft saved');
    }
  }, [saveDraftNow]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        persistDraftBanner();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [persistDraftBanner]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || e.key !== 'Enter') return;
      if (blockComposerSubmitShortcut(e.target)) return;
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const draft = tabId ? drafts[tabId] : undefined;

  useEffect(() => {
    if (!tabId) return;
    if (urlCustomerAppliedForTab.current.has(tabId)) return;
    const raw = searchParams.get('customerId');
    if (raw == null || raw === '') return;
    const id = Number(raw);
    if (!Number.isFinite(id) || id <= 0 || !Number.isInteger(id)) return;
    urlCustomerAppliedForTab.current.add(tabId);
    patchDraft(tabId, (d) => ({ ...d, customerId: id }));
  }, [tabId, searchParams, patchDraft]);

  const cloneFromRaw = searchParams.get('cloneFrom');
  const cloneFromId = useMemo(() => {
    const n = cloneFromRaw ? Number(cloneFromRaw) : NaN;
    return Number.isFinite(n) && n > 0 && Number.isInteger(n) ? Math.floor(n) : null;
  }, [cloneFromRaw]);

  useEffect(() => {
    if (!tabId || cloneFromId == null) return;
    let cancelled = false;
    void (async () => {
      try {
        const inv = await apiJsonAuth<InvoiceDetailDto>(`/v1/invoices/${cloneFromId}`);
        if (cancelled) return;
        patchDraft(tabId, (d) => ({
          ...d,
          customerId: inv.customerId,
          lines: inv.lines.length ? inv.lines.map(mapInvoiceLineToDraft) : [newDraftLine()],
        }));
        const title =
          inv.invoiceNumber?.trim() || inv.customerName?.trim() || `Invoice #${inv.invoiceId}`;
        renameTab(tabId, title.slice(0, 56));
        navigate(`/invoices/new/${tabId}`, { replace: true });
      } catch (e) {
        if (cancelled) return;
        const msg =
          axios.isAxiosError(e) && e.response?.data
            ? typeof e.response.data === 'string'
              ? e.response.data
              : JSON.stringify(e.response.data)
            : e instanceof Error
              ? e.message
              : 'Could not load invoice.';
        setFormError(msg.slice(0, 280));
        navigate(`/invoices/new/${tabId}`, { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tabId, cloneFromId, patchDraft, renameTab, navigate]);

  const customersQ = useQuery({
    queryKey: ['customers-pick', workplaceOrgId],
    queryFn: async () => {
      const { data } = await authApi.get<CustomerDto[]>('/v1/customers?max=300');
      return data;
    },
    retry: 1,
  });

  const productsQ = useQuery({
    queryKey: ['products-pick', workplaceOrgId],
    queryFn: async () => {
      const { data } = await authApi.get<ProductDto[]>('/v1/products?activeOnly=true&max=300');
      return data;
    },
    retry: 1,
  });

  const warehousesQ = useQuery({
    queryKey: ['warehouses-pick', workplaceOrgId],
    queryFn: () => inventoryApi.warehouses.list(true),
    retry: 1,
  });

  const authMeQ = useQuery({
    queryKey: ['auth-me-invoice-create', workplaceOrgId],
    enabled: workplaceOrgId > 0,
    queryFn: () => apiJsonAuth<AuthUserSummary>('/v1/auth/me'),
    staleTime: 60_000,
    retry: 1,
  });
  const canManageProducts = authMeQ.data?.permissions?.includes('products.manage') ?? false;

  const productsById = useMemo(() => {
    const m = new Map<number, ProductDto>();
    for (const p of productsQ.data ?? []) m.set(p.productId, p);
    return m;
  }, [productsQ.data]);

  const customer = useMemo(
    () => customersQ.data?.find((c) => c.customerId === draft?.customerId),
    [customersQ.data, draft?.customerId],
  );

  const lines = draft?.lines ?? [];

  const totals = useMemo(() => {
    let subtotal = 0;
    let lineDiscount = 0;
    let tax = 0;
    let estCost = 0;
    for (const line of lines) {
      const a = lineAmounts(line);
      subtotal += a.subtotal;
      lineDiscount += a.discount;
      tax += a.tax;
      estCost += lineEstCost(line, productsById.get(line.productId ?? -1)?.purchasePrice);
    }
    subtotal = roundMoney2(subtotal);
    lineDiscount = roundMoney2(lineDiscount);
    tax = roundMoney2(tax);
    const docDisc = roundMoney2(draft?.documentDiscount ?? 0);
    const shipping = roundMoney2(draft?.shippingAmount ?? 0);
    const grand = roundMoney2(subtotal - lineDiscount - docDisc + tax + shipping);
    const paid = roundMoney2(draft?.amountPaid ?? 0);
    const balance = roundMoney2(grand - paid);
    const profit = roundMoney2(grand - estCost);
    const margin = grand > 0 ? roundMoney2((profit / grand) * 100) : 0;
    return { subtotal, lineDiscount, tax, docDisc, shipping, grand, paid, balance, estCost, profit, margin };
  }, [lines, draft?.documentDiscount, draft?.shippingAmount, draft?.amountPaid, productsById]);

  useEffect(() => {
    if (!tabId || !draft?.customerId) return;
    const name = customer?.name?.trim();
    if (name) renameTab(tabId, name);
  }, [customer?.name, draft?.customerId, renameTab, tabId]);

  useEffect(() => {
    if (!draft?.warehouseId && warehousesQ.data?.length) {
      const def = warehousesQ.data.find((w) => w.isDefault) ?? warehousesQ.data[0];
      if (tabId && def) patchDraft(tabId, (d) => ({ ...d, warehouseId: d.warehouseId === '' ? def.warehouseId : d.warehouseId }));
    }
  }, [draft?.warehouseId, warehousesQ.data, tabId, patchDraft]);

  const createMut = useMutation({
    mutationFn: async (body: CreateInvoiceBody) => {
      try {
        const { data } = await authApi.post<{ invoiceId: number }>('/v1/invoices', body);
        return data;
      } catch (e) {
        if (axios.isAxiosError(e)) {
          const status = e.response?.status;
          if (status === 401) throw new Error('Unauthorized — sign in again.');
          const d = e.response?.data;
          const msg =
            typeof d === 'string'
              ? d
              : d && typeof d === 'object' && 'title' in d
                ? String((d as { title?: string }).title)
                : '';
          throw new Error(msg.replace(/^\s+|\s+$/g, '').slice(0, 240) || `Request failed (${status}).`);
        }
        throw e;
      }
    },
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ['invoices-list'] });
      await qc.invalidateQueries({ queryKey: ['invoices-recent'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      await qc.invalidateQueries({ queryKey: ['inv-serials'] });
      navigate(`/invoices/${data.invoiceId}`);
    },
  });

  async function ensureVariants(productId: number): Promise<ProductVariantDto[]> {
    if (variantsByProduct[productId]) return variantsByProduct[productId]!;
    const list = await productApi.listVariants(productId);
    setVariantsByProduct((prev) => ({ ...prev, [productId]: list }));
    return list;
  }

  function setLine(key: string, patch: Partial<InvoiceDraftLine>) {
    if (!tabId) return;
    patchDraft(tabId, (d) => ({
      ...d,
      lines: d.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    }));
  }

  function invoiceProductSeed(line: InvoiceDraftLine): string {
    if (line.productId != null) {
      const p = productsById.get(line.productId);
      return p ? formatProductLine(p) : line.description;
    }
    return line.description;
  }

  function invoiceProductInputDisplay(line: InvoiceDraftLine): string {
    const d = productPickDraft[line.key];
    if (d !== undefined) return d;
    return invoiceProductSeed(line);
  }

  function invoiceSuggestionsFor(line: InvoiceDraftLine): ProductDto[] {
    const all = productsQ.data ?? [];
    const sorted = sortedCatalog(all);
    const raw = invoiceProductInputDisplay(line);
    const q = normalizeProductSearch(raw);
    if (!q) return sorted.slice(0, ITEM_PICKER_LIMIT);
    return sorted.filter((p) => productMatches(p, q)).slice(0, ITEM_PICKER_LIMIT);
  }

  async function applyInvoiceProduct(lineKey: string, p: ProductDto) {
    const variants = await ensureVariants(p.productId);
    const defaultVar =
      variants.find((v) => v.isDefault) ?? variants[0] ?? null;
    setLine(lineKey, {
      productId: p.productId,
      productVariantId: defaultVar?.productVariantId ?? null,
      description: p.name,
      unitPrice: defaultVar?.salePrice ?? p.unitPrice,
      taxRatePercent: p.taxRatePercent ?? 0,
      selectedSerials: [],
      quantity: 1,
    });
    setProductPickDraft((prev) => {
      const next = { ...prev };
      delete next[lineKey];
      return next;
    });
    setSuggestLineKey(null);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!tabId || !draft) {
      setFormError('Missing composer tab.');
      return;
    }
    if (draft.customerId === '') {
      setFormError('Select a customer.');
      return;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (!line.description.trim()) {
        setFormError(`Line ${i + 1}: product description is required.`);
        return;
      }
      if (!(line.quantity > 0)) {
        setFormError(`Line ${i + 1}: quantity must be greater than zero.`);
        return;
      }
      const p = line.productId != null ? productsById.get(line.productId) : undefined;
      if (isSerializedProduct(p)) {
        if (line.productVariantId == null) {
          setFormError(`Line ${i + 1}: select a variant before choosing IMEI / serial.`);
          return;
        }
        if (line.selectedSerials.length === 0) {
          setFormError(`Line ${i + 1}: select at least one IMEI / serial for this serialized product.`);
          return;
        }
        if (line.selectedSerials.length !== Math.round(line.quantity)) {
          setFormError(
            `Line ${i + 1}: quantity (${line.quantity}) must match the number of IMEI / serial units selected (${line.selectedSerials.length}).`,
          );
          return;
        }
      }
    }

    if (lines.length === 0) {
      setFormError('Add at least one line item.');
      return;
    }

    const body: CreateInvoiceBody = {
      customerId: draft.customerId,
      lines: lines.map((l) => ({
        productId: l.productId,
        description: l.description.trim(),
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        productVariantId: l.productVariantId,
        productSerialIds:
          l.selectedSerials.length > 0
            ? l.selectedSerials.map((s) => s.productSerialId)
            : null,
      })),
    };

    createMut.mutate(body);
  }

  const serialPickerLine = lines.find((l) => l.key === serialPickerLineKey);
  const serialPickerProduct =
    serialPickerLine?.productId != null ? productsById.get(serialPickerLine.productId) : undefined;

  const otherPickedSerialIds = useMemo(() => {
    const ids: number[] = [];
    for (const l of lines) {
      if (l.key === serialPickerLineKey) continue;
      for (const s of l.selectedSerials) ids.push(s.productSerialId);
    }
    return ids;
  }, [lines, serialPickerLineKey]);

  if (!tabId || !draft) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-sm text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" aria-hidden />
        Loading draft…
      </div>
    );
  }

  const dueHint = dueDaysLabel(draft.orderDate, draft.dueDate);

  return (
    <div className="-mx-4 -mt-4 min-h-full bg-[#f4f6fb] px-4 pb-16 pt-4 text-slate-900 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500">
            <Link to="/sales" className="hover:text-blue-600">
              Sales
            </Link>
            <span className="mx-1">›</span>
            Create Invoice
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Create Sales Invoice</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            Add products, select customer, and assign IMEI / serial numbers for serialized items.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/invoices"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={() => persistDraftBanner()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Save className="h-4 w-4" aria-hidden />
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => formRef.current?.requestSubmit()}
            disabled={createMut.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-60"
          >
            {createMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            Create Invoice
          </button>
        </div>
      </div>

      {draftBanner && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {draftBanner}
        </div>
      )}

      <form ref={formRef} onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="space-y-4 xl:col-span-8">
            <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-bold text-slate-800">Invoice details</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="sm:col-span-2">
                  <span className={labelClass}>Customer *</span>
                  <select
                    required
                    value={draft.customerId === '' ? '' : String(draft.customerId)}
                    onChange={(e) => {
                      const v = e.target.value === '' ? '' : Number(e.target.value);
                      patchDraft(tabId, (d) => ({ ...d, customerId: v }));
                    }}
                    className={`${inputClass} mt-1`}
                  >
                    <option value="">Select customer…</option>
                    {(customersQ.data ?? []).map((c) => (
                      <option key={c.customerId} value={c.customerId}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <Link to="/customers" className="mt-1 inline-block text-xs font-semibold text-blue-600 hover:underline">
                    + New Customer
                  </Link>
                </label>
                <label>
                  <span className={labelClass}>Sales Channel</span>
                  <select
                    value={draft.salesChannel}
                    onChange={(e) => patchDraft(tabId, (d) => ({ ...d, salesChannel: e.target.value }))}
                    className={`${inputClass} mt-1`}
                  >
                    <option>Retail Store</option>
                    <option>Online</option>
                    <option>B2B</option>
                  </select>
                </label>
                <label>
                  <span className={labelClass}>Email</span>
                  <input
                    readOnly
                    value={customer?.email ?? ''}
                    className={`${inputClass} mt-1 bg-slate-50`}
                    placeholder="—"
                  />
                </label>
                <label>
                  <span className={labelClass}>Phone</span>
                  <input
                    readOnly
                    value={customer?.phone ?? ''}
                    className={`${inputClass} mt-1 bg-slate-50`}
                    placeholder="—"
                  />
                </label>
                <label>
                  <span className={labelClass}>GSTIN (optional)</span>
                  <input
                    value={draft.gstin || customer?.taxId || ''}
                    onChange={(e) => patchDraft(tabId, (d) => ({ ...d, gstin: e.target.value }))}
                    className={`${inputClass} mt-1`}
                    placeholder="GST number"
                  />
                </label>
                <label className="sm:col-span-2 lg:col-span-3">
                  <span className={labelClass}>Billing Address</span>
                  <textarea
                    value={draft.billingAddress}
                    onChange={(e) => patchDraft(tabId, (d) => ({ ...d, billingAddress: e.target.value }))}
                    rows={2}
                    className={`${inputClass} mt-1`}
                    placeholder="Street, city, state, PIN"
                  />
                </label>
                <label>
                  <span className={labelClass}>Warehouse</span>
                  <select
                    value={draft.warehouseId === '' ? '' : String(draft.warehouseId)}
                    onChange={(e) =>
                      patchDraft(tabId, (d) => ({
                        ...d,
                        warehouseId: e.target.value === '' ? '' : Number(e.target.value),
                      }))
                    }
                    className={`${inputClass} mt-1`}
                  >
                    <option value="">Select warehouse…</option>
                    {(warehousesQ.data ?? []).map((w: WarehouseDto) => (
                      <option key={w.warehouseId} value={w.warehouseId}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={labelClass}>Order Date</span>
                  <input
                    type="date"
                    value={draft.orderDate}
                    onChange={(e) => patchDraft(tabId, (d) => ({ ...d, orderDate: e.target.value }))}
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <label>
                  <span className={labelClass}>
                    Due Date {dueHint && <span className="font-normal text-blue-600">{dueHint}</span>}
                  </span>
                  <input
                    type="date"
                    value={draft.dueDate}
                    onChange={(e) => patchDraft(tabId, (d) => ({ ...d, dueDate: e.target.value }))}
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <label>
                  <span className={labelClass}>Payment Method</span>
                  <select
                    value={draft.paymentMethod}
                    onChange={(e) => patchDraft(tabId, (d) => ({ ...d, paymentMethod: e.target.value }))}
                    className={`${inputClass} mt-1`}
                  >
                    <option>Credit Card</option>
                    <option>UPI</option>
                    <option>Cash</option>
                    <option>Bank Transfer</option>
                    <option>Credit Terms</option>
                  </select>
                </label>
                <label>
                  <span className={labelClass}>Reference (optional)</span>
                  <input
                    value={draft.reference}
                    onChange={(e) => patchDraft(tabId, (d) => ({ ...d, reference: e.target.value }))}
                    className={`${inputClass} mt-1`}
                    placeholder="PO / order ref"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-slate-800">Line Items</h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    <ScanLine className="h-3.5 w-3.5" /> Scan Barcode
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      patchDraft(tabId, (d) => ({ ...d, lines: [...d.lines, newDraftLine()] }))
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Item
                  </button>
                </div>
              </div>

              <div ref={linesShellRef} className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-[960px] w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="w-8 px-2 py-2">#</th>
                      <th className="min-w-[180px] px-2 py-2">Product</th>
                      <th className="min-w-[120px] px-2 py-2">Variant</th>
                      <th className="min-w-[140px] px-2 py-2">Serial / IMEI</th>
                      <th className="w-16 px-2 py-2 text-right">Qty</th>
                      <th className="w-24 px-2 py-2 text-right">Unit Price</th>
                      <th className="w-20 px-2 py-2 text-right">Disc %</th>
                      <th className="w-20 px-2 py-2 text-right">Tax %</th>
                      <th className="w-24 px-2 py-2 text-right">Total</th>
                      <th className="w-10 px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => {
                      const p = line.productId != null ? productsById.get(line.productId) : undefined;
                      const serialized = isSerializedProduct(p);
                      const variants = line.productId != null ? variantsByProduct[line.productId] : undefined;
                      const amounts = lineAmounts(line);
                      const sug = invoiceSuggestionsFor(line);
                      const filterActive = normalizeProductSearch(invoiceProductInputDisplay(line)).length > 0;
                      const showSuggest =
                        suggestLineKey === line.key &&
                        (productsQ.isLoading || canManageProducts || sug.length > 0 || (filterActive && !productsQ.isLoading));

                      return (
                        <Fragment key={line.key}>
                          <tr className="border-b border-slate-100 align-top">
                            <td className="px-2 py-2 text-center text-xs text-slate-500">{idx + 1}</td>
                            <td className="relative px-2 py-2">
                              <input
                                value={invoiceProductInputDisplay(line)}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setProductPickDraft((prev) => ({ ...prev, [line.key]: v }));
                                  setLine(line.key, {
                                    productId: null,
                                    productVariantId: null,
                                    description: v,
                                    selectedSerials: [],
                                  });
                                  setSuggestLineKey(line.key);
                                }}
                                onFocus={() => {
                                  setSuggestLineKey(line.key);
                                  if (line.productId != null) void ensureVariants(line.productId);
                                }}
                                className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs"
                                placeholder="Search product…"
                                autoComplete="off"
                              />
                              {showSuggest && (
                                <ul className="absolute left-2 top-full z-[80] max-h-48 min-w-[240px] overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                                  {sug.map((sp) => (
                                    <li key={sp.productId}>
                                      <button
                                        type="button"
                                        className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => void applyInvoiceProduct(line.key, sp)}
                                      >
                                        <span className="font-semibold">{sp.name}</span>
                                        {sp.sku && <span className="text-slate-500"> · {sp.sku}</span>}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                            <td className="px-2 py-2">
                              {variants && variants.length > 1 ? (
                                <select
                                  value={line.productVariantId ?? ''}
                                  onChange={(e) => {
                                    const vid = e.target.value ? Number(e.target.value) : null;
                                    const v = variants.find((x) => x.productVariantId === vid);
                                    setLine(line.key, {
                                      productVariantId: vid,
                                      unitPrice: v?.salePrice ?? line.unitPrice,
                                      selectedSerials: [],
                                    });
                                  }}
                                  className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs"
                                >
                                  <option value="">Variant…</option>
                                  {variants.map((v) => (
                                    <option key={v.productVariantId} value={v.productVariantId}>
                                      {variantLabel(v)}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-xs text-slate-500">
                                  {variants?.[0] ? variantLabel(variants[0]) : '—'}
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-2">
                              {serialized ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (line.productVariantId == null && line.productId != null) {
                                      void ensureVariants(line.productId);
                                    }
                                    setSerialPickerLineKey(line.key);
                                  }}
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                    line.selectedSerials.length > 0
                                      ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200'
                                      : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
                                  }`}
                                >
                                  {line.selectedSerials.length > 0 ? (
                                    <>
                                      <Check className="h-3 w-3" />
                                      {line.selectedSerials.length} IMEI Selected
                                    </>
                                  ) : (
                                    <>Select IMEI</>
                                  )}
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-400">Auto (Not required)</span>
                              )}
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                min={serialized ? line.selectedSerials.length || 1 : 0}
                                step={serialized ? 1 : 'any'}
                                value={line.quantity}
                                onChange={(e) => setLine(line.key, { quantity: Number(e.target.value) })}
                                className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-right text-xs tabular-nums"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={line.unitPrice}
                                onChange={(e) => setLine(line.key, { unitPrice: Number(e.target.value) })}
                                className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-right text-xs tabular-nums"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={line.discountPercent}
                                onChange={(e) =>
                                  setLine(line.key, { discountPercent: Number(e.target.value) })
                                }
                                className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-right text-xs"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={line.taxRatePercent}
                                onChange={(e) => setLine(line.key, { taxRatePercent: Number(e.target.value) })}
                                className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-right text-xs"
                              />
                            </td>
                            <td className="px-2 py-2 text-right text-xs font-semibold tabular-nums">
                              {fmtInr.format(amounts.total)}
                            </td>
                            <td className="px-2 py-2">
                              {lines.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    patchDraft(tabId, (d) => ({
                                      ...d,
                                      lines: d.lines.filter((l) => l.key !== line.key),
                                    }))
                                  }
                                  className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                          {line.selectedSerials.length > 0 && (
                            <tr className="bg-slate-50/80">
                              <td colSpan={10} className="px-4 py-3">
                                <p className="mb-2 text-xs font-semibold text-slate-600">
                                  Selected IMEI ({line.selectedSerials.length})
                                </p>
                                <ul className="space-y-2">
                                  {line.selectedSerials.map((s) => (
                                    <li
                                      key={s.productSerialId}
                                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Check className="h-4 w-4 text-emerald-600" />
                                        <span className="font-mono text-sm font-semibold">{s.serialNumber}</span>
                                        {s.warehouseName && (
                                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                                            {s.warehouseName}
                                          </span>
                                        )}
                                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                                          In Stock
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        className="text-xs font-semibold text-rose-600 hover:underline"
                                        onClick={() =>
                                          setLine(line.key, {
                                            selectedSerials: line.selectedSerials.filter(
                                              (x) => x.productSerialId !== s.productSerialId,
                                            ),
                                            quantity: Math.max(
                                              1,
                                              line.selectedSerials.length - 1,
                                            ),
                                          })
                                        }
                                      >
                                        Remove
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="space-y-4 xl:col-span-4">
            <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-800">Delivery Details</h2>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={draft.shipToDifferent}
                    onChange={(e) =>
                      patchDraft(tabId, (d) => ({ ...d, shipToDifferent: e.target.checked }))
                    }
                    className="rounded border-slate-300"
                  />
                  Ship to different address
                </label>
              </div>
              {draft.shipToDifferent && (
                <div className="grid gap-3">
                  <input
                    value={draft.deliveryRecipient}
                    onChange={(e) =>
                      patchDraft(tabId, (d) => ({ ...d, deliveryRecipient: e.target.value }))
                    }
                    placeholder="Recipient"
                    className={inputClass}
                  />
                  <textarea
                    value={draft.deliveryAddress}
                    onChange={(e) =>
                      patchDraft(tabId, (d) => ({ ...d, deliveryAddress: e.target.value }))
                    }
                    placeholder="Shipping address"
                    rows={2}
                    className={inputClass}
                  />
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-bold text-slate-800">Invoice Summary</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Subtotal</dt>
                  <dd className="font-medium tabular-nums">{fmtInr.format(totals.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Discount</dt>
                  <dd className="font-medium tabular-nums text-rose-600">
                    −{fmtInr.format(totals.lineDiscount + totals.docDisc)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Tax</dt>
                  <dd className="font-medium tabular-nums">{fmtInr.format(totals.tax)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Shipping</dt>
                  <dd className="font-medium tabular-nums">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={draft.shippingAmount}
                      onChange={(e) =>
                        patchDraft(tabId, (d) => ({ ...d, shippingAmount: Number(e.target.value) }))
                      }
                      className="w-24 rounded border border-slate-200 px-2 py-0.5 text-right text-xs"
                    />
                  </dd>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-bold">
                  <dt>Grand Total</dt>
                  <dd className="tabular-nums text-blue-600">{fmtInr.format(totals.grand)}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-slate-500">Amount Paid</dt>
                  <dd>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={draft.amountPaid}
                      onChange={(e) =>
                        patchDraft(tabId, (d) => ({ ...d, amountPaid: Number(e.target.value) }))
                      }
                      className="w-28 rounded border border-slate-200 px-2 py-1 text-right text-sm tabular-nums"
                    />
                  </dd>
                </div>
                <div className="flex justify-between text-base font-bold">
                  <dt className="text-rose-700">Balance Due</dt>
                  <dd className="tabular-nums text-rose-600">{fmtInr.format(totals.balance)}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-800">Profit Preview</h3>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <dt className="text-emerald-700/80">Est. Cost</dt>
                  <dd className="mt-1 font-bold tabular-nums text-slate-800">
                    {fmtInr.format(totals.estCost)}
                  </dd>
                </div>
                <div>
                  <dt className="text-emerald-700/80">Est. Profit</dt>
                  <dd className="mt-1 font-bold tabular-nums text-emerald-800">
                    {fmtInr.format(totals.profit)}
                  </dd>
                </div>
                <div>
                  <dt className="text-emerald-700/80">Est. Margin</dt>
                  <dd className="mt-1 font-bold tabular-nums text-emerald-800">{totals.margin}%</dd>
                </div>
              </dl>
            </section>
          </div>
        </div>

        {(formError || createMut.isError) && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          >
            {formError ?? (createMut.error instanceof Error ? createMut.error.message : 'Could not create invoice.')}
          </div>
        )}
      </form>

      {serialPickerLine && serialPickerProduct && (
        <InvoiceSerialPickerModal
          open={serialPickerLineKey != null}
          onClose={() => setSerialPickerLineKey(null)}
          productId={serialPickerProduct.productId}
          productVariantId={serialPickerLine.productVariantId}
          warehouseId={draft.warehouseId}
          alreadyPickedIds={otherPickedSerialIds}
          maxPick={Math.max(1, Math.round(serialPickerLine.quantity))}
          onConfirm={(serials) => {
            setLine(serialPickerLine.key, {
              selectedSerials: serials,
              quantity: serials.length,
            });
          }}
        />
      )}

      <QuickProductModal
        open={quickProductOpen}
        onClose={() => {
          setQuickProductOpen(false);
          setQuickProductLineKey(null);
        }}
        lineKey={quickProductLineKey}
        onCreated={(product, lk) => {
          if (lk != null) void applyInvoiceProduct(lk, product);
          void qc.invalidateQueries({ queryKey: ['products-pick', workplaceOrgId] });
        }}
      />
    </div>
  );
}
