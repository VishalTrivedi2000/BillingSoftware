# Universal Product & Inventory Management — Implementation Plan (BS-native)

> Anchored to `Production_Ready_Universal_Product_Inventory_System_REAL_WORLD_UPDATED.docx` and the
> 33 reference screens in `docs/inventory-pics/`. **Reference only — do not clone screens.** All flows
> are re-imagined in BS visual language (dark `#070a12` shell, `workspace-panel`, blue/indigo accents)
> and aligned with the locked CORE rounding/permission rules.

---

## 0. Guiding rules (non-negotiable)

1. **Stock movement is a ledger.** Every increase/decrease is one append-only `InventoryTransaction`
   row with `IdempotencyKey`, `SourceDocumentType/Id`, `TenantId/OrganizationId/WarehouseId/VariantId`.
   `InventoryBalance` is a *derived snapshot* rebuildable from the ledger.
2. **Universal `dbo.Products` stays.** New universal columns are *additive*. Category-specific
   attributes (RAM, Color, Size, Fabric, Voltage…) live in `ProductCustomField*`, never as columns.
3. **Every stock-tracked product resolves to a `ProductVariant`.** Simple products get one implicit
   default variant. SKU/barcode unique per (tenant, org).
4. **Concurrency:** stock mutation locks the `InventoryBalance` row (`UPDLOCK, HOLDLOCK`) inside the
   same DB transaction as the ledger insert.
5. **Idempotency:** unique index on `(TenantId, OrganizationId, IdempotencyKey)` where not null;
   business workflows (purchase post, invoice post, transfer in/out, adjustment approve) generate a
   deterministic key so retries never double-post.
6. **No hard deletes** on Product / Variant / Warehouse / Batch / Ledger.
7. **Backward compatibility window:** legacy `dbo.Products.StockQty` is *dual-written* during shadow
   mode; existing PurchaseRepository bump path keeps working while ledger becomes the truth.
8. **Tenant + organization scoping** on every query.

## 1. Screen → BS route map

| Screen (ref no.) | BS route | Implementation |
|---|---|---|
| `1.png` Dashboard | `/inventory` | `InventoryDashboardPage` — KPIs, recent ledger, low stock & expiry alerts, warehouse balances |
| `2.png` Products | `/products` (existing) | Extend filters: type/status/warehouse; show variants & tracking-mode pill |
| `3.png` Create product | `/products` (modal/inline) | Sectioned form: Basic / Category / Pricing / Variants / Inventory rules / Custom fields / Images |
| `4.png` Product detail | `/products/:id` (new) | Tabs: Overview · Variants · Serials/IMEI · Purchases · Sales · Activity |
| `5.png` Inventory ledger | `/inventory/ledger` | `InventoryLedgerPage` — every transaction, filters, totals strip |
| `6.png` Profitability report | `/reports/profitability` | `ItemProfitReportPage` (per-line cost + sale + margin) |
| `7.png` Create PO | reuses existing `/purchases/new` composer | adds Warehouse & receiving-rules fields (additive) |
| `8.png` Purchases list | `/purchases` (existing) | adds Quick-Receive panel + KPIs |
| `9.png` Create invoice | `/invoices/new` (existing) | adds Serial/IMEI & Batch selectors for tracked items |
| `10.png` Sales list | existing | + KPI strip + delivery state |
| `11.png` Warehouses | `/warehouses` | `WarehousesPage` — list, zones/bins (in-doc only initially) |
| `12.png` Variants | `/variants` | `VariantsPage` — variant matrix per product, generation rules |
| `13.png` Returns hub | `/returns` | `ReturnsHubPage` — customer/supplier returns, workflow timeline |
| `14.png` Business partners | merges with existing `/parties` | adds supplier balance KPIs |
| `15-19.png` Reports | `/reports/*` | new pages under existing `ReportsLayout` |
| `20-21.png` Modals | shared | `SerialPickerModal`, `BatchPickerModal`, `ScheduleReportModal` |
| `22.png` Receive GRN | `/purchases/:id/receive` | drawer modal off purchase detail |
| `23.png` Quick transfer | `/inventory/transfers/new` (modal/page) | `StockTransferPage` |
| `24.png` Sales return | `/returns/sale/new` | wizard with credit-note output |
| `25.png` New stock transfer | `/inventory/transfers/new` | same page (full) |
| `26.png` Stock adjustment | `/inventory/adjustments/new` | `StockAdjustmentPage` |
| `27.png` Purchase return | `/returns/purchase/new` | wizard with debit-note output |
| `28.png` Create reservation | `/inventory/reservations/new` | `ReservationCreatePage` |
| `29.png` Stock summary | `/reports/stock-summary` | `StockSummaryReportPage` |
| `30.png` Expiry/FEFO | `/reports/expiry-fefo` | `ExpiryFefoReportPage` |
| `31-32.png` Confirm/alert | global | small reusable confirm + alert components |
| `33.png` Batch picker | shared | `BatchPickerModal` |

## 2. Database (MS SQL Server) — additive migrations

### `016_universal_inventory_foundation.sql`
- `dbo.Warehouses` (universal site model, tenant+org-scoped, types: Store / Online / Return / Damage / Transit)
- `dbo.WarehouseLocations` (optional zones/bins)
- `dbo.InventoryUnits` (universal unit registry; piece/kg/gram/box/litre/metre/custom)
- `dbo.InventoryUnitConversions` (`from_unit → to_unit @ factor`)
- `dbo.ProductVariants` (SKU, Barcode, Status, attribute hashes, pricing overrides, tracking-mode resolution at variant level)
- `dbo.ProductVariantAttributes` (KV pairs: Color=Black, Size=M)
- `dbo.ProductCustomFieldDefinitions` (per tenant/category; field key/type/section/validation JSON)
- `dbo.ProductCustomFieldValues` (per product or variant)
- `dbo.SearchFacets` (normalized `(FieldKey, NormalizedValue)` for fast filters)
- `dbo.Batches` (lot # / mfg / exp / quality status / cost layer)
- `dbo.ProductSerials` (IMEI/serial unit-level identity + warranty + status)
- `dbo.InventoryTransactions` (append-only ledger — full row schema from table 12 of doc)
- `dbo.InventoryBalances` (snapshot — unique per Variant+Warehouse+Batch)
- `dbo.InventoryReservations` (Reserve→Release→Commit lifecycle)
- `dbo.AuditLog` (entity, action, oldJson/newJson, reason, correlationId)
- `dbo.OutboxEvents` (reliable integration events)
- Extra columns on `dbo.Products`: `ProductNature`, `InventoryTrackingMode`, `HasVariants`, `DefaultVariantId`, `IsSellable`, `IsPurchasable`, `BaseUnitId` (FK to InventoryUnits), `ValuationMode`, `Status`.

### `017_universal_inventory_backfill.sql`
- For every active organization, insert one default `Main Warehouse` (id captured).
- For every existing product missing a default variant: create one default variant with the
  same SKU; set `Products.DefaultVariantId` and `Products.HasVariants = 0`.
- Seed an opening `InventoryTransactions` row per product with current `StockQty` and
  `TransactionType='OPENING_BALANCE'`, then upsert `InventoryBalances`.

### `018_universal_inventory_extras.sql`
- `dbo.ReturnAuthorizations` + `dbo.ReturnLines` (customer + supplier returns; inspection result)
- `dbo.StockCountSessions` + `dbo.StockCountLines` (physical count with approval)
- `dbo.InventoryAdjustmentApprovals` (approval workflow)
- `dbo.ProductBundleComponents` (kit/BOM)
- `dbo.SalesInvoiceLineSerials` (exact unit sold per invoice line)
- `dbo.SalesInvoiceLineCostAllocations` (FIFO/FEFO/avg cost split per sale line)
- `dbo.InventoryCostLayers` (purchase lots for FIFO/avg)
- `dbo.LicenseKeys` (digital products — optional, phase 2)

## 3. Backend layout

```
src/BillingApp.Application/
  Abstractions/Inventory/
    IWarehouseRepository.cs
    IInventoryUnitRepository.cs
    IProductVariantRepository.cs
    IInventoryRepository.cs           // ledger + balance
    IInventoryReservationRepository.cs
    IBatchRepository.cs
    IProductSerialRepository.cs
    IInventoryReportRepository.cs
    IInventoryAdjustmentRepository.cs
    IStockTransferRepository.cs
    IReturnRepository.cs
  Inventory/
    InventoryContracts.cs             // all DTOs + request records

src/BillingApp.Infrastructure/Billing/
  WarehouseRepository.cs
  InventoryUnitRepository.cs
  ProductVariantRepository.cs
  InventoryLedgerRepository.cs        // append-only writes + idempotent + balance update
  InventoryReservationRepository.cs
  BatchRepository.cs
  ProductSerialRepository.cs
  InventoryReportRepository.cs
  InventoryAdjustmentRepository.cs
  StockTransferRepository.cs
  ReturnRepository.cs

src/BillingApp.Api/Controllers/V1/
  WarehousesController.cs
  ProductVariantsController.cs
  InventoryController.cs              // /inventory/transactions, /balance, /adjustments, /reservations
  InventoryTransfersController.cs
  BatchesController.cs
  SerialsController.cs
  ReturnsController.cs
  InventoryReportsController.cs
```

### New permissions
`inventory.view`, `inventory.adjust`, `inventory.transfer`, `inventory.reserve`,
`inventory.return`, `warehouses.read`, `warehouses.manage`, `variants.manage`,
`reports.inventory`, `reports.profitability`.

## 4. Frontend layout (web/src/features)

```
inventory/
  InventoryDashboardPage.tsx
  InventoryLedgerPage.tsx
  StockAdjustmentPage.tsx
  StockTransferPage.tsx
  ReservationsPage.tsx
  ReservationCreatePage.tsx
  ReturnsHubPage.tsx
  inventoryApi.ts
  components/
    KpiTiles.tsx
    LedgerFilters.tsx
    BatchPickerModal.tsx
    SerialPickerModal.tsx
warehouses/
  WarehousesPage.tsx
variants/
  VariantsPage.tsx
reports/
  StockSummaryReportPage.tsx
  StockValuationReportPage.tsx
  ExpiryFefoReportPage.tsx
  LowStockReportPage.tsx
  SerialTraceReportPage.tsx
  ItemProfitReportPage.tsx
entities/
  inventory.ts                         // shared TS types
```

## 5. Delivery phases

| Phase | Scope | Status |
|---|---|---|
| **F0 — Plan** | This doc | DONE |
| **F1 — Schema + ledger core** | mig 016/017/018, repos + DI, idempotent ledger posts, balance lock, default warehouse + default variant backfill | **THIS DELIVERY** |
| **F2 — Catalog/variant API** | Variants CRUD, custom fields registry, dynamic form template endpoint, search facets | **THIS DELIVERY** (catalogue read + write CRUD; dynamic-form endpoint stubbed) |
| **F3 — Inventory operations API** | adjustments, transfers, reservations, batches, serials, returns | **THIS DELIVERY** |
| **F4 — Web pages** | dashboard, ledger, warehouses, variants, adjustment, transfer, reservation, returns | **THIS DELIVERY** |
| **F5 — Reports** | stock-summary, valuation, expiry/FEFO, low-stock, serial-trace, item-profit | **THIS DELIVERY** (server endpoints + UI pages) |
| **F6 — Cutover** | Dual-write StockQty → ledger, reconciliation job, feature flag for retiring StockQty | NEXT |
| **F7 — BOM/Kits + digital + manufacturing** | bundle component explosion, license keys, work orders | NEXT |

## 6. Integration rules

- The **existing purchase post path** (`PurchaseRepository.PostDraftAsync`) keeps bumping
  `Products.StockQty`. In F1 we **also** insert one `InventoryTransactions` row per posted line
  (`SourceDocumentType='PurchaseBill'`, `IdempotencyKey="PUR:{billId}:{lineId}:RECEIPT"`).
  This is invisible to existing UI but means the ledger reconciles from day one.
- Invoice posting will get the same dual-write in F6. Until then, the ledger is the source of
  truth for *adjustments / transfers / reservations / returns / opening balances*, and the
  existing invoice path remains untouched to keep CORE rounding behaviour locked.
- Web pages query *the new endpoints*; existing report pages (`SaleInvoicesReportPage`,
  `PurchaseBillsReportPage`) are unchanged.

## 7. Open items / phase-next

- Frontend dynamic-form renderer (driven by `/products/{id}/dynamic-form` endpoint)
- Outbox publisher background worker
- Reconciliation job (`LedgerBalanceReconciliation`)
- ROWVERSION concurrency tokens — optional; current solution uses `UPDLOCK,HOLDLOCK`
- Approval workflow UI for high-risk adjustments (records persisted now; UI is phase F6)
- Multi-bin picking optimisation
- Manufacturing work-orders (phase F7)
