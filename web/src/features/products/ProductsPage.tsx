import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ChevronRight,
  Grid3x3,
  Layers,
  ImagePlus,
  LayoutGrid,
  List,
  Loader2,
  Package,
  PieChart,
  Search,
  Warehouse,
} from 'lucide-react';
import axios from 'axios';
import type { AuthUserSummary } from '../../entities/auth-types';
import type {
  ProductBrandDto,
  ProductBrowseResult,
  ProductCategoryDto,
  ProductDto,
  ProductInventorySummaryDto,
  ProductUnitDto,
} from '../../entities/billing';
import { useAppSelector } from '../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../../features/auth/authSlice';
import { apiJsonAuth, authApi } from '../../shared/api/axiosClient';
import { productImageUrl } from '../../shared/config';
import { CatalogTaxonomyModal, type TaxonomySection } from './CatalogTaxonomyModal';

const PAGE_SIZE = 24;
const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
/** Cap simultaneous selections for quick-add / card uploads (each file is one API call). */
const MAX_PRODUCT_IMAGES_PER_BATCH = 12;

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'relevance', label: 'Relevance (with search)' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'name_asc', label: 'Name A–Z' },
  { value: 'name_desc', label: 'Name Z–A' },
  { value: 'stock_asc', label: 'Stock: low to high' },
  { value: 'stock_desc', label: 'Stock: high to low' },
] as const;

type CatNode = ProductCategoryDto & { children: CatNode[] };

function buildCategoryTree(flat: ProductCategoryDto[]): CatNode[] {
  const active = flat.filter((c) => c.isActive);
  const map = new Map<number, CatNode>();
  for (const c of active) {
    map.set(c.categoryId, { ...c, children: [] });
  }
  const roots: CatNode[] = [];
  for (const c of active) {
    const node = map.get(c.categoryId)!;
    if (c.parentCategoryId == null) {
      roots.push(node);
      continue;
    }
    const parent = map.get(c.parentCategoryId);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  function sortTree(nodes: CatNode[]) {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    for (const n of nodes) sortTree(n.children);
  }
  sortTree(roots);
  return roots;
}

function fmtInr(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);
}

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

function stockBadge(p: ProductDto) {
  const qty = p.stockQty ?? 0;
  const low = p.lowStockThreshold;
  const unitHint = p.unitName ? ` ${p.unitName}` : '';
  if (qty <= 0)
    return <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-300">Out of stock</span>;
  if (low != null && qty <= low)
    return (
      <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200">Low stock</span>
    );
  return (
    <span className="text-[11px] text-slate-500">
      {qty}
      {unitHint || ' units'}
    </span>
  );
}

const CATALOG_VIEW_STORAGE_KEY = 'billing.productsCatalogView';

export type CatalogViewMode = 'cards' | 'compact' | 'list';

function readStoredCatalogView(): CatalogViewMode {
  try {
    const raw = localStorage.getItem(CATALOG_VIEW_STORAGE_KEY);
    if (raw === 'cards' || raw === 'compact' || raw === 'list') return raw;
  } catch {
    /* ignore */
  }
  return 'cards';
}

function CatalogViewToggle({
  value,
  onChange,
}: {
  value: CatalogViewMode;
  onChange: (v: CatalogViewMode) => void;
}) {
  const modes: { id: CatalogViewMode; label: string; Icon: typeof LayoutGrid }[] = [
    { id: 'cards', label: 'Cards', Icon: LayoutGrid },
    { id: 'compact', label: 'Compact', Icon: Grid3x3 },
    { id: 'list', label: 'List', Icon: List },
  ];
  return (
    <div className="flex shrink-0 rounded-xl border border-slate-700 bg-[#1f2937] p-1" role="group" aria-label="Catalog layout">
      {modes.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          title={label}
          className={`flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition sm:px-2.5 ${
            value === id ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          <span className="hidden min-[420px]:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

type ProductCatalogTileProps = {
  p: ProductDto;
  view: CatalogViewMode;
  tab: 'catalog' | 'reports';
  canManageProducts: boolean;
  uploadingProductId: number | null;
  uploadMutPending: boolean;
  onPickPhotos: (productId: number, files: File[]) => void;
  onUploadError: (msg: string) => void;
};

function ProductCatalogTile({
  p,
  view,
  tab,
  canManageProducts,
  uploadingProductId,
  uploadMutPending,
  onPickPhotos,
  onUploadError,
}: ProductCatalogTileProps) {
  const imgUrl = productImageUrl(p.primaryImageRelativePath);
  const uploading = uploadMutPending && uploadingProductId === p.productId;

  function handleFiles(files: File[]) {
    if (files.length === 0) return;
    const capped = files.slice(0, MAX_PRODUCT_IMAGES_PER_BATCH);
    for (const file of capped) {
      const err = validateImageFile(file);
      if (err) {
        onUploadError(err);
        return;
      }
    }
    onPickPhotos(p.productId, capped);
  }

  const uploadControl =
    canManageProducts && tab === 'catalog' ? (
      <label
        className={`inline-flex cursor-pointer items-center gap-2 font-semibold text-violet-300 hover:text-violet-200 ${
          view === 'list' ? 'text-[11px]' : 'mt-3 text-[11px]'
        }`}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="sr-only"
          disabled={uploading}
          onChange={(ev) => {
            handleFiles(Array.from(ev.target.files ?? []));
            ev.target.value = '';
          }}
        />
        {uploading ? (
          <span className="flex items-center gap-1 text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Uploading…
          </span>
        ) : (
          <span>{view === 'list' ? 'Add photos' : 'Add photos (multiple)'}</span>
        )}
      </label>
    ) : null;

  if (view === 'list') {
    return (
      <div className="flex flex-col gap-3 px-4 py-3 transition hover:bg-white/[0.03] sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 gap-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-800/80 sm:h-[72px] sm:w-[72px]">
            {imgUrl ? (
              <img src={imgUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-600">
                <Package className="h-8 w-8 opacity-40" aria-hidden />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-400/90">
              {p.categoryName ?? 'Uncategorized'}
            </p>
            <h3 className="mt-0.5 text-sm font-bold leading-snug text-white">{p.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              {p.brand && <span>{p.brand}</span>}
              {p.brand && <span aria-hidden>·</span>}
              <span className="font-mono text-[10px] text-slate-600">
                SKU {p.sku ?? '—'} · #{p.productId}
                {p.hsnCode ? ` · HSN ${p.hsnCode}` : ''}
              </span>
              {!p.isActive && (
                <span className="rounded bg-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-300">Inactive</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:min-w-[200px] sm:items-end sm:text-right">
          <p className="text-base font-bold tabular-nums text-emerald-300">{fmtInr(p.unitPrice)}</p>
          {p.unitName && <p className="text-[10px] text-slate-500">Per {p.unitName.toLowerCase()}</p>}
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">{stockBadge(p)}</div>
          {uploadControl}
        </div>
      </div>
    );
  }

  const compact = view === 'compact';
  return (
    <article
      className={
        compact
          ? 'flex flex-col rounded-xl border border-white/10 bg-slate-900/60 p-3 shadow-inner shadow-black/20'
          : 'flex flex-col rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-inner shadow-black/20'
      }
    >
      <div
        className={`relative w-full overflow-hidden rounded-xl bg-slate-800/80 ${compact ? 'aspect-square' : 'aspect-[4/3]'}`}
      >
        {imgUrl ? (
          <img src={imgUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-600">
            <Package className={compact ? 'h-10 w-10 opacity-40' : 'h-12 w-12 opacity-40'} aria-hidden />
          </div>
        )}
      </div>
      <div className={`flex items-start justify-between gap-2 ${compact ? 'mt-2' : 'mt-3'}`}>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-400/90">
            {p.categoryName ?? 'Uncategorized'}
          </p>
          <h3
            className={`mt-1 font-bold leading-snug text-white ${compact ? 'line-clamp-2 text-xs' : 'line-clamp-2 text-sm'}`}
          >
            {p.name}
          </h3>
          {p.brand && (
            <p className={`mt-0.5 text-slate-500 ${compact ? 'text-[10px]' : 'text-xs'}`}>{p.brand}</p>
          )}
        </div>
        {!p.isActive && (
          <span className="shrink-0 rounded bg-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
            Inactive
          </span>
        )}
      </div>
      <p className={`mt-2 font-bold tabular-nums text-emerald-300 ${compact ? 'text-sm' : 'text-lg'}`}>
        {fmtInr(p.unitPrice)}
      </p>
      {p.unitName && (
        <p className={`text-slate-500 ${compact ? 'text-[10px]' : 'mt-0.5 text-[11px]'}`}>
          Per {p.unitName.toLowerCase()}
        </p>
      )}
      <div className={`flex flex-wrap items-center gap-2 ${compact ? 'mt-1.5' : 'mt-2'}`}>{stockBadge(p)}</div>
      {uploadControl}
      <p className={`font-mono text-slate-600 ${compact ? 'mt-2 text-[9px]' : 'mt-3 text-[10px]'}`}>
        SKU {p.sku ?? '—'} · #{p.productId}
        {p.hsnCode ? ` · HSN ${p.hsnCode}` : ''}
        {p.isService ? ' · Service' : ''}
      </p>
    </article>
  );
}

export function ProductsPage() {
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const workplaceOrgId = workplace?.organizationId ?? 0;
  const qc = useQueryClient();

  const [tab, setTab] = useState<'catalog' | 'reports'>('catalog');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [brandFilterId, setBrandFilterId] = useState<number | null>(null);
  const [unitFilterId, setUnitFilterId] = useState<number | null>(null);
  const [sort, setSort] = useState<string>('newest');
  const [page, setPage] = useState(0);
  const [catalogView, setCatalogViewState] = useState<CatalogViewMode>(() => readStoredCatalogView());

  const [taxonomyOpen, setTaxonomyOpen] = useState(false);
  const [taxonomyInitialSection, setTaxonomyInitialSection] = useState<TaxonomySection>('category');

  const [qaName, setQaName] = useState('');
  const [qaSku, setQaSku] = useState('');
  const [qaBrandId, setQaBrandId] = useState<number | ''>('');
  const [qaUnitId, setQaUnitId] = useState<number | ''>('');
  const [qaCategoryId, setQaCategoryId] = useState<number | ''>('');
  const [qaPrice, setQaPrice] = useState('');
  const [qaStock, setQaStock] = useState('');
  const [qaLow, setQaLow] = useState('');
  const [qaHsn, setQaHsn] = useState('');
  const [qaDesc, setQaDesc] = useState('');
  const [qaMrp, setQaMrp] = useState('');
  const [qaPurchasePrice, setQaPurchasePrice] = useState('');
  const [qaWholesalePrice, setQaWholesalePrice] = useState('');
  const [qaMinWholesaleQty, setQaMinWholesaleQty] = useState('');
  const [qaTax, setQaTax] = useState('');
  const [qaLocation, setQaLocation] = useState('');
  const [qaIsService, setQaIsService] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);
  const [qaPhotoWarning, setQaPhotoWarning] = useState<string | null>(null);
  const [qaPhotoFiles, setQaPhotoFiles] = useState<File[]>([]);
  const qaPhotoRef = useRef<HTMLInputElement>(null);
  const [qaSubTab, setQaSubTab] = useState<'details' | 'pricing' | 'stock'>('details');

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, categoryId, brandFilterId, unitFilterId, sort, tab]);

  const categoriesQ = useQuery({
    queryKey: ['product-categories', workplaceOrgId],
    enabled: authed && workplace != null,
    queryFn: async () => {
      const { data } = await authApi.get<ProductCategoryDto[]>('/v1/product-categories');
      return data;
    },
    retry: 1,
  });

  const brandsQ = useQuery({
    queryKey: ['product-brands', workplaceOrgId],
    enabled: authed && workplace != null,
    queryFn: async () => {
      const { data } = await authApi.get<ProductBrandDto[]>('/v1/product-brands');
      return data;
    },
    retry: 1,
  });

  const unitsQ = useQuery({
    queryKey: ['product-units', workplaceOrgId],
    enabled: authed && workplace != null,
    queryFn: async () => {
      const { data } = await authApi.get<ProductUnitDto[]>('/v1/product-units');
      return data;
    },
    retry: 1,
  });

  const tree = useMemo(() => buildCategoryTree(categoriesQ.data ?? []), [categoriesQ.data]);

  const browseKey =
    tab === 'catalog'
      ? ['products-browse', workplaceOrgId, debouncedSearch, categoryId, brandFilterId, unitFilterId, sort, page]
      : ['products-browse-alerts', workplaceOrgId, brandFilterId, unitFilterId, page];

  const browseQ = useQuery({
    queryKey: browseKey,
    enabled: authed && workplace != null,
    queryFn: async () => {
      const params = new URLSearchParams({
        activeOnly: tab === 'catalog' ? 'true' : 'false',
        sort: tab === 'catalog' ? sort : 'stock_asc',
        skip: String(page * PAGE_SIZE),
        take: String(PAGE_SIZE),
      });
      if (tab === 'catalog' && debouncedSearch) params.set('q', debouncedSearch);
      if (tab === 'catalog' && categoryId != null) params.set('categoryId', String(categoryId));
      if (brandFilterId != null) params.set('brandId', String(brandFilterId));
      if (unitFilterId != null) params.set('unitId', String(unitFilterId));
      if (tab === 'reports') params.set('alertsOnly', 'true');
      const { data } = await authApi.get<ProductBrowseResult>(`/v1/products/browse?${params.toString()}`);
      return data;
    },
    retry: 1,
  });

  const summaryQ = useQuery({
    queryKey: ['products-inventory-summary', workplaceOrgId],
    enabled: authed && workplace != null && tab === 'reports',
    queryFn: async () => {
      const { data } = await authApi.get<ProductInventorySummaryDto>('/v1/products/inventory/summary');
      return data;
    },
    retry: 1,
  });

  const authMeQ = useQuery({
    queryKey: ['auth-me-header'],
    enabled: authed,
    queryFn: () => apiJsonAuth<AuthUserSummary>('/v1/auth/me'),
    staleTime: 60_000,
    retry: 1,
  });
  const canManageProducts = authMeQ.data?.permissions?.includes('products.manage') ?? false;

  function setCatalogView(mode: CatalogViewMode) {
    setCatalogViewState(mode);
    try {
      localStorage.setItem(CATALOG_VIEW_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }

  const createMut = useMutation({
    mutationFn: async (vars: { body: Record<string, unknown>; imageFiles: File[] }) => {
      const { data } = await authApi.post<{ productId: number }>('/v1/products', vars.body);
      const productId = data?.productId;
      const failParts: string[] = [];
      if (productId != null && vars.imageFiles.length > 0) {
        for (let i = 0; i < vars.imageFiles.length; i++) {
          const file = vars.imageFiles[i]!;
          try {
            const fd = new FormData();
            fd.append('file', file);
            const qs = i === 0 ? '?primary=true' : '';
            await authApi.post(`/v1/products/${productId}/images${qs}`, fd);
          } catch (e) {
            const detail = axios.isAxiosError(e)
              ? String(e.response?.data ?? e.response?.status ?? e.message)
              : 'Upload failed.';
            failParts.push(`${file.name}: ${detail}`);
          }
        }
      }
      let photoWarning: string | null = null;
      if (failParts.length > 0) {
        photoWarning =
          failParts.length === vars.imageFiles.length
            ? `Product #${productId} was created, but no photos uploaded (${failParts.join('; ')}).`
            : `Product #${productId} was created; some photos failed (${failParts.join('; ')}).`;
      }
      return { photoWarning };
    },
    onSuccess: async (result) => {
      setQaError(null);
      setQaPhotoWarning(result.photoWarning);
      setQaName('');
      setQaSku('');
      setQaBrandId('');
      setQaUnitId('');
      setQaCategoryId('');
      setQaPrice('');
      setQaStock('');
      setQaLow('');
      setQaHsn('');
      setQaDesc('');
      setQaMrp('');
      setQaPurchasePrice('');
      setQaWholesalePrice('');
      setQaMinWholesaleQty('');
      setQaTax('');
      setQaLocation('');
      setQaIsService(false);
      setQaPhotoFiles([]);
      if (qaPhotoRef.current) qaPhotoRef.current.value = '';
      setQaSubTab('details');
      await qc.invalidateQueries({ queryKey: ['products-browse'] });
      await qc.invalidateQueries({ queryKey: ['products-inventory-summary'] });
      await qc.invalidateQueries({ queryKey: ['products-directory'] });
      await qc.invalidateQueries({ queryKey: ['products-pick'] });
    },
    onError: (e: unknown) => {
      const msg = axios.isAxiosError(e)
        ? e.response?.status === 403
          ? 'Need products.manage permission.'
          : String(e.response?.data ?? e.response?.status ?? e.message)
        : 'Could not create product.';
      setQaError(msg);
    },
  });

  const [uploadingProductId, setUploadingProductId] = useState<number | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const uploadImageMut = useMutation({
    mutationFn: async ({
      productId,
      files,
      hasExistingPrimary,
    }: {
      productId: number;
      files: File[];
      hasExistingPrimary: boolean;
    }) => {
      let firstPrimaryDone = hasExistingPrimary;
      const failed: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        try {
          const fd = new FormData();
          fd.append('file', file);
          const wantPrimary = !firstPrimaryDone && i === 0;
          const qs = wantPrimary ? '?primary=true' : '';
          await authApi.post(`/v1/products/${productId}/images${qs}`, fd);
          if (wantPrimary) firstPrimaryDone = true;
        } catch (e) {
          const detail = axios.isAxiosError(e)
            ? String(e.response?.data ?? e.response?.status ?? e.message)
            : 'Upload failed.';
          failed.push(`${file.name}: ${detail}`);
        }
      }
      if (failed.length === files.length) {
        throw new Error(failed.join('; '));
      }
      return { partialFailures: failed };
    },
    onMutate: ({ productId }) => {
      setUploadErr(null);
      setUploadingProductId(productId);
    },
    onSuccess: async (result) => {
      setUploadingProductId(null);
      if (result.partialFailures.length > 0) {
        setUploadErr(`Some images failed: ${result.partialFailures.join('; ')}`);
      }
      await qc.invalidateQueries({ queryKey: ['products-browse'] });
    },
    onError: (e: unknown) => {
      setUploadingProductId(null);
      if (e instanceof Error && !axios.isAxiosError(e)) {
        setUploadErr(e.message);
        return;
      }
      const msg = axios.isAxiosError(e)
        ? e.response?.status === 403
          ? 'Need products.manage permission.'
          : String(e.response?.data ?? e.response?.status ?? e.message)
        : 'Could not upload images.';
      setUploadErr(msg);
    },
  });

  function onQuickAdd(e: FormEvent) {
    e.preventDefault();
    setQaError(null);
    setQaPhotoWarning(null);
    const name = qaName.trim();
    if (!name) {
      setQaError('Name is required.');
      return;
    }
    const price = Number(qaPrice);
    if (!Number.isFinite(price) || price < 0) {
      setQaError('Unit price must be a non-negative number.');
      return;
    }
    const stock = qaStock.trim() === '' ? undefined : Number(qaStock);
    if (stock !== undefined && (!Number.isFinite(stock) || stock < 0)) {
      setQaError('Stock must be a non-negative number.');
      return;
    }
    const low = qaLow.trim() === '' ? undefined : Number(qaLow);
    if (low !== undefined && (!Number.isFinite(low) || low < 0)) {
      setQaError('Low-stock threshold must be a non-negative number.');
      return;
    }

    const parseOptDecimal = (raw: string, label: string): number | null | undefined => {
      const t = raw.trim();
      if (t === '') return null;
      const n = Number(t);
      if (!Number.isFinite(n) || n < 0) {
        setQaError(`${label} must be empty or a non-negative number.`);
        return undefined;
      }
      return n;
    };

    const mrp = parseOptDecimal(qaMrp, 'MRP');
    if (mrp === undefined) return;
    const purchasePrice = parseOptDecimal(qaPurchasePrice, 'Purchase price');
    if (purchasePrice === undefined) return;
    const wholesalePrice = parseOptDecimal(qaWholesalePrice, 'Wholesale price');
    if (wholesalePrice === undefined) return;
    const minWholesaleQty = parseOptDecimal(qaMinWholesaleQty, 'Min wholesale qty');
    if (minWholesaleQty === undefined) return;
    const taxPct = parseOptDecimal(qaTax, 'Tax %');
    if (taxPct === undefined) return;
    if (taxPct != null && taxPct > 100) {
      setQaError('Tax % cannot exceed 100.');
      return;
    }
    if (qaPhotoFiles.length > 0) {
      for (const f of qaPhotoFiles) {
        const err = validateImageFile(f);
        if (err) {
          setQaError(err);
          return;
        }
      }
    }
    createMut.mutate({
      body: {
        sku: qaSku.trim() || null,
        name,
        unitPrice: price,
        categoryId: qaCategoryId === '' ? null : qaCategoryId,
        brandId: qaBrandId === '' ? null : qaBrandId,
        unitId: qaUnitId === '' ? null : qaUnitId,
        stockQty: stock,
        lowStockThreshold: low,
        hsnCode: qaHsn.trim() || null,
        description: qaDesc.trim() || null,
        mrp,
        purchasePrice,
        wholesalePrice,
        minWholesaleQty,
        taxRatePercent: taxPct,
        storageLocation: qaLocation.trim() || null,
        isService: qaIsService,
      },
      imageFiles: qaPhotoFiles,
    });
  }

  const totalPages = browseQ.data ? Math.max(1, Math.ceil(browseQ.data.totalCount / PAGE_SIZE)) : 1;

  function CategoryBranch({ nodes, depth }: { nodes: CatNode[]; depth: number }) {
    return (
      <ul className={depth === 0 ? 'space-y-0.5' : 'ml-3 mt-0.5 space-y-0.5 border-l border-slate-700 pl-2'}>
        {nodes.map((n) => (
          <li key={n.categoryId}>
            <button
              type="button"
              onClick={() => setCategoryId(n.categoryId)}
              className={`flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-left text-xs transition ${
                categoryId === n.categoryId ? 'bg-violet-600/25 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              {n.children.length > 0 ? <ChevronRight className="h-3 w-3 shrink-0 opacity-60" /> : <span className="w-3" />}
              <span className="truncate">{n.name}</span>
            </button>
            {n.children.length > 0 && <CategoryBranch nodes={n.children} depth={depth + 1} />}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-violet-400/90">Masters · Inventory</p>
          <h2 className="mt-1 flex items-center gap-3 text-2xl font-bold text-white">
            <Package className="h-8 w-8 text-violet-400" aria-hidden />
            Product catalog & inventory
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Marketplace-style browsing: category tree, search across name/SKU/brand, sorting, and paginated results scoped to your
            organization. Reporting highlights low and out-of-stock SKUs.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Link to="/invoices/new" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">
            Use on invoice
          </Link>
          {canManageProducts && (
            <button
              type="button"
              onClick={() => {
                setTaxonomyInitialSection('category');
                setTaxonomyOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-violet-500/40 bg-violet-950/40 px-4 py-2.5 text-sm font-semibold text-violet-100 hover:bg-violet-900/50"
            >
              <Layers className="h-4 w-4" aria-hidden />
              Categories & brands
            </button>
          )}
        </div>
      </header>

      <div className="flex gap-2 rounded-2xl border border-slate-800 bg-slate-900/40 p-1">
        <button
          type="button"
          onClick={() => setTab('catalog')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            tab === 'catalog' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20' : 'text-slate-400 hover:text-white'
          }`}
        >
          <LayoutGrid className="h-4 w-4" />
          Catalog browse
        </button>
        <button
          type="button"
          onClick={() => setTab('reports')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            tab === 'reports' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20' : 'text-slate-400 hover:text-white'
          }`}
        >
          <PieChart className="h-4 w-4" />
          Inventory reporting
        </button>
      </div>

      {tab === 'catalog' && (
        <section className="workspace-panel overflow-hidden p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Warehouse className="h-4 w-4 text-violet-400" />
            Quick add SKU
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Requires <span className="font-mono text-slate-400">products.manage</span>. Pick category, brand, and unit — create missing taxonomy via{' '}
            <button type="button" className="text-violet-300 underline hover:text-violet-200" onClick={() => { setTaxonomyInitialSection('category'); setTaxonomyOpen(true); }}>
              Categories & brands
            </button>
            . Fields are grouped like Vyapar-style item tabs (details, pricing, stock).
          </p>
          <form className="mt-4 space-y-4" onSubmit={(ev) => void onQuickAdd(ev)}>
            <div className="flex flex-wrap gap-1 rounded-xl border border-slate-700 bg-[#1a1f2e] p-1">
              {(
                [
                  ['details', 'Details'],
                  ['pricing', 'Pricing & tax'],
                  ['stock', 'Stock & notes'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setQaSubTab(id)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                    qaSubTab === id ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {qaSubTab === 'details' && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <input
                  placeholder="Product name"
                  value={qaName}
                  onChange={(e) => setQaName(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-violet-500 sm:col-span-2"
                />
                <input
                  placeholder="SKU"
                  value={qaSku}
                  onChange={(e) => setQaSku(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                />
                <input
                  placeholder="HSN code"
                  value={qaHsn}
                  onChange={(e) => setQaHsn(e.target.value)}
                  maxLength={16}
                  className="rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                />
                <select
                  value={qaBrandId === '' ? '' : qaBrandId}
                  onChange={(e) => setQaBrandId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                >
                  <option value="">Brand (optional)</option>
                  {(brandsQ.data ?? [])
                    .filter((b) => b.isActive)
                    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
                    .map((b) => (
                      <option key={b.brandId} value={b.brandId}>
                        {b.name}
                      </option>
                    ))}
                </select>
                <select
                  value={qaCategoryId === '' ? '' : qaCategoryId}
                  onChange={(e) => setQaCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                >
                  <option value="">Category (optional)</option>
                  {(categoriesQ.data ?? [])
                    .filter((c) => c.isActive)
                    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
                    .map((c) => (
                      <option key={c.categoryId} value={c.categoryId}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <select
                  value={qaUnitId === '' ? '' : qaUnitId}
                  onChange={(e) => setQaUnitId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                >
                  <option value="">Unit (optional)</option>
                  {(unitsQ.data ?? [])
                    .filter((u) => u.isActive)
                    .sort((a, b) => a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName))
                    .map((u) => (
                      <option key={u.unitId} value={u.unitId}>
                        {u.displayName}
                      </option>
                    ))}
                </select>
                <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-slate-300 sm:col-span-2">
                  <input type="checkbox" checked={qaIsService} onChange={(e) => setQaIsService(e.target.checked)} className="rounded border-slate-600" />
                  Service (non-stock)
                </label>
              </div>
            )}

            {qaSubTab === 'pricing' && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <input
                  placeholder="Unit price (INR)"
                  inputMode="decimal"
                  value={qaPrice}
                  onChange={(e) => setQaPrice(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                />
                <input
                  placeholder="Purchase / cost price"
                  inputMode="decimal"
                  value={qaPurchasePrice}
                  onChange={(e) => setQaPurchasePrice(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                />
                <input
                  placeholder="MRP (INR)"
                  inputMode="decimal"
                  value={qaMrp}
                  onChange={(e) => setQaMrp(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                />
                <input
                  placeholder="Default tax % (GST)"
                  inputMode="decimal"
                  value={qaTax}
                  onChange={(e) => setQaTax(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                />
                <input
                  placeholder="Wholesale price"
                  inputMode="decimal"
                  value={qaWholesalePrice}
                  onChange={(e) => setQaWholesalePrice(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                />
                <input
                  placeholder="Min wholesale qty"
                  inputMode="decimal"
                  value={qaMinWholesaleQty}
                  onChange={(e) => setQaMinWholesaleQty(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                />
              </div>
            )}

            {qaSubTab === 'stock' && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <input
                  placeholder="Stock qty"
                  inputMode="numeric"
                  value={qaStock}
                  onChange={(e) => setQaStock(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                />
                <input
                  placeholder="Low-stock alert qty"
                  inputMode="numeric"
                  value={qaLow}
                  onChange={(e) => setQaLow(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                />
                <input
                  placeholder="Storage location"
                  value={qaLocation}
                  onChange={(e) => setQaLocation(e.target.value)}
                  className="sm:col-span-2 rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                />
                <textarea
                  placeholder="Description / notes"
                  value={qaDesc}
                  onChange={(e) => setQaDesc(e.target.value)}
                  rows={3}
                  className="sm:col-span-2 lg:col-span-4 rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                />
              </div>
            )}

            <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-4">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Product photos <span className="font-normal normal-case text-slate-600">(optional, multiple)</span>
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-600 bg-[#1f2937] px-3 py-2 text-sm text-violet-200 hover:border-violet-500/60 hover:bg-[#252f3f]">
                  <ImagePlus className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                  <span>Add images…</span>
                  <input
                    ref={qaPhotoRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    className="sr-only"
                    onChange={(ev) => {
                      const picked = Array.from(ev.target.files ?? []);
                      ev.target.value = '';
                      if (picked.length === 0) return;
                      setQaPhotoFiles((prev) =>
                        dedupeFiles([...prev, ...picked]).slice(0, MAX_PRODUCT_IMAGES_PER_BATCH),
                      );
                    }}
                  />
                </label>
                {qaPhotoFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setQaPhotoFiles([]);
                      if (qaPhotoRef.current) qaPhotoRef.current.value = '';
                    }}
                    className="text-xs font-semibold text-slate-500 underline hover:text-slate-300"
                  >
                    Clear all
                  </button>
                )}
              </div>
              {qaPhotoFiles.length > 0 && (
                <ul className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                  {qaPhotoFiles.map((f, idx) => (
                    <li
                      key={`${f.name}-${f.size}-${f.lastModified}-${idx}`}
                      className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/20 px-2 py-1"
                    >
                      <span className="max-w-[140px] truncate" title={f.name}>
                        {idx === 0 ? '★ ' : ''}
                        {f.name}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 text-rose-400 hover:text-rose-300"
                        aria-label={`Remove ${f.name}`}
                        onClick={() => setQaPhotoFiles((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[11px] text-slate-600">
                JPEG / PNG / WebP / GIF · max {MAX_PRODUCT_IMAGE_BYTES / (1024 * 1024)} MB each · up to {MAX_PRODUCT_IMAGES_PER_BATCH}{' '}
                files · first becomes primary listing photo
              </p>
            </div>
            <button
              type="submit"
              disabled={createMut.isPending}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {createMut.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Create product'}
            </button>
            {qaError && (
              <p role="alert" className="sm:col-span-2 lg:col-span-4 text-sm text-rose-300">
                {qaError}
              </p>
            )}
            {qaPhotoWarning && (
              <p role="status" className="sm:col-span-2 lg:col-span-4 text-sm text-amber-200">
                {qaPhotoWarning}
              </p>
            )}
          </form>
        </section>
      )}

      {tab === 'reports' && summaryQ.data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="workspace-panel p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total SKUs</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-white">{summaryQ.data.totalSkus}</p>
          </div>
          <div className="workspace-panel p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Active listings</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-300">{summaryQ.data.activeSkus}</p>
          </div>
          <div className="workspace-panel p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Out of stock</p>
            <p className="mt-1 flex items-center gap-2 text-2xl font-bold tabular-nums text-rose-300">
              <AlertTriangle className="h-5 w-5" />
              {summaryQ.data.outOfStockCount}
            </p>
          </div>
          <div className="workspace-panel p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Inventory value (retail)</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-white">{fmtInr(summaryQ.data.inventoryValueAtRetail)}</p>
            <p className="mt-1 text-xs text-slate-500">Σ unit price × stock (approximation)</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6 xl:flex-row">
        {tab === 'catalog' && (
          <aside className="w-full shrink-0 xl:w-64">
            <div className="workspace-panel p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Shop by category</p>
              <button
                type="button"
                onClick={() => setCategoryId(null)}
                className={`mt-3 w-full rounded-lg px-2 py-2 text-left text-xs font-semibold ${
                  categoryId === null ? 'bg-violet-600/30 text-white' : 'text-slate-400 hover:bg-white/5'
                }`}
              >
                All categories
              </button>
              {categoriesQ.isLoading && <p className="mt-4 text-xs text-slate-500">Loading tree…</p>}
              {categoriesQ.isError && <p className="mt-4 text-xs text-rose-400">Could not load categories.</p>}
              {tree.length > 0 && (
                <div className="mt-2 max-h-[420px] overflow-y-auto pr-1">
                  <CategoryBranch nodes={tree} depth={0} />
                </div>
              )}
            </div>
          </aside>
        )}

        <div className="min-w-0 flex-1 space-y-4">
          {tab === 'catalog' && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search products, SKU, brand, HSN…"
                  className="w-full rounded-xl border border-slate-700 bg-[#1f2937] py-2.5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-500"
                />
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {tab === 'reports' && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
              <strong className="font-semibold">Replenishment queue</strong> — SKUs that are out of stock or at/below their low-stock
              threshold (paginated below).
            </div>
          )}

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Brand
              <select
                value={brandFilterId ?? ''}
                onChange={(e) => setBrandFilterId(e.target.value === '' ? null : Number(e.target.value))}
                className="rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm font-normal normal-case text-white outline-none focus:border-violet-500"
              >
                <option value="">All brands</option>
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
            <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Unit
              <select
                value={unitFilterId ?? ''}
                onChange={(e) => setUnitFilterId(e.target.value === '' ? null : Number(e.target.value))}
                className="rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm font-normal normal-case text-white outline-none focus:border-violet-500"
              >
                <option value="">All units</option>
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
            {(brandFilterId != null || unitFilterId != null) && (
              <button
                type="button"
                onClick={() => {
                  setBrandFilterId(null);
                  setUnitFilterId(null);
                }}
                className="rounded-xl border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5"
              >
                Clear brand / unit
              </button>
            )}
            </div>
            <CatalogViewToggle value={catalogView} onChange={setCatalogView} />
          </div>

          <div className="workspace-panel overflow-hidden">
            {browseQ.isLoading && (
              <div className="flex items-center gap-3 px-6 py-20 text-slate-400">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-violet-400/30 border-t-violet-400" />
                Loading…
              </div>
            )}
            {browseQ.isError && (
              <div role="alert" className="border border-rose-500/20 bg-rose-500/10 px-6 py-12 text-sm text-rose-200">
                Could not load catalog — sign in and ensure you have invoice or product read access.
              </div>
            )}
            {browseQ.data && browseQ.data.items.length === 0 && (
              <p className="px-6 py-20 text-center text-sm text-slate-500">
                {tab === 'reports' ? 'No inventory alerts for this page.' : 'No products match these filters.'}
              </p>
            )}
            {browseQ.data && browseQ.data.items.length > 0 && (
              <>
                {uploadErr && (
                  <p role="alert" className="border-b border-rose-500/20 bg-rose-500/10 px-4 py-2 text-xs text-rose-200">
                    {uploadErr}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3 text-xs text-slate-500">
                  <span>
                    Showing <strong className="text-slate-300">{browseQ.data.items.length}</strong> of{' '}
                    <strong className="text-slate-300">{browseQ.data.totalCount}</strong>
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={page <= 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      className="rounded-lg border border-slate-600 px-3 py-1 text-slate-300 hover:bg-white/5 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                      className="rounded-lg border border-slate-600 px-3 py-1 text-slate-300 hover:bg-white/5 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
                <div
                  className={
                    catalogView === 'list'
                      ? 'divide-y divide-white/10'
                      : catalogView === 'compact'
                        ? 'grid gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                        : 'grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3'
                  }
                >
                  {browseQ.data.items.map((p) => (
                    <ProductCatalogTile
                      key={p.productId}
                      p={p}
                      view={catalogView}
                      tab={tab}
                      canManageProducts={canManageProducts}
                      uploadingProductId={uploadingProductId}
                      uploadMutPending={uploadImageMut.isPending}
                      onPickPhotos={(productId, files) => {
                        const row = browseQ.data!.items.find((i) => i.productId === productId);
                        uploadImageMut.mutate({
                          productId,
                          files,
                          hasExistingPrimary: Boolean(row?.primaryImageRelativePath),
                        });
                      }}
                      onUploadError={setUploadErr}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <CatalogTaxonomyModal
        open={taxonomyOpen}
        onClose={() => setTaxonomyOpen(false)}
        categories={categoriesQ.data ?? []}
        initialSection={taxonomyInitialSection}
        onCreated={async () => {
          await qc.invalidateQueries({ queryKey: ['product-categories'] });
          await qc.invalidateQueries({ queryKey: ['product-brands'] });
          await qc.invalidateQueries({ queryKey: ['product-units'] });
        }}
      />
    </div>
  );
}
