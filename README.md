Production-Ready Universal Product & Inventory Management System
Full Architecture, Database, API, UI, Inventory Ledger, Warehouse, Variant, Batch, Security and Rollout Specification


Item	Value
Generated	2026-05-12
Database	Microsoft SQL Server
Backend	ASP.NET Core Web API + Dapper
Frontend	React dynamic catalog + inventory operations
Scope	Universal products: electronics, grocery, apparel, furniture, medicine-like batch goods, raw materials, digital/service catalog items
Strategy	Extend existing Billing catalog without big-bang rewrite


Executive decision: The system will treat inventory as a financial-grade ledger. Product data can be flexible and metadata-driven, but stock movement must be strict, auditable, idempotent, and transaction-safe.
 
Table of Contents
1.	1. Executive Summary
2.	2. Product Coverage and Business Scope
3.	3. Core Design Principles
4.	4. High-Level System Architecture
5.	5. Domain Modules
6.	6. Product Catalog Model
7.	7. Variant Management
8.	8. Dynamic Metadata and Universal Forms
9.	9. Warehouse, Location and Bin Model
10.	10. Inventory Ledger Architecture
11.	11. Inventory Balance, Reservation and Availability
12.	12. Batch, Lot, Serial Number and Expiry Handling
13.	13. Units of Measure and Conversion Rules
14.	14. Pricing, Tax and Commercial Rules
15.	15. Database Schema Blueprint for SQL Server
16.	16. API Surface and Contracts
17.	17. UI/UX Application Flow
18.	18. Search, Facets and Reporting
19.	19. Security, RBAC and Tenant Isolation
20.	20. Audit, Compliance and Operational Controls
21.	21. Background Jobs and Reconciliation
22.	22. Performance, Scale and Indexing
23.	23. Integration and Eventing
24.	24. Migration from Existing Billing System
25.	25. Testing Strategy
26.	26. Deployment and Observability
27.	27. Risk Register and Mitigation
28.	28. Implementation Roadmap
29.	29. Final Production Checklist
 
30. Real-World Inventory Problems and Production Handling
31. Serialized Inventory / IMEI Tracking
32. Item-wise Profitability and Costing Engine
33. Product-Type Handling Matrix
34. Complete Stock Lifecycle States
35. Returns, Exchange, Warranty and After-Sales Handling
36. Reservation, Allocation and Overselling Protection
37. Additional SQL Server Schema Required for Real-World Coverage
38. Reports Required for Production Inventory
39. Non-Negotiable Implementation Rules
40. Real-World Readiness Checklist
1. Executive Summary
This document defines a production-ready universal product and inventory management system that can manage all major product types without creating separate product tables for every industry. The system extends an existing billing catalog while introducing a proper product master, variant engine, dynamic metadata, multi-warehouse inventory, batch and serial handling, reservation lifecycle, and an append-only inventory ledger.
The most important rule is simple: product information may be flexible, but stock movement must be strict. Every increase or decrease in stock must be represented by a ledger transaction that is idempotent, auditable, linked to a source document, tenant-scoped, and protected against concurrency bugs.
Production goal: The platform should work for retail, wholesale, ecommerce, distribution, manufacturing support, service catalogs, and multi-location businesses using the same core architecture.
1.1 Key outcomes
•	Universal catalog that supports simple products, configurable products, variants, bundles, kits, digital items, service items, raw materials and batch/expiry products.
•	Inventory ledger that records purchase, sale, return, transfer, damage, adjustment, reservation, release and stock-count movements.
•	Multi-tenant, multi-organization and warehouse-scoped security.
•	Dynamic field engine so categories can have custom attributes without adding fixed columns such as RAM, Size, Color or Organic to dbo.Products.
•	Backward-compatible migration from the existing Billing product table and StockQty column.
2. Product Coverage and Business Scope
Product Type	Examples	How the system manages it
Simple stock product	Notebook, chair, USB cable	One product with one default variant and inventory at warehouse level.
Variant product	T-shirt size/color, phone RAM/storage	Product master plus multiple ProductVariant rows and variant attributes.
Batch/expiry product	Milk, medicine-like goods, packaged food	Inventory tracked by Variant + Warehouse + Batch/Lot + ExpiryDate.
Serial-number product	Laptop, mobile phone, appliance	Stock unit tracked using SerialNumber records linked to variant and warehouse.
Weighted product	Rice, flour, fabric roll	Uses base unit with decimal quantity and conversion rules.
Bundle/kit	Computer set, grocery combo	Parent sellable SKU consumes child SKUs through BOM/kit component rules.
Service item	Installation, repair, consulting	No physical stock; can be invoiced but does not create inventory movement.
Digital product	License key, download product	No warehouse stock unless license keys are tracked as serial-like inventory.
Raw material	Wood, screw, fabric, chemical input	Inventory tracked and consumed through adjustment or production issue flow.
Asset/non-sellable item	Office equipment	Cataloged separately or flagged as non-sellable/non-stock item.
2.1 Universal product classification
Classification Field	Allowed Meaning
ProductNature	Physical, Service, Digital, Bundle, RawMaterial, Asset
InventoryTrackingMode	None, Quantity, Batch, Serial, BatchAndSerial
VariantMode	Single, VariantEnabled, Configurable
ValuationMode	None, WeightedAverage, FIFO, StandardCost
ShelfLifeMode	None, ExpiryRequired, ManufacturingDateRequired
SalesMode	Sellable, PurchasableOnly, InternalUseOnly
3. Core Design Principles
30.	Extend existing catalog; do not replace working billing features in a risky big-bang rewrite.
31.	Keep dbo.Products universal. Do not add category-specific columns such as RAM, Color, Size, Organic, Fabric or ExpiryRule directly on Products.
32.	Use ProductVariant as the sellable stock unit. Even simple products get one implicit default variant after migration.
33.	InventoryTransaction is the source of truth. InventoryBalance is a derived snapshot/cache for fast reads.
34.	Every stock movement must have a source document reference and an idempotency key.
35.	All writes must be tenant-scoped and organization-scoped.
36.	Never hard-delete products, variants, warehouses, batches or ledger entries.
37.	Dynamic forms are rendered from metadata but validated on the server.
38.	Reservation and availability are separate from physical on-hand stock.
39.	Reconciliation jobs must prove that balance equals ledger before StockQty is retired.
4. High-Level System Architecture
The system is designed as a modular monolith first. This keeps development fast and consistent while maintaining clean boundaries that can later be extracted into services if scale requires it.
React Web UI
   |-- Product Wizard / Dynamic Forms
   |-- Variant Manager
   |-- Inventory Operations
   |-- Warehouse / Batch / Serial Screens
   |-- Reports and Search
        |
ASP.NET Core Web API
   |-- Catalog Module
   |-- Inventory Module
   |-- Pricing and Tax Module
   |-- Reporting Module
   |-- Security and Audit Module
        |
Dapper Repositories + SQL Server
   |-- Products / Variants / Metadata
   |-- Warehouses / Batches / Serials
   |-- InventoryTransaction Ledger
   |-- InventoryBalance Snapshot
   |-- Outbox Events / Audit Logs
4.1 Recommended deployment topology
Layer	Production recommendation
Frontend	React app served through CDN or secure web host.
API	ASP.NET Core Web API behind HTTPS load balancer.
Database	Microsoft SQL Server with automated backups, point-in-time restore and index maintenance.
Cache	Optional Redis for catalog lookups and sessions; never source of truth for stock.
Queue/Jobs	Hangfire, Quartz.NET, Azure WebJobs or hosted background service for reconciliation and outbox processing.
Storage	Object storage for product images and documents; database stores metadata and URLs.
Monitoring	Structured logs, metrics, tracing, DB error alerts and stock anomaly alerts.
5. Domain Modules
Module	Responsibilities
Catalog	Products, categories, brands, units, product media, documents, metadata definitions, custom field values.
Variant	Variant axes, variant generation, variant-specific SKU, barcode, price, images, weight and dimensions.
Inventory	Warehouses, locations, balances, ledger transactions, stock adjustments, transfers, reservations.
Batch & Serial	Lot creation, expiry, FEFO/FIFO picking, serial allocation, warranty tracking.
Commercial	Price lists, tax groups, discounts, margin rules and customer/vendor item mappings.
Search & Reporting	Faceted search, stock ledger report, valuation report, low-stock report, expiry report.
Security	Tenant isolation, organization scoping, RBAC, policy checks and warehouse permissions.
Audit & Compliance	Audit logs, immutable ledger, reconciliation reports, approval workflows for adjustments.
Integration	Outbox events, import/export, ecommerce/POS/accounting sync.
6. Product Catalog Model
The product master stores stable, cross-industry fields only. Attributes that vary by business category are stored using metadata definitions and values.
6.1 Core product fields
Field	Purpose
ProductId	Internal unique identifier.
TenantId / OrganizationId	Isolation and workplace scoping.
CategoryId / BrandId / UnitId	Existing catalog relationships.
Name / SKU / Barcode	Standard identification fields.
ProductNature	Physical, Service, Digital, Bundle, RawMaterial or Asset.
HasVariants	Whether variants are enabled.
DefaultVariantId	Used for simple products and backward compatibility.
InventoryTrackingMode	None, Quantity, Batch, Serial or BatchAndSerial.
IsSellable / IsPurchasable	Controls sales/purchase flow.
TaxGroupId	Tax calculation reference.
Status	Draft, Active, Archived, Discontinued.
IsActive / DeletedUtc / DeletedBy	Soft delete support.
6.2 Forbidden product columns
The following must not be added as dedicated columns to dbo.Products because they are category-specific attributes:
•	RAM
•	Storage
•	Color
•	Size
•	Organic
•	Fabric
•	ScreenSize
•	WoodType
•	ExpiryType
•	SpiceLevel
•	Voltage
•	WarrantyMonths as a category-specific attribute unless made universal by business decision
7. Variant Management
A variant is the exact sellable and stock-tracked form of a product. For example, a shirt product may have variants like Red-M, Red-L, Blue-M and Blue-L. A phone may have variants like 8GB RAM / 128GB Storage / Black.
7.1 Variant rules
•	Every physical stock product must resolve to a VariantId before inventory movement.
•	Simple products automatically receive one default variant.
•	Variant SKU and barcode must be unique per tenant/organization.
•	Variant attributes are key/value pairs such as Color=Black and Size=M.
•	Variant generation must support selective combinations, not only full Cartesian generation.
•	Variant explosion protection must prevent accidental creation of thousands of unusable SKUs.
7.2 Variant explosion control
Risk	Control
Too many combinations	Preview count before generation and require confirmation above threshold.
Invalid combinations	Allow disabled combinations and selective generation.
Duplicate SKUs	Unique index on TenantId + OrganizationId + SKU.
Operational clutter	Allow archive/discontinue but never hard-delete variants with transactions.
Wrong invoice line	Sales posting must require ProductId + VariantId for variant products.
8. Dynamic Metadata and Universal Forms
Dynamic metadata allows every category to define its own fields without changing database schema. React renders forms from server-provided JSON, while the backend remains responsible for validation and persistence.
8.1 Metadata definition structure
{
  "fieldKey": "ram",
  "label": "RAM",
  "type": "select",
  "required": true,
  "appliesTo": "Variant",
  "sectionName": "Technical Specifications",
  "displayOrder": 10,
  "validation": { "allowedValues": ["4GB", "8GB", "16GB"] },
  "searchable": true,
  "filterable": true
}
8.2 Field types
Field Type	Examples
Text	Model number, fabric name
Number	Warranty months, wattage
Decimal	Weight, length, density
Boolean	Organic, waterproof
Select	RAM, storage, size
Multi-select	Compatible devices
Date	Manufacturing date
File/Image	Certificate, product manual
Rich text	Long description
Measurement	Dimension with unit
8.3 Server-side validation
•	Frontend dynamic forms improve flexibility but must not be trusted.
•	Backend validates required fields, data type, allowed values, min/max and tenant ownership of field definitions.
•	Published field definitions should be locked or versioned to avoid breaking old product records.
•	Searchable fields should be mirrored into a SearchFacet table for performance.
9. Warehouse, Location and Bin Model
The system supports multiple warehouses and optional internal locations/bins. A warehouse may represent a shop, store room, truck, ecommerce fulfillment center or damage location.
Entity	Purpose
Warehouse	Main stock site such as Lucknow Store, Online Warehouse or Supplier Return Area.
WarehouseLocation	Optional zone, rack, shelf or bin inside a warehouse.
InventoryBalance	Fast current quantity by Variant + Warehouse + optional Batch/Serial scope.
TransferOrder	Movement request from one warehouse to another.
StockCount	Physical count session used for adjustment approval.
9.1 Warehouse permissions
•	Users may have access to all warehouses or selected warehouses only.
•	Inventory adjustment should require inventory.adjust permission.
•	Transfer should require inventory.transfer permission at source and destination warehouses.
•	Negative stock permission should be separate and disabled by default.
10. Inventory Ledger Architecture
The inventory ledger is the heart of the system. Every stock movement creates one or more immutable ledger rows. The ledger must be append-only. Correction is done by reversal transactions, not by editing old transactions.
10.1 Ledger transaction types
Type	Quantity Effect	Example
PURCHASE_RECEIPT	Increase	Vendor purchase received.
SALE_ISSUE	Decrease	Invoice posted or item shipped.
SALE_RETURN	Increase	Customer returned item.
PURCHASE_RETURN	Decrease	Goods returned to supplier.
TRANSFER_OUT	Decrease	Stock leaves source warehouse.
TRANSFER_IN	Increase	Stock arrives at destination warehouse.
DAMAGE	Decrease or move bucket	Damaged stock written off.
ADJUSTMENT_POSITIVE	Increase	Physical count found extra stock.
ADJUSTMENT_NEGATIVE	Decrease	Physical count found shortage.
RESERVE	Reserve only	Order reserves stock.
RELEASE_RESERVATION	Release reserve	Order cancelled.
COMMIT_RESERVATION	Decrease available/on hand	Reserved stock shipped.
PRODUCTION_CONSUME	Decrease	Raw material consumed.
PRODUCTION_OUTPUT	Increase	Finished good produced.
10.2 Required ledger fields
Field	Why required
InventoryTransactionId	Primary key.
TenantId / OrganizationId	Security and isolation.
VariantId	Stock-tracked item.
WarehouseId	Stock location.
BatchId / SerialId	Required depending on tracking mode.
QtyChange	Signed quantity change.
QuantityBucket	Available, Reserved, Damaged, Returned, Incoming.
TransactionType	Business reason.
SourceDocumentType	Invoice, Purchase, Transfer, Adjustment, StockCount, Production.
SourceDocumentId / SourceLineId	Reconciliation to business document.
IdempotencyKey	Prevents duplicate posting on retries.
CreatedBy / CreatedUtc	Audit and accountability.
ReversalOfTransactionId	Correction link.
MetadataJson	Safe extension for operational metadata.
10.3 Idempotency rule
Critical production rule: The same business event must never reduce or increase stock twice. Use a unique constraint on TenantId + SourceDocumentType + SourceDocumentId + SourceLineId + TransactionType or a generated IdempotencyKey.
CREATE UNIQUE INDEX UX_InventoryTransaction_Idempotency
ON dbo.InventoryTransaction(TenantId, OrganizationId, IdempotencyKey)
WHERE IdempotencyKey IS NOT NULL;
11. Inventory Balance, Reservation and Availability
InventoryBalance provides fast reads for current stock, but it is not the legal source of truth. It must be rebuildable from InventoryTransaction at any time.
11.1 Availability formula
OnHandQty      = sum(physical ledger movements)
ReservedQty    = sum(open reservations)
DamagedQty     = stock not sellable
AvailableQty   = OnHandQty - ReservedQty - DamagedQty
IncomingQty    = confirmed inbound purchase or transfer not yet received
11.2 Reservation lifecycle
Step	Description
Reserve	Order/cart/invoice draft allocates quantity.
Expire	Reservation is automatically released if not completed before expiry.
Release	User cancels or edits order and stock becomes available again.
Commit	Invoice/shipment posts and reserved quantity becomes actual stock issue.
Backorder	If allowed, order continues without full availability.
Partial commit	Only shipped quantity is committed; remaining reservation remains or releases.
11.3 Concurrency control
Stock mutation must lock or version the balance row so two users cannot sell the same last item at the same time.
-- Pattern: lock the balance row before mutation
SELECT AvailableQty
FROM dbo.InventoryBalance WITH (UPDLOCK, HOLDLOCK)
WHERE TenantId=@TenantId AND VariantId=@VariantId AND WarehouseId=@WarehouseId;

-- Then validate quantity, insert ledger row, update balance in the same DB transaction.
12. Batch, Lot, Serial Number and Expiry Handling
12.1 Batch/Lot model
Batch tracking is required for products where expiry, manufacturing lot, vendor lot, recall or quality status matters.
Field	Purpose
BatchId	Unique batch identity.
VariantId	Product variant linked to the batch.
BatchNo / LotNo	Supplier or internal lot number.
ManufacturingDate	Optional production date.
ExpiryDate	Required for expiry-controlled items.
QualityStatus	Released, Quarantine, Blocked, Recalled.
CostLayerId	Optional valuation link.
12.2 Picking rules
Rule	Use case
FEFO	First expiry first out for grocery/medicine-like goods.
FIFO	First received first out for general stock.
Manual batch selection	Warehouse operator selects exact batch.
Blocked batch exclusion	Do not sell batches in quarantine/blocked status.
Near-expiry alerts	Warn before expiry date threshold.
12.3 Serial number model
Serial tracking is used when each unit has a unique identity, such as mobile phones, laptops and appliances. Serial numbers move with warehouse and status changes.
13. Units of Measure and Conversion Rules
The system must support piece, box, kg, gram, liter, meter and custom business units. All ledger quantities should be stored in a base unit to avoid confusion.
Rule	Recommendation
Precision	Use DECIMAL(18,6) or stricter business precision.
Base unit	Each product has one base inventory unit.
Purchase unit	Can differ from base unit, e.g., 1 box = 12 pieces.
Sales unit	Can differ from base unit, e.g., sell in piece but buy in carton.
Cycle prevention	UnitConversion graph must not allow circular inconsistent conversions.
Rounding	Define rounding mode per unit and transaction type.
14. Pricing, Tax and Commercial Rules
Pricing should remain separate from inventory. Stock movement tells what happened physically; pricing and tax tell what happened commercially.
Feature	Description
Base sale price	Default price on product or variant.
Price list	Customer group, channel or date-based pricing.
Purchase cost	Vendor cost stored from purchase line, not manually trusted from product only.
Tax group	GST/tax mapping separate from product metadata.
Discount rules	Applied in billing module, not inventory ledger.
Margin reports	Calculated from sale price and cost/valuation layers.
15. Database Schema Blueprint for SQL Server
The following tables form the recommended production blueprint. Names can be aligned with existing dbo naming conventions.
Table	Purpose
dbo.Products	Universal product master with existing fields preserved.
dbo.ProductVariant	Sellable and stock-tracked SKU rows.
dbo.ProductVariantAttribute	Variant axis key/value pairs.
dbo.ProductCustomFieldDefinition	Dynamic field definitions per tenant/category.
dbo.ProductCustomFieldValue	Custom values for product or variant.
dbo.SearchFacet	Fast faceted filtering for searchable metadata.
dbo.Warehouse	Stock site.
dbo.WarehouseLocation	Optional bin/rack/shelf.
dbo.Batch	Batch/lot/expiry information.
dbo.SerialNumber	Unit-level tracking.
dbo.InventoryTransaction	Append-only ledger.
dbo.InventoryBalance	Current derived balance snapshot.
dbo.InventoryReservation	Reservation lifecycle tracking.
dbo.UnitConversion	Conversion graph.
dbo.AuditLog	Security and change audit.
dbo.OutboxEvent	Reliable integration event publishing.
dbo.StockCountSession / Lines	Physical stock count workflow.
dbo.ProductDocument	Manuals, certificates, images metadata.
15.1 Critical indexes
-- Product/variant uniqueness
CREATE UNIQUE INDEX UX_ProductVariant_SKU
ON dbo.ProductVariant(TenantId, OrganizationId, SKU)
WHERE SKU IS NOT NULL AND IsDeleted = 0;

-- Fast ledger history
CREATE INDEX IX_InventoryTransaction_VariantWarehouseDate
ON dbo.InventoryTransaction(TenantId, OrganizationId, VariantId, WarehouseId, CreatedUtc DESC);

-- Fast balance lookup
CREATE UNIQUE INDEX UX_InventoryBalance_Scope
ON dbo.InventoryBalance(TenantId, OrganizationId, VariantId, WarehouseId, ISNULL(BatchId,0));

-- Fast metadata search
CREATE INDEX IX_SearchFacet_FieldValue
ON dbo.SearchFacet(TenantId, OrganizationId, FieldKey, NormalizedValue);
15.2 Soft delete and audit columns
•	IsActive
•	IsDeleted
•	DeletedUtc
•	DeletedBy
•	CreatedUtc
•	CreatedBy
•	UpdatedUtc
•	UpdatedBy
•	RowVersion for concurrency-sensitive tables
16. API Surface and Contracts
Area	Endpoint Examples
Catalog	GET /api/v1/products, POST /api/v1/products, PUT /api/v1/products/{id}
Dynamic Form	GET /api/v1/products/dynamic-form-template, GET /api/v1/products/{id}/dynamic-form
Variant	POST /api/v1/products/{id}/variants/proposal, POST /api/v1/products/{id}/variants
Warehouse	GET /api/v1/warehouses, POST /api/v1/warehouses
Inventory	POST /api/v1/inventory/transactions, GET /api/v1/inventory/balance
Reservation	POST /api/v1/inventory/reservations, POST /api/v1/inventory/reservations/{id}/release
Transfer	POST /api/v1/inventory/transfers, POST /api/v1/inventory/transfers/{id}/receive
Batch/Serial	POST /api/v1/batches, GET /api/v1/serials
Search	POST /api/v1/catalog/search
Reports	GET /api/v1/reports/stock-ledger, GET /api/v1/reports/low-stock
16.1 Search DSL example
{
  "query": "samsung",
  "filters": [
    { "field": "category", "operator": "eq", "value": "Mobile" },
    { "field": "ram", "operator": "in", "value": ["8GB", "12GB"] },
    { "field": "availableQty", "operator": "gt", "value": 0 }
  ],
  "sort": [{ "field": "salePrice", "direction": "asc" }],
  "page": 1,
  "pageSize": 25
}
16.2 Inventory transaction API rule
Inventory transaction APIs must be protected from direct casual use. Most ledger rows should be produced by business workflows such as purchase receipt, invoice posting, transfer receive or approved stock adjustment.
17. UI/UX Application Flow
Screen	Purpose
/products	Catalog list hub with search, filters and status.
/catalog/products/new	Universal create wizard.
/catalog/products/:id/edit	Edit core fields, dynamic sections and variants.
/catalog/products/:id/variants	Variant manager and SKU/barcode setup.
/inventory/dashboard	Stock summary, low stock, near expiry, pending transfers.
/inventory/stock-in	Purchase receipt/manual stock-in where permitted.
/inventory/stock-out	Manual stock issue where permitted.
/inventory/adjustments	Adjustment requests and approvals.
/inventory/transfers	Warehouse transfer workflow.
/inventory/reservations	Open reservations and expiry monitoring.
/reports/stock-ledger	Full ledger audit trail.
/reports/valuation	Stock valuation report.
17.1 Product creation wizard
40.	Select product nature and category.
41.	Fill universal system fields.
42.	Render category-specific dynamic fields.
43.	Choose variant mode.
44.	Generate or create default variant.
45.	Set tracking mode: quantity, batch, serial or none.
46.	Set warehouses/opening stock if authorized.
47.	Review summary and publish product.
18. Search, Facets and Reporting
Search must support both universal fields and dynamic metadata. For performance, important searchable dynamic values should be normalized into SearchFacet rows rather than queried from raw JSON at scale.
Report	Purpose
Stock Summary	Current on hand, reserved, available and damaged stock.
Stock Ledger	All movements with source document links.
Low Stock	Products below reorder point.
Near Expiry	Batch items approaching expiry.
Dead Stock	No movement for configured period.
Adjustment Report	Manual adjustments by user and reason.
Transfer Report	Pending, in-transit and completed transfers.
Valuation Report	Inventory value by warehouse/category.
Serial Trace	Serial number purchase-to-sale history.
19. Security, RBAC and Tenant Isolation
Security Area	Required Control
Tenant isolation	Every table has TenantId; every query filters by TenantId.
Organization scope	OrganizationId applied wherever workspace separation exists.
RBAC	Permissions such as catalog.manage, inventory.view, inventory.adjust, inventory.transfer, reports.view.
Warehouse permission	Users can operate only on authorized warehouses.
Adjustment approval	High-risk adjustments require approval workflow.
API authorization	Never rely only on frontend route hiding.
Sensitive operations	Log user, IP/device if available, old/new values and reason.
Row-level security	Optional SQL Server RLS for defense-in-depth when mature.
20. Audit, Compliance and Operational Controls
Inventory is financially sensitive. The system needs audit controls similar to accounting systems.
•	Ledger rows are immutable; corrections use reversal transactions.
•	Product price, tax group, variant SKU, tracking mode and unit conversion changes must be audited.
•	Adjustment requires reason code and optional approval.
•	Backdated transactions require permission and are reported separately.
•	Admin data changes should record before and after JSON snapshots.
•	System should expose reconciliation status to administrators.
20.1 AuditLog fields
Field	Purpose
AuditLogId	Unique audit record.
TenantId / OrganizationId	Scope.
EntityName / EntityId	Changed object.
Action	Create, Update, Delete, Approve, Reverse.
OldValueJson / NewValueJson	Before and after.
Reason	Mandatory for sensitive actions.
UserId / CreatedUtc	Who and when.
CorrelationId	Trace API/job request chain.
21. Background Jobs and Reconciliation
Job	Frequency / Trigger	Purpose
LedgerBalanceReconciliation	Hourly/daily	Compare InventoryBalance with ledger aggregate.
ReservationExpiryJob	Every few minutes	Release expired reservations.
LowStockAlertJob	Scheduled	Notify reorder points.
ExpiryAlertJob	Daily	Alert near-expiry batches.
OutboxPublisher	Continuous	Publish integration events reliably.
SearchFacetRebuild	On demand / nightly	Repair search index/facet table.
StockValuationSnapshot	Nightly/monthly	Reporting performance.
DataRetentionArchive	Monthly/quarterly	Archive old ledger partitions if needed.
21.1 Reconciliation rule
Go-live gate: Do not retire legacy StockQty until repeated reconciliation proves Product.StockQty, InventoryBalance and ledger-derived quantities are aligned for all active SKUs.
22. Performance, Scale and Indexing
•	Use narrow indexes on tenant, organization, variant, warehouse and date.
•	Use filtered indexes for active products and active variants.
•	Use SearchFacet for dynamic filter performance.
•	Avoid scanning InventoryTransaction for every product list page; read InventoryBalance for current stock.
•	Partition InventoryTransaction by month or quarter if volume becomes high.
•	Keep ledger immutable to simplify archival and audit.
•	Bulk imports should use staging tables and validation reports before publishing.
22.1 SQL Server data type guidance
Data	Recommended Type
Money/price	DECIMAL(18,4) or business-approved precision.
Inventory quantity	DECIMAL(18,6).
JSON metadata	NVARCHAR(MAX) with ISJSON check where useful.
Concurrency token	ROWVERSION.
Timestamps	DATETIME2(3) UTC.
IDs	BIGINT identity or UNIQUEIDENTIFIER depending existing standard.
23. Integration and Eventing
The system should use an outbox pattern for reliable integration with ecommerce, POS, accounting, warehouse apps and reporting pipelines.
Event	When emitted
ProductCreated	Product is published.
ProductUpdated	Important catalog change.
VariantCreated	New sellable SKU created.
InventoryAdjusted	Approved adjustment posted.
StockReserved	Reservation created.
StockReleased	Reservation released.
StockCommitted	Sale/shipment committed.
TransferCreated	Warehouse transfer started.
TransferReceived	Warehouse transfer completed.
BatchNearExpiry	Expiry alert generated.
23.1 Outbox table rule
•	Event record is inserted in same transaction as the business write.
•	Background publisher sends pending events.
•	Retries are safe and idempotent.
•	PublishedAt and AttemptCount are stored.
24. Migration from Existing Billing System
The existing Products table and StockQty column should remain during migration. The new inventory system should be introduced gradually.
Phase	Action	Exit Criteria
1. Additive schema	Create new tables and nullable columns.	Existing billing continues working.
2. Default variant backfill	Create one default variant per existing product.	Every stock product has DefaultVariantId.
3. Opening ledger import	Create opening balance ledger rows from StockQty.	Ledger-derived stock equals StockQty.
4. Shadow dual-write	Invoice/purchase flows write StockQty and ledger.	No mismatch in reconciliation report.
5. Balance read switch	UI reads InventoryBalance for stock.	Stock screens match expected business values.
6. Variant enforcement	VariantId required for stock movement.	No ProductId-only inventory posting remains.
7. StockQty freeze	Stop trusting StockQty.	StockQty becomes legacy display or removed later.
8. Cleanup	Remove old code paths after safe period.	All reports and operations use ledger.
25. Testing Strategy
Test Type	Important Cases
Unit tests	Quantity conversion, metadata validation, availability calculation.
Integration tests	Ledger insert + balance update in one transaction.
Concurrency tests	Two users selling last item simultaneously.
Idempotency tests	Same invoice post retried multiple times.
Migration tests	StockQty to default variant and opening ledger.
Permission tests	Warehouse-restricted user cannot adjust unauthorized warehouse.
Batch tests	FEFO allocation and expired batch blocking.
Serial tests	Cannot sell same serial twice.
Reconciliation tests	Balance rebuild from ledger matches snapshot.
UI tests	Dynamic form renders and validates required fields.
26. Deployment and Observability
•	Use database migrations with idempotent SQL Server scripts.
•	Enable feature flags for ledger shadow mode, variant enforcement and StockQty retirement.
•	Use structured logging with CorrelationId and TenantId.
•	Monitor failed inventory posts, duplicate idempotency conflicts, negative stock attempts and reconciliation mismatches.
•	Back up database before major migration and test restore procedure.
•	Create dashboard for stock anomalies and job failures.
•	Keep audit logs and ledger protected from direct admin edits.
27. Risk Register and Mitigation
Risk	Impact	Mitigation
InventoryBalance drift	Wrong stock shown	Reconciliation job, LastLedgerId/checkpoints, rebuild tool.
Duplicate posting	Stock doubled or reduced twice	Idempotency keys and unique indexes.
Concurrent selling	Negative stock	UPDLOCK/HOLDLOCK or rowversion transaction pattern.
Variant explosion	Unusable catalog	Preview, threshold approval and selective generation.
Slow metadata search	Poor product listing performance	SearchFacet table and filtered indexes.
Hard delete breaks history	Ledger/report failure	Soft delete only.
Wrong unit conversion	Quantity mismatch	Base unit normalization and precision tests.
Unapproved adjustments	Fraud risk	RBAC, approval workflow and audit reason.
Migration mismatch	Billing disruption	Shadow mode and phased rollout.
Batch expiry missed	Customer safety/business loss	FEFO, expiry alerts and blocked batches.
28. Implementation Roadmap
Sprint/Phase	Deliverables
Phase A - Foundation	Schema, soft-delete fields, audit, tenant indexes, default variant design.
Phase B - Catalog Metadata	Dynamic field definitions, values, validation, form API, React renderer.
Phase C - Variants	Variant proposal, selective generation, SKU/barcode uniqueness.
Phase D - Ledger Core	InventoryTransaction, InventoryBalance, idempotency, concurrency tests.
Phase E - Warehouses	Warehouse, locations, permissions, balance views.
Phase F - Reservations	Reserve, release, expire, commit lifecycle.
Phase G - Batch/Serial	Batch expiry, FEFO/FIFO, serial allocation.
Phase H - Migration	Default variant backfill, opening ledger, dual-write.
Phase I - Reports/Search	Stock ledger, low stock, expiry, valuation, search facets.
Phase J - Production Hardening	Observability, reconciliation, outbox, backups, load tests.
29. Final Production Checklist
Area	Checklist Item	Status
Catalog	Products are universal and category-specific fields are metadata only.	Pending
Variants	Every stock item resolves to VariantId.	Pending
Ledger	All stock movement uses InventoryTransaction.	Pending
Idempotency	Duplicate API retry cannot duplicate stock movement.	Pending
Concurrency	Last-item sale race condition is prevented.	Pending
Balance	InventoryBalance can be rebuilt from ledger.	Pending
Reservation	Reserve-release-expire-commit flow works.	Pending
Batch/Serial	Expiry and serial uniqueness rules are enforced.	Pending
Security	Tenant, organization and warehouse permissions are enforced.	Pending
Audit	Sensitive changes and adjustments are audited.	Pending
Migration	StockQty reconciliation is proven before cutover.	Pending
Reports	Stock ledger and summary reports match business documents.	Pending
Monitoring	Anomaly alerts and job failure alerts configured.	Pending
Backup	Restore drill completed.	Pending
30. Conclusion
This specification converts the previous inventory plan into a complete production-ready universal inventory architecture. The system can handle all major product types by separating universal product identity, dynamic product attributes, variants, and strict inventory ledger logic. The most important production safeguards are idempotency, concurrency control, soft delete, audit logging, reservation lifecycle, reconciliation and phased migration from the existing StockQty model.
Final recommendation: Begin development with additive SQL Server migrations, default variant backfill, ledger shadow mode and reconciliation reporting before switching live inventory reads from StockQty to InventoryBalance.
 
30. Real-World Inventory Problems and Production Handling
This section extends the architecture so the system can handle real-world product and stock problems, not only basic quantity management. The key rule is: every business type chooses the correct tracking mode at product or variant level. A grocery item may use batch and expiry, a phone may use IMEI/serial number, apparel may use size/color variants, and loose material may use decimal quantity and unit conversion.
Problem	Required Handling	System Module
Which exact phone was sold?	Track each unit by IMEI/SerialNumber and link it to invoice line.	Serialized Inventory
What profit did each sale line generate?	Capture resolved cost price and sale price on every sale line.	Item-wise Profitability
Which expiry batch should be sold first?	Use FEFO allocation: First Expiry First Out.	Batch and Expiry
Two users sell last stock at same time.	Use stock reservation, row version, and transactional commit.	Concurrency Control
Customer returns a used/damaged item.	Return into Returned, Damaged, Refurbished, or Sellable bucket after inspection.	Return Lifecycle
Same item purchased at different costs.	Use FIFO, weighted average, or serial-specific costing.	Costing Engine
Bundle sold as one item but stock reduces from multiple items.	Explode kit/BOM components at sale posting.	Bundle / Kit Engine
Warehouse-to-warehouse transfer.	Create outbound and inbound transfer ledger with in-transit state.	Transfer Management
Loose goods like rice, oil, cable, fabric.	Use decimal quantity, base UOM, and conversion rules.	UOM Engine
Mismatch between physical and software stock.	Run stock count, variance approval, adjustment ledger, and audit.	Stock Audit

31. Serialized Inventory / IMEI Tracking
Serialized inventory is mandatory for high-value or uniquely identifiable products such as mobile phones, laptops, vehicles, machines, medical devices, electronics, warranty products and rental assets. If five phones have the same model and configuration, the system must still store five separate unit records.
Serial Field	Purpose
SerialId	Internal unique row id for the physical unit.
ProductId / VariantId	Links the unit to product and configuration.
SerialNumber	Manufacturer serial number where applicable.
IMEINumber1 / IMEINumber2	Mobile phone IMEI tracking.
PurchaseLineId	Links exact unit to its purchase document and cost.
WarehouseId / BinId	Current physical location.
PurchaseCostPerUnit	Cost locked for item-wise profit.
Status	IN_STOCK, RESERVED, SOLD, RETURNED, DAMAGED, REPAIRED, TRANSFERRED.
SoldInvoiceLineId	Filled when exact unit is sold.
WarrantyStart / WarrantyEnd	Warranty tracking for customer and service support.

31.1 Example: five identical phones, one sold
IMEI	Product	Config	Cost	Status	Invoice
IMEI001	Phone A	8GB / 128GB / Black	1000	IN_STOCK	-
IMEI002	Phone A	8GB / 128GB / Black	1000	IN_STOCK	-
IMEI003	Phone A	8GB / 128GB / Black	1000	SOLD	INV-001
IMEI004	Phone A	8GB / 128GB / Black	1000	IN_STOCK	-
IMEI005	Phone A	8GB / 128GB / Black	1000	IN_STOCK	-

•	During sale, the cashier or API must select the actual available serial/IMEI item.
•	The invoice line stores SerialId, selling price, cost price and profit.
•	After posting, ProductSerial.Status changes from IN_STOCK or RESERVED to SOLD.
•	Warranty, return, exchange and service cases can later identify the same physical unit.
32. Item-wise Profitability and Costing Engine
The system must not calculate profit only at product-bunch level. Profit must be available per item, per invoice line, per batch, per serial number, per warehouse, per customer and per date range. This requires the sale line to store both selling price and resolved cost price at posting time.
Costing Method	Best For	How Profit Is Resolved
Serial-specific costing	Phones, laptops, machines, vehicles	Cost comes from the exact ProductSerial row sold.
FIFO	General trading goods with purchase lots	Oldest available purchase lot cost is consumed first.
FEFO	Expiry products like food and medicine	Earliest expiry batch is consumed first, with its batch cost.
Weighted average	Bulk goods and commodities	Average cost is recalculated after purchases.
Manual lot selection	Special business cases	User selects purchase lot/batch during sale.
Standard cost	Manufacturing or planned-cost reporting	Profit compares sale price with configured standard cost; variance tracked separately.

32.1 Required sale line cost capture
SalesInvoiceLine: ProductId, VariantId, Qty, SellingPricePerUnit, Discount, Tax, NetSellingPrice, ResolvedCostPerUnit, GrossProfitPerUnit, TotalGrossProfit, CostingMethod, CostSourceId
SalesInvoiceLineSerial: InvoiceLineId, SerialId, SellingPrice, CostPrice, GrossProfit
SalesInvoiceLineCostAllocation: InvoiceLineId, PurchaseLineId/BatchId, Qty, CostPerUnit, TotalCost
32.2 Example: purchase ten phones and sell at different prices
Sale	Qty	Cost / Unit	Sale / Unit	Profit / Unit	Total Profit
Sale 1	3	1000	1200	200	600
Sale 2	5	1000	1400	400	2000
Sale 3	2	1000	1300	300	600
Total	10	-	-	-	3200

33. Product-Type Handling Matrix
Product Type	Tracking Mode	Important Real-World Rules
Mobile / Laptop / Electronics	Variant + Serial/IMEI	Exact unit identity, warranty, return verification, serial-specific profit.
Grocery / Food	Batch + Expiry + FEFO	Expiry alerts, batch recalls, damaged/expired write-off, MRP and selling price by batch.
Medicine / Pharmacy	Batch + Expiry + Regulatory Fields	Batch number, manufacturer, prescription flags, near-expiry blocking.
Apparel / Shoes	Variant Axis	Size/color/style variants, barcode per variant, return/exchange by size.
Furniture	Variant + Optional Serial	Material, dimensions, warehouse location, delivery and installation status.
Loose Material	Decimal Quantity + UOM	Kg/gram/litre/metre conversions, weighing scale integration, rounding control.
Bundles / Kits	BOM / Component Explosion	Sell kit as one SKU; reduce component stock individually.
Digital Goods	License/Key Tracking	No warehouse stock; delivery key/status/audit required.
Services	Non-stock Product	No inventory movement; revenue and tax only.
Rental Assets	Serialized Asset Lifecycle	Available, rented, returned, damaged, maintenance, depreciation.
Manufactured Goods	BOM + Work Order	Consume raw materials; produce finished goods; track wastage and variance.
Consignment Stock	Ownership Flag	Stock stored in warehouse but not owned until sold or accepted.

34. Complete Stock Lifecycle States
A production system must separate physical stock from business availability. The same product can exist in multiple states at the same time.
State	Meaning	Typical Movement
Incoming	Ordered but not physically received.	Purchase order created.
Received Pending QC	Received but not yet approved for sale.	Goods receipt completed.
Available	Sellable stock.	QC passed or direct purchase posted.
Reserved	Allocated to order but not invoiced/dispatched.	Customer order confirmed.
Picked / Packed	Removed from shelf for fulfilment.	Warehouse picking process.
Sold	Invoice posted and ownership transferred.	Sale posting.
In Transit	Moving between warehouses.	Transfer out created.
Returned Pending Inspection	Customer returned item; not yet sellable.	Return received.
Refurbished / Repaired	Restored item that can be resold.	Inspection passed after repair.
Damaged	Not sellable; may be written off.	Damage entry.
Expired	Expiry date passed or blocked.	Expiry job / stock audit.
Lost / Shrinkage	Physical stock missing.	Stock count variance.

35. Returns, Exchange, Warranty and After-Sales Handling
•	Return request is linked to original invoice line and, where applicable, SerialId or BatchId.
•	Returned item enters RETURNED_PENDING_INSPECTION and does not immediately become available stock.
•	Inspection decides final bucket: sellable, damaged, repair, refurbish, scrap or supplier return.
•	Refund and stock movement are separate but linked documents.
•	Exchange creates two linked flows: return of old unit and sale/issue of replacement unit.
•	Warranty claim can verify exact IMEI/serial, purchase date, customer and invoice.
Scenario	Correct Handling
Customer returns sealed phone	Move exact SerialId from SOLD to RETURNED_PENDING_INSPECTION, then AVAILABLE if approved.
Customer returns damaged phone	Move exact SerialId to DAMAGED or REPAIR; do not add to sellable stock.
Customer exchanges size M shirt for size L	Increase returned variant after inspection; reduce replacement variant.
Expired food item found	Move batch quantity from AVAILABLE to EXPIRED/DAMAGED through adjustment ledger.
Supplier return	Move stock out with reference to debit note or supplier return document.

36. Reservation, Allocation and Overselling Protection
The system must prevent two users or channels from selling the same stock. Reservation is temporary allocation; sale is final consumption. Availability must be calculated as OnHand - Reserved - Blocked - Damaged - Expired, not only StockQty.
AvailableToSell = OnHandQty - ReservedQty - BlockedQty - DamagedQty - ExpiredQty
Step	Action	System Rule
1	Customer order created	Reserve stock by VariantId/WarehouseId and SerialId/BatchId if required.
2	Payment pending	Hold reservation until configured expiry time.
3	Invoice posted	Convert reservation to sale ledger movement.
4	Payment failed/cancelled	Release reservation automatically.
5	Reservation expired	Background job releases stock back to available.

37. Additional SQL Server Schema Required for Real-World Coverage
Table	Purpose
ProductSerial	Stores one row per physical serialized unit such as phone IMEI or laptop serial.
SalesInvoiceLineSerial	Links sold invoice line to exact serial units.
SalesInvoiceLineCostAllocation	Stores FIFO/FEFO/weighted cost split for each sale line.
StockReservation	Temporarily reserves stock for orders before final invoice.
ReturnAuthorization	Tracks return request, inspection status and refund/exchange decision.
StockInspection	Captures QC result for received or returned goods.
InventoryAdjustmentApproval	Approval workflow for manual stock changes.
ProductBundleComponent	Defines kit/bundle/BOM components.
ProductLicenseKey	Tracks digital product keys and delivery status.
StockCountSession / StockCountLine	Physical stock audit and variance posting.
InventoryCostLayer	Represents purchase lots/cost layers used by FIFO and weighted average.
InventoryOutboxEvent	Publishes stock events to ecommerce, accounting and warehouse integrations.

38. Reports Required for Production Inventory
Report	Answers This Question
Item-wise Profit Report	How much profit did each sold unit or invoice line generate?
Serial Traceability Report	Which customer purchased which IMEI/serial number?
Batch Expiry Report	Which stock is near expiry or already expired?
Stock Valuation Report	What is the current inventory value by FIFO/average/standard cost?
Gross Margin by Product/Category	Which products are profitable and which are low-margin?
Warehouse Stock Report	How much stock exists in each warehouse/bin?
Reservation Report	Which orders are holding stock?
Return and Damage Report	How much stock is returned, damaged, repaired or scrapped?
Stock Movement Ledger	Complete audit trail of every stock increase/decrease.
Reconciliation Report	Does balance snapshot match ledger total and physical count?

39. Non-Negotiable Implementation Rules
•	For serialized products, invoice posting must require exact SerialId/IMEI selection before stock can be reduced.
•	For batch/expiry products, invoice posting must allocate BatchId using FEFO unless user has permission for manual override.
•	For normal non-serialized products, costing must resolve through FIFO or weighted average and save cost allocation rows.
•	For service products, no inventory ledger movement should be created.
•	For digital products, delivery/license status must be tracked instead of warehouse quantity.
•	Every sale line must store selling price, discount, tax, resolved cost, gross profit and source costing method.
•	Every return must reference original sale where possible and must not automatically increase sellable stock before inspection.
•	Manual adjustment must require reason, user, approval policy and audit trail.
•	InventoryBalance is never the legal source of truth; it is always rebuildable from InventoryTransaction.
•	Reports must be able to drill down from summary to invoice line, serial number, batch and ledger transaction.
40. Real-World Readiness Checklist
Capability	Required Before Production
Can identify exact phone sold	ProductSerial + SalesInvoiceLineSerial implemented.
Can calculate profit per unit	Resolved cost saved on sale line.
Can handle grocery expiry	Batch, expiry date, FEFO and expiry alerts implemented.
Can prevent overselling	Reservations, concurrency control and idempotency implemented.
Can process returns safely	Inspection workflow and return stock buckets implemented.
Can support all product types	Tracking mode configured per product/variant.
Can audit every stock change	Append-only ledger and audit log implemented.
Can recover from bugs	Balance rebuild and reconciliation jobs implemented.

