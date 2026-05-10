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
import type { InvoiceComposerDraft, InvoiceComposerTab } from './invoiceComposerTypes';
import { defaultComposerDraft } from './invoiceComposerDefaults';

export const COMPOSER_STORAGE_KEY = 'billing.invoiceComposer.v1';

type PersistedShape = {
  tabs: InvoiceComposerTab[];
  drafts: Record<string, InvoiceComposerDraft>;
};

function isDraftLine(v: unknown): v is InvoiceComposerDraft['lines'][0] {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof (v as { key?: unknown }).key === 'string' &&
    typeof (v as { description?: unknown }).description === 'string'
  );
}

function reviveDraft(raw: unknown): InvoiceComposerDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const customerRaw = o.customerId;
  const customerId: number | '' =
    customerRaw === '' || customerRaw == null
      ? ''
      : typeof customerRaw === 'number' && Number.isFinite(customerRaw)
        ? customerRaw
        : '';
  const linesRaw = o.lines;
  if (!Array.isArray(linesRaw) || linesRaw.length === 0) return null;
  const lines = linesRaw.filter(isDraftLine).map((l) => ({
    key: l.key,
    productId: typeof l.productId === 'number' && Number.isFinite(l.productId) ? l.productId : null,
    description: l.description,
    quantity: typeof l.quantity === 'number' && Number.isFinite(l.quantity) ? l.quantity : 1,
    unitPrice: typeof l.unitPrice === 'number' && Number.isFinite(l.unitPrice) ? l.unitPrice : 0,
  }));
  if (lines.length === 0) return null;
  return { customerId, lines };
}

function loadPersisted(): PersistedShape | null {
  try {
    const raw = localStorage.getItem(COMPOSER_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== 'object') return null;
    const tabsRaw = (p as { tabs?: unknown }).tabs;
    const draftsRaw = (p as { drafts?: unknown }).drafts;
    if (!Array.isArray(tabsRaw) || typeof draftsRaw !== 'object' || draftsRaw === null) return null;
    const tabs: InvoiceComposerTab[] = tabsRaw
      .filter((t): t is InvoiceComposerTab => !!t && typeof t === 'object' && typeof (t as { id?: unknown }).id === 'string')
      .map((t) => ({
        id: (t as InvoiceComposerTab).id,
        title: typeof (t as InvoiceComposerTab).title === 'string' ? (t as InvoiceComposerTab).title : 'Invoice',
      }));
    const drafts: Record<string, InvoiceComposerDraft> = {};
    for (const [k, v] of Object.entries(draftsRaw)) {
      const d = reviveDraft(v);
      if (d) drafts[k] = d;
    }
    return { tabs, drafts };
  } catch {
    return null;
  }
}

function persistState(tabs: InvoiceComposerTab[], drafts: Record<string, InvoiceComposerDraft>): void {
  try {
    localStorage.setItem(COMPOSER_STORAGE_KEY, JSON.stringify({ tabs, drafts }));
  } catch {
    /* quota */
  }
}

type ComposerContextValue = {
  routeTabId: string | undefined;
  tabs: InvoiceComposerTab[];
  drafts: Record<string, InvoiceComposerDraft>;
  patchDraft: (tabId: string, updater: (d: InvoiceComposerDraft) => InvoiceComposerDraft) => void;
  renameTab: (tabId: string, title: string) => void;
  addTab: () => void;
  closeTab: (tabId: string) => void;
  saveDraftNow: () => string;
};

const InvoiceComposerContext = createContext<ComposerContextValue | null>(null);

export function InvoiceComposerProvider({
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

  const [tabs, setTabs] = useState<InvoiceComposerTab[]>(() =>
    persisted?.tabs?.length ? persisted.tabs : [],
  );
  const [drafts, setDrafts] = useState<Record<string, InvoiceComposerDraft>>(
    () => persisted?.drafts ?? {},
  );

  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedulePersist = useCallback((nextTabs: InvoiceComposerTab[], nextDrafts: Record<string, InvoiceComposerDraft>) => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      persistTimer.current = null;
      persistState(nextTabs, nextDrafts);
    }, 450);
  }, []);

  const flushPersist = useCallback((nextTabs: InvoiceComposerTab[], nextDrafts: Record<string, InvoiceComposerDraft>) => {
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
      return [...prev, { id: routeTabId, title: 'New invoice' }];
    });
    setDrafts((prev) => {
      if (prev[routeTabId]) return prev;
      return { ...prev, [routeTabId]: defaultComposerDraft() };
    });
  }, [routeTabId]);

  useEffect(() => {
    schedulePersist(tabs, drafts);
  }, [tabs, drafts, schedulePersist]);

  const patchDraft = useCallback((tabId: string, updater: (d: InvoiceComposerDraft) => InvoiceComposerDraft) => {
    setDrafts((prev) => {
      const base = prev[tabId] ?? defaultComposerDraft();
      return { ...prev, [tabId]: updater(base) };
    });
  }, []);

  const renameTab = useCallback((tabId: string, title: string) => {
    const trimmed = title.trim() || 'New invoice';
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === tabId);
      if (idx < 0) return prev;
      if (prev[idx]!.title === trimmed) return prev;
      return prev.map((t) => (t.id === tabId ? { ...t, title: trimmed } : t));
    });
  }, []);

  const addTab = useCallback(() => {
    const id = crypto.randomUUID();
    const nextDrafts = { ...drafts, [id]: defaultComposerDraft() };
    const nextTabs = [...tabs, { id, title: 'New invoice' }];
    setTabs(nextTabs);
    setDrafts(nextDrafts);
    flushPersist(nextTabs, nextDrafts);
    navigate(`/invoices/new/${id}`);
  }, [drafts, flushPersist, navigate, tabs]);

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
        navigate(`/invoices/new/${fallback.id}`);
      } else {
        navigate('/invoices');
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

  const value = useMemo<ComposerContextValue>(
    () => ({
      routeTabId,
      tabs,
      drafts,
      patchDraft,
      renameTab,
      addTab,
      closeTab,
      saveDraftNow,
    }),
    [routeTabId, tabs, drafts, patchDraft, renameTab, addTab, closeTab, saveDraftNow],
  );

  return <InvoiceComposerContext.Provider value={value}>{children}</InvoiceComposerContext.Provider>;
}

export function useInvoiceComposer(): ComposerContextValue {
  const ctx = useContext(InvoiceComposerContext);
  if (!ctx) throw new Error('useInvoiceComposer must be used inside InvoiceComposerProvider');
  return ctx;
}
