import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_PURCHASE_PRINT_OPTIONS, type PurchasePrintOptions, type PurchasePrintPrefsState } from './purchasePrintTypes';
import { DEFAULT_PURCHASE_PRINT_TEMPLATE_ID, getPurchasePrintTemplate } from './purchasePrintTemplates';

function storageKey(orgId: number): string {
  return `billing.purchasePrintPrefs.v1.${orgId}`;
}

function cloneOptions(o: PurchasePrintOptions): PurchasePrintOptions {
  return { ...o };
}

export function loadPurchasePrintPrefs(orgId: number): PurchasePrintPrefsState {
  if (orgId <= 0) {
    return {
      templateId: DEFAULT_PURCHASE_PRINT_TEMPLATE_ID,
      options: cloneOptions(DEFAULT_PURCHASE_PRINT_OPTIONS),
    };
  }
  try {
    const raw = localStorage.getItem(storageKey(orgId));
    if (!raw) throw new Error('empty');
    const parsed = JSON.parse(raw) as Partial<PurchasePrintPrefsState>;
    const templateId = String(parsed.templateId ?? DEFAULT_PURCHASE_PRINT_TEMPLATE_ID);
    getPurchasePrintTemplate(templateId);
    const mergedOptions = {
      ...DEFAULT_PURCHASE_PRINT_OPTIONS,
      ...(parsed.options && typeof parsed.options === 'object' ? parsed.options : {}),
    } as PurchasePrintOptions;
    return { templateId, options: cloneOptions(mergedOptions) };
  } catch {
    return {
      templateId: DEFAULT_PURCHASE_PRINT_TEMPLATE_ID,
      options: cloneOptions(DEFAULT_PURCHASE_PRINT_OPTIONS),
    };
  }
}

export function savePurchasePrintPrefs(orgId: number, state: PurchasePrintPrefsState): void {
  if (orgId <= 0) return;
  try {
    localStorage.setItem(storageKey(orgId), JSON.stringify(state));
  } catch {
    /* quota */
  }
}

export function usePurchasePrintPrefs(orgId: number): {
  prefs: PurchasePrintPrefsState;
  setTemplateId: (id: string) => void;
  setOptions: (next: PurchasePrintOptions | ((prev: PurchasePrintOptions) => PurchasePrintOptions)) => void;
  patchOptions: (patch: Partial<PurchasePrintOptions>) => void;
  resetDefaults: () => void;
} {
  const [prefs, setPrefs] = useState<PurchasePrintPrefsState>(() => loadPurchasePrintPrefs(orgId));

  useEffect(() => {
    setPrefs(loadPurchasePrintPrefs(orgId));
  }, [orgId]);

  const setTemplateId = useCallback((id: string) => {
    getPurchasePrintTemplate(id);
    setPrefs((p) => {
      const next = { ...p, templateId: id };
      savePurchasePrintPrefs(orgId, next);
      return next;
    });
  }, [orgId]);

  const setOptions = useCallback(
    (next: PurchasePrintOptions | ((prev: PurchasePrintOptions) => PurchasePrintOptions)) => {
      setPrefs((p) => {
        const resolved = typeof next === 'function' ? next(p.options) : next;
        const out = { ...p, options: cloneOptions(resolved) };
        savePurchasePrintPrefs(orgId, out);
        return out;
      });
    },
    [orgId],
  );

  const patchOptions = useCallback((patch: Partial<PurchasePrintOptions>) => {
    setPrefs((p) => {
      const out = { ...p, options: cloneOptions({ ...p.options, ...patch }) };
      savePurchasePrintPrefs(orgId, out);
      return out;
    });
  }, [orgId]);

  const resetDefaults = useCallback(() => {
    setPrefs(() => {
      const out: PurchasePrintPrefsState = {
        templateId: DEFAULT_PURCHASE_PRINT_TEMPLATE_ID,
        options: cloneOptions(DEFAULT_PURCHASE_PRINT_OPTIONS),
      };
      savePurchasePrintPrefs(orgId, out);
      return out;
    });
  }, [orgId]);

  return useMemo(
    () => ({ prefs, setTemplateId, setOptions, patchOptions, resetDefaults }),
    [prefs, setTemplateId, setOptions, patchOptions, resetDefaults],
  );
}
