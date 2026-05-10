import { FormEvent, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { ImagePlus, Loader2, PackagePlus, X } from 'lucide-react';
import type {
  ProductBrandDto,
  ProductCategoryDto,
  ProductDto,
  ProductUnitDto,
} from '../../entities/billing';
import { useAppSelector } from '../../app/hooks';
import { selectWorkplaceSnapshot } from '../../features/auth/authSlice';
import { authApi } from '../../shared/api/axiosClient';

type QuickProductTab = 'details' | 'pricing' | 'stock' | 'photos';

const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PRODUCT_IMAGES_PER_BATCH = 12;
const OK_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function validateImageFile(file: File): string | null {
  if (!OK_IMAGE_TYPES.includes(file.type)) {
    return 'Each file must be JPEG, PNG, WebP, or GIF.';
  }
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
    return `Each file must be ${MAX_PRODUCT_IMAGE_BYTES / (1024 * 1024)} MB or smaller.`;
  }
  return null;
}

function dedupeFiles(files: File[]): File[] {
  const seen = new Set<string>();
  const out: File[] = [];
  for (const f of files) {
    const k = `${f.name}:${f.size}:${f.lastModified}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out;
}

export type QuickProductModalProps = {
  open: boolean;
  onClose: () => void;
  /** When set, parent can apply the new SKU to this purchase line. */
  lineKey: string | null;
  onCreated: (product: ProductDto, lineKey: string | null) => void;
};

export function QuickProductModal({ open, onClose, lineKey, onCreated }: QuickProductModalProps) {
  const qc = useQueryClient();
  const workplaceOrgId = useAppSelector(selectWorkplaceSnapshot)?.organizationId ?? 0;

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  /** Free-text brand when not using a master brand row (matches API `brand`). */
  const [brandText, setBrandText] = useState('');
  const [brandId, setBrandId] = useState<number | ''>('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [unitId, setUnitId] = useState<number | ''>('');
  const [unitPrice, setUnitPrice] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [mrp, setMrp] = useState('');
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [minWholesaleQty, setMinWholesaleQty] = useState('');
  const [taxRatePercent, setTaxRatePercent] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [description, setDescription] = useState('');
  const [storageLocation, setStorageLocation] = useState('');
  const [stockQty, setStockQty] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [isService, setIsService] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalTab, setModalTab] = useState<QuickProductTab>('details');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setModalTab('details');
    setPhotoFiles([]);
    if (photoInputRef.current) photoInputRef.current.value = '';
  }, [open]);

  const brandsQ = useQuery({
    queryKey: ['product-brands-pick', workplaceOrgId],
    queryFn: async () => {
      const { data } = await authApi.get<ProductBrandDto[]>('/v1/product-brands?max=400');
      return data;
    },
    enabled: open && workplaceOrgId > 0,
    retry: 1,
  });

  const categoriesQ = useQuery({
    queryKey: ['product-categories-pick', workplaceOrgId],
    queryFn: async () => {
      const { data } = await authApi.get<ProductCategoryDto[]>('/v1/product-categories?max=400');
      return data;
    },
    enabled: open && workplaceOrgId > 0,
    retry: 1,
  });

  const unitsQ = useQuery({
    queryKey: ['product-units-pick', workplaceOrgId],
    queryFn: async () => {
      const { data } = await authApi.get<ProductUnitDto[]>('/v1/product-units?max=400');
      return data;
    },
    enabled: open && workplaceOrgId > 0,
    retry: 1,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const nm = name.trim();
      if (!nm) throw new Error('Item name is required.');
      const sale = Number(unitPrice);
      if (!Number.isFinite(sale) || sale < 0) throw new Error('Sale unit price must be a non-negative number.');

      if (photoFiles.length > 0) {
        for (const f of photoFiles) {
          const verr = validateImageFile(f);
          if (verr) throw new Error(verr);
        }
      }

      const brandPayload =
        brandId === '' ? (brandText.trim() === '' ? null : brandText.trim()) : null;

      const body: Record<string, unknown> = {
        sku: sku.trim() || null,
        name: nm,
        brand: brandPayload,
        unitPrice: sale,
        categoryId: categoryId === '' ? null : categoryId,
        brandId: brandId === '' ? null : brandId,
        unitId: unitId === '' ? null : unitId,
        stockQty: stockQty.trim() === '' ? 0 : Number(stockQty),
        lowStockThreshold: lowStockThreshold.trim() === '' ? null : Number(lowStockThreshold),
        hsnCode: hsnCode.trim() || null,
        description: description.trim() || null,
        mrp: mrp.trim() === '' ? null : Number(mrp),
        purchasePrice: purchasePrice.trim() === '' ? null : Number(purchasePrice),
        wholesalePrice: wholesalePrice.trim() === '' ? null : Number(wholesalePrice),
        minWholesaleQty: minWholesaleQty.trim() === '' ? null : Number(minWholesaleQty),
        taxRatePercent: taxRatePercent.trim() === '' ? null : Number(taxRatePercent),
        storageLocation: storageLocation.trim() || null,
        isService,
      };

      try {
        const { data } = await authApi.post<{ productId: number }>('/v1/products', body);
        const id = data?.productId;
        if (id == null) throw new Error('No product id returned.');

        const failParts: string[] = [];
        if (photoFiles.length > 0) {
          for (let i = 0; i < photoFiles.length; i++) {
            const file = photoFiles[i]!;
            try {
              const fd = new FormData();
              fd.append('file', file);
              const qs = i === 0 ? '?primary=true' : '';
              await authApi.post(`/v1/products/${id}/images${qs}`, fd);
            } catch (e) {
              const detail = axios.isAxiosError(e)
                ? String(e.response?.data ?? e.response?.status ?? e.message)
                : 'Upload failed.';
              failParts.push(`${file.name}: ${detail}`);
            }
          }
        }

        if (failParts.length === photoFiles.length && photoFiles.length > 0) {
          throw new Error(`Product #${id} was saved, but no photos uploaded (${failParts.join('; ')}).`);
        }

        const { data: detail } = await authApi.get<ProductDto>(`/v1/products/${id}`);
        if (failParts.length > 0) {
          console.warn('Catalog images partial failure:', failParts.join('; '));
        }
        return detail;
      } catch (e) {
        if (axios.isAxiosError(e)) {
          const d = e.response?.data;
          const msg =
            typeof d === 'string'
              ? d
              : d && typeof d === 'object' && 'title' in d
                ? String((d as { title?: string }).title)
                : '';
          throw new Error(msg.replace(/^\s+|\s+$/g, '').slice(0, 240) || `Request failed (${e.response?.status}).`);
        }
        throw e;
      }
    },
    onSuccess: async (product) => {
      await qc.invalidateQueries({ queryKey: ['products-pick'] });
      await qc.invalidateQueries({ queryKey: ['products-browse'] });
      await qc.invalidateQueries({ queryKey: ['products-directory'] });
      onCreated(product, lineKey);
      setName('');
      setSku('');
      setBrandText('');
      setBrandId('');
      setCategoryId('');
      setUnitId('');
      setUnitPrice('');
      setPurchasePrice('');
      setMrp('');
      setWholesalePrice('');
      setMinWholesaleQty('');
      setTaxRatePercent('');
      setHsnCode('');
      setDescription('');
      setStorageLocation('');
      setStockQty('');
      setLowStockThreshold('');
      setIsService(false);
      setPhotoFiles([]);
      if (photoInputRef.current) photoInputRef.current.value = '';
      setError(null);
      onClose();
    },
    onError: (e: unknown) => {
      setError(e instanceof Error ? e.message : 'Could not create product.');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    createMut.mutate();
  }

  if (!open) return null;

  const field =
    'mt-1 w-full rounded-lg border border-white/15 bg-[#1a1f2e] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25';

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center px-3 py-6 sm:items-center" role="dialog" aria-modal aria-labelledby="quick-product-title">
      <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      <div className="relative z-10 max-h-[min(92vh,720px)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/12 bg-[#0f141f] shadow-2xl shadow-black/50">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-white/10 bg-[#0f141f]/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
              <PackagePlus className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 id="quick-product-title" className="text-lg font-bold text-white">
                New catalog item
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                BS-native quick create — saves to your org catalog (needs <span className="font-mono text-slate-400">products.manage</span>). Purchase
                line picks default unit cost from purchase price when set.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-white/10 hover:text-white" aria-label="Close dialog">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(ev) => void onSubmit(ev)} className="space-y-5 px-5 py-5">
          <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
            {(
              [
                ['details', 'Details'],
                ['pricing', 'Pricing & tax'],
                ['stock', 'Stock & notes'],
                ['photos', 'Photos'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setModalTab(id)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                  modalTab === id ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {modalTab === 'details' && (
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={isService} onChange={(e) => setIsService(e.target.checked)} className="rounded border-white/20 bg-[#1a1f2e]" />
                Service item (no stock moves from purchases)
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="text-xs font-medium text-slate-400">Item name *</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="e.g. Coconut hair oil 200 ml" />
                </label>
                <label>
                  <span className="text-xs font-medium text-slate-400">SKU / item code</span>
                  <input value={sku} onChange={(e) => setSku(e.target.value)} className={field} placeholder="Optional" />
                </label>
                <label>
                  <span className="text-xs font-medium text-slate-400">HSN</span>
                  <input value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} className={field} placeholder="e.g. 3305" maxLength={16} />
                </label>
                <label>
                  <span className="text-xs font-medium text-slate-400">Category</span>
                  <select
                    value={categoryId === '' ? '' : String(categoryId)}
                    onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
                    className={field}
                    disabled={categoriesQ.isLoading}
                  >
                    <option value="">Optional</option>
                    {(categoriesQ.data ?? [])
                      .filter((c) => c.isActive)
                      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
                      .map((c) => (
                        <option key={c.categoryId} value={c.categoryId}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  <span className="text-xs font-medium text-slate-400">Brand</span>
                  <select
                    value={brandId === '' ? '' : String(brandId)}
                    onChange={(e) => {
                      const v = e.target.value === '' ? '' : Number(e.target.value);
                      setBrandId(v);
                      if (v !== '') setBrandText('');
                    }}
                    className={field}
                    disabled={brandsQ.isLoading}
                  >
                    <option value="">Optional</option>
                    {(brandsQ.data ?? [])
                      .filter((b) => b.isActive)
                      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
                      .map((b) => (
                        <option key={b.brandId} value={b.brandId}>
                          {b.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="sm:col-span-2">
                  <span className="text-xs font-medium text-slate-400">Brand label (free text)</span>
                  <input
                    value={brandText}
                    onChange={(e) => setBrandText(e.target.value)}
                    disabled={brandId !== ''}
                    className={`${field} disabled:cursor-not-allowed disabled:opacity-50`}
                    placeholder={brandId === '' ? 'e.g. Local maker — when not using master brand above' : 'Cleared — master brand is selected'}
                  />
                  <p className="mt-1 text-[11px] text-slate-600">
                    Matches inventory column “Brand” when you do not pick a master brand row.
                  </p>
                </label>
                <label className="sm:col-span-2">
                  <span className="text-xs font-medium text-slate-400">Unit</span>
                  <select
                    value={unitId === '' ? '' : String(unitId)}
                    onChange={(e) => setUnitId(e.target.value === '' ? '' : Number(e.target.value))}
                    className={field}
                    disabled={unitsQ.isLoading}
                  >
                    <option value="">Optional</option>
                    {(unitsQ.data ?? [])
                      .filter((u) => u.isActive)
                      .sort((a, b) => a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName))
                      .map((u) => (
                        <option key={u.unitId} value={u.unitId}>
                          {u.displayName}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
            </div>
          )}

          {modalTab === 'pricing' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="text-xs font-medium text-slate-400">Sale unit price (INR) *</span>
                <input inputMode="decimal" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className={`${field} tabular-nums`} />
              </label>
              <label>
                <span className="text-xs font-medium text-slate-400">Purchase price (default cost)</span>
                <input inputMode="decimal" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} className={`${field} tabular-nums`} />
              </label>
              <label>
                <span className="text-xs font-medium text-slate-400">MRP</span>
                <input inputMode="decimal" value={mrp} onChange={(e) => setMrp(e.target.value)} className={`${field} tabular-nums`} />
              </label>
              <label>
                <span className="text-xs font-medium text-slate-400">Default tax % (GST)</span>
                <input inputMode="decimal" value={taxRatePercent} onChange={(e) => setTaxRatePercent(e.target.value)} className={`${field} tabular-nums`} placeholder="e.g. 18" />
              </label>
              <label>
                <span className="text-xs font-medium text-slate-400">Wholesale price</span>
                <input inputMode="decimal" value={wholesalePrice} onChange={(e) => setWholesalePrice(e.target.value)} className={`${field} tabular-nums`} />
              </label>
              <label>
                <span className="text-xs font-medium text-slate-400">Min wholesale qty</span>
                <input inputMode="decimal" value={minWholesaleQty} onChange={(e) => setMinWholesaleQty(e.target.value)} className={`${field} tabular-nums`} />
              </label>
            </div>
          )}

          {modalTab === 'stock' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="text-xs font-medium text-slate-400">Opening stock qty</span>
                <input inputMode="numeric" value={stockQty} onChange={(e) => setStockQty(e.target.value)} className={`${field} tabular-nums`} placeholder="0" />
              </label>
              <label>
                <span className="text-xs font-medium text-slate-400">Low-stock alert qty</span>
                <input inputMode="numeric" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} className={`${field} tabular-nums`} />
              </label>
              <label className="sm:col-span-2">
                <span className="text-xs font-medium text-slate-400">Storage location</span>
                <input value={storageLocation} onChange={(e) => setStorageLocation(e.target.value)} className={field} placeholder="e.g. Warehouse A — rack 3" />
              </label>
              <label className="sm:col-span-2">
                <span className="text-xs font-medium text-slate-400">Description</span>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={field} placeholder="Notes for staff / listings" />
              </label>
            </div>
          )}

          {modalTab === 'photos' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Optional listing photos — uploaded after the SKU is created (same as catalog). First image becomes primary.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/20 bg-[#1a1f2e] px-3 py-2 text-sm text-emerald-200 hover:border-emerald-500/50">
                  <ImagePlus className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                  <span>Add images…</span>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    className="sr-only"
                    onChange={(ev) => {
                      const picked = Array.from(ev.target.files ?? []);
                      ev.target.value = '';
                      if (picked.length === 0) return;
                      setPhotoFiles((prev) =>
                        dedupeFiles([...prev, ...picked]).slice(0, MAX_PRODUCT_IMAGES_PER_BATCH),
                      );
                    }}
                  />
                </label>
                {photoFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoFiles([]);
                      if (photoInputRef.current) photoInputRef.current.value = '';
                    }}
                    className="text-xs font-semibold text-slate-500 underline hover:text-slate-300"
                  >
                    Clear all
                  </button>
                )}
              </div>
              {photoFiles.length > 0 && (
                <ul className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                  {photoFiles.map((f, idx) => (
                    <li
                      key={`${f.name}-${f.size}-${f.lastModified}-${idx}`}
                      className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/25 px-2 py-1"
                    >
                      <span className="max-w-[160px] truncate" title={f.name}>
                        {idx === 0 ? '★ ' : ''}
                        {f.name}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 text-rose-400 hover:text-rose-300"
                        aria-label={`Remove ${f.name}`}
                        onClick={() => setPhotoFiles((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[11px] text-slate-600">
                JPEG / PNG / WebP / GIF · max {MAX_PRODUCT_IMAGE_BYTES / (1024 * 1024)} MB each · up to {MAX_PRODUCT_IMAGES_PER_BATCH} files
              </p>
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-3 border-t border-white/10 pt-4">
            <button type="button" onClick={onClose} className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMut.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {createMut.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                'Save to catalog'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Prefer catalog purchase price for inward costing; fall back to sale unit price. */
export function defaultPurchaseUnitCost(p: ProductDto): number {
  const pp = p.purchasePrice;
  if (pp != null && Number.isFinite(pp) && pp >= 0) return pp;
  return p.unitPrice;
}
