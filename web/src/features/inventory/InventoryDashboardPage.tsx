import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { Link } from "react-router-dom";

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Barcode,
  Boxes,
  Building2,
  Calendar,
  ChevronDown,
  CircleDollarSign,
  Package,
  Settings2,
  TrendingDown,
  TrendingUp,
  Warehouse,
} from "lucide-react";

import { inventoryApi } from "./inventoryApi";

import { fmtDate, fmtInr, fmtQty, fmtSignedQty } from "./inventoryHelpers";

import { useAppSelector } from "../../app/hooks";

import {
  selectIsAuthenticated,
  selectWorkplaceSnapshot,
} from "../auth/authSlice";

import { DonutChart, LineChart } from "../../shared/ui/charts";

import { apiJsonAuth } from "../../shared/api/axiosClient";

import type { InvoiceSummaryDto } from "../../entities/billing";

import type {
  InventoryDashboardDto,
  InventoryTransactionDto,
  InventoryTransactionType,
} from "../../entities/inventory";

/* StockPro-style light dashboard — scoped to this page only */

function startOfDay(d: Date): Date {
  const x = new Date(d);

  x.setHours(0, 0, 0, 0);

  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);

  x.setDate(x.getDate() + n);

  return x;
}

function fmtRangeLabel(from: Date, to: Date): string {
  const fmt = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${fmt.format(from)} – ${fmt.format(to)}`;
}

function lastNDates(n: number, end: Date): { iso: string; label: string }[] {
  const out: { iso: string; label: string }[] = [];

  const fmt = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  });

  for (let i = n - 1; i >= 0; i--) {
    const d = startOfDay(addDays(end, -i));

    out.push({ iso: d.toISOString().slice(0, 10), label: fmt.format(d) });
  }

  return out;
}

function pctDelta(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;

  return ((current - previous) / previous) * 100;
}

const INCOMING: InventoryTransactionType[] = [
  "PURCHASE_RECEIPT",

  "SALE_RETURN",

  "TRANSFER_IN",

  "ADJUSTMENT_POSITIVE",

  "PRODUCTION_OUTPUT",

  "OPENING_BALANCE",
];

const OUTGOING: InventoryTransactionType[] = [
  "SALE_ISSUE",

  "PURCHASE_RETURN",

  "TRANSFER_OUT",

  "DAMAGE",

  "ADJUSTMENT_NEGATIVE",

  "PRODUCTION_CONSUME",
];

function stockProTxLabel(t: InventoryTransactionType): string {
  if (INCOMING.includes(t)) return "Stock In";

  if (OUTGOING.includes(t)) return "Stock Out";

  if (t.includes("TRANSFER")) return "Transfer";

  if (t.includes("ADJUSTMENT")) return "Adjustment";

  return t.replace(/_/g, " ");
}

function stockProTxBadge(t: InventoryTransactionType): string {
  if (INCOMING.includes(t))
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";

  if (OUTGOING.includes(t)) return "bg-rose-50 text-rose-700 ring-rose-200";

  if (t.includes("TRANSFER")) return "bg-blue-50 text-blue-700 ring-blue-200";

  if (t.includes("ADJUSTMENT"))
    return "bg-amber-50 text-amber-800 ring-amber-200";

  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function txReference(tx: InventoryTransactionDto): string {
  if (tx.sourceDocumentType && tx.sourceDocumentId != null) {
    return `${tx.sourceDocumentType} #${tx.sourceDocumentId}`;
  }

  return `TX-${tx.inventoryTransactionId}`;
}

async function fetchInvoices(): Promise<InvoiceSummaryDto[]> {
  return apiJsonAuth<InvoiceSummaryDto[]>("/v1/invoices?take=250");
}

function apiErrorDetail(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const data = err.response?.data;
    if (typeof data === "string" && data.trim()) return data;
    if (data && typeof data === "object") {
      const msg =
        (data as { message?: string }).message ??
        (data as { title?: string }).title ??
        (data as { detail?: string }).detail;
      if (msg) return status ? `${status}: ${msg}` : msg;
    }
    if (status === 403)
      return "403 Forbidden — your role needs inventory.view or reports.inventory.";
    if (status) return `HTTP ${status}`;
  }
  if (err instanceof Error) return err.message;
  return "Unknown error";
}

export function InventoryDashboardPage() {
  const authed = useAppSelector(selectIsAuthenticated);

  const workplace = useAppSelector(selectWorkplaceSnapshot);

  const orgId = workplace?.organizationId ?? 0;

  const enabled = authed && workplace != null;

  const [rangeEnd, setRangeEnd] = useState(() => startOfDay(new Date()));

  const [rangeStart, setRangeStart] = useState(() =>
    startOfDay(addDays(new Date(), -6)),
  );

  const [chartGranularity, setChartGranularity] = useState<"Daily" | "Weekly">(
    "Daily",
  );

  const fromUtc = useMemo(() => rangeStart.toISOString(), [rangeStart]);

  const toUtc = useMemo(() => {
    const e = new Date(rangeEnd);

    e.setHours(23, 59, 59, 999);

    return e.toISOString();
  }, [rangeEnd]);

  const todayStart = useMemo(() => startOfDay(new Date()).toISOString(), []);

  const yesterdayStart = useMemo(
    () => startOfDay(addDays(new Date(), -1)).toISOString(),
    [],
  );

  const yesterdayEnd = useMemo(() => {
    const e = startOfDay(new Date());

    e.setMilliseconds(-1);

    return e.toISOString();
  }, []);

  const dashboardQ = useQuery({
    queryKey: ["inventory-dashboard", orgId],

    queryFn: () => inventoryApi.inventory.dashboard(),

    enabled,

    retry: 1,
  });

  const ledgerQ = useQuery({
    queryKey: ["inventory-dashboard-ledger", orgId, fromUtc, toUtc],

    queryFn: () => inventoryApi.inventory.ledger({ fromUtc, toUtc, take: 500 }),

    enabled,

    retry: 1,
  });

  const profitRangeQ = useQuery({
    queryKey: ["inventory-dashboard-itemprofit", orgId, fromUtc, toUtc],

    queryFn: () => inventoryApi.reports.itemProfit({ fromUtc, toUtc }),

    enabled,

    retry: 0,
  });

  const profitTodayQ = useQuery({
    queryKey: ["inventory-dashboard-profit-today", orgId, todayStart],

    queryFn: () => inventoryApi.reports.itemProfit({ fromUtc: todayStart }),

    enabled,

    retry: 0,
  });

  const profitYesterdayQ = useQuery({
    queryKey: [
      "inventory-dashboard-profit-yesterday",
      orgId,
      yesterdayStart,
      yesterdayEnd,
    ],

    queryFn: () =>
      inventoryApi.reports.itemProfit({
        fromUtc: yesterdayStart,
        toUtc: yesterdayEnd,
      }),

    enabled,

    retry: 0,
  });

  const valuationQ = useQuery({
    queryKey: ["inventory-dashboard-valuation", orgId],

    queryFn: () => inventoryApi.reports.valuation({}),

    enabled,

    retry: 0,
  });

  const lowStockQ = useQuery({
    queryKey: ["inventory-dashboard-lowstock", orgId],

    queryFn: () => inventoryApi.reports.lowStock(),

    enabled,

    retry: 0,
  });

  const expiryQ = useQuery({
    queryKey: ["inventory-dashboard-expiry", orgId],

    queryFn: () => inventoryApi.reports.expiryFefo({ daysWindow: 90 }),

    enabled,

    retry: 0,
  });

  const invoicesQ = useQuery({
    queryKey: ["inventory-dashboard-invoices", orgId],

    queryFn: fetchInvoices,

    enabled,

    retry: 0,
  });

  const warehousesQ = useQuery({
    queryKey: ["inventory-dashboard-warehouses", orgId],
    queryFn: () => inventoryApi.warehouses.list(true),
    enabled,
    retry: 0,
  });

  const d = dashboardQ.data;

  /** When /inventory/dashboard fails (partial DB migration), derive KPIs from reports that still work. */
  const fallbackStats = useMemo(() => {
    const val = valuationQ.data ?? [];
    const productIds = new Set(val.map((r) => r.productId));
    const variantIds = new Set(val.map((r) => r.productVariantId));
    const onHand = val.reduce((s, r) => s + r.onHandQty, 0);
    const whTiles = (warehousesQ.data ?? []).map((w) => ({
      warehouseId: w.warehouseId,
      name: w.name,
      onHandQty: 0,
      availableQty: 0,
      skuCount: 0,
    }));
    return {
      totalWarehouses: warehousesQ.data?.length ?? 0,
      totalVariants: variantIds.size,
      totalProducts: productIds.size,
      totalOnHandQty: onHand,
      totalAvailableQty: onHand,
      totalReservedQty: 0,
      inventoryValueAtCost: val.reduce((s, r) => s + (r.totalValue ?? 0), 0),
      lowStockSkuCount: lowStockQ.data?.length ?? 0,
      outOfStockSkuCount: 0,
      nearExpiryBatchCount: 0,
      expiredBatchCount: 0,
      openReservationCount: 0,
      activeSerialsCount: 0,
      warehouseTiles: whTiles,
      recentLedger: [] as InventoryDashboardDto["recentLedger"],
    };
  }, [valuationQ.data, lowStockQ.data, warehousesQ.data]);

  const stats = d ?? (dashboardQ.isError ? fallbackStats : undefined);

  const dates = useMemo(() => lastNDates(7, rangeEnd), [rangeEnd]);

  const stockMovement = useMemo(() => {
    const map = new Map<string, { in: number; out: number }>();

    for (const day of dates) map.set(day.iso, { in: 0, out: 0 });

    for (const tx of ledgerQ.data?.items ?? []) {
      const day = tx.createdUtc.slice(0, 10);

      if (!map.has(day)) continue;

      const bucket = map.get(day)!;

      if (tx.qtyChange >= 0) bucket.in += tx.qtyChange;
      else bucket.out += -tx.qtyChange;
    }

    return dates.map((day) => map.get(day.iso) ?? { in: 0, out: 0 });
  }, [dates, ledgerQ.data?.items]);

  const inventoryByCategory = useMemo(() => {
    const counts = new Map<string, Set<number>>();

    for (const row of valuationQ.data ?? []) {
      const k = row.categoryName?.trim() || "Others";

      if (!counts.has(k)) counts.set(k, new Set());

      counts.get(k)!.add(row.productId);
    }

    return Array.from(counts.entries())

      .map(([name, set]) => ({ name, value: set.size }))

      .sort((a, b) => b.value - a.value)

      .slice(0, 6);
  }, [valuationQ.data]);

  const topSellers = useMemo(() => {
    const rows = profitRangeQ.data ?? [];

    return [...rows]

      .sort((a, b) => b.quantitySold - a.quantitySold)

      .slice(0, 5)

      .map((r) => ({
        name: r.productName,

        sub: r.sku ?? "—",

        value: r.quantitySold,
      }));
  }, [profitRangeQ.data]);

  const recentTx = useMemo(
    () => (ledgerQ.data?.items ?? []).slice(0, 8),

    [ledgerQ.data?.items],
  );

  const lowStockTop = useMemo(
    () => (lowStockQ.data ?? []).slice(0, 5),
    [lowStockQ.data],
  );

  const { todaySales, salesTrend } = useMemo(() => {
    const todayKey = startOfDay(new Date()).toISOString().slice(0, 10);

    const yKey = startOfDay(addDays(new Date(), -1)).toISOString().slice(0, 10);

    let today = 0;

    let yesterday = 0;

    for (const inv of invoicesQ.data ?? []) {
      if (inv.status.toLowerCase() === "draft") continue;

      const day = inv.issueUtc.slice(0, 10);

      if (day === todayKey) today += inv.totalAmount;
      else if (day === yKey) yesterday += inv.totalAmount;
    }

    return {
      todaySales: today,

      salesTrend: pctDelta(today, yesterday),
    };
  }, [invoicesQ.data]);

  const { grossProfitToday, profitTrend } = useMemo(() => {
    const sum = (rows: { grossProfit: number }[] | undefined) =>
      (rows ?? []).reduce((s, r) => s + r.grossProfit, 0);

    const today = sum(profitTodayQ.data);

    const yesterday = sum(profitYesterdayQ.data);

    return {
      grossProfitToday: today,

      profitTrend: pctDelta(today, yesterday),
    };
  }, [profitTodayQ.data, profitYesterdayQ.data]);

  const inStockSkus = useMemo(() => {
    if (!stats) return 0;
    return Math.max(0, stats.totalVariants - stats.outOfStockSkuCount);
  }, [stats]);

  const pctOfVariants = (n: number) =>
    stats && stats.totalVariants > 0
      ? `${((n / stats.totalVariants) * 100).toFixed(1)}% of total`
      : "—";

  const totalProductLabel = useMemo(() => {
    if (stats?.totalProducts) return `${stats.totalProducts.toLocaleString()} Products`;
    const n = inventoryByCategory.reduce((s, c) => s + c.value, 0);
    return n > 0 ? `${n.toLocaleString()} Products` : "—";
  }, [stats?.totalProducts, inventoryByCategory]);

  const expiring60 = useMemo(
    () =>
      (expiryQ.data ?? []).filter((r) => {
        const days = r.daysToExpiry ?? 999;

        return days > 30 && days <= 60;
      }).length,

    [expiryQ.data],
  );

  const soldThisMonth = useMemo(() => {
    const monthStart = new Date();

    monthStart.setDate(1);

    monthStart.setHours(0, 0, 0, 0);

    const key = monthStart.toISOString().slice(0, 10);

    let qty = 0;

    for (const tx of ledgerQ.data?.items ?? []) {
      if (
        tx.transactionType === "SALE_ISSUE" &&
        tx.createdUtc.slice(0, 10) >= key
      ) {
        qty += Math.abs(tx.qtyChange);
      }
    }

    return qty;
  }, [ledgerQ.data?.items]);

  return (
    <div className="stockpro-inv-dashboard app-page-canvas -mx-4 -mt-4 min-h-full px-4 pb-12 pt-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 lg:text-[1.65rem]">
            Inventory Dashboard
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Real-time overview of your inventory and operations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker
            start={rangeStart}
            end={rangeEnd}
            onChange={(s, e) => {
              setRangeStart(s);

              setRangeEnd(e);
            }}
          />

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            onClick={() => {
              /* placeholder for widget layout prefs */
            }}
          >
            <Settings2 className="h-4 w-4 text-slate-500" aria-hidden />
            Customize
          </button>
        </div>
      </header>

      {dashboardQ.isError && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950"
        >
          <p className="font-semibold">Dashboard summary API unavailable</p>
          <p className="mt-1 text-amber-900/90">{apiErrorDetail(dashboardQ.error)}</p>
          <p className="mt-2 text-xs text-amber-800/90">
            Showing estimates from valuation and reports below. Restart the API after applying{" "}
            <span className="font-mono">db/migrations/016</span>–
            <span className="font-mono">019</span>, then sign out and back in if permissions changed.
          </p>
        </div>
      )}

      <section
        aria-label="Inventory KPIs"
        className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"
      >
        <StockProKpi
          title="Total Products"
          value={stats ? stats.totalProducts.toLocaleString() : "—"}
          icon={Boxes}
          iconBg="bg-blue-50 text-blue-600"
        />

        <StockProKpi
          title="In Stock"
          value={stats ? inStockSkus.toLocaleString() : "—"}
          subtitle={pctOfVariants(inStockSkus)}
          subtitleTone="muted"
          icon={Warehouse}
          iconBg="bg-emerald-50 text-emerald-600"
        />

        <StockProKpi
          title="Low Stock"
          value={stats ? stats.lowStockSkuCount.toLocaleString() : "—"}
          subtitle={stats ? pctOfVariants(stats.lowStockSkuCount) : "—"}
          subtitleTone="warning"
          icon={AlertTriangle}
          iconBg="bg-amber-50 text-amber-600"
        />

        <StockProKpi
          title="Serialized Items"
          value={stats ? stats.activeSerialsCount.toLocaleString() : "—"}
          subtitle={stats ? pctOfVariants(stats.activeSerialsCount) : "—"}
          subtitleTone="muted"
          icon={Barcode}
          iconBg="bg-violet-50 text-violet-600"
        />

        <StockProKpi
          title="Warehouses"
          value={stats ? String(stats.totalWarehouses) : "—"}
          subtitle="Active locations"
          subtitleTone="muted"
          icon={Building2}
          iconBg="bg-sky-50 text-sky-600"
        />

        <StockProKpi
          title="Today Sales"
          value={fmtInr(todaySales)}
          trend={salesTrend}
          trendSuffix="vs yesterday"
          icon={CircleDollarSign}
          iconBg="bg-emerald-50 text-emerald-600"
        />

        <StockProKpi
          title="Gross Profit"
          value={fmtInr(grossProfitToday)}
          trend={profitTrend}
          trendSuffix="vs yesterday"
          icon={BarChart3}
          iconBg="bg-violet-50 text-violet-600"
        />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <LightCard>
          <CardHeader
            title="Stock Movement (Last 7 Days)"
            action={
              <select
                value={chartGranularity}
                onChange={(e) =>
                  setChartGranularity(e.target.value as "Daily" | "Weekly")
                }
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600"
                aria-label="Chart granularity"
              >
                <option value="Daily">Daily</option>

                <option value="Weekly">Weekly</option>
              </select>
            }
            linkTo="/inventory/ledger"
            linkLabel="View ledger"
          />

          <LineChart
            theme="light"
            xLabels={dates.map((day) => day.label)}
            series={[
              {
                name: "Stock In",
                color: "#22c55e",
                values: stockMovement.map((m) => m.in),
              },

              {
                name: "Stock Out",
                color: "#3b82f6",
                values: stockMovement.map((m) => m.out),
              },
            ]}
            height={220}
          />
        </LightCard>

        <LightCard>
          <CardHeader
            title="Inventory by Category"
            linkTo="/inventory/reports/stock-summary"
            linkLabel="All categories"
          />

          <DonutChart
            theme="light"
            slices={inventoryByCategory}
            centerTitle="Total"
            centerValue={totalProductLabel}
            size={168}
            thickness={32}
          />
        </LightCard>

        <LightCard>
          <CardHeader
            title="Low Stock Alerts"
            linkTo="/inventory/reports/low-stock-expiry"
            linkLabel="View all"
          />

          <ul className="space-y-2">
            {lowStockTop.length === 0 && (
              <li className="text-sm text-slate-500">
                Nothing below reorder threshold.
              </li>
            )}

            {lowStockTop.map((row) => (
              <li
                key={`${row.productVariantId}-${row.warehouseId ?? "all"}`}
                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
              >
                <ProductThumb label={row.productName} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {row.productName}
                  </p>

                  <p className="text-xs text-slate-500">
                    SKU: {row.sku ?? "—"}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p
                    className={`text-sm font-bold tabular-nums ${
                      row.severity === "OutOfStock"
                        ? "text-rose-600"
                        : "text-amber-600"
                    }`}
                  >
                    {fmtQty(row.availableQty)} units
                  </p>

                  <p className="text-xs text-slate-500">
                    {row.lowStockThreshold != null
                      ? `Min: ${fmtQty(row.lowStockThreshold)}`
                      : "No min"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </LightCard>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <LightCard className="overflow-hidden xl:col-span-2">
          <CardHeader
            title="Recent Inventory Transactions"
            linkTo="/inventory/ledger"
            linkLabel="View all"
          />

          <div className="overflow-x-auto -mx-1">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2.5">Date</th>

                  <th className="px-3 py-2.5">Type</th>

                  <th className="px-3 py-2.5">Reference</th>

                  <th className="px-3 py-2.5">Product</th>

                  <th className="px-3 py-2.5">Warehouse</th>

                  <th className="px-3 py-2.5 text-right">Qty</th>

                  <th className="px-3 py-2.5">User</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {recentTx.map((r) => (
                  <tr
                    key={r.inventoryTransactionId}
                    className="hover:bg-slate-50/80"
                  >
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                      {fmtDate(r.createdUtc)}
                    </td>

                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${stockProTxBadge(r.transactionType)}`}
                      >
                        {stockProTxLabel(r.transactionType)}
                      </span>
                    </td>

                    <td className="px-3 py-2.5">
                      <Link
                        to="/inventory/ledger"
                        className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        {txReference(r)}
                      </Link>
                    </td>

                    <td className="max-w-[140px] truncate px-3 py-2.5 font-medium text-slate-800">
                      {r.variantDisplay}
                    </td>

                    <td className="px-3 py-2.5 text-slate-600">
                      {r.warehouseName}
                    </td>

                    <td
                      className={`px-3 py-2.5 text-right font-mono text-sm font-semibold tabular-nums ${
                        r.qtyChange >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {fmtSignedQty(r.qtyChange)}
                    </td>

                    <td className="px-3 py-2.5 text-slate-600">
                      {r.createdBy ?? "System"}
                    </td>
                  </tr>
                ))}

                {recentTx.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-10 text-center text-slate-500"
                    >
                      No ledger movement in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </LightCard>

        <LightCard>
          <CardHeader
            title="Top Selling Products"
            linkTo="/inventory/reports/item-profit"
            linkLabel="View all"
          />

          {topSellers.length === 0 ? (
            <p className="text-sm text-slate-500">
              No sales in the selected period.
            </p>
          ) : (
            <ul className="space-y-4">
              {topSellers.map((s) => (
                <li key={s.name} className="flex items-center gap-3">
                  <ProductThumb label={s.name} size="sm" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {s.name}
                      </p>

                      <span className="shrink-0 text-sm font-bold tabular-nums text-slate-700">
                        {fmtQty(s.value)} units
                      </span>
                    </div>

                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{
                          width: `${Math.max(8, (s.value / (topSellers[0]?.value || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </LightCard>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <LightCard>
          <CardHeader
            title="Serialized Phones Overview"
            linkTo="/inventory/serials"
            linkLabel="View all"
          />

          <div className="grid grid-cols-2 gap-3">
            <MiniStat
              label="Total"
              value={stats?.activeSerialsCount.toLocaleString() ?? "—"}
            />

            <MiniStat
              label="Active"
              value={stats ? fmtQty(stats.totalAvailableQty) : "—"}
            />

            <MiniStat label="Sold This Month" value={fmtQty(soldThisMonth)} />

            <MiniStat
              label="Reserved"
              value={stats ? fmtQty(stats.totalReservedQty) : "—"}
            />
          </div>
        </LightCard>

        <LightCard>
          <CardHeader
            title="Batch / Expiry Alerts"
            linkTo="/inventory/reports/expiry-fefo"
            linkLabel="View all"
          />

          <ul className="space-y-2">
            <ExpiryRow
              label="Expiring in 30 days"
              value={stats?.nearExpiryBatchCount ?? 0}
              tone="amber"
            />

            <ExpiryRow
              label="Expiring in 60 days"
              value={expiring60}
              tone="yellow"
            />

            <ExpiryRow
              label="Expired"
              value={stats?.expiredBatchCount ?? 0}
              tone="rose"
            />
          </ul>
        </LightCard>

        <LightCard>
          <CardHeader
            title="Warehouse Balances"
            linkTo="/inventory/warehouses"
            linkLabel="All warehouses"
          />

          <div className="-mx-1 flex gap-3 overflow-x-auto pb-1">
            {(stats?.warehouseTiles ?? []).slice(0, 8).map((w, idx) => (
              <WarehouseBalanceCard
                key={w.warehouseId}
                name={w.name}
                onHand={w.onHandQty}
                tone={idx % 4}
              />
            ))}

            {(stats?.warehouseTiles ?? []).length === 0 && (
              <p className="text-sm text-slate-500">
                No warehouses configured.
              </p>
            )}
          </div>
        </LightCard>
      </section>
    </div>
  );
}

function LightCard({
  children,

  className = "",
}: {
  children: ReactNode;

  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ${className}`}
    >
      {children}
    </div>
  );
}

function CardHeader({
  title,

  action,

  linkTo,

  linkLabel,
}: {
  title: string;

  action?: ReactNode;

  linkTo?: string;

  linkLabel?: string;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <h2 className="text-sm font-bold text-slate-800">{title}</h2>

      <div className="flex shrink-0 items-center gap-2">
        {action}

        {linkTo && linkLabel && (
          <Link
            to={linkTo}
            className="inline-flex items-center gap-0.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            {linkLabel}

            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}

function StockProKpi({
  title,

  value,

  subtitle,

  subtitleTone = "muted",

  trend,

  trendSuffix,

  icon: Icon,

  iconBg,
}: {
  title: string;

  value: string;

  subtitle?: string;

  subtitleTone?: "muted" | "warning";

  trend?: number | null;

  trendSuffix?: string;

  icon: ComponentType<{ className?: string }>;

  iconBg: string;
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{title}</p>

          <p className="mt-1 truncate text-xl font-bold tracking-tight text-slate-900">
            {value}
          </p>

          {trend != null && trendSuffix && (
            <p className="mt-1 flex items-center gap-1 text-xs">
              {trend >= 0 ? (
                <TrendingUp
                  className="h-3.5 w-3.5 text-emerald-500"
                  aria-hidden
                />
              ) : (
                <TrendingDown
                  className="h-3.5 w-3.5 text-rose-500"
                  aria-hidden
                />
              )}

              <span
                className={
                  trend >= 0
                    ? "font-semibold text-emerald-600"
                    : "font-semibold text-rose-600"
                }
              >
                {trend >= 0 ? "+" : ""}
                {trend.toFixed(1)}%
              </span>

              <span className="text-slate-500">{trendSuffix}</span>
            </p>
          )}

          {subtitle && trend == null && (
            <p
              className={`mt-1 text-xs ${
                subtitleTone === "warning"
                  ? "font-medium text-amber-600"
                  : "text-slate-500"
              }`}
            >
              {subtitle}
            </p>
          )}
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </div>
    </div>
  );
}

function ProductThumb({
  label,
  size = "md",
}: {
  label: string;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-9 w-9" : "h-11 w-11";

  const initial = (label.trim()[0] ?? "?").toUpperCase();

  return (
    <div
      className={`${dim} flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-bold text-slate-600 ring-1 ring-slate-200/80`}
      aria-hidden
    >
      {initial.length === 1 && /[A-Z0-9]/.test(initial) ? (
        initial
      ) : (
        <Package className="h-4 w-4 text-slate-500" />
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/90 px-3 py-2.5 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">
        {value}
      </p>
    </div>
  );
}

function ExpiryRow({
  label,

  value,

  tone,
}: {
  label: string;

  value: number;

  tone: "amber" | "yellow" | "rose";
}) {
  const colors = {
    amber: "text-amber-700 bg-amber-50",

    yellow: "text-yellow-800 bg-yellow-50",

    rose: "text-rose-700 bg-rose-50",
  }[tone];

  return (
    <li
      className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${colors}`}
    >
      <span className="text-sm font-medium">{label}</span>

      <span className="text-lg font-bold tabular-nums">
        {value.toLocaleString()}
      </span>
    </li>
  );
}

const WH_GRADIENTS = [
  "from-blue-500 to-blue-600",

  "from-emerald-500 to-emerald-600",

  "from-violet-500 to-violet-600",

  "from-amber-500 to-amber-600",
];

function WarehouseBalanceCard({
  name,

  onHand,

  tone,
}: {
  name: string;

  onHand: number;

  tone: number;
}) {
  return (
    <div
      className={`min-w-[148px] shrink-0 rounded-xl bg-gradient-to-br ${WH_GRADIENTS[tone % WH_GRADIENTS.length]} px-4 py-3 text-white shadow-md`}
    >
      <p className="truncate text-xs font-medium text-white/90">{name}</p>

      <p className="mt-1 text-2xl font-bold tabular-nums">{fmtQty(onHand)}</p>

      <p className="text-[11px] text-white/75">on hand</p>
    </div>
  );
}

function DateRangePicker({
  start,

  end,

  onChange,
}: {
  start: Date;

  end: Date;

  onChange: (start: Date, end: Date) => void;
}) {
  const [open, setOpen] = useState(false);

  const startStr = start.toISOString().slice(0, 10);

  const endStr = end.toISOString().slice(0, 10);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        <Calendar className="h-4 w-4 text-slate-500" aria-hidden />

        {fmtRangeLabel(start, end)}

        <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
          <label className="block text-xs font-semibold text-slate-600">
            From
            <input
              type="date"
              value={startStr}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              onChange={(e) => {
                const d = new Date(e.target.value);

                if (!Number.isNaN(d.getTime()))
                  onChange(startOfDay(d), end < d ? startOfDay(d) : end);
              }}
            />
          </label>

          <label className="mt-3 block text-xs font-semibold text-slate-600">
            To
            <input
              type="date"
              value={endStr}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              onChange={(e) => {
                const d = new Date(e.target.value);

                if (!Number.isNaN(d.getTime()))
                  onChange(start > d ? startOfDay(d) : start, startOfDay(d));
              }}
            />
          </label>

          <button
            type="button"
            className="mt-3 w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            onClick={() => setOpen(false)}
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
