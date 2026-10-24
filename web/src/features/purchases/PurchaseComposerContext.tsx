import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import type { DraftLine, PurchaseComposerDraft, PurchaseComposerTab } from './purchaseComposerTypes';
import { defaultPurchaseComposerDraft } from './purchaseComposerDefaults';

export const PURCHASE_COMPOSER_STORAGE_KEY = 'billing.purchaseComposer.multi.v1';

type PersistedShape = {
  tabs: PurchaseComposerTab[];
  drafts: Record<string, PurchaseComposerDraft>;
};

function isDraftLine(v: unknown): v is DraftLine {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof (v as { key?: unknown }).key === 'string' &&
    typeof (v as { description?: unknown }).description === 'string'
  );
}

function reviveDraft(raw: unknown): PurchaseComposerDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const partyRaw = o.partyId;
  const partyId: number | '' =
    partyRaw === '' || partyRaw == null
      ? ''
      : typeof partyRaw === 'number' && Number.isFinite(partyRaw)
        ? partyRaw
        : '';

  const serverRaw = o.serverDraftId;
  const serverDraftId =
    typeof serverRaw === 'number' && Number.isFinite(serverRaw) && serverRaw > 0 ? serverRaw : null;

  const linesRaw = o.lines;
  if (!Array.isArray(linesRaw) || linesRaw.length === 0) return null;
  const lines = linesRaw.filter(isDraftLine).map((l) => ({
    key: l.key,
    productId: typeof l.productId === 'number' && Number.isFinite(l.productId) ? l.productId : null,
    productVariantId:
      typeof l.productVariantId === 'number' && Number.isFinite(l.productVariantId)
        ? l.productVariantId
        : null,
    description: l.description,
    quantity: typeof l.quantity === 'number' && Number.isFinite(l.quantity) ? l.quantity : 1,
    unitCost: typeof l.unitCost === 'number' && Number.isFinite(l.unitCost) ? l.unitCost : 0,
    discountPercent:
      typeof l.discountPercent === 'number' && Number.isFinite(l.discountPercent) ? l.discountPercent : 0,
    discountAmount:
      typeof l.discountAmount === 'number' && Number.isFinite(l.discountAmount) ? l.discountAmount : 0,
    taxRatePercent:
      typeof l.taxRatePercent === 'number' && Number.isFinite(l.taxRatePercent) ? l.taxRatePercent : 0,
  }));
  if (lines.length === 0) return null;
  return { partyId, lines, serverDraftId };
}

function loadPersisted(): PersistedShape | null {
  try {
    const raw = localStorage.getItem(PURCHASE_COMPOSER_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== 'object') return null;
    const tabsRaw = (p as { tabs?: unknown }).tabs;
    const draftsRaw = (p as { drafts?: unknown }).drafts;
    if (!Array.isArray(tabsRaw) || typeof draftsRaw !== 'object' || draftsRaw === null) return null;
    const tabs: PurchaseComposerTab[] = tabsRaw
      .filter((t): t is PurchaseComposerTab => !!t && typeof t === 'object' && typeof (t as { id?: unknown }).id === 'string')
      .map((t) => ({
        id: (t as PurchaseComposerTab).id,
        title: typeof (t as PurchaseComposerTab).title === 'string' ? (t as PurchaseComposerTab).title : 'Purchase',
      }));
    const drafts: Record<string, PurchaseComposerDraft> = {};
    for (const [k, v] of Object.entries(draftsRaw)) {
      const d = reviveDraft(v);
      if (d) drafts[k] = d;
    }
    return { tabs, drafts };
  } catch {
    return null;
  }
}

function persistState(tabs: PurchaseComposerTab[], drafts: Record<string, PurchaseComposerDraft>): void {
  try {
    localStorage.setItem(PURCHASE_COMPOSER_STORAGE_KEY, JSON.stringify({ tabs, drafts }));
  } catch {
    /* quota */
  }
}

export type PurchaseComposerContextValue = {
  routeTabId: string | undefined;
  tabs: PurchaseComposerTab[];
  drafts: Record<string, PurchaseComposerDraft>;
  patchDraft: (tabId: string, updater: (d: PurchaseComposerDraft) => PurchaseComposerDraft) => void;
  renameTab: (tabId: string, title: string) => void;
  addTab: () => void;
  closeTab: (tabId: string) => void;
  removeDraftTab: (tabId: string) => void;
  saveDraftNow: () => string;
};

const PurchaseComposerContext = createContext<PurchaseComposerContextValue | null>(null);

export function PurchaseComposerProvider({
  routeTabId,
  children,
}: {
  routeTabId: string | undefined;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const persistedRef = useRef<PersistedShape | null>(null);
  if (persistedRef.current === null) {
    persistedRef.current = loadPersisted();
  }
  const persisted = persistedRef.current;

  const [tabs, setTabs] = useState<PurchaseComposerTab[]>(() =>
    persisted?.tabs?.length ? persisted.tabs : [],
  );
  const [drafts, setDrafts] = useState<Record<string, PurchaseComposerDraft>>(
    () => persisted?.drafts ?? {},
  );

  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedulePersist = useCallback((nextTabs: PurchaseComposerTab[], nextDrafts: Record<string, PurchaseComposerDraft>) => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      persistTimer.current = null;
      persistState(nextTabs, nextDrafts);
    }, 450);
  }, []);

  const flushPersist = useCallback((nextTabs: PurchaseComposerTab[], nextDrafts: Record<string, PurchaseComposerDraft>) => {
    if (persistTimer.current) {
      clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    persistState(nextTabs, nextDrafts);
  }, []);

  useEffect(
    () => () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!routeTabId) return;
    setTabs((prev) => {
      if (prev.some((t) => t.id === routeTabId)) return prev;
      return [...prev, { id: routeTabId, title: 'New purchase' }];
    });
    setDrafts((prev) => {
      if (prev[routeTabId]) return prev;
      return { ...prev, [routeTabId]: defaultPurchaseComposerDraft() };
    });
  }, [routeTabId]);

  useEffect(() => {
    schedulePersist(tabs, drafts);
  }, [tabs, drafts, schedulePersist]);

  const patchDraft = useCallback((tabId: string, updater: (d: PurchaseComposerDraft) => PurchaseComposerDraft) => {
    setDrafts((prev) => {
      const base = prev[tabId] ?? defaultPurchaseComposerDraft();
      return { ...prev, [tabId]: updater(base) };
    });
  }, []);

  const renameTab = useCallback((tabId: string, title: string) => {
    const trimmed = title.trim() || 'New purchase';
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === tabId);
      if (idx < 0) return prev;
      if (prev[idx]!.title === trimmed) return prev;
      return prev.map((t) => (t.id === tabId ? { ...t, title: trimmed } : t));
    });
  }, []);

  const addTab = useCallback(() => {
    const id = crypto.randomUUID();
    const nextDrafts = { ...drafts, [id]: defaultPurchaseComposerDraft() };
    const nextTabs = [...tabs, { id, title: 'New purchase' }];
    setTabs(nextTabs);
    setDrafts(nextDrafts);
    flushPersist(nextTabs, nextDrafts);
    navigate(`/purchases/new/${id}`);
  }, [drafts, flushPersist, navigate, tabs]);

  const removeDraftTab = useCallback(
    (tabId: string) => {
      const nextTabs = tabs.filter((t) => t.id !== tabId);
      const nextDrafts = { ...drafts };
      delete nextDrafts[tabId];
      setTabs(nextTabs);
      setDrafts(nextDrafts);
      flushPersist(nextTabs, nextDrafts);
    },
    [drafts, flushPersist, tabs],
  );

  const closeTab = useCallback(
    (tabId: string) => {
      const idx = tabs.findIndex((t) => t.id === tabId);
      const nextTabs = tabs.filter((t) => t.id !== tabId);
      const nextDrafts = { ...drafts };
      delete nextDrafts[tabId];
      setTabs(nextTabs);
      setDrafts(nextDrafts);
      flushPersist(nextTabs, nextDrafts);

      if (routeTabId !== tabId) return;
      const fallback = nextTabs[idx - 1] ?? nextTabs[idx] ?? nextTabs[0];
      if (fallback) {
        navigate(`/purchases/new/${fallback.id}`);
      } else {
        navigate('/purchases');
      }
    },
    [drafts, flushPersist, navigate, routeTabId, tabs],
  );

  const saveDraftNow = useCallback(() => {
    flushPersist(tabs, drafts);
    try {
      return new Date().toISOString();
    } catch {
      return '';
    }
  }, [drafts, flushPersist, tabs]);

  const value = useMemo<PurchaseComposerContextValue>(
    () => ({
      routeTabId,
      tabs,
      drafts,
      patchDraft,
      renameTab,
      addTab,
      closeTab,
      removeDraftTab,
      saveDraftNow,
    }),
    [routeTabId, tabs, drafts, patchDraft, renameTab, addTab, closeTab, removeDraftTab, saveDraftNow],
  );

  return <PurchaseComposerContext.Provider value={value}>{children}</PurchaseComposerContext.Provider>;
}

export function usePurchaseComposer(): PurchaseComposerContextValue {
  const ctx = useContext(PurchaseComposerContext);
  if (!ctx) throw new Error('usePurchaseComposer must be used inside PurchaseComposerProvider');
  return ctx;
}

export function useOptionalPurchaseComposer(): PurchaseComposerContextValue | null {
  return useContext(PurchaseComposerContext);
}
