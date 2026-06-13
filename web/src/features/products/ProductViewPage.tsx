import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bookmark,
  Box,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Edit3,
  Loader2,
  MoreHorizontal,
  Package,
  Printer,
  Search,
  ShoppingCart,
  Tag,
  Truck,
} from 'lucide-react';
import type { ProductDto } from '../../entities/billing';
import type {
  InventoryTransactionDto,
  ProductSerialDto,
  ProductVariantDto,
} from '../../entities/inventory';
import { InventoryTransactionTypes } from '../../entities/inventory';
import { useAppSelector } from '../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../auth/authSlice';
import { productApi } from './productApi';
import { StockProPage } from './productFormUi';
import { inventoryApi } from '../inventory/inventoryApi';
import { fmtInr } from '../inventory/inventoryHelpers';
import { DonutChart } from '../../shared/ui/charts';
import { productImageUrl } from '../../shared/config/api';

const PAGE_SIZE = 25;

type ViewTab =
  | 'overview'
  | 'variants'
  | 'serials'
  | 'purchases'
  | 'sales'
  | 'warranty'
  | 'activity';

function parseTags(raw?: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw.split(',').map((t) => t.trim()).filter(Boolean);
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

function serialStatusLabel(status: string): string {
  switch (status) {
    case 'Available':
      return 'In Stock';
    case 'Damaged':
      return 'Repair';
    default:
      return status;
  }
}

function serialStatusClass(status: string): string {
  switch (status) {
    case 'Available':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'Reserved':
      return 'bg-blue-50 text-blue-700 ring-blue-200';
    case 'Sold':
      return 'bg-violet-50 text-violet-700 ring-violet-200';
    case 'Returned':
      return 'bg-slate-100 text-slate-600 ring-slate-200';
    case 'Damaged':
      return 'bg-amber-50 text-amber-800 ring-amber-200';
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
}

function docLink(tx: InventoryTransactionDto): { label: string; to: string | null } {
  const id = tx.sourceDocumentId;
  if (id == null) return { label: '—', to: null };
  const t = (tx.sourceDocumentType ?? '').toLowerCase();
  if (t.includes('invoice') || tx.transactionType === InventoryTransactionTypes.SaleIssue)
    return { label: `INV-${id}`, to: `/invoices/${id}` };
  if (t.includes('purchase') || tx.transactionType === InventoryTransactionTypes.PurchaseReceipt)
    return { label: `PO-${id}`, to: `/purchases/${id}` };
  return { label: String(id), to: null };
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof Box;
  tone: 'blue' | 'green' | 'indigo' | 'emerald';
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-teal-50 text-teal-600',
  };
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
        </div>
        <span className={`rounded-lg p-2 ${tones[tone]}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
    </div>
  );
}

export function ProductViewPage() {
  const { productId: idParam } = useParams();
  const productId = idParam ? Number(idParam) : NaN;
  const navigate = useNavigate();
  const authed = useAppSelector(selectIsAuthenticated);
  const orgId = useAppSelector(selectWorkplaceSnapshot)?.organizationId ?? 0;
  const enabled = authed && Number.isFinite(productId);

  const [tab, setTab] = useState<ViewTab>('overview');
  const [serialSearch, setSerialSearch] = useState('');
  const [serialStatus, setSerialStatus] = useState('');
  const [serialPage, setSerialPage] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);

  const productQ = useQuery({
    queryKey: ['product-view', productId],
    queryFn: () => productApi.get(productId),
    enabled,
  });

  const imagesQ = useQuery({
    queryKey: ['product-images', productId],
    queryFn: () => productApi.listImages(productId),
    enabled,
  });

  const variantsQ = useQuery({
    queryKey: ['product-variants', productId],
    queryFn: () => productApi.listVariants(productId),
    enabled,
  });

  const balancesQ = useQuery({
    queryKey: ['product-balances', productId, orgId],
    queryFn: () => inventoryApi.inventory.balances({ productId, take: 200 }),
    enabled,
  });

  const serialsQ = useQuery({
    queryKey: ['product-serials', productId, serialSearch, serialStatus, serialPage],
    queryFn: () =>
      inventoryApi.serials.browse({
        productId,
        search: serialSearch.trim() || undefined,
        status: serialStatus || undefined,
        skip: serialPage * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    enabled: enabled && (tab === 'serials' || tab === 'warranty'),
  });

  const needsLedger =
    tab === 'purchases' || tab === 'sales' || tab === 'activity';
  const ledgerQ = useQuery({
    queryKey: ['product-ledger', productId],
    queryFn: () => inventoryApi.inventory.ledger({ productId, take: 200 }),
    enabled: enabled && needsLedger,
    retry: 1,
  });

  const profitQ = useQuery({
    queryKey: ['product-profit', orgId],
    queryFn: () => inventoryApi.reports.itemProfit({ fromUtc: undefined, toUtc: undefined }),
    enabled,
  });

  const p = productQ.data;
  const variants = variantsQ.data ?? [];
  const images = imagesQ.data ?? [];
  const balances = balancesQ.data?.items ?? [];
  const ledger = ledgerQ.data?.items ?? [];
  const serials = serialsQ.data?.items ?? [];
  const serialTotal = serialsQ.data?.totalCount ?? 0;

  const tags = useMemo(() => {
    const fromProduct = parseTags(p?.tags);
    const chips: string[] = [];
    if (p?.categoryName) chips.push(p.categoryName);
    if (p?.brand) chips.push(p.brand);
    return [...chips, ...fromProduct];
  }, [p]);

  const stockKpis = useMemo(() => {
    let onHand = 0;
    let reserved = 0;
    const byWarehouse = new Map<string, number>();
    for (const b of balances) {
      onHand += b.onHandQty;
      reserved += b.reservedQty;
      const name = b.warehouseName || 'Unknown';
      byWarehouse.set(name, (byWarehouse.get(name) ?? 0) + b.onHandQty);
    }
    if (onHand === 0 && p?.stockQty != null) onHand = p.stockQty;
    return { onHand, reserved, byWarehouse };
  }, [balances, p]);

  const warehouseSlices = useMemo(
    () =>
      [...stockKpis.byWarehouse.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({ name, value })),
    [stockKpis.byWarehouse],
  );

  const profitRow = useMemo(
    () => profitQ.data?.find((r) => r.productId === productId),
    [profitQ.data, productId],
  );

  const purchaseTx = useMemo(
    () =>
      ledger.filter(
        (t) =>
          t.transactionType === InventoryTransactionTypes.PurchaseReceipt ||
          (t.sourceDocumentType ?? '').toLowerCase().includes('purchase'),
      ),
    [ledger],
  );

  const salesTx = useMemo(
    () =>
      ledger.filter(
        (t) =>
          t.transactionType === InventoryTransactionTypes.SaleIssue ||
          (t.sourceDocumentType ?? '').toLowerCase().includes('invoice'),
      ),
    [ledger],
  );

  const warrantySerials = useMemo(
    () => (serialsQ.data?.items ?? []).filter((s) => s.warrantyEndUtc || s.warrantyStartUtc),
    [serialsQ.data],
  );

  const primaryImg =
    productImageUrl(p?.primaryImageRelativePath) ??
    productImageUrl(images.find((i) => i.isPrimary)?.url ?? images[0]?.url);

  const serialPages = Math.max(1, Math.ceil(serialTotal / PAGE_SIZE));

  if (!Number.isFinite(productId)) {
    return (
      <StockProPage>
        <p className="text-sm text-rose-600">Invalid product id.</p>
      </StockProPage>
    );
  }

  if (productQ.isLoading) {
    return (
      <StockProPage>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          Loading product…
        </div>
      </StockProPage>
    );
  }

  if (productQ.isError || !p) {
    return (
      <StockProPage>
        <p className="text-sm text-rose-600">Product not found or could not be loaded.</p>
        <Link to="/products" className="mt-3 inline-block text-sm font-semibold text-blue-600">
          Back to products
        </Link>
      </StockProPage>
    );
  }

  const tabs: { id: ViewTab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'variants', label: 'Variants', count: variants.length },
    { id: 'serials', label: 'Serials / IMEI', count: serialTotal },
    { id: 'purchases', label: 'Purchases', count: purchaseTx.length },
    { id: 'sales', label: 'Sales', count: salesTx.length },
    { id: 'warranty', label: 'Warranty', count: warrantySerials.length },
    { id: 'activity', label: 'Activity', count: ledger.length },
  ];

  return (
    <StockProPage className="print:bg-white">
      {/* Breadcrumbs + header */}
      <nav className="mb-4 text-xs text-slate-500">
        <Link to="/products" className="font-medium text-blue-600 hover:underline">
          Products
        </Link>
        <span className="mx-1.5">›</span>
        <span className="text-slate-700">{p.name}</span>
      </nav>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{p.name}</h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                p.isActive
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                  : 'bg-slate-100 text-slate-600 ring-slate-200'
              }`}
            >
              {p.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  <Tag className="h-3 w-3 text-slate-400" aria-hidden />
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Link
            to={`/products/${productId}/edit`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Edit3 className="h-4 w-4" aria-hidden />
            Edit product
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" aria-hidden />
            Print label
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
            >
              More actions
              <ChevronDown className="h-4 w-4" aria-hidden />
            </button>
            {moreOpen && (
              <div className="absolute right-0 z-20 mt-1 min-w-[180px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                <Link
                  to="/inventory/serials"
                  className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => setMoreOpen(false)}
                >
                  Manage all serials
                </Link>
                <Link
                  to="/inventory/ledger"
                  className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => setMoreOpen(false)}
                >
                  Inventory ledger
                </Link>
                <button
                  type="button"
                  className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setMoreOpen(false);
                    navigate('/purchases/new');
                  }}
                >
                  New purchase (GRN)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary card */}
      <section className="mb-6 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="flex gap-4 lg:col-span-4">
            <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              {primaryImg ? (
                <img src={primaryImg} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-300">
                  <Package className="h-12 w-12" aria-hidden />
                </div>
              )}
            </div>
            <dl className="grid flex-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold text-slate-500">SKU</dt>
                <dd className="font-mono font-medium text-slate-900">{p.sku ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500">Category</dt>
                <dd className="text-slate-800">{p.categoryName ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500">Brand</dt>
                <dd className="text-slate-800">{p.brand ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500">Warranty</dt>
                <dd className="text-slate-800">
                  {p.warrantyMonths != null ? `${p.warrantyMonths} months` : '—'}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold text-slate-500">Status</dt>
                <dd className="flex items-center gap-1.5 text-slate-800">
                  <span
                    className={`h-2 w-2 rounded-full ${p.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}
                  />
                  {p.isActive ? 'Active' : 'Inactive'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:col-span-4">
            <KpiCard
              label="Total stock"
              value={`${stockKpis.onHand.toLocaleString()} units`}
              icon={Box}
              tone="blue"
            />
            <KpiCard
              label="Sold stock"
              value={`${(profitRow?.quantitySold ?? 0).toLocaleString()} units`}
              icon={ShoppingCart}
              tone="green"
            />
            <KpiCard
              label="Reserved stock"
              value={`${stockKpis.reserved.toLocaleString()} units`}
              icon={Bookmark}
              tone="indigo"
            />
            <KpiCard
              label="Profit (total)"
              value={fmtInr(profitRow?.grossProfit ?? 0)}
              sub={
                profitRow && profitRow.totalRevenue > 0
                  ? `${profitRow.grossMarginPercent.toFixed(1)}% margin`
                  : 'No posted sales yet'
              }
              icon={DollarSign}
              tone="emerald"
            />
          </div>

          <div className="lg:col-span-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              Warehouse distribution
            </p>
            <DonutChart
              theme="light"
              slices={warehouseSlices}
              centerTitle="Total"
              centerValue={`${stockKpis.onHand.toLocaleString()} units`}
              size={160}
              thickness={32}
            />
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="mb-4 border-b border-slate-200 print:hidden">
        <div className="flex gap-1 overflow-x-auto pb-px">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                if (t.id === 'serials') setSerialPage(0);
              }}
              className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className="ml-1.5 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                  {t.count.toLocaleString()}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        {tab === 'overview' && <OverviewTab product={p} variants={variants} />}
        {tab === 'variants' && <VariantsTab variants={variants} productId={productId} />}
        {tab === 'serials' && (
          <SerialsTab
            serials={serials}
            total={serialTotal}
            page={serialPage}
            pageSize={PAGE_SIZE}
            pages={serialPages}
            search={serialSearch}
            status={serialStatus}
            loading={serialsQ.isLoading}
            onSearch={setSerialSearch}
            onStatus={setSerialStatus}
            onPage={setSerialPage}
            unitPrice={p.unitPrice}
          />
        )}
        {tab === 'purchases' && (
          <LedgerDocTab rows={purchaseTx} kind="purchase" ledgerError={ledgerQ.isError} />
        )}
        {tab === 'sales' && (
          <LedgerDocTab rows={salesTx} kind="sale" ledgerError={ledgerQ.isError} />
        )}
        {tab === 'warranty' && (
          <WarrantyTab serials={warrantySerials} loading={serialsQ.isLoading} />
        )}
        {tab === 'activity' && (
          <ActivityTab rows={ledger} loading={ledgerQ.isLoading} error={ledgerQ.isError} />
        )}
      </div>
    </StockProPage>
  );
}

function OverviewTab({ product: p, variants }: { product: ProductDto; variants: ProductVariantDto[] }) {
  const desc = p.description ?? '';
  const [short, long] = desc.includes('\n\n') ? desc.split('\n\n') : ['', desc];
  const tagList = parseTags(p.tags);

  const rows: [string, string][] = [
    ['Product type', p.isService ? 'Service (non-stock)' : p.hasVariants ? 'Variant product' : 'Simple'],
    ['Unit', p.unitName ?? '—'],
    ['Barcode', p.barcode ?? variants.find((v) => v.barcode)?.barcode ?? '—'],
    ['HSN / SAC', p.hsnCode ?? '—'],
    ['Country of origin', p.countryOfOrigin ?? '—'],
    ['Internal code', p.internalCode ?? '—'],
    ['Manufacturer part no.', p.manufacturerPartNo ?? '—'],
    ['Manufacturer / supplier', p.manufacturer ?? '—'],
    ['Sale price', fmtInr(p.unitPrice)],
    ['MRP', p.mrp != null ? fmtInr(p.mrp) : '—'],
    ['Purchase price', p.purchasePrice != null ? fmtInr(p.purchasePrice) : '—'],
    ['Tax %', p.taxRatePercent != null ? `${p.taxRatePercent}%` : '—'],
    ['Storage location', p.storageLocation ?? '—'],
    ['Tracking mode', p.inventoryTrackingMode ?? '—'],
    ['Lead time', p.leadTimeDays != null ? `${p.leadTimeDays} days` : '—'],
    ['Shelf life', p.shelfLifeDays != null ? `${p.shelfLifeDays} days` : '—'],
    ['Returnable', p.isReturnable ? 'Yes' : 'No'],
    ['Visibility', p.visibility ?? '—'],
  ];

  return (
    <div className="p-5">
      <p className="mb-4 text-sm text-slate-600">
        Full catalog profile for this SKU — pricing, tax, inventory rules, and identifiers.
      </p>
      {tagList.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {tagList.map((t) => (
            <span key={t} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
              {t}
            </span>
          ))}
        </div>
      )}
      {(short || long) && (
        <div className="mb-6 space-y-2 text-sm text-slate-700">
          {short && <p className="font-medium text-slate-900">{short}</p>}
          {long && <p className="whitespace-pre-wrap text-slate-600">{long}</p>}
        </div>
      )}
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function VariantsTab({
  variants,
  productId,
}: {
  variants: ProductVariantDto[];
  productId: number;
}) {
  return (
    <div className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Sellable SKUs and attribute combinations for this product.</p>
        <Link
          to={`/products/${productId}/edit`}
          className="text-sm font-semibold text-blue-600 hover:underline"
        >
          Manage variants
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Variant</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">Barcode</th>
              <th className="px-3 py-2">Sale price</th>
              <th className="px-3 py-2">MRP</th>
              <th className="px-3 py-2">Tracking</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {variants.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  No variants yet. Open edit product to add variants.
                </td>
              </tr>
            ) : (
              variants.map((v) => (
                <tr key={v.productVariantId} className="border-b border-slate-100 hover:bg-slate-50/80">
                  <td className="px-3 py-2.5 font-medium text-slate-900">
                    {v.displayName ?? v.productName}
                    {v.isDefault && (
                      <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                        Default
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{v.sku ?? '—'}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{v.barcode ?? '—'}</td>
                  <td className="px-3 py-2.5">{v.salePrice != null ? fmtInr(v.salePrice) : '—'}</td>
                  <td className="px-3 py-2.5">{v.mrp != null ? fmtInr(v.mrp) : '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{v.inventoryTrackingMode ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                        v.isActive
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                          : 'bg-slate-100 text-slate-600 ring-slate-200'
                      }`}
                    >
                      {v.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SerialsTab({
  serials,
  total,
  page,
  pageSize,
  pages,
  search,
  status,
  loading,
  onSearch,
  onStatus,
  onPage,
  unitPrice,
}: {
  serials: ProductSerialDto[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  search: string;
  status: string;
  loading: boolean;
  onSearch: (v: string) => void;
  onStatus: (v: string) => void;
  onPage: (p: number) => void;
  unitPrice: number;
}) {
  return (
    <div className="p-5">
      <p className="mb-4 text-sm text-slate-600">
        Track every individual unit by its IMEI/serial number. Identify purchase, sale, and current
        warehouse location.
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              onSearch(e.target.value);
              onPage(0);
            }}
            placeholder="Search serial / IMEI…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            onStatus(e.target.value);
            onPage(0);
          }}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="Available">In stock</option>
          <option value="Reserved">Reserved</option>
          <option value="Sold">Sold</option>
          <option value="Returned">Returned</option>
          <option value="Damaged">Repair</option>
        </select>
        <Link
          to="/inventory/serials"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Export
        </Link>
        <Link
          to="/inventory/serials"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
        >
          + Add serial
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="w-8 px-2 py-2" />
                  <th className="px-3 py-2">IMEI / Serial</th>
                  <th className="px-3 py-2">Received</th>
                  <th className="px-3 py-2">Purchase cost</th>
                  <th className="px-3 py-2">Warehouse</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Sold invoice</th>
                  <th className="px-3 py-2">Sale price</th>
                  <th className="px-3 py-2">Margin</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {serials.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-10 text-center text-slate-500">
                      No serials for this product yet.
                    </td>
                  </tr>
                ) : (
                  serials.map((s) => {
                    const cost = s.purchaseCostPerUnit ?? 0;
                    const sale = s.status === 'Sold' ? unitPrice : null;
                    const marginPct =
                      sale != null && cost > 0 ? (((sale - cost) / cost) * 100).toFixed(1) : null;
                    return (
                      <tr key={s.productSerialId} className="border-b border-slate-100 hover:bg-slate-50/80">
                        <td className="px-2 py-2">
                          <input type="checkbox" className="rounded border-slate-300" aria-label="Select" />
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs font-semibold text-slate-900">
                          {s.serialNumber}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{fmtDate(s.createdUtc)}</td>
                        <td className="px-3 py-2.5">
                          {s.purchaseCostPerUnit != null ? fmtInr(s.purchaseCostPerUnit) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-slate-700">{s.warehouseName ?? '—'}</td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${serialStatusClass(s.status)}`}
                          >
                            {serialStatusLabel(s.status)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {s.soldInvoiceLineId ? (
                            <span className="font-mono text-xs text-blue-600">
                              LINE-{s.soldInvoiceLineId}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {sale != null ? fmtInr(sale) : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          {marginPct != null ? (
                            <span
                              className={
                                Number(marginPct) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                              }
                            >
                              {marginPct}%{' '}
                              {sale != null && (
                                <span className="text-slate-500">
                                  ({fmtInr(sale - cost)})
                                </span>
                              )}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            aria-label="Actions"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            pages={pages}
            onPage={onPage}
          />
        </>
      )}
    </div>
  );
}

function LedgerDocTab({
  rows,
  kind,
  ledgerError,
}: {
  rows: InventoryTransactionDto[];
  kind: 'purchase' | 'sale';
  ledgerError?: boolean;
}) {
  const Icon = kind === 'purchase' ? Truck : ShoppingCart;
  if (ledgerError) {
    return (
      <div className="p-5 text-sm text-amber-800">
        Could not load inventory history. Restart the API after updating, then refresh this page.
      </div>
    );
  }
  return (
    <div className="p-5">
      <p className="mb-4 flex items-center gap-2 text-sm text-slate-600">
        <Icon className="h-4 w-4" aria-hidden />
        {kind === 'purchase'
          ? 'Stock received against purchase bills and GRNs for this product.'
          : 'Stock issued on posted sales invoices for this product.'}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Document</th>
              <th className="px-3 py-2">Variant</th>
              <th className="px-3 py-2">Warehouse</th>
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2">Cost / unit</th>
              <th className="px-3 py-2">Type</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-slate-500">
                  No {kind} movements recorded yet.
                </td>
              </tr>
            ) : (
              rows.map((t) => {
                const doc = docLink(t);
                return (
                  <tr key={t.inventoryTransactionId} className="border-b border-slate-100">
                    <td className="px-3 py-2.5 text-slate-600">{fmtDateTime(t.createdUtc)}</td>
                    <td className="px-3 py-2.5">
                      {doc.to ? (
                        <Link to={doc.to} className="font-semibold text-blue-600 hover:underline">
                          {doc.label}
                        </Link>
                      ) : (
                        doc.label
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-800">{t.variantDisplay}</td>
                    <td className="px-3 py-2.5">{t.warehouseName}</td>
                    <td className="px-3 py-2.5 font-medium">{t.qtyChange}</td>
                    <td className="px-3 py-2.5">
                      {t.costPerUnit != null ? fmtInr(t.costPerUnit) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{t.transactionType}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WarrantyTab({
  serials,
  loading,
}: {
  serials: ProductSerialDto[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }
  return (
    <div className="p-5">
      <p className="mb-4 text-sm text-slate-600">
        Units with warranty start/end dates on file (from serial registration).
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Serial</th>
              <th className="px-3 py-2">Start</th>
              <th className="px-3 py-2">End</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Warehouse</th>
            </tr>
          </thead>
          <tbody>
            {serials.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-slate-500">
                  No warranty records for this product.
                </td>
              </tr>
            ) : (
              serials.map((s) => (
                <tr key={s.productSerialId} className="border-b border-slate-100">
                  <td className="px-3 py-2.5 font-mono text-xs font-semibold">{s.serialNumber}</td>
                  <td className="px-3 py-2.5">{fmtDate(s.warrantyStartUtc)}</td>
                  <td className="px-3 py-2.5">{fmtDate(s.warrantyEndUtc)}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${serialStatusClass(s.status)}`}
                    >
                      {serialStatusLabel(s.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">{s.warehouseName ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActivityTab({
  rows,
  loading,
  error,
}: {
  rows: InventoryTransactionDto[];
  loading: boolean;
  error?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-5 text-sm text-amber-800">
        Could not load inventory activity. Restart the API after updating, then open this tab again.
      </div>
    );
  }
  return (
    <div className="p-5">
      <p className="mb-4 text-sm text-slate-600">Complete inventory ledger timeline for this product.</p>
      <ul className="space-y-3">
        {rows.length === 0 ? (
          <li className="text-sm text-slate-500">No activity yet.</li>
        ) : (
          rows.map((t) => {
            const doc = docLink(t);
            return (
              <li
                key={t.inventoryTransactionId}
                className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm"
              >
                <span className="shrink-0 text-xs text-slate-500">{fmtDateTime(t.createdUtc)}</span>
                <span className="font-semibold text-slate-800">{t.transactionType}</span>
                <span className="text-slate-600">
                  {t.qtyChange > 0 ? '+' : ''}
                  {t.qtyChange} @ {t.warehouseName}
                </span>
                {doc.to && (
                  <Link to={doc.to} className="font-semibold text-blue-600 hover:underline">
                    {doc.label}
                  </Link>
                )}
                {t.reason && <span className="text-slate-500">— {t.reason}</span>}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function Pagination({
  page,
  pageSize,
  total,
  pages,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  pages: number;
  onPage: (p: number) => void;
}) {
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm text-slate-600">
      <p>
        Showing {from} to {to} of {total.toLocaleString()} entries
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 0}
          onClick={() => onPage(page - 1)}
          className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {Array.from({ length: Math.min(5, pages) }, (_, i) => {
          let p = i;
          if (pages > 5 && page > 2) p = Math.min(page - 2 + i, pages - 1);
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPage(p)}
              className={`min-w-[2rem] rounded-lg px-2 py-1 text-sm font-semibold ${
                p === page ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {p + 1}
            </button>
          );
        })}
        {pages > 5 && <span className="px-1">…</span>}
        <button
          type="button"
          disabled={page >= pages - 1}
          onClick={() => onPage(page + 1)}
          className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="ml-2 text-xs text-slate-500">{pageSize} / page</span>
      </div>
    </div>
  );
}
