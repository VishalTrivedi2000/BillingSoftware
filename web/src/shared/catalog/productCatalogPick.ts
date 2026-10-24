import type { ProductDto } from '../../entities/billing';
import type { ProductVariantDto } from '../../entities/inventory';
import type { InvoiceDraftLine } from '../../features/invoices/invoiceComposerTypes';
import type { DraftLine } from '../../features/purchases/purchaseComposerTypes';

export const CATALOG_PICK_LIMIT = 50;

export type CatalogPickSuggestion = {
  key: string;
  product: ProductDto;
  /** Resolved variant; null means resolve default on apply. */
  variant: ProductVariantDto | null;
  title: string;
  detail: string;
  isMainProduct: boolean;
};

export function normalizeProductSearch(q: string): string {
  return q.trim().toLowerCase();
}

export function productMatches(p: ProductDto, q: string): boolean {
  if (!q) return true;
  const n = p.name.toLowerCase();
  const sku = (p.sku ?? '').toLowerCase();
  const hsn = (p.hsnCode ?? '').toLowerCase();
  const brand = (p.brand ?? '').toLowerCase();
  const cat = (p.categoryName ?? '').toLowerCase();
  return n.includes(q) || sku.includes(q) || hsn.includes(q) || brand.includes(q) || cat.includes(q);
}

export function sortedCatalog(products: ProductDto[]): ProductDto[] {
  return [...products].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export function variantDisplayLabel(v: ProductVariantDto): string {
  if (v.attributes?.length) {
    return v.attributes.map((a) => a.value).join(' / ');
  }
  return v.displayName ?? v.sku ?? 'Default';
}

function productDetailParts(p: ProductDto, v: ProductVariantDto | null): string[] {
  const parts: string[] = [];
  const sku = v?.sku ?? p.sku;
  if (sku) parts.push(sku);
  if (p.brand) parts.push(p.brand);
  return parts;
}

export function formatCatalogPickDetail(
  p: ProductDto,
  v: ProductVariantDto | null,
  opts: { price?: number | null; priceLabel?: string },
): string {
  const parts = productDetailParts(p, v);
  if (opts.price != null && Number.isFinite(opts.price)) {
    parts.push(`${opts.priceLabel ?? 'Price'} ${opts.price}`);
  }
  if (v?.isDefault) parts.push('Default');
  return parts.join(' · ') || 'Catalog item';
}

/** Build merged product + variant suggestions for sale/purchase line pickers. */
export function buildCatalogPickSuggestions(
  products: ProductDto[],
  variantRows: ProductVariantDto[],
  query: string,
  limit = CATALOG_PICK_LIMIT,
): CatalogPickSuggestion[] {
  const q = normalizeProductSearch(query);
  const sorted = sortedCatalog(products);
  const productsById = new Map(sorted.map((p) => [p.productId, p]));

  if (!q) {
    return sorted.slice(0, limit).map((p) => ({
      key: `p-${p.productId}`,
      product: p,
      variant: null,
      title: p.name,
      detail: formatCatalogPickDetail(p, null, { price: p.unitPrice, priceLabel: 'Sale' }),
      isMainProduct: true,
    }));
  }

  const matchedProducts = sorted.filter((p) => productMatches(p, q));
  const variantByProduct = new Map<number, ProductVariantDto[]>();
  for (const v of variantRows) {
    const list = variantByProduct.get(v.productId) ?? [];
    list.push(v);
    variantByProduct.set(v.productId, list);
  }

  const out: CatalogPickSuggestion[] = [];
  const addedProductMain = new Set<number>();

  for (const v of variantRows) {
    const p = productsById.get(v.productId);
    if (!p) continue;
    const siblings = variantByProduct.get(v.productId) ?? [];
    const multi = siblings.length > 1;
    out.push({
      key: `v-${v.productVariantId}`,
      product: p,
      variant: v,
      title: multi ? `${p.name} · ${variantDisplayLabel(v)}` : p.name,
      detail: formatCatalogPickDetail(p, v, {
        price: v.salePrice ?? p.unitPrice,
        priceLabel: 'Sale',
      }),
      isMainProduct: !multi,
    });
  }

  for (const p of matchedProducts) {
    const pvs = variantByProduct.get(p.productId) ?? [];
    if (pvs.length === 0) {
      if (!out.some((s) => s.product.productId === p.productId && s.isMainProduct)) {
        out.push({
          key: `p-${p.productId}`,
          product: p,
          variant: null,
          title: p.name,
          detail: formatCatalogPickDetail(p, null, { price: p.unitPrice, priceLabel: 'Sale' }),
          isMainProduct: true,
        });
      }
      continue;
    }
    if (pvs.length > 1 && !addedProductMain.has(p.productId)) {
      const def = pvs.find((x) => x.isDefault) ?? pvs[0]!;
      addedProductMain.add(p.productId);
      out.push({
        key: `p-${p.productId}-main`,
        product: p,
        variant: def,
        title: p.name,
        detail: formatCatalogPickDetail(p, def, {
          price: def.salePrice ?? p.unitPrice,
          priceLabel: 'Sale',
        }),
        isMainProduct: true,
      });
    }
  }

  const seen = new Set<string>();
  const deduped: CatalogPickSuggestion[] = [];
  for (const s of out) {
    if (seen.has(s.key)) continue;
    seen.add(s.key);
    deduped.push(s);
  }

  deduped.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
  return deduped.slice(0, limit);
}

const fmtInr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

function purchasePickDetail(p: ProductDto, v: ProductVariantDto | null): string {
  const parts = productDetailParts(p, v);
  const cost = v?.purchasePrice ?? p.purchasePrice;
  if (cost != null && Number.isFinite(cost)) parts.push(`Cost ${fmtInr.format(cost)}`);
  if (p.unitPrice != null && Number.isFinite(p.unitPrice)) parts.push(`Sale ${fmtInr.format(p.unitPrice)}`);
  if (p.stockQty != null) parts.push(`Stock ${p.stockQty}`);
  if (v?.isDefault) parts.push('Default');
  return parts.join(' · ') || 'Catalog item';
}

export function buildCatalogPickSuggestionsForPurchase(
  products: ProductDto[],
  variantRows: ProductVariantDto[],
  query: string,
  limit = CATALOG_PICK_LIMIT,
): CatalogPickSuggestion[] {
  const sale = buildCatalogPickSuggestions(products, variantRows, query, limit);
  return sale.map((s) => ({
    ...s,
    detail: purchasePickDetail(s.product, s.variant),
  }));
}

export function saleLinePatchFromPick(
  pick: CatalogPickSuggestion,
  resolvedVariant: ProductVariantDto | null,
): Partial<InvoiceDraftLine> {
  const p = pick.product;
  const v = resolvedVariant ?? pick.variant;
  return {
    productId: p.productId,
    productVariantId: v?.productVariantId ?? null,
    description: p.name,
    unitPrice: v?.salePrice ?? p.unitPrice,
    taxRatePercent: p.taxRatePercent ?? 0,
    selectedSerials: [],
    quantity: 1,
  };
}

export function purchaseLinePatchFromPick(
  pick: CatalogPickSuggestion,
  resolvedVariant: ProductVariantDto | null,
  defaultUnitCost: (p: ProductDto) => number,
): Partial<DraftLine> {
  const p = pick.product;
  const v = resolvedVariant ?? pick.variant;
  const unitCost =
    v?.purchasePrice != null && Number.isFinite(v.purchasePrice)
      ? v.purchasePrice
      : defaultUnitCost(p);
  return {
    productId: p.productId,
    productVariantId: v?.productVariantId ?? null,
    description: p.name,
    unitCost,
    taxRatePercent: p.taxRatePercent != null && Number.isFinite(p.taxRatePercent) ? p.taxRatePercent : 0,
  };
}
