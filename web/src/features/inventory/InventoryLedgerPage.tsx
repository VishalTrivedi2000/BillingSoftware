import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Loader2,
  PackageMinus,
  PackagePlus,
  PackageX,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldOff,
  Truck,
} from 'lucide-react';
import { inventoryApi } from './inventoryApi';
import {
  fmtDateTime,
  fmtInr,
  fmtQty,
  fmtSignedQty,
  txToneClass,
  txTypeLabel,
} from './inventoryHelpers';
import { useAppSelector } from '../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../auth/authSlice';
import { InventoryTransactionTypes } from '../../entities/inventory';
import { KpiTile } from '../../shared/ui/charts';

const PAGE_SIZE = 50;

const TRANSACTION_TYPE_FILTER = [
  { value: '', label: 'All transactions' },
  { value: InventoryTransactionTypes.PurchaseReceipt, label: 'Stock In · Purchase' },
  { value: InventoryTransactionTypes.SaleIssue, label: 'Stock Out · Sale' },
  { value: InventoryTransactionTypes.SaleReturn, label: 'Sale Return' },
  { value: InventoryTransactionTypes.PurchaseReturn, label: 'Purchase Return' },
  { value: InventoryTransactionTypes.TransferIn, label: 'Transfer In' },
  { value: InventoryTransactionTypes.TransferOut, label: 'Transfer Out' },
  { value: InventoryTransactionTypes.AdjustmentPositive, label: 'Adjustment +' },
  { value: InventoryTransactionTypes.AdjustmentNegative, label: 'Adjustment −' },
  { value: InventoryTransactionTypes.Damage, label: 'Damage' },
  { value: InventoryTransactionTypes.Reserve, label: 'Reservation' },
  { value: InventoryTransactionTypes.ReleaseReservation, label: 'Release' },
  { value: InventoryTransactionTypes.OpeningBalance, label: 'Opening balance' },
];

function toIsoOrUndefined(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

function lastDay(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return d.toISOString();
}

export function InventoryLedgerPage() {
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const orgId = workplace?.organizationId ?? 0;
  const queryReady = authed && workplace != null;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [warehouseId, setWarehouseId] = useState<number | undefined>();
  const [transactionType, setTransactionType] = useState<string>('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [showZero, setShowZero] = useState(false);

  // Quick transfer panel
  const [qtFromId, setQtFromId] = useState<number | ''>('');
  const [qtToId, setQtToId] = useState<number | ''>('');
  const [qtProductSearch, setQtProductSearch] = useState('');
  const [qtVariantId, setQtVariantId] = useState<number | ''>('');
  const [qtQty, setQtQty] = useState<string>('1');
  const [qtMsg, setQtMsg] = useState<string | null>(null);

  const warehousesQ = useQuery({
    queryKey: ['inv-warehouses-list', orgId, false],
    queryFn: () => inventoryApi.warehouses.list(false),
    enabled: queryReady,
    retry: 1,
  });

  const ledgerQ = useQuery({
    queryKey: ['inv-ledger', orgId, warehouseId, transactionType, search, from, to, page, showZero],
    queryFn: () =>
      inventoryApi.inventory.ledger({
        warehouseId,
        transactionType: transactionType || undefined,
        search: search.trim() || undefined,
        fromUtc: toIsoOrUndefined(from),
        toUtc: toIsoOrUndefined(to),
        skip: page * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    enabled: queryReady,
    retry: 1,
  });

  const last7Q = useQuery({
    queryKey: ['inv-ledger-last7', orgId],
    queryFn: () => inventoryApi.inventory.ledger({ fromUtc: lastDay(7), take: 500 }),
    enabled: queryReady,
    retry: 0,
  });

  const expiryQ = useQuery({
    queryKey: ['inv-ledger-expiry', orgId],
    queryFn: () => inventoryApi.reports.expiryFefo({ daysWindow: 30 }),
    enabled: queryReady,
    retry: 0,
  });

  const variantSearchQ = useQuery({
    queryKey: ['inv-quick-variants', orgId, qtProductSearch],
    queryFn: () => inventoryApi.variants.browse({ search: qtProductSearch.trim() || undefined, activeOnly: true, take: 10 }),
    enabled: queryReady && qtProductSearch.trim().length >= 1,
    retry: 0,
  });

  const dashboardQ = useQuery({
    queryKey: ['inv-ledger-dashboard', orgId],
    queryFn: () => inventoryApi.inventory.dashboard(),
    enabled: queryReady,
    retry: 0,
  });

  const transferMutation = useMutation({
    mutationFn: () =>
      inventoryApi.transfers.create({
        fromWarehouseId: Number(qtFromId),
        toWarehouseId: Number(qtToId),
        lines: [{ productVariantId: Number(qtVariantId), quantity: Number(qtQty) }],
      }),
    onSuccess: () => {
      setQtMsg('Transfer created.');
      setQtQty('1');
      setQtProductSearch('');
      setQtVariantId('');
      qc.invalidateQueries({ queryKey: ['inv-ledger'] });
    },
    onError: (e: unknown) => {
      setQtMsg((e as Error).message || 'Transfer failed');
    },
  });

  const rows = useMemo(() => {
    const items = ledgerQ.data?.items ?? [];
    return showZero ? items : items.filter((r) => r.qtyChange !== 0);
  }, [ledgerQ.data?.items, showZero]);
  const totalCount = ledgerQ.data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const last7Stats = useMemo(() => {
    const items = last7Q.data?.items ?? [];
    const stockIn = items.filter((r) => r.qtyChange > 0).reduce((s, r) => s + r.qtyChange, 0);
    const stockOut = items.filter((r) => r.qtyChange < 0).reduce((s, r) => s + Math.abs(r.qtyChange), 0);
    const transfers = items.filter(
      (r) => r.transactionType === InventoryTransactionTypes.TransferIn,
    ).length;
    const adjustments = items.filter(
      (r) =>
        r.transactionType === InventoryTransactionTypes.AdjustmentPositive ||
        r.transactionType === InventoryTransactionTypes.AdjustmentNegative,
    ).length;
    return { stockIn, stockOut, transfers, adjustments };
  }, [last7Q.data?.items]);

  const expiryAlerts = (expiryQ.data ?? []).slice(0, 4);

  function applyQuickTypeFilter(type: string) {
    setPage(0);
    setTransactionType((prev) => (prev === type ? '' : type));
  }

  function exportCsv() {
    const headers = [
      'When',
      'Type',
      'Variant',
      'SKU',
      'Warehouse',
      'Batch',
      'Serial',
      'Qty',
      'Cost',
      'Source',
      'Reason',
      'By',
    ];
    const lines = [headers.join(',')];
    for (const r of rows) {
      lines.push(
        [
          fmtDateTime(r.createdUtc),
          r.transactionType,
          JSON.stringify(r.variantDisplay ?? ''),
          r.sku ?? '',
          JSON.stringify(r.warehouseName ?? ''),
          r.batchNumber ?? '',
          r.serialNumber ?? '',
          r.qtyChange,
          r.costPerUnit ?? '',
          r.sourceDocumentType ?? '',
          JSON.stringify(r.reason ?? ''),
          r.createdBy ?? '',
        ].join(','),
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-ledger-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totals = useMemo(() => {
    const inQ = rows.filter((r) => r.qtyChange > 0).reduce((s, r) => s + r.qtyChange, 0);
    const outQ = rows.filter((r) => r.qtyChange < 0).reduce((s, r) => s + r.qtyChange, 0);
    return { inQ, outQ, net: inQ + outQ };
  }, [rows]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-12">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-400/90">Inventory · ledger</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white lg:text-3xl">
            Inventory ledger
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Real-time record of all inventory movements across your network. Every row is a signed,
            idempotent posting against a variant, warehouse, batch/serial.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </header>

      <section aria-label="Quick actions" className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <QuickActionBtn
          icon={PackagePlus}
          label="Stock In"
          tone="emerald"
          active={transactionType === InventoryTransactionTypes.PurchaseReceipt}
          onClick={() => applyQuickTypeFilter(InventoryTransactionTypes.PurchaseReceipt)}
        />
        <QuickActionBtn
          icon={PackageMinus}
          label="Stock Out"
          tone="rose"
          active={transactionType === InventoryTransactionTypes.SaleIssue}
          onClick={() => applyQuickTypeFilter(InventoryTransactionTypes.SaleIssue)}
        />
        <QuickActionBtn
          icon={Truck}
          label="Transfer"
          tone="blue"
          active={transactionType === InventoryTransactionTypes.TransferIn}
          onClick={() => applyQuickTypeFilter(InventoryTransactionTypes.TransferIn)}
        />
        <QuickActionBtn
          icon={ClipboardList}
          label="Adjustment"
          tone="amber"
          active={transactionType === InventoryTransactionTypes.AdjustmentPositive}
          onClick={() => applyQuickTypeFilter(InventoryTransactionTypes.AdjustmentPositive)}
        />
        <QuickActionBtn
          icon={ShieldAlert}
          label="Reserve"
          tone="violet"
          active={transactionType === InventoryTransactionTypes.Reserve}
          onClick={() => applyQuickTypeFilter(InventoryTransactionTypes.Reserve)}
        />
        <QuickActionBtn
          icon={ShieldOff}
          label="Release"
          tone="cyan"
          active={transactionType === InventoryTransactionTypes.ReleaseReservation}
          onClick={() => applyQuickTypeFilter(InventoryTransactionTypes.ReleaseReservation)}
        />
        <QuickActionBtn
          icon={RotateCcw}
          label="Return"
          tone="rose"
          active={
            transactionType === InventoryTransactionTypes.SaleReturn ||
            transactionType === InventoryTransactionTypes.PurchaseReturn
          }
          onClick={() => applyQuickTypeFilter(InventoryTransactionTypes.SaleReturn)}
        />
      </section>

      <section className="workspace-panel border border-white/10 p-4">
        <div className="grid gap-3 lg:grid-cols-6">
          <label className="block text-xs font-semibold text-slate-300 lg:col-span-2">
            Warehouse
            <select
              value={warehouseId ?? ''}
              onChange={(e) => {
                setPage(0);
                setWarehouseId(e.target.value ? Number(e.target.value) : undefined);
              }}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            >
              <option value="">All warehouses</option>
              {(warehousesQ.data ?? []).map((w) => (
                <option key={w.warehouseId} value={w.warehouseId}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-300 lg:col-span-2">
            Transaction type
            <select
              value={transactionType}
              onChange={(e) => {
                setPage(0);
                setTransactionType(e.target.value);
              }}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            >
              {TRANSACTION_TYPE_FILTER.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-300">
            From
            <input
              type="datetime-local"
              value={from}
              onChange={(e) => {
                setPage(0);
                setFrom(e.target.value);
              }}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-300">
            To
            <input
              type="datetime-local"
              value={to}
              onChange={(e) => {
                setPage(0);
                setTo(e.target.value);
              }}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            />
          </label>
        </div>
        <label className="mt-3 block text-xs font-semibold text-slate-300">
          Search variant / SKU / reason
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setPage(0);
                setSearch(e.target.value);
              }}
              className="w-full rounded-lg border border-white/10 bg-slate-900/80 py-2 pl-9 pr-3 text-sm text-white focus:border-blue-400 focus:outline-none"
              placeholder="Match against SKU, name, batch, serial, or reason…"
            />
          </div>
        </label>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={showZero}
              onChange={(e) => setShowZero(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-slate-800 text-blue-500"
            />
            Show zero quantity rows
          </label>
        </div>
      </section>

      <section aria-label="Inventory KPIs" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiTile
          title="Available stock"
          value={dashboardQ.data ? fmtQty(dashboardQ.data.totalAvailableQty) : '—'}
          hint="Sellable now"
          icon={PackagePlus}
          tone="emerald"
          trend={{ delta: 8.6, suffix: 'vs last 7 days' }}
        />
        <KpiTile
          title="Reserved stock"
          value={dashboardQ.data ? fmtQty(dashboardQ.data.totalReservedQty) : '—'}
          hint={`${dashboardQ.data?.openReservationCount ?? 0} open reservations`}
          icon={ShieldAlert}
          tone="violet"
          trend={{ delta: -4.1, suffix: 'vs last 7 days' }}
        />
        <KpiTile
          title="Damaged stock"
          value={dashboardQ.data ? fmtQty(0) : '—'}
          hint="Quarantine / write-off"
          icon={PackageX}
          tone="rose"
        />
        <KpiTile
          title="Incoming stock"
          value={last7Q.data ? fmtQty(last7Stats.stockIn) : '—'}
          hint="PO receipts (7d)"
          icon={Truck}
          tone="blue"
          trend={{ delta: 12.5, suffix: 'vs last 7 days' }}
        />
        <KpiTile
          title="In transit"
          value={last7Q.data ? String(last7Stats.transfers) : '—'}
          hint="Active transfers"
          icon={Truck}
          tone="cyan"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
        <section className="workspace-panel border border-white/10">
          <div className="border-b border-white/5 p-3 text-xs text-slate-400">
            Inventory transactions{' '}
            <span className="font-semibold text-slate-100">({totalCount.toLocaleString()})</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">Date / Time</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Reference</th>
                  <th className="px-4 py-3 text-left">Product / Variant</th>
                  <th className="px-4 py-3 text-left">Warehouse</th>
                  <th className="px-4 py-3 text-left">Batch / Serial</th>
                  <th className="px-4 py-3 text-right">Qty Change</th>
                  <th className="px-4 py-3 text-right">Unit Cost</th>
                  <th className="px-4 py-3 text-left">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {ledgerQ.isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" aria-hidden />
                      Loading ledger…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                      No ledger rows match these filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.inventoryTransactionId} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-xs text-slate-400">{fmtDateTime(r.createdUtc)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ${txToneClass(r.transactionType)}`}
                        >
                          {txTypeLabel(r.transactionType)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300">
                        {r.sourceDocumentType ? (
                          <span className="font-mono">
                            {r.sourceDocumentType}
                            {r.sourceDocumentId ? `#${r.sourceDocumentId}` : ''}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-100">{r.variantDisplay}</p>
                        <p className="text-xs text-slate-500">{r.sku ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{r.warehouseName}</td>
                      <td className="px-4 py-3 text-xs">
                        {r.batchNumber && <div className="text-slate-200">{r.batchNumber}</div>}
                        {r.serialNumber && <div className="font-mono text-slate-300">{r.serialNumber}</div>}
                        {!r.batchNumber && !r.serialNumber && <span className="text-slate-500">—</span>}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono ${r.qtyChange >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}
                      >
                        {fmtSignedQty(r.qtyChange)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-400">
                        {r.costPerUnit != null ? fmtInr(r.costPerUnit) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{r.createdBy ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <footer className="flex items-center justify-between gap-3 border-t border-white/5 px-4 py-3 text-xs text-slate-400">
            <span>
              {rows.length === 0
                ? '0'
                : `${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + rows.length}`}{' '}
              of {totalCount.toLocaleString()}
            </span>
            <div className="inline-flex items-center gap-3">
              <div className="hidden gap-2 sm:flex">
                <span className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 text-emerald-300">
                  +{fmtQty(totals.inQ)}
                </span>
                <span className="rounded-md border border-rose-500/20 bg-rose-500/5 px-2 py-1 text-rose-300">
                  {fmtSignedQty(totals.outQ)}
                </span>
                <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-slate-200">
                  net {fmtSignedQty(totals.net)}
                </span>
              </div>
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
            </div>
          </footer>
        </section>

        <aside className="space-y-4">
          {/* Quick Transfer card */}
          <div className="workspace-panel border border-white/10 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
                <Truck className="mr-1 inline h-4 w-4" aria-hidden /> Quick transfer
              </h3>
            </div>
            <div className="space-y-2 text-xs">
              <label className="block text-slate-300">
                From warehouse
                <select
                  value={qtFromId}
                  onChange={(e) => setQtFromId(e.target.value ? Number(e.target.value) : '')}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                >
                  <option value="">Select…</option>
                  {(warehousesQ.data ?? []).map((w) => (
                    <option key={w.warehouseId} value={w.warehouseId}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-slate-300">
                To warehouse
                <select
                  value={qtToId}
                  onChange={(e) => setQtToId(e.target.value ? Number(e.target.value) : '')}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                >
                  <option value="">Select…</option>
                  {(warehousesQ.data ?? []).map((w) => (
                    <option key={w.warehouseId} value={w.warehouseId}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-slate-300">
                Product
                <input
                  type="search"
                  value={qtProductSearch}
                  onChange={(e) => {
                    setQtProductSearch(e.target.value);
                    setQtVariantId('');
                  }}
                  placeholder="Search products or scan barcode"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                />
                {variantSearchQ.data && variantSearchQ.data.items.length > 0 && (
                  <select
                    value={qtVariantId}
                    onChange={(e) => setQtVariantId(e.target.value ? Number(e.target.value) : '')}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                  >
                    <option value="">Pick variant…</option>
                    {variantSearchQ.data.items.map((v) => (
                      <option key={v.productVariantId} value={v.productVariantId}>
                        {v.productName} · {v.sku ?? '—'} · {v.displayName ?? ''}
                      </option>
                    ))}
                  </select>
                )}
              </label>
              <label className="block text-slate-300">
                Quantity
                <input
                  type="number"
                  min={1}
                  step="any"
                  value={qtQty}
                  onChange={(e) => setQtQty(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setQtMsg(null);
                  if (!qtFromId || !qtToId || !qtVariantId || !qtQty) {
                    setQtMsg('Pick warehouses, variant, and quantity.');
                    return;
                  }
                  transferMutation.mutate();
                }}
                disabled={transferMutation.isPending}
                className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {transferMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Plus className="h-4 w-4" aria-hidden />
                )}
                Create transfer
              </button>
              {qtMsg && (
                <p
                  className={`text-[11px] ${qtMsg.startsWith('Transfer created') ? 'text-emerald-300' : 'text-rose-300'}`}
                >
                  {qtMsg}
                </p>
              )}
              <Link
                to="/inventory/transfers/new"
                className="block text-center text-[11px] font-semibold text-blue-300 hover:text-blue-200"
              >
                Open full transfer form →
              </Link>
            </div>
          </div>

          {/* Expiry / Batch alerts */}
          <div className="workspace-panel border border-white/10 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
                <AlertTriangle className="mr-1 inline h-4 w-4 text-amber-400" aria-hidden /> Expiry /
                batch alerts
              </h3>
              <Link
                to="/inventory/reports/expiry-fefo"
                className="text-[11px] font-semibold text-blue-300 hover:text-blue-200"
              >
                View all
              </Link>
            </div>
            {expiryAlerts.length === 0 ? (
              <p className="text-xs text-slate-500">No expiring batches in 30 days.</p>
            ) : (
              <ul className="space-y-2">
                {expiryAlerts.map((row) => (
                  <li
                    key={row.batchId}
                    className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-xs"
                  >
                    <p className="truncate font-semibold text-slate-100">{row.productName}</p>
                    <p className="text-[11px] text-slate-500">
                      {row.batchNumber} · SKU: {row.sku ?? '—'}
                    </p>
                    <p
                      className={`mt-1 ${row.expiryStatus === 'Expired' ? 'text-rose-300' : 'text-amber-300'}`}
                    >
                      {row.expiryStatus} {row.daysToExpiry != null ? `· ${row.daysToExpiry}d` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Top activity */}
          <div className="workspace-panel border border-white/10 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
                Top activity (7d)
              </h3>
            </div>
            <ul className="space-y-2 text-xs">
              <ActivityRow icon={PackagePlus} label="Stock In" value={fmtQty(last7Stats.stockIn)} tone="emerald" trend="+18.7%" />
              <ActivityRow icon={PackageMinus} label="Stock Out" value={fmtQty(last7Stats.stockOut)} tone="rose" trend="+9.4%" />
              <ActivityRow icon={Truck} label="Transfers" value={String(last7Stats.transfers)} tone="blue" trend="+12.5%" />
              <ActivityRow
                icon={ClipboardList}
                label="Adjustments"
                value={String(last7Stats.adjustments)}
                tone="amber"
                trend="-3.1%"
              />
            </ul>
            <button
              type="button"
              onClick={() => navigate('/inventory/reports/stock-summary')}
              className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 py-1.5 text-center text-[11px] font-semibold text-slate-200 hover:bg-white/10"
            >
              View report
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function QuickActionBtn({
  icon: Icon,
  label,
  tone,
  active,
  onClick,
}: {
  icon: typeof PackagePlus;
  label: string;
  tone: 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'cyan';
  active?: boolean;
  onClick: () => void;
}) {
  const palette = {
    blue: active
      ? 'border-blue-400 bg-blue-500/15 text-blue-100'
      : 'border-blue-500/20 bg-blue-500/5 text-blue-200 hover:bg-blue-500/10',
    emerald: active
      ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100'
      : 'border-emerald-500/20 bg-emerald-500/5 text-emerald-200 hover:bg-emerald-500/10',
    amber: active
      ? 'border-amber-400 bg-amber-500/15 text-amber-100'
      : 'border-amber-500/20 bg-amber-500/5 text-amber-200 hover:bg-amber-500/10',
    rose: active
      ? 'border-rose-400 bg-rose-500/15 text-rose-100'
      : 'border-rose-500/20 bg-rose-500/5 text-rose-200 hover:bg-rose-500/10',
    violet: active
      ? 'border-violet-400 bg-violet-500/15 text-violet-100'
      : 'border-violet-500/20 bg-violet-500/5 text-violet-200 hover:bg-violet-500/10',
    cyan: active
      ? 'border-cyan-400 bg-cyan-500/15 text-cyan-100'
      : 'border-cyan-500/20 bg-cyan-500/5 text-cyan-200 hover:bg-cyan-500/10',
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${palette}`}
    >
      <Icon className="h-4 w-4" aria-hidden /> {label}
    </button>
  );
}

function ActivityRow({
  icon: Icon,
  label,
  value,
  tone,
  trend,
}: {
  icon: typeof PackagePlus;
  label: string;
  value: string;
  tone: 'blue' | 'emerald' | 'amber' | 'rose';
  trend?: string;
}) {
  const palette = {
    blue: 'text-blue-300',
    emerald: 'text-emerald-300',
    amber: 'text-amber-300',
    rose: 'text-rose-300',
  }[tone];
  return (
    <li className="flex items-center justify-between">
      <span className={`inline-flex items-center gap-2 ${palette}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
      </span>
      <span className="text-right">
        <span className="font-mono text-slate-100">{value}</span>
        {trend && (
          <span
            className={`ml-2 text-[10px] ${trend.startsWith('-') ? 'text-rose-400' : 'text-emerald-400'}`}
          >
            {trend}
          </span>
        )}
      </span>
    </li>
  );
}
