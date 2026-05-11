import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import axios from 'axios';
import type { AuthUserSummary } from '../../entities/auth-types';
import type { CreateInvoiceBody, CustomerDto, InvoiceDetailDto, ProductDto } from '../../entities/billing';
import { useAppSelector } from '../../app/hooks';
import { selectWorkplaceSnapshot } from '../../features/auth/authSlice';
import { QuickProductModal } from '../purchases/QuickProductModal';
import { apiJsonAuth, authApi } from '../../shared/api/axiosClient';
import { blockComposerSubmitShortcut } from '../../shared/composer/composerShortcuts';
import { useDismissSuggestionLayer } from '../../shared/hooks/useDismissSuggestionLayer';
import { roundMoney2 } from './invoiceMoney';
import { useInvoiceComposer } from './InvoiceComposerContext';
import type { InvoiceDraftLine } from './invoiceComposerTypes';
import { mapInvoiceLineToDraft, newDraftLine } from './invoiceComposerDefaults';

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

const ITEM_PICKER_LIMIT = 500;

function sortedCatalog(products: ProductDto[]): ProductDto[] {
  return [...products].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

function formatInvoiceProductLabel(p: ProductDto): string {
  return p.sku ? `${p.sku} · ${p.name}` : p.name;
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
        patchDraft(tabId, () => ({
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

  const customerId = draft?.customerId ?? '';
  const lines = draft?.lines ?? [];

  const previewTotal = useMemo(() => {
    let t = 0;
    for (const line of lines) {
      t += roundMoney2(line.quantity * line.unitPrice);
    }
    return roundMoney2(t);
  }, [lines]);

  useEffect(() => {
    if (!tabId || customerId === '') return;
    const name = customersQ.data?.find((c) => c.customerId === customerId)?.name?.trim();
    if (name) renameTab(tabId, name);
  }, [customerId, customersQ.data, renameTab, tabId]);

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
      navigate(`/invoices/${data.invoiceId}`);
    },
  });

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
      return p ? formatInvoiceProductLabel(p) : line.description;
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

  function applyInvoiceProduct(lineKey: string, p: ProductDto) {
    setLine(lineKey, {
      productId: p.productId,
      description: p.name,
      unitPrice: p.unitPrice,
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

    if (customerId === '') {
      setFormError('Select a customer.');
      return;
    }

    const payloadLines = lines.map((l) => ({
      productId: l.productId,
      description: l.description.trim(),
      quantity: l.quantity,
      unitPrice: l.unitPrice,
    }));

    for (let i = 0; i < payloadLines.length; i++) {
      const line = payloadLines[i];
      if (!line.description) {
        setFormError(`Line ${i + 1}: description is required.`);
        return;
      }
      if (!(line.quantity > 0)) {
        setFormError(`Line ${i + 1}: quantity must be greater than zero.`);
        return;
      }
    }

    if (payloadLines.length === 0) {
      setFormError('Add at least one line.');
      return;
    }

    const body: CreateInvoiceBody = {
      customerId,
      lines: payloadLines.map((l) => ({
        productId: l.productId,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
    };

    createMut.mutate(body);
  }

  const fmtInrPreview = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
  const field =
    'mt-1 w-full rounded-lg border border-white/15 bg-[#1a1f2e] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/25';
  /** Dense table-style line editor (single row per line). */
  const invLineGrid =
    'grid grid-cols-[2rem_minmax(108px,1fr)_minmax(132px,2fr)_4.25rem_6rem_7rem_2.25rem] items-center gap-x-2 px-2 py-1.5 sm:px-3';
  const invCell =
    'w-full min-h-[34px] rounded-md border border-white/15 bg-[#1a1f2e] px-2 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/25 sm:text-sm';

  if (!tabId || !draft) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-sm text-slate-400">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-teal-400/30 border-t-teal-400" aria-hidden />
        Loading draft…
      </div>
    );
  }

  return (
    <div className="w-full max-w-none space-y-6 pb-10">
      <div>
        <Link to="/invoices" className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white">
          <ArrowLeft size={16} aria-hidden />
          Back to invoices
        </Link>
      </div>

      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
          New invoice
        </h1>
        <p className="mt-2 max-w-none text-pretty text-sm text-slate-400">
          Lines use the same rounding as the API (<span className="font-mono text-xs">decimal × qty → 2dp half-away-from-zero</span>). Posted invoices get a generated number. Use tabs above for parallel drafts.
          Shortcuts:{' '}
          <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 font-mono text-[10px] text-slate-400">⌘/Ctrl</kbd>
          {' + '}
          <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 font-mono text-[10px] text-slate-400">S</kbd>
          {' save · '}
          <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 font-mono text-[10px] text-slate-400">⌘/Ctrl</kbd>
          {' + '}
          <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 font-mono text-[10px] text-slate-400">Shift</kbd>
          {' + '}
          <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 font-mono text-[10px] text-slate-400">Enter</kbd>
          {' create · '}
          <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 font-mono text-[10px] text-slate-400">Alt</kbd>
          {' + '}
          <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 font-mono text-[10px] text-slate-400">←</kbd>
          /
          <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 font-mono text-[10px] text-slate-400">→</kbd>
          {' tabs · '}
          <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 font-mono text-[10px] text-slate-400">Alt</kbd>
          {' + '}
          <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 font-mono text-[10px] text-slate-400">Shift</kbd>
          {' + '}
          <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 font-mono text-[10px] text-slate-400">N</kbd>
          {' new tab.'}
        </p>
      </header>

      {draftBanner ? (
        <div role="status" className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">
          {draftBanner}
        </div>
      ) : null}

      <form
        ref={formRef}
        onSubmit={(e) => void onSubmit(e)}
        className="workspace-panel relative space-y-6 overflow-visible p-4 sm:p-6"
      >
        <div className="grid gap-6 lg:grid-cols-12">
          <label className="relative z-[30] block lg:col-span-12">
            <span className="text-sm font-semibold text-slate-300">Customer</span>
            <select
              required
              value={customerId === '' ? '' : String(customerId)}
              onChange={(e) => {
                const v = e.target.value === '' ? '' : Number(e.target.value);
                patchDraft(tabId, (d) => ({ ...d, customerId: v }));
              }}
              className={`${field} mt-2 w-full`}
              disabled={customersQ.isLoading}
            >
              <option value="">Select customer…</option>
              {(customersQ.data ?? []).map((c) => (
                <option key={c.customerId} value={c.customerId}>
                  {c.name}
                </option>
              ))}
            </select>
            {customersQ.isError && (
              <p className="mt-2 text-xs text-rose-400">Could not load customers (need customers.read).</p>
            )}
          </label>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <h2 className="text-lg font-semibold text-white">Lines</h2>
            <button
              type="button"
              onClick={() =>
                patchDraft(tabId, (d) => ({
                  ...d,
                  lines: [...d.lines, newDraftLine()],
                }))
              }
              className="inline-flex items-center gap-2 rounded-lg border border-teal-500/40 bg-teal-950/30 px-3 py-2 text-sm font-medium text-teal-100 hover:bg-teal-900/40"
            >
              <Plus size={16} aria-hidden />
              Add line
            </button>
          </div>

          <div ref={linesShellRef} className="border border-white/10">
            <div className="min-w-[780px]">
              <div
                className={`${invLineGrid} border-b border-white/10 bg-white/[0.04] text-[10px] font-semibold uppercase tracking-wide text-slate-500`}
              >
                <div className="text-center text-slate-600">#</div>
                <div>Item</div>
                <div>Description</div>
                <div className="text-right">Qty</div>
                <div className="text-right">Rate</div>
                <div className="text-right">Amount</div>
                <div className="text-center" aria-hidden>
                  {' '}
                </div>
              </div>
              {lines.map((line, idx) => {
                const sug = invoiceSuggestionsFor(line);
                const filterActive = normalizeProductSearch(invoiceProductInputDisplay(line)).length > 0;
                const showSuggest =
                  suggestLineKey === line.key &&
                  (productsQ.isLoading || canManageProducts || sug.length > 0 || (filterActive && !productsQ.isLoading));
                const rowLift = suggestLineKey === line.key;

                return (
                  <div
                    key={line.key}
                    className={`${invLineGrid} relative border-b border-white/[0.06] last:border-b-0 hover:bg-white/[0.02] ${rowLift ? 'z-[75]' : 'z-[1]'}`}
                  >
                    <div className="text-center text-xs tabular-nums text-slate-500">{idx + 1}</div>
                    <div className="relative min-w-0">
                      <input
                        value={invoiceProductInputDisplay(line)}
                        onChange={(e) => {
                          const v = e.target.value;
                          setProductPickDraft((prev) => ({ ...prev, [line.key]: v }));
                          setLine(line.key, { productId: null, description: v });
                          setSuggestLineKey(line.key);
                        }}
                        onFocus={() => {
                          setSuggestLineKey(line.key);
                          setProductPickDraft((prev) => {
                            if (prev[line.key] !== undefined) return prev;
                            return { ...prev, [line.key]: invoiceProductSeed(line) };
                          });
                        }}
                        className={invCell}
                        placeholder="Search catalog…"
                        autoComplete="off"
                        aria-label={`Line ${idx + 1} item`}
                        disabled={productsQ.isLoading}
                      />
                      {showSuggest && (
                        <ul className="absolute left-0 top-[calc(100%+4px)] z-[320] max-h-60 min-w-[260px] max-w-[min(100vw-2rem,440px)] overflow-auto rounded-lg border border-white/15 bg-[#151b28] py-1 shadow-2xl ring-1 ring-black/40">
                          {productsQ.isLoading && <li className="px-3 py-2 text-xs text-slate-500">Loading catalog…</li>}
                          {!productsQ.isLoading && sug.length > 0 && !normalizeProductSearch(invoiceProductInputDisplay(line)) && (
                            <li className="pointer-events-none px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                              All items · type to narrow
                            </li>
                          )}
                          {filterActive && !productsQ.isLoading && sug.length === 0 && (
                            <li className="pointer-events-none px-3 py-2 text-xs text-slate-500">
                              No catalog matches — try another spelling or create new.
                            </li>
                          )}
                          {sug.map((sp) => (
                            <li key={sp.productId}>
                              <button
                                type="button"
                                className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-white/10"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => applyInvoiceProduct(line.key, sp)}
                              >
                                <span className="text-sm text-slate-100">{sp.name}</span>
                                <span className="text-[10px] text-slate-500">
                                  {sp.brand ? `${sp.brand} · ` : ''}
                                  {sp.sku ? `${sp.sku} · ` : ''}
                                  {fmtInrPreview.format(sp.unitPrice)}
                                </span>
                              </button>
                            </li>
                          ))}
                          {canManageProducts && (
                            <li className="border-t border-white/10">
                              <button
                                type="button"
                                className="flex w-full px-3 py-2 text-left text-xs font-semibold text-teal-400 hover:bg-white/10"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setQuickProductLineKey(line.key);
                                  setQuickProductOpen(true);
                                  setSuggestLineKey(null);
                                }}
                              >
                                + Create new catalog item…
                              </button>
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                    <div className="min-w-0">
                      <input
                        value={line.description}
                        onChange={(e) => setLine(line.key, { description: e.target.value })}
                        className={invCell}
                        placeholder="Description"
                        aria-label={`Line ${idx + 1} description`}
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        step="any"
                        min={0}
                        value={line.quantity}
                        onChange={(e) => setLine(line.key, { quantity: Number(e.target.value) })}
                        className={`${invCell} text-right tabular-nums`}
                        aria-label={`Line ${idx + 1} quantity`}
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        step="any"
                        min={0}
                        value={line.unitPrice}
                        onChange={(e) => setLine(line.key, { unitPrice: Number(e.target.value) })}
                        className={`${invCell} text-right tabular-nums`}
                        aria-label={`Line ${idx + 1} unit price`}
                      />
                    </div>
                    <div className="text-right text-xs tabular-nums text-slate-200">
                      {fmtInrPreview.format(roundMoney2(line.quantity * line.unitPrice))}
                    </div>
                    <div className="flex justify-center">
                      {lines.length > 1 ? (
                        <button
                          type="button"
                          onClick={() =>
                            patchDraft(tabId, (d) => ({
                              ...d,
                              lines: d.lines.filter((l) => l.key !== line.key),
                            }))
                          }
                          className="rounded-lg p-2 text-slate-500 hover:bg-rose-500/15 hover:text-rose-300"
                          aria-label={`Remove line ${idx + 1}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : (
                        <span className="inline-block w-9" aria-hidden />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-6 border-t border-white/10 pt-4">
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Document total</p>
              <p className="text-xl font-bold tabular-nums text-white">{fmtInrPreview.format(previewTotal)}</p>
              <p className="mt-1 text-[11px] text-slate-600">Preview until posted (same math as server).</p>
            </div>
          </div>
        </div>

        {(formError || createMut.isError) && (
          <div role="alert" className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {formError ?? (createMut.error instanceof Error ? createMut.error.message : 'Could not create invoice.')}
          </div>
        )}

        <div className="flex flex-wrap gap-3 border-t border-white/10 pt-6">
          <button
            type="button"
            onClick={() => persistDraftBanner()}
            className="inline-flex items-center gap-2 rounded-xl border border-teal-500/50 bg-teal-950/40 px-5 py-3 text-sm font-semibold text-teal-100 hover:bg-teal-900/50"
          >
            <Save className="h-4 w-4" aria-hidden />
            Save draft now
          </button>
          <button
            type="submit"
            disabled={createMut.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-600/20 transition hover:from-teal-500 hover:to-emerald-500 disabled:opacity-60"
          >
            {createMut.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Creating…
              </>
            ) : (
              'Create invoice'
            )}
          </button>
          <Link to="/invoices" className="rounded-xl border border-white/15 px-6 py-3 text-sm font-medium text-slate-300 hover:bg-white/5">
            Cancel
          </Link>
        </div>
      </form>

      <QuickProductModal
        open={quickProductOpen}
        onClose={() => {
          setQuickProductOpen(false);
          setQuickProductLineKey(null);
        }}
        lineKey={quickProductLineKey}
        onCreated={(product, lk) => {
          if (lk != null) applyInvoiceProduct(lk, product);
          void qc.invalidateQueries({ queryKey: ['products-pick', workplaceOrgId] });
        }}
      />
    </div>
  );
}
