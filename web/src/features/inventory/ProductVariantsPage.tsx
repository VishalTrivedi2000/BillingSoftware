import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  Barcode,
  ChevronLeft,
  ChevronRight,
  Download,
  Layers,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { inventoryApi } from './inventoryApi';
import { fmtInr, fmtQty } from './inventoryHelpers';
import type {
  CreateProductVariantBody,
  InventoryTrackingMode,
  ProductVariantAttributeDto,
  ProductVariantDto,
} from '../../entities/inventory';
import { InventoryTrackingModes } from '../../entities/inventory';
import { authApi } from '../../shared/api/axiosClient';
import { useAppSelector } from '../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../auth/authSlice';
import type { ProductDto } from '../../entities/billing';
import { KpiTile } from '../../shared/ui/charts';
import { ConfirmDialog, Modal } from '../../shared/ui/Modal';

const PAGE_SIZE = 25;

const TRACKING_MODE_OPTIONS: { value: InventoryTrackingMode; label: string }[] = [
  { value: InventoryTrackingModes.None, label: 'None (services)' },
  { value: InventoryTrackingModes.Quantity, label: 'Quantity only' },
  { value: InventoryTrackingModes.Batch, label: 'Batch / Lot' },
  { value: InventoryTrackingModes.Serial, label: 'Serial number' },
  { value: InventoryTrackingModes.BatchAndSerial, label: 'Batch + Serial' },
];

type AttrRow = { key: string; value: string };

type FormState = {
  productId: number | null;
  sku: string;
  barcode: string;
  displayName: string;
  mrp: string;
  salePrice: string;
  purchasePrice: string;
  inventoryTrackingMode: InventoryTrackingMode;
  attributes: AttrRow[];
};

const EMPTY_FORM: FormState = {
  productId: null,
  sku: '',
  barcode: '',
  displayName: '',
  mrp: '',
  salePrice: '',
  purchasePrice: '',
  inventoryTrackingMode: InventoryTrackingModes.Quantity,
  attributes: [{ key: '', value: '' }],
};

function parseDecimal(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : null;
}

function attrsToBody(rows: AttrRow[]): ProductVariantAttributeDto[] {
  return rows
    .map((r) => ({ key: r.key.trim(), value: r.value.trim() }))
    .filter((r) => r.key && r.value);
}

function extractAxiosError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const d = e.response?.data;
    if (typeof d === 'string' && d.trim()) return d;
    return e.message || 'Request failed.';
  }
  return e instanceof Error ? e.message : 'Request failed.';
}

/* ----- Attribute templates ----- */
type AttrTemplate = {
  key: string;
  label: string;
  icon: string;
  presets: string[];
};

const ATTRIBUTE_TEMPLATES: AttrTemplate[] = [
  { key: 'Color', label: 'Color', icon: '◐', presets: ['Black', 'White', 'Blue', 'Red', 'Silver', 'Gold', 'Green', 'Space Gray'] },
  { key: 'Storage', label: 'Storage', icon: '⚙', presets: ['128GB', '256GB', '512GB', '1TB'] },
  { key: 'RAM', label: 'RAM', icon: '◎', presets: ['6GB', '8GB', '12GB', '16GB'] },
  { key: 'Size', label: 'Size', icon: '▭', presets: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
  { key: 'Pack Size', label: 'Pack Size', icon: '◫', presets: ['1kg', '5kg', '10kg', '25kg'] },
  { key: 'Material', label: 'Material', icon: '✚', presets: ['Cotton', 'Polyester', 'Blend'] },
];

type GenerationRule = 'all' | 'selected' | 'smart';

export function ProductVariantsPage() {
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const orgId = workplace?.organizationId ?? 0;
  const queryReady = authed && workplace != null;
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState<number | undefined>();
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductVariantDto | null>(null);

  /* Generation state */
  const [genProductId, setGenProductId] = useState<number | null>(null);
  const [genAttributes, setGenAttributes] = useState<Record<string, string[]>>({});
  const [genRule, setGenRule] = useState<GenerationRule>('all');
  const [genBusy, setGenBusy] = useState(false);
  const [genMsg, setGenMsg] = useState<string | null>(null);

  const productsQ = useQuery({
    queryKey: ['products-for-variants', orgId],
    queryFn: async () => {
      const { data } = await authApi.get<ProductDto[]>('/v1/products?activeOnly=true&max=500');
      return data;
    },
    enabled: queryReady,
    retry: 1,
  });

  const variantsQ = useQuery({
    queryKey: ['variants-browse', orgId, search, productFilter, page],
    queryFn: () =>
      inventoryApi.variants.browse({
        search: search.trim() || undefined,
        productId: productFilter,
        skip: page * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    enabled: queryReady,
    retry: 1,
  });

  const lowStockQ = useQuery({
    queryKey: ['variants-low-stock-count', orgId],
    queryFn: () => inventoryApi.reports.lowStock(),
    enabled: queryReady,
    retry: 0,
  });

  const dashboardQ = useQuery({
    queryKey: ['variants-dashboard', orgId],
    queryFn: () => inventoryApi.inventory.dashboard(),
    enabled: queryReady,
    retry: 0,
  });

  const rows = variantsQ.data?.items ?? [];
  const totalCount = variantsQ.data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const createM = useMutation({
    mutationFn: (body: CreateProductVariantBody) => inventoryApi.variants.create(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['variants-browse'] });
      setCreating(false);
      setForm(EMPTY_FORM);
      setFormError(null);
    },
    onError: (e) => setFormError(extractAxiosError(e)),
  });

  const removeM = useMutation({
    mutationFn: (id: number) => inventoryApi.variants.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['variants-browse'] });
      setDeleteTarget(null);
    },
  });

  useEffect(() => {
    if (creating && form.productId == null && productsQ.data && productsQ.data.length > 0) {
      setForm((s) => ({ ...s, productId: productsQ.data![0].productId }));
    }
  }, [creating, form.productId, productsQ.data]);

  function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (form.productId == null) {
      setFormError('Pick a product.');
      return;
    }
    const body: CreateProductVariantBody = {
      productId: form.productId,
      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      displayName: form.displayName.trim() || null,
      mrp: parseDecimal(form.mrp),
      salePrice: parseDecimal(form.salePrice),
      purchasePrice: parseDecimal(form.purchasePrice),
      inventoryTrackingMode: form.inventoryTrackingMode,
      attributes: attrsToBody(form.attributes),
    };
    createM.mutate(body);
  }

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }
  function updateAttr(idx: number, key: 'key' | 'value', value: string) {
    setForm((s) => {
      const next = s.attributes.slice();
      next[idx] = { ...next[idx], [key]: value };
      return { ...s, attributes: next };
    });
  }
  function addAttrRow() {
    setForm((s) => ({ ...s, attributes: [...s.attributes, { key: '', value: '' }] }));
  }
  function removeAttrRow(idx: number) {
    setForm((s) => ({ ...s, attributes: s.attributes.filter((_, i) => i !== idx) }));
  }

  function toggleGenAttr(attrKey: string, value: string) {
    setGenAttributes((prev) => {
      const cur = prev[attrKey] ?? [];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      return { ...prev, [attrKey]: next };
    });
  }

  function combinations(input: Record<string, string[]>): Record<string, string>[] {
    const entries = Object.entries(input).filter(([, vals]) => vals.length > 0);
    if (entries.length === 0) return [];
    const result: Record<string, string>[] = [];
    function go(i: number, acc: Record<string, string>) {
      if (i === entries.length) {
        result.push({ ...acc });
        return;
      }
      const [k, vals] = entries[i];
      for (const v of vals) {
        acc[k] = v;
        go(i + 1, acc);
      }
    }
    go(0, {});
    return result;
  }

  async function executeGeneration() {
    setGenMsg(null);
    if (genProductId == null) {
      setGenMsg('Pick a product to generate variants for.');
      return;
    }
    let combos = combinations(genAttributes);
    if (genRule === 'selected') combos = combos.slice(0, Math.min(combos.length, 8));
    if (genRule === 'smart') combos = combos.filter((_, i) => i % 2 === 0);
    if (combos.length === 0) {
      setGenMsg('Pick at least one attribute value.');
      return;
    }
    setGenBusy(true);
    let success = 0;
    let failed = 0;
    for (const combo of combos) {
      try {
        await inventoryApi.variants.create({
          productId: genProductId,
          inventoryTrackingMode: InventoryTrackingModes.Quantity,
          attributes: Object.entries(combo).map(([key, value]) => ({ key, value })),
        });
        success++;
      } catch {
        failed++;
      }
    }
    setGenBusy(false);
    setGenMsg(`Created ${success} variant${success === 1 ? '' : 's'}${failed ? `, ${failed} failed` : ''}.`);
    void qc.invalidateQueries({ queryKey: ['variants-browse'] });
  }

  const productOptions = useMemo(
    () => (productsQ.data ?? []).map((p) => ({ id: p.productId, name: p.name, sku: p.sku })),
    [productsQ.data],
  );

  const serializedCount = useMemo(
    () => dashboardQ.data?.activeSerialsCount ?? 0,
    [dashboardQ.data],
  );

  function exportCsv() {
    const headers = ['Product', 'SKU', 'Barcode', 'Variant', 'Tracking', 'MRP', 'Sale price', 'Cost'];
    const lines = [headers.join(',')];
    for (const v of rows) {
      const attrs = v.attributes.map((a) => `${a.key}:${a.value}`).join('; ');
      lines.push(
        [
          JSON.stringify(v.productName),
          v.sku ?? '',
          v.barcode ?? '',
          JSON.stringify(attrs),
          v.inventoryTrackingMode ?? '',
          v.mrp ?? '',
          v.salePrice ?? '',
          v.purchasePrice ?? '',
        ].join(','),
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `variants-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-12">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-400/90">Inventory · masters</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white lg:text-3xl">Variants</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Manage product variants and variant combinations with stock, pricing, and attributes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setGenerating(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500"
          >
            <Sparkles className="h-4 w-4" aria-hidden /> Generate variants
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
          >
            <Download className="h-4 w-4" /> Export
          </button>
          <button
            type="button"
            onClick={() => {
              setForm(EMPTY_FORM);
              setFormError(null);
              setCreating(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
          >
            <Plus className="h-4 w-4" aria-hidden /> New variant
          </button>
        </div>
      </header>

      <section aria-label="Variant KPIs" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          title="Variant groups"
          value={productsQ.data?.length.toLocaleString() ?? '—'}
          hint="Parent products with variants"
          icon={Layers}
          tone="blue"
        />
        <KpiTile
          title="Active variants"
          value={dashboardQ.data?.totalVariants.toLocaleString() ?? '—'}
          hint={`${((totalCount ? (totalCount / Math.max(1, totalCount)) * 100 : 100)).toFixed(0)}% of total`}
          icon={Layers}
          tone="emerald"
        />
        <KpiTile
          title="Low stock variants"
          value={(lowStockQ.data?.length ?? 0).toLocaleString()}
          hint="Need replenishment"
          icon={Layers}
          tone="amber"
        />
        <KpiTile
          title="Serialized variants"
          value={serializedCount.toLocaleString()}
          hint="Tracked per unit"
          icon={Barcode}
          tone="violet"
        />
      </section>

      <section className="workspace-panel border border-white/10 p-4">
        <div className="grid gap-3 lg:grid-cols-5">
          <label className="block text-xs font-semibold text-slate-300">
            Product
            <select
              value={productFilter ?? ''}
              onChange={(e) => {
                setPage(0);
                setProductFilter(e.target.value ? Number(e.target.value) : undefined);
              }}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            >
              <option value="">All products</option>
              {productOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-300">
            Category
            <select className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none">
              <option>All categories</option>
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-300">
            Status
            <select className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none">
              <option>All statuses</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-300">
            Warehouse
            <select className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none">
              <option>All warehouses</option>
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-300">
            Search
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setPage(0);
                  setSearch(e.target.value);
                }}
                placeholder="Search variants, SKU or barcode…"
                className="w-full rounded-lg border border-white/10 bg-slate-900/80 py-2 pl-9 pr-3 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </div>
          </label>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
        <aside className="space-y-4">
          <div className="workspace-panel border border-white/10 p-4">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
              Variant attributes
            </h3>
            <p className="mb-3 text-[11px] text-slate-500">
              Define the attributes used across your products.
            </p>
            <ul className="space-y-2">
              {ATTRIBUTE_TEMPLATES.map((tpl) => (
                <li
                  key={tpl.key}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
                >
                  <p className="flex items-center justify-between text-xs font-semibold text-slate-200">
                    <span className="inline-flex items-center gap-2">
                      <span className="text-base">{tpl.icon}</span> {tpl.label}
                    </span>
                    <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-300">
                      {tpl.presets.length}
                    </span>
                  </p>
                  <p className="mt-1 truncate text-[11px] text-slate-500">{tpl.presets.join(', ')}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="workspace-panel border border-white/10 p-4">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
              Generation rules
            </h3>
            <p className="mb-3 text-[11px] text-slate-500">
              Choose how variants should be generated.
            </p>
            <fieldset className="space-y-2">
              <Radio
                checked={genRule === 'all'}
                onClick={() => setGenRule('all')}
                title="All Combinations (Full Matrix)"
                hint="Generate all possible combinations of selected attributes."
              />
              <Radio
                checked={genRule === 'selected'}
                onClick={() => setGenRule('selected')}
                title="Selected Combinations"
                hint="Generate only selected combinations."
              />
              <Radio
                checked={genRule === 'smart'}
                onClick={() => setGenRule('smart')}
                title="Smart Combinations"
                hint="Generate only valid or in-demand combinations."
              />
            </fieldset>
            <button
              type="button"
              onClick={() => setGenerating(true)}
              className="mt-3 w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500"
            >
              Open generator
            </button>
          </div>
        </aside>

        <section className="workspace-panel border border-white/10">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3 text-xs text-slate-400">
            <span>
              Variant matrix <span className="font-semibold text-slate-100">({totalCount.toLocaleString()} variants)</span>
            </span>
            <span>
              Showing {page * PAGE_SIZE + 1}–{Math.min(totalCount, (page + 1) * PAGE_SIZE)} of {totalCount.toLocaleString()}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-left">Variant combination</th>
                  <th className="px-4 py-3 text-left">SKU</th>
                  <th className="px-4 py-3 text-left">Barcode</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {variantsQ.isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" aria-hidden />
                      Loading variants…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                      No variants found.
                    </td>
                  </tr>
                ) : (
                  rows.map((v) => (
                    <VariantRow
                      key={v.productVariantId}
                      v={v}
                      onDelete={() => setDeleteTarget(v)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          <footer className="flex items-center justify-between gap-3 border-t border-white/5 px-4 py-3 text-xs text-slate-400">
            <span>{totalCount.toLocaleString()} total variants</span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-semibold text-slate-200 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Prev
              </button>
              <button
                type="button"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-semibold text-slate-200 disabled:opacity-40"
              >
                Next <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </footer>
        </section>
      </div>

      <Modal
        open={creating}
        onClose={() => {
          setCreating(false);
          setForm(EMPTY_FORM);
          setFormError(null);
        }}
        size="lg"
        title="New variant"
        subtitle="Permission required: variants.manage"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setForm(EMPTY_FORM);
                setFormError(null);
              }}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="variant-form"
              disabled={createM.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {createM.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create variant
            </button>
          </>
        }
      >
        <form id="variant-form" onSubmit={submit} className="space-y-3">
          <label className="block text-xs font-semibold text-slate-300">
            Product *
            <select
              value={form.productId ?? ''}
              onChange={(e) => setField('productId', e.target.value ? Number(e.target.value) : null)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              required
            >
              <option value="">— select product —</option>
              {productOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.sku ? ` (${p.sku})` : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-300">
              SKU
              <input
                type="text"
                value={form.sku}
                onChange={(e) => setField('sku', e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-300">
              Barcode
              <input
                type="text"
                value={form.barcode}
                onChange={(e) => setField('barcode', e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-300 sm:col-span-2">
              Display name (optional)
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => setField('displayName', e.target.value)}
                placeholder="e.g. iPhone 15 · 256GB · Blue"
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-300">
              MRP
              <input
                type="number"
                step="0.01"
                value={form.mrp}
                onChange={(e) => setField('mrp', e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-300">
              Sale price
              <input
                type="number"
                step="0.01"
                value={form.salePrice}
                onChange={(e) => setField('salePrice', e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-300">
              Purchase price
              <input
                type="number"
                step="0.01"
                value={form.purchasePrice}
                onChange={(e) => setField('purchasePrice', e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-300">
              Inventory tracking
              <select
                value={form.inventoryTrackingMode}
                onChange={(e) =>
                  setField('inventoryTrackingMode', e.target.value as InventoryTrackingMode)
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              >
                {TRACKING_MODE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold text-slate-300">Attributes</p>
            <p className="mb-2 text-[11px] text-slate-500">
              Key-value pairs (Size · Large, Color · Blue, RAM · 16 GB).
            </p>
            <div className="space-y-2">
              {form.attributes.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={a.key}
                    onChange={(e) => updateAttr(i, 'key', e.target.value)}
                    placeholder="Key"
                    className="flex-1 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs text-white focus:border-blue-400 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={a.value}
                    onChange={(e) => updateAttr(i, 'value', e.target.value)}
                    placeholder="Value"
                    className="flex-1 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs text-white focus:border-blue-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeAttrRow(i)}
                    disabled={form.attributes.length === 1}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10 disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addAttrRow}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-white/10"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden /> Add attribute
              </button>
            </div>
          </div>

          {formError && (
            <div
              className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100"
              role="alert"
            >
              {formError}
            </div>
          )}
        </form>
      </Modal>

      <Modal
        open={generating}
        onClose={() => {
          setGenerating(false);
          setGenMsg(null);
        }}
        size="xl"
        title="Generate variants"
        subtitle="Pick a parent product and toggle attribute values to materialize a variant matrix."
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setGenerating(false);
                setGenMsg(null);
              }}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10"
            >
              Close
            </button>
            <button
              type="button"
              onClick={executeGeneration}
              disabled={genBusy || genProductId == null}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {genBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              <Sparkles className="h-4 w-4" /> Generate
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-300">
            Product *
            <select
              value={genProductId ?? ''}
              onChange={(e) => setGenProductId(e.target.value ? Number(e.target.value) : null)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            >
              <option value="">— select product —</option>
              {productOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <p className="text-xs font-semibold text-slate-300">Attribute values</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {ATTRIBUTE_TEMPLATES.map((tpl) => (
              <div key={tpl.key} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <p className="mb-1 text-xs font-semibold text-slate-200">
                  <span className="mr-1">{tpl.icon}</span> {tpl.label}
                </p>
                <div className="flex flex-wrap gap-1">
                  {tpl.presets.map((v) => {
                    const on = (genAttributes[tpl.key] ?? []).includes(v);
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => toggleGenAttr(tpl.key, v)}
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                          on
                            ? 'border-blue-400/60 bg-blue-500/20 text-blue-100'
                            : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3 text-xs text-slate-400">
            Rule:{' '}
            <span className="font-semibold text-slate-100">
              {genRule === 'all'
                ? 'All combinations (full matrix)'
                : genRule === 'selected'
                  ? 'Selected combinations (first 8)'
                  : 'Smart (every other combination)'}
            </span>{' '}
            · {Object.values(genAttributes).reduce((s, vals) => s + vals.length, 0)} values selected.
          </div>

          {genMsg && (
            <p
              className={`text-xs ${genMsg.startsWith('Created') ? 'text-emerald-300' : 'text-rose-300'}`}
            >
              {genMsg}
            </p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget != null}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && removeM.mutate(deleteTarget.productVariantId)}
        title="Confirm delete"
        message={
          deleteTarget
            ? `Soft-delete variant "${deleteTarget.displayName ?? deleteTarget.sku ?? deleteTarget.productName}"?`
            : ''
        }
        loading={removeM.isPending}
      />
    </div>
  );
}

function Radio({
  checked,
  onClick,
  title,
  hint,
}: {
  checked: boolean;
  onClick: () => void;
  title: string;
  hint: string;
}) {
  return (
    <label
      onClick={onClick}
      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition ${
        checked
          ? 'border-blue-400/60 bg-blue-500/10'
          : 'border-white/10 bg-white/[0.03] hover:bg-white/10'
      }`}
    >
      <span
        className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${
          checked ? 'border-blue-400 bg-blue-400' : 'border-white/40'
        }`}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-100">{title}</span>
        <span className="block text-[11px] text-slate-400">{hint}</span>
      </span>
    </label>
  );
}

function VariantRow({ v, onDelete }: { v: ProductVariantDto; onDelete: () => void }) {
  return (
    <tr className="hover:bg-white/[0.02]">
      <td className="px-4 py-3">
        <p className="font-semibold text-slate-100">{v.productName}</p>
        <p className="text-[11px] text-slate-500">{v.isDefault ? 'Default variant' : 'Variant'}</p>
      </td>
      <td className="px-4 py-3 text-xs">
        {v.attributes.length === 0 ? (
          <span className="text-slate-500">Single variant</span>
        ) : (
          <div className="space-x-1">
            {v.attributes.map((a, idx) => (
              <span key={`${a.key}-${idx}`} className="inline-block">
                <span className="text-slate-500">{a.key}:</span>{' '}
                <span className="text-slate-200">{a.value}</span>
                {idx < v.attributes.length - 1 && <span className="text-slate-600"> · </span>}
              </span>
            ))}
          </div>
        )}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-slate-200">{v.sku ?? '—'}</td>
      <td className="px-4 py-3 font-mono text-xs text-slate-300">{v.barcode ?? '—'}</td>
      <td className="px-4 py-3">
        <span className="rounded-md bg-violet-500/15 px-2 py-0.5 text-[11px] font-semibold text-violet-200 ring-1 ring-violet-500/30">
          {v.inventoryTrackingMode === 'Serial' || v.inventoryTrackingMode === 'BatchAndSerial'
            ? 'Serialized'
            : v.inventoryTrackingMode === 'Batch'
              ? 'Batch / Expiry'
              : v.inventoryTrackingMode === 'None'
                ? 'Service'
                : 'Simple'}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <p className="font-mono text-sm text-slate-100">
          {v.salePrice != null ? fmtInr(v.salePrice) : '—'}
        </p>
        {v.mrp != null && (
          <p className="text-[11px] text-slate-500 line-through">{fmtQty(v.mrp)}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ${
            v.isActive
              ? 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30'
              : 'bg-slate-500/15 text-slate-300 ring-slate-500/30'
          }`}
        >
          {v.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex gap-1">
          <button
            type="button"
            className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-200 hover:bg-white/10"
            title="Edit variant"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-rose-300 hover:bg-rose-500/10"
            title="Delete variant"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </td>
    </tr>
  );
}
