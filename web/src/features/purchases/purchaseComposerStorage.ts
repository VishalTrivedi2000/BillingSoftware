/** Browser snapshot for purchase composer (crash / refresh resilience). Version per org. */

export type StoredPurchaseLine = {
  key: string;
  productId: number | null;
  description: string;
  quantity: number;
  unitCost: number;
  discountPercent: number;
  discountAmount: number;
  taxRatePercent: number;
};

export type PurchaseComposerSnapshotV1 = {
  v: 1;
  updatedAt: string;
  /** Last known server draft id (resume opens tabbed composer with ?loadDraft=…). */
  draftPurchaseBillId: number | null;
  partyId: number | '';
  lines: StoredPurchaseLine[];
};

function storageKey(orgId: number): string {
  return `billing.purchaseComposer.v1.${orgId}`;
}

export function readPurchaseComposerSnapshot(orgId: number): PurchaseComposerSnapshotV1 | null {
  if (orgId <= 0) return null;
  try {
    const raw = localStorage.getItem(storageKey(orgId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PurchaseComposerSnapshotV1;
    if (parsed?.v !== 1 || !Array.isArray(parsed.lines)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePurchaseComposerSnapshot(orgId: number, snapshot: PurchaseComposerSnapshotV1): void {
  if (orgId <= 0) return;
  try {
    localStorage.setItem(storageKey(orgId), JSON.stringify(snapshot));
  } catch {
    /* quota / private mode */
  }
}

export function clearPurchaseComposerSnapshot(orgId: number): void {
  if (orgId <= 0) return;
  try {
    localStorage.removeItem(storageKey(orgId));
  } catch {
    /* ignore */
  }
}
