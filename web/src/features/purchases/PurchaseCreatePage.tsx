import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import axios from 'axios';
import type { AuthUserSummary } from '../../entities/auth-types';
import type {
  CreatePurchaseBillBody,
  PartyDto,
  ProductDto,
  PurchaseBillDetailDto,
  PurchaseLineDto,
} from '../../entities/billing';
import { useAppSelector } from '../../app/hooks';
import { selectWorkplaceSnapshot } from '../../features/auth/authSlice';
import { apiJsonAuth, authApi } from '../../shared/api/axiosClient';
import {
  clearPurchaseComposerSnapshot,
  readPurchaseComposerSnapshot,
  writePurchaseComposerSnapshot,
} from './purchaseComposerStorage';
import type { DraftLine } from './purchaseComposerTypes';
import { newLine } from './purchaseComposerDefaults';
import { useOptionalPurchaseComposer } from './PurchaseComposerContext';
import { QuickProductModal, defaultPurchaseUnitCost } from './QuickProductModal';
import { GST_PRESETS, computePurchaseLinePreview } from './purchaseMath';
import { PURCHASE_TEMPLATES, buildDraftLinesFromTemplate } from './purchaseTemplates';
import { useDismissSuggestionLayer } from '../../shared/hooks/useDismissSuggestionLayer';
import { blockComposerSubmitShortcut } from '../../shared/composer/composerShortcuts';

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

function linesToDraftApi(lines: DraftLine[]): CreatePurchaseBillBody['lines'] {
  return lines
    .filter((l) => l.quantity > 0 && l.description.trim().length > 0)
    .map((l) => ({
      productId: l.productId,
      description: l.description.trim(),
      quantity: l.quantity,
      unitCost: l.unitCost,
      discountPercent: l.discountPercent,
      discountAmount: l.discountAmount,
      taxRatePercent: l.taxRatePercent,
    }));
}

function fingerprintSync(partyId: number | '', lines: DraftLine[]): string {
  return JSON.stringify({ partyId, lines: linesToDraftApi(lines) });
}

function fingerprintFromServerDetail(d: PurchaseBillDetailDto): string {
  return JSON.stringify({
    partyId: d.partyId,
    lines: d.lines.map((l) => ({
      productId: l.productId,
      description: l.description.trim(),
      quantity: l.quantity,
      unitCost: l.unitCost,
      discountPercent: l.discountPercent,
      discountAmount: l.discountAmount,
      taxRatePercent: l.taxRatePercent,
    })),
  });
}

function mapDetailLineToDraft(line: PurchaseLineDto): DraftLine {
  return {
    key: crypto.randomUUID(),
    productId: line.productId,
    description: line.description,
    quantity: line.quantity,
    unitCost: line.unitCost,
    discountPercent: line.discountPercent,
    discountAmount: line.discountAmount,
    taxRatePercent: line.taxRatePercent,
  };
}

const cellInput =
  'w-full min-w-[4rem] rounded border border-white/10 bg-[#1a1f2e] px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-emerald-500 sm:text-sm';

/** Dense spreadsheet-style rows (one row per line). */
const purchaseLineGrid =
  'grid grid-cols-[2rem_minmax(196px,2fr)_3.5rem_3.25rem_5rem_3.25rem_3.75rem_6rem_3rem_4.25rem_6rem_2.25rem] items-center gap-x-2 px-2 py-1.5 sm:px-3';

const SERVER_DEBOUNCE_MS = 2600;
const LOCAL_PERSIST_MS = 450;

export function PurchaseCreatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ tabId?: string; draftPurchaseBillId?: string }>();
  const composer = useOptionalPurchaseComposer();
  const patchDraftFn = composer?.patchDraft;
  const renameTabFn = composer?.renameTab;
  const removeDraftTabFn = composer?.removeDraftTab;
  const tabId = params.tabId;
  const isComposer = Boolean(tabId && composer);

  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const workplaceOrgId = useAppSelector(selectWorkplaceSnapshot)?.organizationId ?? 0;

  const draftBillParam = params.draftPurchaseBillId ? Number(params.draftPurchaseBillId) : NaN;
  const standaloneUrlDraftId =
    !isComposer && Number.isFinite(draftBillParam) && draftBillParam > 0 ? Math.floor(draftBillParam) : null;

  const [standalonePartyId, setStandalonePartyId] = useState<number | ''>('');
  const [standaloneLines, setStandaloneLines] = useState<DraftLine[]>(() => [newLine()]);
  const [formError, setFormError] = useState<string | null>(null);
  const [quickProductOpen, setQuickProductOpen] = useState(false);
  const [quickProductLineKey, setQuickProductLineKey] = useState<string | null>(null);
  const [suggestLineKey, setSuggestLineKey] = useState<string | null>(null);
  const [templateSelectKey, setTemplateSelectKey] = useState('');

  const composerDraft = isComposer && tabId ? composer!.drafts[tabId] : undefined;
  const partyId = isComposer ? (composerDraft?.partyId ?? '') : standalonePartyId;
  const lines = isComposer ? (composerDraft?.lines ?? [newLine()]) : standaloneLines;
  const serverDraftId = isComposer ? (composerDraft?.serverDraftId ?? null) : standaloneUrlDraftId;

  const linesGridShellRef = useRef<HTMLDivElement>(null);
  useDismissSuggestionLayer(Boolean(suggestLineKey), linesGridShellRef, () => setSuggestLineKey(null));

  useEffect(() => {
    setSuggestLineKey(null);
  }, [tabId]);

  function setPartyIdNext(v: number | '') {
    if (isComposer && tabId && patchDraftFn) patchDraftFn(tabId, (d) => ({ ...d, partyId: v }));
    else setStandalonePartyId(v);
  }

  function updateLines(updater: (prev: DraftLine[]) => DraftLine[]) {
    if (isComposer && tabId && patchDraftFn) patchDraftFn(tabId, (d) => ({ ...d, lines: updater(d.lines) }));
    else setStandaloneLines(updater);
  }

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'saved' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const lastSyncedFingerprintRef = useRef<string | null>(null);
  const syncInFlightRef = useRef(false);
  const hydratedBillIdRef = useRef<number | null>(null);

  const loadDraftRaw = searchParams.get('loadDraft');
  const loadDraftId = useMemo(() => {
    const n = loadDraftRaw ? Number(loadDraftRaw) : NaN;
    return Number.isFinite(n) && n > 0 && Number.isInteger(n) ? Math.floor(n) : null;
  }, [loadDraftRaw]);

  const locationPathKey = `${location.pathname}${location.search}`;

  const authMeQ = useQuery({
    queryKey: ['auth-me-purchase-create', workplaceOrgId],
    enabled: workplaceOrgId > 0,
    queryFn: () => apiJsonAuth<AuthUserSummary>('/v1/auth/me'),
    staleTime: 60_000,
    retry: 1,
  });
  const canManageProducts = authMeQ.data?.permissions?.includes('products.manage') ?? false;

  const partiesQ = useQuery({
    queryKey: ['parties-pick', workplaceOrgId],
    queryFn: async () => {
      const { data } = await authApi.get<PartyDto[]>('/v1/parties?max=400');
      return data;
    },
    retry: 1,
  });

  const vendors = useMemo(() => {
    return (partiesQ.data ?? []).filter((p) => p.isActive && String(p.kind).toLowerCase() === 'vendor');
  }, [partiesQ.data]);

  useEffect(() => {
    if (!isComposer || !tabId || !renameTabFn || partyId === '') return;
    const label = vendors.find((v) => v.partyId === partyId)?.displayName?.trim();
    if (label) renameTabFn(tabId, label);
  }, [renameTabFn, isComposer, tabId, partyId, vendors]);

  const productsQ = useQuery({
    queryKey: ['products-pick', workplaceOrgId],
    queryFn: async () => {
      const { data } = await authApi.get<ProductDto[]>('/v1/products?activeOnly=true&max=500');
      return data;
    },
    retry: 1,
  });

  const draftDetailQ = useQuery({
    queryKey: ['purchase-draft-edit', serverDraftId, workplaceOrgId],
    queryFn: () => apiJsonAuth<PurchaseBillDetailDto>(`/v1/purchases/${serverDraftId}`),
    enabled: serverDraftId != null && workplaceOrgId > 0,
    retry: 1,
  });

  const productsById = useMemo(() => {
    const m = new Map<number, ProductDto>();
    for (const p of productsQ.data ?? []) m.set(p.productId, p);
    return m;
  }, [productsQ.data]);

  const linePreviews = useMemo(() => {
    const m = new Map<string, ReturnType<typeof computePurchaseLinePreview>>();
    for (const line of lines) {
      m.set(
        line.key,
        computePurchaseLinePreview(line.quantity, line.unitCost, line.discountPercent, line.discountAmount, line.taxRatePercent),
      );
    }
    return m;
  }, [lines]);

  const documentTotal = useMemo(() => {
    let t = 0;
    for (const line of lines) {
      t += linePreviews.get(line.key)?.lineTotal ?? 0;
    }
    return Math.round((t + Number.EPSILON) * 100) / 100;
  }, [lines, linePreviews]);

  const syncFingerprint = useMemo(() => fingerprintSync(partyId, lines), [partyId, lines]);

  const bootstrapRef = useRef<string | null>(null);
  useEffect(() => {
    if (bootstrapRef.current === locationPathKey) return;
    bootstrapRef.current = locationPathKey;

    if (isComposer || serverDraftId != null) return;

    if (searchParams.get('fresh') === '1') {
      clearPurchaseComposerSnapshot(workplaceOrgId);
      return;
    }

    const snap = readPurchaseComposerSnapshot(workplaceOrgId);
    if (snap?.draftPurchaseBillId) {
      navigate(`/purchases/new?loadDraft=${snap.draftPurchaseBillId}`, { replace: true });
      return;
    }
    if (snap?.lines?.length) {
      setStandalonePartyId(snap.partyId);
      setStandaloneLines(snap.lines as DraftLine[]);
    }
  }, [locationPathKey, workplaceOrgId, serverDraftId, searchParams, navigate, isComposer]);

  useEffect(() => {
    if (!isComposer || !tabId || !patchDraftFn || !renameTabFn || loadDraftId == null) return;

    let cancelled = false;
    void (async () => {
      try {
        const d = await apiJsonAuth<PurchaseBillDetailDto>(`/v1/purchases/${loadDraftId}`);
        if (cancelled) return;
        if (d.status !== 'Draft') {
          navigate(`/purchases/${loadDraftId}`, { replace: true });
          return;
        }
        patchDraftFn(tabId, () => ({
          partyId: d.partyId,
          lines: d.lines.length ? d.lines.map(mapDetailLineToDraft) : [newLine()],
          serverDraftId: d.purchaseBillId,
        }));
        const supplierLabel = d.supplierName?.trim();
        if (supplierLabel) renameTabFn(tabId, supplierLabel);
        lastSyncedFingerprintRef.current = fingerprintFromServerDetail(d);
        hydratedBillIdRef.current = d.purchaseBillId;
        navigate(`/purchases/new/${tabId}`, { replace: true });
      } catch (e) {
        if (cancelled) return;
        const msg =
          axios.isAxiosError(e) && e.response?.data
            ? typeof e.response.data === 'string'
              ? e.response.data
              : JSON.stringify(e.response.data)
            : e instanceof Error
              ? e.message
              : 'Could not load draft.';
        setFormError(msg.slice(0, 280));
        navigate(`/purchases/new/${tabId}`, { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isComposer, tabId, patchDraftFn, renameTabFn, loadDraftId, navigate]);

  useEffect(() => {
    if (!draftDetailQ.isSuccess || !draftDetailQ.data) return;
    const d = draftDetailQ.data;
    if (d.status !== 'Draft') {
      navigate(`/purchases/${serverDraftId}`, { replace: true });
      return;
    }
    if (hydratedBillIdRef.current === d.purchaseBillId) return;
    hydratedBillIdRef.current = d.purchaseBillId;
    setPartyIdNext(d.partyId);
    updateLines(() => d.lines.map(mapDetailLineToDraft));
    lastSyncedFingerprintRef.current = fingerprintFromServerDetail(d);
    setSyncStatus('saved');
    setSyncMessage(null);
  }, [draftDetailQ.data, draftDetailQ.isSuccess, navigate, serverDraftId]);

  useEffect(() => {
    hydratedBillIdRef.current = null;
    lastSyncedFingerprintRef.current = null;
  }, [tabId]);

  useEffect(() => {
    if (workplaceOrgId <= 0 || isComposer) return;
    const t = window.setTimeout(() => {
      writePurchaseComposerSnapshot(workplaceOrgId, {
        v: 1,
        updatedAt: new Date().toISOString(),
        draftPurchaseBillId: serverDraftId,
        partyId,
        lines,
      });
    }, LOCAL_PERSIST_MS);
    return () => window.clearTimeout(t);
  }, [workplaceOrgId, serverDraftId, partyId, lines, isComposer]);

  const runServerSync = useCallback(
    async (force: boolean): Promise<boolean> => {
      if (partyId === '') {
        setSyncMessage('Pick a supplier before saving to server.');
        setSyncStatus('error');
        return false;
      }
      const body: CreatePurchaseBillBody = {
        partyId,
        lines: linesToDraftApi(lines),
      };
      const fp = fingerprintSync(partyId, lines);
      if (!force && fp === lastSyncedFingerprintRef.current) {
        setSyncStatus('saved');
        return true;
      }
      if (syncInFlightRef.current) return false;
      syncInFlightRef.current = true;
      setSyncStatus('syncing');
      setSyncMessage(null);
      try {
        let effectiveId = serverDraftId;
        if (serverDraftId == null) {
          const { data } = await authApi.post<{ purchaseBillId: number }>('/v1/purchases/drafts', body);
          const id = data?.purchaseBillId;
          if (id == null) throw new Error('No draft id returned.');
          lastSyncedFingerprintRef.current = fp;
          effectiveId = id;
          if (isComposer && tabId && patchDraftFn) {
            patchDraftFn(tabId, (d) => ({ ...d, serverDraftId: id }));
          } else {
            navigate(`/purchases/new?loadDraft=${id}`, { replace: true });
          }
        } else {
          await authApi.put(`/v1/purchases/drafts/${serverDraftId}`, body);
          lastSyncedFingerprintRef.current = fp;
        }
        setSyncStatus('saved');
        await qc.invalidateQueries({ queryKey: ['purchases-list'] });
        if (effectiveId != null) {
          await qc.invalidateQueries({ queryKey: ['purchase-draft-edit', effectiveId] });
        }
        return true;
      } catch (e) {
        const msg =
          axios.isAxiosError(e) && e.response?.data
            ? typeof e.response.data === 'string'
              ? e.response.data
              : JSON.stringify(e.response.data)
            : e instanceof Error
              ? e.message
              : 'Draft sync failed.';
        setSyncMessage(msg.slice(0, 280));
        setSyncStatus('error');
        return false;
      } finally {
        syncInFlightRef.current = false;
      }
    },
    [partyId, lines, serverDraftId, navigate, qc, isComposer, tabId, patchDraftFn],
  );

  useEffect(() => {
    if (partyId === '') return;
    const t = window.setTimeout(() => {
      void runServerSync(false);
    }, SERVER_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [syncFingerprint, partyId, runServerSync]);

  function validatePostedLines(): string | null {
    if (partyId === '') return 'Select a supplier (vendor party).';
    const payloadLines = lines.map((l) => ({
      productId: l.productId,
      description: l.description.trim(),
      quantity: l.quantity,
      unitCost: l.unitCost,
      discountPercent: l.discountPercent,
      discountAmount: l.discountAmount,
      taxRatePercent: l.taxRatePercent,
    }));
    for (let i = 0; i < payloadLines.length; i++) {
      const line = payloadLines[i];
      if (!line!.description) return `Line ${i + 1}: enter or pick an item.`;
      if (!(line!.quantity > 0)) return `Line ${i + 1}: quantity must be greater than zero.`;
      if (line!.discountPercent < 0 || line!.discountPercent > 100) return `Line ${i + 1}: discount % must be 0–100.`;
      if (line!.discountAmount < 0) return `Line ${i + 1}: discount amount cannot be negative.`;
      if (line!.taxRatePercent < 0 || line!.taxRatePercent > 100)
        return `Line ${i + 1}: GST % must be 0–100 (combined CGST+SGST rate).`;
      if (!Number.isFinite(line!.unitCost) || line!.unitCost < 0)
        return `Line ${i + 1}: rate must be a non-negative number (tax-exclusive).`;
    }
    if (payloadLines.length === 0) return 'Add at least one line.';
    return null;
  }

  const postDraftMut = useMutation({
    mutationFn: async () => {
      const err = validatePostedLines();
      if (err) throw new Error(err);
      if (partyId === '') throw new Error('Select a supplier.');
      const body: CreatePurchaseBillBody = {
        partyId,
        lines: linesToDraftApi(lines),
      };
      let draftId = serverDraftId;
      if (draftId == null) {
        const { data } = await authApi.post<{ purchaseBillId: number }>('/v1/purchases/drafts', body);
        draftId = data?.purchaseBillId;
        if (draftId == null) throw new Error('No draft id returned.');
        lastSyncedFingerprintRef.current = fingerprintSync(partyId, lines);
        if (isComposer && tabId && patchDraftFn) {
          patchDraftFn(tabId, (d) => ({ ...d, serverDraftId: draftId! }));
        } else {
          navigate(`/purchases/new?loadDraft=${draftId}`, { replace: true });
        }
      } else {
        await authApi.put(`/v1/purchases/drafts/${draftId}`, body);
        lastSyncedFingerprintRef.current = fingerprintSync(partyId, lines);
      }
      await authApi.post(`/v1/purchases/drafts/${draftId}/post`);
      return draftId;
    },
    onSuccess: async (id) => {
      if (!isComposer) clearPurchaseComposerSnapshot(workplaceOrgId);
      else if (tabId && removeDraftTabFn) removeDraftTabFn(tabId);
      await qc.invalidateQueries({ queryKey: ['purchases-list'] });
      await qc.invalidateQueries({ queryKey: ['products-pick'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      navigate(`/purchases/${id}`);
    },
    onError: (e: unknown) => {
      setFormError(e instanceof Error ? e.message : 'Could not post purchase.');
    },
  });

  function setLine(key: string, patch: Partial<DraftLine>) {
    updateLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function applyProduct(lineKey: string, p: ProductDto) {
    setLine(lineKey, {
      productId: p.productId,
      description: p.name,
      unitCost: defaultPurchaseUnitCost(p),
      taxRatePercent: p.taxRatePercent != null && Number.isFinite(p.taxRatePercent) ? p.taxRatePercent : 0,
    });
    setSuggestLineKey(null);
  }

  function suggestionsFor(line: DraftLine): ProductDto[] {
    const all = productsQ.data ?? [];
    const sorted = sortedCatalog(all);
    const q = normalizeProductSearch(line.description);
    if (!q) return sorted.slice(0, ITEM_PICKER_LIMIT);
    return sorted.filter((p) => productMatches(p, q)).slice(0, ITEM_PICKER_LIMIT);
  }

  async function onManualSaveDraft() {
    setFormError(null);
    await runServerSync(true);
  }

  function onPostPurchase() {
    setFormError(null);
    const err = validatePostedLines();
    if (err) {
      setFormError(err);
      return;
    }
    postDraftMut.mutate();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void onManualSaveDraft();
  }

  const quickPostRef = useRef(onPostPurchase);
  quickPostRef.current = onPostPurchase;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || e.key !== 'Enter') return;
      if (blockComposerSubmitShortcut(e.target)) return;
      e.preventDefault();
      quickPostRef.current();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const fmtInrPreview = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
  const field =
    'mt-1 w-full rounded-lg border border-white/15 bg-[#1a1f2e] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25';

  const title = serverDraftId != null ? `Purchase draft #${serverDraftId}` : 'New purchase';

  return (
    <div className={isComposer ? 'w-full max-w-none space-y-6 pb-10' : 'mx-auto w-full max-w-[1400px] space-y-8 pb-12'}>
      <div>
        <Link to="/purchases" className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white">
          <ArrowLeft size={16} aria-hidden />
          Back to purchases
        </Link>
      </div>

      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
          {title}
        </h1>
        <p className="mt-2 max-w-none text-pretty text-sm text-slate-400">
          Drafts sync from the composer (local + debounced server). Posted bills update inventory for physical SKUs. Drafts save to this device immediately and sync after you pause editing (~{Math.round(SERVER_DEBOUNCE_MS / 1000)}s) or when you click{' '}
          <strong className="font-medium text-slate-300">Save draft</strong>. Posting finalizes stock and PUR number. Rates are tax-exclusive; GST is a combined line %.{' '}
          <span className="text-slate-500">
            <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 font-mono text-[10px] text-slate-400">⌘/Ctrl</kbd>
            {' + '}
            <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 font-mono text-[10px] text-slate-400">Shift</kbd>
            {' + '}
            <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 font-mono text-[10px] text-slate-400">Enter</kbd>
            {' posts · '}
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
          </span>
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`rounded-full px-2.5 py-1 font-semibold ${
              syncStatus === 'syncing'
                ? 'bg-amber-500/20 text-amber-200'
                : syncStatus === 'saved'
                  ? 'bg-emerald-500/15 text-emerald-200'
                  : syncStatus === 'error'
                    ? 'bg-rose-500/20 text-rose-200'
                    : 'bg-white/10 text-slate-400'
            }`}
          >
            {syncStatus === 'syncing' && 'Syncing draft…'}
            {syncStatus === 'saved' && 'Draft synced'}
            {syncStatus === 'error' && 'Sync issue'}
            {syncStatus === 'idle' && 'Local + server draft'}
          </span>
          {syncMessage && <span className="text-rose-300">{syncMessage}</span>}
        </div>
      </header>

      {serverDraftId != null && draftDetailQ.isLoading && (
        <div className="workspace-panel px-6 py-8 text-sm text-slate-400">Loading draft…</div>
      )}

      <form onSubmit={(e) => void onSubmit(e)} className="workspace-panel relative space-y-6 overflow-visible p-4 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-12">
          <label className="block lg:col-span-6">
            <span className="text-sm font-semibold text-slate-300">Supplier (vendor)</span>
            <select
              required
              value={partyId === '' ? '' : String(partyId)}
              onChange={(e) => setPartyIdNext(e.target.value === '' ? '' : Number(e.target.value))}
              className={`${field} relative z-[1] mt-2 w-full`}
              disabled={partiesQ.isLoading}
            >
              <option value="">{vendors.length === 0 ? 'No active vendors — add in Parties' : 'Select supplier…'}</option>
              {vendors.map((v) => (
                <option key={v.partyId} value={v.partyId}>
                  {v.displayName}
                </option>
              ))}
            </select>
          </label>

          <label className="block lg:col-span-6">
            <span className="text-sm font-semibold text-slate-300">Starter template</span>
            <select
              value={templateSelectKey}
              onChange={(e) => {
                const id = e.target.value;
                if (!id) return;
                updateLines(() => buildDraftLinesFromTemplate(id) as DraftLine[]);
                setTemplateSelectKey('');
              }}
              className={`${field} relative z-[1] mt-2 w-full`}
            >
              <option value="">Apply a template…</option>
              {PURCHASE_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Replaces current rows with presets (GST %, discounts, row count). Pick items and rates next — templates are local shortcuts only.
            </p>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <h2 className="text-lg font-semibold text-white">Items</h2>
          <button
            type="button"
            onClick={() => updateLines((prev) => [...prev, newLine()])}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-sm font-medium text-emerald-100 hover:bg-emerald-900/40"
          >
            <Plus size={16} aria-hidden />
            Add row
          </button>
        </div>

        <div ref={linesGridShellRef} className="overflow-x-auto rounded-xl border border-white/10">
          <div className="min-w-[1040px]">
            <div
              className={`${purchaseLineGrid} border-b border-white/10 bg-white/[0.04] text-[10px] font-semibold uppercase tracking-wide text-slate-500`}
            >
              <div className="text-center text-slate-600">#</div>
              <div>Item</div>
              <div className="text-right">Qty</div>
              <div>Unit</div>
              <div className="text-right">Rate</div>
              <div className="text-right">Disc%</div>
              <div className="text-right">Disc₹</div>
              <div>GST</div>
              <div className="text-right">%</div>
              <div className="text-right">Tax</div>
              <div className="text-right">Amount</div>
              <div className="text-center" aria-hidden>
                {' '}
              </div>
            </div>
            {lines.map((line, idx) => {
              const p = line.productId != null ? productsById.get(line.productId) : undefined;
              const preview = linePreviews.get(line.key)!;
              const sug = suggestionsFor(line);
              const filterActive = normalizeProductSearch(line.description).length > 0;
              const showSuggest =
                suggestLineKey === line.key &&
                (productsQ.isLoading || canManageProducts || sug.length > 0 || (filterActive && !productsQ.isLoading));
              const rowLift = suggestLineKey === line.key;

              return (
                <div
                  key={line.key}
                  className={`${purchaseLineGrid} relative border-b border-white/[0.06] last:border-b-0 hover:bg-white/[0.02] ${rowLift ? 'z-[75]' : 'z-[1]'}`}
                >
                  <div className="text-center text-xs tabular-nums text-slate-500">{idx + 1}</div>
                  <div className="relative min-w-0">
                    <input
                      value={line.description}
                      onChange={(e) => {
                        setLine(line.key, { description: e.target.value, productId: null });
                        setSuggestLineKey(line.key);
                      }}
                      onFocus={() => setSuggestLineKey(line.key)}
                      className={cellInput}
                      placeholder="Search catalog…"
                      autoComplete="off"
                      aria-label={`Line ${idx + 1} item`}
                    />
                    {showSuggest && (
                      <ul className="absolute left-0 top-[calc(100%+4px)] z-[320] max-h-60 min-w-[260px] max-w-[min(100vw-2rem,440px)] overflow-auto rounded-lg border border-white/15 bg-[#151b28] py-1 shadow-2xl ring-1 ring-black/40">
                        {productsQ.isLoading && <li className="px-3 py-2 text-xs text-slate-500">Loading catalog…</li>}
                        {!productsQ.isLoading && sug.length > 0 && !normalizeProductSearch(line.description) && (
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
                              onClick={() => applyProduct(line.key, sp)}
                            >
                              <span className="text-sm text-slate-100">{sp.name}</span>
                              <span className="text-[10px] text-slate-500">
                                {sp.brand ? `${sp.brand} · ` : ''}
                                {sp.sku ? `${sp.sku} · ` : ''}
                                Sale {fmtInrPreview.format(sp.unitPrice)}
                                {sp.purchasePrice != null ? ` · Cost ${fmtInrPreview.format(sp.purchasePrice)}` : ''}
                                {sp.stockQty != null ? ` · Stock ${sp.stockQty}` : ''}
                              </span>
                            </button>
                          </li>
                        ))}
                        {canManageProducts && (
                          <li className="border-t border-white/10">
                            <button
                              type="button"
                              className="flex w-full px-3 py-2 text-left text-xs font-semibold text-emerald-400 hover:bg-white/10"
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
                  <div>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      value={line.quantity}
                      onChange={(e) => setLine(line.key, { quantity: Number(e.target.value) })}
                      className={`${cellInput} text-right tabular-nums`}
                      aria-label={`Line ${idx + 1} quantity`}
                    />
                  </div>
                  <div
                    className="truncate text-[11px] text-slate-400 tabular-nums"
                    title={p?.unitName ?? undefined}
                  >
                    {p?.unitName ?? '—'}
                  </div>
                  <div>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      value={line.unitCost}
                      onChange={(e) => setLine(line.key, { unitCost: Number(e.target.value) })}
                      className={`${cellInput} text-right tabular-nums`}
                      title="Purchase rate (excluding GST)"
                      aria-label={`Line ${idx + 1} rate`}
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      max={100}
                      value={line.discountPercent}
                      onChange={(e) => setLine(line.key, { discountPercent: Number(e.target.value) })}
                      className={`${cellInput} text-right tabular-nums`}
                      aria-label={`Line ${idx + 1} discount percent`}
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      value={line.discountAmount}
                      onChange={(e) => setLine(line.key, { discountAmount: Number(e.target.value) })}
                      className={`${cellInput} text-right tabular-nums`}
                      aria-label={`Line ${idx + 1} discount amount`}
                    />
                  </div>
                  <div className="relative z-[25] min-w-0">
                    <select
                      value={GST_PRESETS.includes(line.taxRatePercent as (typeof GST_PRESETS)[number]) ? String(line.taxRatePercent) : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLine(line.key, { taxRatePercent: v === '' ? line.taxRatePercent : Number(v) });
                      }}
                      className={`${cellInput} text-[11px]`}
                      aria-label={`Line ${idx + 1} GST preset`}
                    >
                      <option value="">Preset…</option>
                      {GST_PRESETS.map((g) => (
                        <option key={g} value={g}>
                          {g}%
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      max={100}
                      value={line.taxRatePercent}
                      onChange={(e) => setLine(line.key, { taxRatePercent: Number(e.target.value) })}
                      className={`${cellInput} text-right tabular-nums text-[11px]`}
                      title="Combined GST %"
                      aria-label={`Line ${idx + 1} GST percent`}
                    />
                  </div>
                  <div className="text-right text-[11px] tabular-nums text-slate-400">{fmtInrPreview.format(preview.taxAmount)}</div>
                  <div className="text-right text-xs font-semibold tabular-nums text-slate-100">
                    {fmtInrPreview.format(preview.lineTotal)}
                  </div>
                  <div className="flex justify-center">
                    {lines.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => updateLines((prev) => prev.filter((l) => l.key !== line.key))}
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
            <p className="text-xl font-bold tabular-nums text-white">{fmtInrPreview.format(documentTotal)}</p>
            <p className="mt-1 text-[11px] text-slate-600">Preview until posted (same math as server).</p>
          </div>
        </div>

        {(formError || postDraftMut.isError) && (
          <div role="alert" className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {formError ?? (postDraftMut.error instanceof Error ? postDraftMut.error.message : 'Could not post purchase.')}
          </div>
        )}

        <div className="flex flex-wrap gap-3 border-t border-white/10 pt-6">
          <button
            type="button"
            onClick={() => void onManualSaveDraft()}
            disabled={partyId === ''}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-950/40 px-5 py-3 text-sm font-semibold text-emerald-100 hover:bg-emerald-900/50 disabled:opacity-50"
          >
            <Save className="h-4 w-4" aria-hidden />
            Save draft now
          </button>
          <button
            type="button"
            onClick={() => void onPostPurchase()}
            disabled={postDraftMut.isPending || vendors.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:from-emerald-500 hover:to-teal-600 disabled:opacity-60"
          >
            {postDraftMut.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Posting…
              </>
            ) : (
              'Post purchase'
            )}
          </button>
          <Link to="/purchases" className="rounded-xl border border-white/15 px-6 py-3 text-sm font-medium text-slate-300 hover:bg-white/5">
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
          if (lk != null) {
            updateLines((prev) =>
              prev.map((line) =>
                line.key === lk
                  ? {
                      ...line,
                      productId: product.productId,
                      description: product.name,
                      unitCost: defaultPurchaseUnitCost(product),
                      taxRatePercent:
                        product.taxRatePercent != null && Number.isFinite(product.taxRatePercent) ? product.taxRatePercent : line.taxRatePercent,
                    }
                  : line,
              ),
            );
          }
        }}
      />
    </div>
  );
}
