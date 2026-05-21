/* Universal Product & Inventory foundation — additive only.
   Adds warehouses, units, variants, custom fields, search facets, batches, serials,
   inventory ledger + balance + reservations, audit log, outbox. Apply after 015. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

/* =========================================================================
   1. Warehouses & locations (universal stock sites)
   ========================================================================= */
IF OBJECT_ID(N'dbo.Warehouses', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Warehouses (
    WarehouseId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    Code NVARCHAR(40) NOT NULL,
    Name NVARCHAR(160) NOT NULL,
    WarehouseType NVARCHAR(24) NOT NULL CONSTRAINT DF_Warehouses_Type DEFAULT (N'Store'),
    AddressLine1 NVARCHAR(200) NULL,
    AddressLine2 NVARCHAR(200) NULL,
    City NVARCHAR(120) NULL,
    StateRegion NVARCHAR(120) NULL,
    PostalCode NVARCHAR(40) NULL,
    Country NVARCHAR(120) NULL,
    ManagerName NVARCHAR(160) NULL,
    ManagerEmail NVARCHAR(200) NULL,
    ManagerPhone NVARCHAR(40) NULL,
    AllowNegativeStock BIT NOT NULL CONSTRAINT DF_Warehouses_AllowNeg DEFAULT (0),
    IsDefault BIT NOT NULL CONSTRAINT DF_Warehouses_IsDefault DEFAULT (0),
    IsActive BIT NOT NULL CONSTRAINT DF_Warehouses_IsActive DEFAULT (1),
    IsDeleted BIT NOT NULL CONSTRAINT DF_Warehouses_IsDeleted DEFAULT (0),
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_Warehouses_CreatedUtc DEFAULT (SYSUTCDATETIME()),
    UpdatedUtc DATETIME2 NULL,
    CONSTRAINT FK_Warehouses_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(TenantId),
    CONSTRAINT FK_Warehouses_Organization FOREIGN KEY (OrganizationId) REFERENCES dbo.Organizations(OrganizationId)
  );
  CREATE UNIQUE INDEX UX_Warehouses_Org_Code
    ON dbo.Warehouses(TenantId, OrganizationId, Code) WHERE IsDeleted = 0;
  CREATE INDEX IX_Warehouses_Org_Active ON dbo.Warehouses(TenantId, OrganizationId, IsActive, IsDeleted);
END

IF OBJECT_ID(N'dbo.WarehouseLocations', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.WarehouseLocations (
    WarehouseLocationId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    WarehouseId BIGINT NOT NULL,
    Code NVARCHAR(64) NOT NULL,
    Name NVARCHAR(160) NOT NULL,
    Zone NVARCHAR(64) NULL,
    Aisle NVARCHAR(40) NULL,
    Rack NVARCHAR(40) NULL,
    Shelf NVARCHAR(40) NULL,
    BinKind NVARCHAR(32) NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_WarehouseLocations_IsActive DEFAULT (1),
    IsDeleted BIT NOT NULL CONSTRAINT DF_WarehouseLocations_IsDeleted DEFAULT (0),
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_WarehouseLocations_CreatedUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_WarehouseLocations_Warehouse FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouses(WarehouseId)
  );
  CREATE UNIQUE INDEX UX_WarehouseLocations_Warehouse_Code
    ON dbo.WarehouseLocations(TenantId, OrganizationId, WarehouseId, Code) WHERE IsDeleted = 0;
END

/* =========================================================================
   2. Universal units of measure (separate from existing ProductUnits — extends with conversion)
   ========================================================================= */
IF OBJECT_ID(N'dbo.InventoryUnits', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.InventoryUnits (
    InventoryUnitId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    Code NVARCHAR(24) NOT NULL,
    Name NVARCHAR(80) NOT NULL,
    UnitKind NVARCHAR(24) NOT NULL CONSTRAINT DF_InventoryUnits_Kind DEFAULT (N'Count'),
    DecimalPrecision TINYINT NOT NULL CONSTRAINT DF_InventoryUnits_DecPrec DEFAULT (0),
    IsBaseUnit BIT NOT NULL CONSTRAINT DF_InventoryUnits_IsBase DEFAULT (1),
    IsActive BIT NOT NULL CONSTRAINT DF_InventoryUnits_IsActive DEFAULT (1),
    IsDeleted BIT NOT NULL CONSTRAINT DF_InventoryUnits_IsDeleted DEFAULT (0),
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_InventoryUnits_CreatedUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_InventoryUnits_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(TenantId),
    CONSTRAINT FK_InventoryUnits_Organization FOREIGN KEY (OrganizationId) REFERENCES dbo.Organizations(OrganizationId)
  );
  CREATE UNIQUE INDEX UX_InventoryUnits_Org_Code
    ON dbo.InventoryUnits(TenantId, OrganizationId, Code) WHERE IsDeleted = 0;
END

IF OBJECT_ID(N'dbo.InventoryUnitConversions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.InventoryUnitConversions (
    InventoryUnitConversionId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    FromUnitId BIGINT NOT NULL,
    ToUnitId BIGINT NOT NULL,
    Factor DECIMAL(18,6) NOT NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_InventoryUnitConversions_IsActive DEFAULT (1),
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_InventoryUnitConversions_CreatedUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_InventoryUnitConversions_From FOREIGN KEY (FromUnitId) REFERENCES dbo.InventoryUnits(InventoryUnitId),
    CONSTRAINT FK_InventoryUnitConversions_To FOREIGN KEY (ToUnitId) REFERENCES dbo.InventoryUnits(InventoryUnitId),
    CONSTRAINT CK_InventoryUnitConversions_NotSelf CHECK (FromUnitId <> ToUnitId)
  );
  CREATE UNIQUE INDEX UX_InventoryUnitConversions_Pair
    ON dbo.InventoryUnitConversions(TenantId, OrganizationId, FromUnitId, ToUnitId);
END

/* =========================================================================
   3. Products universal columns (additive — never break existing flow)
   ========================================================================= */
IF OBJECT_ID(N'dbo.Products', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.Products', 'ProductNature') IS NULL
    ALTER TABLE dbo.Products ADD ProductNature NVARCHAR(24) NOT NULL CONSTRAINT DF_Products_ProductNature DEFAULT (N'Physical');

  IF COL_LENGTH('dbo.Products', 'InventoryTrackingMode') IS NULL
    ALTER TABLE dbo.Products ADD InventoryTrackingMode NVARCHAR(24) NOT NULL CONSTRAINT DF_Products_TrackingMode DEFAULT (N'Quantity');

  IF COL_LENGTH('dbo.Products', 'HasVariants') IS NULL
    ALTER TABLE dbo.Products ADD HasVariants BIT NOT NULL CONSTRAINT DF_Products_HasVariants DEFAULT (0);

  IF COL_LENGTH('dbo.Products', 'DefaultVariantId') IS NULL
    ALTER TABLE dbo.Products ADD DefaultVariantId BIGINT NULL;

  IF COL_LENGTH('dbo.Products', 'IsSellable') IS NULL
    ALTER TABLE dbo.Products ADD IsSellable BIT NOT NULL CONSTRAINT DF_Products_IsSellable DEFAULT (1);

  IF COL_LENGTH('dbo.Products', 'IsPurchasable') IS NULL
    ALTER TABLE dbo.Products ADD IsPurchasable BIT NOT NULL CONSTRAINT DF_Products_IsPurchasable DEFAULT (1);

  IF COL_LENGTH('dbo.Products', 'BaseInventoryUnitId') IS NULL
    ALTER TABLE dbo.Products ADD BaseInventoryUnitId BIGINT NULL;

  IF COL_LENGTH('dbo.Products', 'ValuationMode') IS NULL
    ALTER TABLE dbo.Products ADD ValuationMode NVARCHAR(24) NOT NULL CONSTRAINT DF_Products_ValuationMode DEFAULT (N'WeightedAverage');

  IF COL_LENGTH('dbo.Products', 'ProductStatus') IS NULL
    ALTER TABLE dbo.Products ADD ProductStatus NVARCHAR(24) NOT NULL CONSTRAINT DF_Products_ProductStatus DEFAULT (N'Active');

  IF COL_LENGTH('dbo.Products', 'IsDeleted') IS NULL
    ALTER TABLE dbo.Products ADD IsDeleted BIT NOT NULL CONSTRAINT DF_Products_IsDeleted DEFAULT (0);

  IF COL_LENGTH('dbo.Products', 'DeletedUtc') IS NULL
    ALTER TABLE dbo.Products ADD DeletedUtc DATETIME2 NULL;
END

/* =========================================================================
   4. Variants
   ========================================================================= */
IF OBJECT_ID(N'dbo.ProductVariants', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductVariants (
    ProductVariantId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    ProductId BIGINT NOT NULL,
    Sku NVARCHAR(80) NULL,
    Barcode NVARCHAR(80) NULL,
    DisplayName NVARCHAR(200) NULL,
    AttributeHash NVARCHAR(200) NULL,
    Mrp DECIMAL(18,4) NULL,
    SalePrice DECIMAL(18,4) NULL,
    PurchasePrice DECIMAL(18,4) NULL,
    WeightGrams DECIMAL(18,4) NULL,
    Length DECIMAL(18,4) NULL,
    Width DECIMAL(18,4) NULL,
    Height DECIMAL(18,4) NULL,
    InventoryTrackingMode NVARCHAR(24) NULL,
    IsDefault BIT NOT NULL CONSTRAINT DF_ProductVariants_IsDefault DEFAULT (0),
    Status NVARCHAR(24) NOT NULL CONSTRAINT DF_ProductVariants_Status DEFAULT (N'Active'),
    IsActive BIT NOT NULL CONSTRAINT DF_ProductVariants_IsActive DEFAULT (1),
    IsDeleted BIT NOT NULL CONSTRAINT DF_ProductVariants_IsDeleted DEFAULT (0),
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_ProductVariants_CreatedUtc DEFAULT (SYSUTCDATETIME()),
    UpdatedUtc DATETIME2 NULL,
    CONSTRAINT FK_ProductVariants_Product FOREIGN KEY (ProductId) REFERENCES dbo.Products(ProductId),
    CONSTRAINT FK_ProductVariants_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(TenantId)
  );
  CREATE INDEX IX_ProductVariants_Product ON dbo.ProductVariants(TenantId, OrganizationId, ProductId, IsDeleted);
  CREATE UNIQUE INDEX UX_ProductVariants_Sku
    ON dbo.ProductVariants(TenantId, OrganizationId, Sku) WHERE Sku IS NOT NULL AND IsDeleted = 0;
  CREATE UNIQUE INDEX UX_ProductVariants_Barcode
    ON dbo.ProductVariants(TenantId, OrganizationId, Barcode) WHERE Barcode IS NOT NULL AND IsDeleted = 0;
  CREATE UNIQUE INDEX UX_ProductVariants_AttributeHash
    ON dbo.ProductVariants(TenantId, OrganizationId, ProductId, AttributeHash) WHERE AttributeHash IS NOT NULL AND IsDeleted = 0;
END

IF OBJECT_ID(N'dbo.ProductVariantAttributes', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductVariantAttributes (
    ProductVariantAttributeId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    ProductVariantId BIGINT NOT NULL,
    [Key] NVARCHAR(64) NOT NULL,
    [Value] NVARCHAR(200) NOT NULL,
    CONSTRAINT FK_ProductVariantAttributes_Variant FOREIGN KEY (ProductVariantId)
      REFERENCES dbo.ProductVariants(ProductVariantId) ON DELETE CASCADE
  );
  CREATE INDEX IX_ProductVariantAttributes_Variant ON dbo.ProductVariantAttributes(ProductVariantId);
  CREATE INDEX IX_ProductVariantAttributes_KeyValue ON dbo.ProductVariantAttributes([Key], [Value]);
END

/* Wire Products.DefaultVariantId -> ProductVariants(ProductVariantId) once both tables exist. */
IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE parent_object_id = OBJECT_ID(N'dbo.Products') AND name = N'FK_Products_DefaultVariant')
  AND COL_LENGTH('dbo.Products', 'DefaultVariantId') IS NOT NULL
  ALTER TABLE dbo.Products ADD CONSTRAINT FK_Products_DefaultVariant
    FOREIGN KEY (DefaultVariantId) REFERENCES dbo.ProductVariants(ProductVariantId);

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE parent_object_id = OBJECT_ID(N'dbo.Products') AND name = N'FK_Products_BaseInventoryUnit')
  AND COL_LENGTH('dbo.Products', 'BaseInventoryUnitId') IS NOT NULL
  ALTER TABLE dbo.Products ADD CONSTRAINT FK_Products_BaseInventoryUnit
    FOREIGN KEY (BaseInventoryUnitId) REFERENCES dbo.InventoryUnits(InventoryUnitId);

/* =========================================================================
   5. Dynamic custom fields + search facets
   ========================================================================= */
IF OBJECT_ID(N'dbo.ProductCustomFieldDefinitions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductCustomFieldDefinitions (
    ProductCustomFieldDefinitionId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    CategoryId BIGINT NULL,
    FieldKey NVARCHAR(80) NOT NULL,
    Label NVARCHAR(200) NOT NULL,
    FieldType NVARCHAR(24) NOT NULL,
    AppliesTo NVARCHAR(16) NOT NULL CONSTRAINT DF_ProductCustomFieldDefinitions_AppliesTo DEFAULT (N'Product'),
    SectionName NVARCHAR(80) NULL,
    DisplayOrder INT NOT NULL CONSTRAINT DF_ProductCustomFieldDefinitions_DisplayOrder DEFAULT (0),
    IsRequired BIT NOT NULL CONSTRAINT DF_ProductCustomFieldDefinitions_IsRequired DEFAULT (0),
    IsSearchable BIT NOT NULL CONSTRAINT DF_ProductCustomFieldDefinitions_IsSearchable DEFAULT (0),
    IsFilterable BIT NOT NULL CONSTRAINT DF_ProductCustomFieldDefinitions_IsFilterable DEFAULT (0),
    IsSortable BIT NOT NULL CONSTRAINT DF_ProductCustomFieldDefinitions_IsSortable DEFAULT (0),
    DefaultValueJson NVARCHAR(MAX) NULL,
    ValidationJson NVARCHAR(MAX) NULL,
    Placeholder NVARCHAR(200) NULL,
    Status NVARCHAR(16) NOT NULL CONSTRAINT DF_ProductCustomFieldDefinitions_Status DEFAULT (N'Published'),
    IsActive BIT NOT NULL CONSTRAINT DF_ProductCustomFieldDefinitions_IsActive DEFAULT (1),
    IsDeleted BIT NOT NULL CONSTRAINT DF_ProductCustomFieldDefinitions_IsDeleted DEFAULT (0),
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_ProductCustomFieldDefinitions_CreatedUtc DEFAULT (SYSUTCDATETIME()),
    /* NULL CategoryId = org-wide field; persisted key for unique index (expressions not allowed in index DDL). */
    CategoryIdScope AS ISNULL(CategoryId, 0) PERSISTED,
    CONSTRAINT FK_ProductCustomFieldDefinitions_Category FOREIGN KEY (CategoryId) REFERENCES dbo.ProductCategories(CategoryId)
  );
  CREATE UNIQUE INDEX UX_ProductCustomFieldDefinitions_Org_Cat_Key
    ON dbo.ProductCustomFieldDefinitions(TenantId, OrganizationId, CategoryIdScope, FieldKey) WHERE IsDeleted = 0;
END

IF OBJECT_ID(N'dbo.ProductCustomFieldValues', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductCustomFieldValues (
    ProductCustomFieldValueId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    ProductId BIGINT NOT NULL,
    ProductVariantId BIGINT NULL,
    FieldKey NVARCHAR(80) NOT NULL,
    ValueText NVARCHAR(MAX) NULL,
    ValueNumber DECIMAL(28,8) NULL,
    ValueDate DATETIME2 NULL,
    ValueBool BIT NULL,
    ValueJson NVARCHAR(MAX) NULL,
    UpdatedUtc DATETIME2 NOT NULL CONSTRAINT DF_ProductCustomFieldValues_UpdatedUtc DEFAULT (SYSUTCDATETIME()),
    /* NULL variant = product-level value; persisted key for unique index. */
    ProductVariantIdScope AS ISNULL(ProductVariantId, 0) PERSISTED,
    CONSTRAINT FK_ProductCustomFieldValues_Product FOREIGN KEY (ProductId) REFERENCES dbo.Products(ProductId) ON DELETE CASCADE,
    CONSTRAINT FK_ProductCustomFieldValues_Variant FOREIGN KEY (ProductVariantId) REFERENCES dbo.ProductVariants(ProductVariantId)
  );
  CREATE INDEX IX_ProductCustomFieldValues_Product ON dbo.ProductCustomFieldValues(TenantId, OrganizationId, ProductId);
  CREATE INDEX IX_ProductCustomFieldValues_Variant ON dbo.ProductCustomFieldValues(ProductVariantId);
  CREATE UNIQUE INDEX UX_ProductCustomFieldValues_Scope
    ON dbo.ProductCustomFieldValues(TenantId, OrganizationId, ProductId, ProductVariantIdScope, FieldKey);
END

IF OBJECT_ID(N'dbo.SearchFacets', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SearchFacets (
    SearchFacetId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    ProductId BIGINT NOT NULL,
    ProductVariantId BIGINT NULL,
    FieldKey NVARCHAR(80) NOT NULL,
    NormalizedValue NVARCHAR(200) NOT NULL,
    DisplayValue NVARCHAR(200) NULL,
    UpdatedUtc DATETIME2 NOT NULL CONSTRAINT DF_SearchFacets_UpdatedUtc DEFAULT (SYSUTCDATETIME())
  );
  CREATE INDEX IX_SearchFacets_Lookup ON dbo.SearchFacets(TenantId, OrganizationId, FieldKey, NormalizedValue);
  CREATE INDEX IX_SearchFacets_Product ON dbo.SearchFacets(ProductId);
END

/* =========================================================================
   6. Batches & serial numbers
   ========================================================================= */
IF OBJECT_ID(N'dbo.Batches', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Batches (
    BatchId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    ProductVariantId BIGINT NOT NULL,
    BatchNumber NVARCHAR(64) NOT NULL,
    LotNumber NVARCHAR(64) NULL,
    ManufacturingDate DATETIME2 NULL,
    ExpiryDate DATETIME2 NULL,
    QualityStatus NVARCHAR(24) NOT NULL CONSTRAINT DF_Batches_QualityStatus DEFAULT (N'Released'),
    CostPerUnit DECIMAL(18,4) NULL,
    SupplierPartyId BIGINT NULL,
    Notes NVARCHAR(1000) NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_Batches_IsActive DEFAULT (1),
    IsDeleted BIT NOT NULL CONSTRAINT DF_Batches_IsDeleted DEFAULT (0),
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_Batches_CreatedUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_Batches_Variant FOREIGN KEY (ProductVariantId) REFERENCES dbo.ProductVariants(ProductVariantId),
    CONSTRAINT FK_Batches_Supplier FOREIGN KEY (SupplierPartyId) REFERENCES dbo.Parties(PartyId)
  );
  CREATE UNIQUE INDEX UX_Batches_Number
    ON dbo.Batches(TenantId, OrganizationId, ProductVariantId, BatchNumber) WHERE IsDeleted = 0;
  CREATE INDEX IX_Batches_Expiry
    ON dbo.Batches(TenantId, OrganizationId, ExpiryDate)
    WHERE ExpiryDate IS NOT NULL AND IsDeleted = 0;
END

IF OBJECT_ID(N'dbo.ProductSerials', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductSerials (
    ProductSerialId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    ProductVariantId BIGINT NOT NULL,
    SerialNumber NVARCHAR(80) NOT NULL,
    Imei1 NVARCHAR(64) NULL,
    Imei2 NVARCHAR(64) NULL,
    WarehouseId BIGINT NULL,
    WarehouseLocationId BIGINT NULL,
    BatchId BIGINT NULL,
    PurchaseLineId BIGINT NULL,
    PurchaseCostPerUnit DECIMAL(18,4) NULL,
    Status NVARCHAR(24) NOT NULL CONSTRAINT DF_ProductSerials_Status DEFAULT (N'InStock'),
    SoldInvoiceLineId BIGINT NULL,
    WarrantyStartUtc DATETIME2 NULL,
    WarrantyEndUtc DATETIME2 NULL,
    Notes NVARCHAR(500) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_ProductSerials_IsDeleted DEFAULT (0),
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_ProductSerials_CreatedUtc DEFAULT (SYSUTCDATETIME()),
    UpdatedUtc DATETIME2 NULL,
    CONSTRAINT FK_ProductSerials_Variant FOREIGN KEY (ProductVariantId) REFERENCES dbo.ProductVariants(ProductVariantId),
    CONSTRAINT FK_ProductSerials_Warehouse FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouses(WarehouseId),
    CONSTRAINT FK_ProductSerials_WarehouseLocation FOREIGN KEY (WarehouseLocationId) REFERENCES dbo.WarehouseLocations(WarehouseLocationId),
    CONSTRAINT FK_ProductSerials_Batch FOREIGN KEY (BatchId) REFERENCES dbo.Batches(BatchId),
    CONSTRAINT FK_ProductSerials_PurchaseLine FOREIGN KEY (PurchaseLineId) REFERENCES dbo.PurchaseLines(PurchaseLineId)
  );
  CREATE UNIQUE INDEX UX_ProductSerials_Serial
    ON dbo.ProductSerials(TenantId, OrganizationId, ProductVariantId, SerialNumber) WHERE IsDeleted = 0;
  CREATE INDEX IX_ProductSerials_Status
    ON dbo.ProductSerials(TenantId, OrganizationId, ProductVariantId, Status) WHERE IsDeleted = 0;
  CREATE INDEX IX_ProductSerials_Imei1
    ON dbo.ProductSerials(TenantId, OrganizationId, Imei1) WHERE Imei1 IS NOT NULL;
END

/* =========================================================================
   7. Inventory ledger (append-only) + balance snapshot
   ========================================================================= */
IF OBJECT_ID(N'dbo.InventoryTransactions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.InventoryTransactions (
    InventoryTransactionId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    ProductVariantId BIGINT NOT NULL,
    WarehouseId BIGINT NOT NULL,
    WarehouseLocationId BIGINT NULL,
    BatchId BIGINT NULL,
    ProductSerialId BIGINT NULL,
    TransactionType NVARCHAR(32) NOT NULL,
    QuantityBucket NVARCHAR(16) NOT NULL CONSTRAINT DF_InventoryTransactions_Bucket DEFAULT (N'Available'),
    QtyChange DECIMAL(18,6) NOT NULL,
    CostPerUnit DECIMAL(18,4) NULL,
    SourceDocumentType NVARCHAR(40) NULL,
    SourceDocumentId BIGINT NULL,
    SourceLineId BIGINT NULL,
    IdempotencyKey NVARCHAR(160) NULL,
    ReversalOfTransactionId BIGINT NULL,
    Reason NVARCHAR(400) NULL,
    MetadataJson NVARCHAR(MAX) NULL,
    CreatedBy NVARCHAR(120) NULL,
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_InventoryTransactions_CreatedUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_InventoryTransactions_Variant FOREIGN KEY (ProductVariantId) REFERENCES dbo.ProductVariants(ProductVariantId),
    CONSTRAINT FK_InventoryTransactions_Warehouse FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouses(WarehouseId),
    CONSTRAINT FK_InventoryTransactions_Batch FOREIGN KEY (BatchId) REFERENCES dbo.Batches(BatchId),
    CONSTRAINT FK_InventoryTransactions_Serial FOREIGN KEY (ProductSerialId) REFERENCES dbo.ProductSerials(ProductSerialId),
    CONSTRAINT FK_InventoryTransactions_Reversal FOREIGN KEY (ReversalOfTransactionId) REFERENCES dbo.InventoryTransactions(InventoryTransactionId)
  );
  CREATE INDEX IX_InventoryTransactions_VarWhDate
    ON dbo.InventoryTransactions(TenantId, OrganizationId, ProductVariantId, WarehouseId, CreatedUtc DESC);
  CREATE INDEX IX_InventoryTransactions_Source
    ON dbo.InventoryTransactions(TenantId, OrganizationId, SourceDocumentType, SourceDocumentId);
  CREATE UNIQUE INDEX UX_InventoryTransactions_Idempotency
    ON dbo.InventoryTransactions(TenantId, OrganizationId, IdempotencyKey) WHERE IdempotencyKey IS NOT NULL;
END

IF OBJECT_ID(N'dbo.InventoryBalances', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.InventoryBalances (
    InventoryBalanceId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    ProductVariantId BIGINT NOT NULL,
    WarehouseId BIGINT NOT NULL,
    BatchId BIGINT NULL,
    OnHandQty DECIMAL(18,6) NOT NULL CONSTRAINT DF_InventoryBalances_OnHand DEFAULT (0),
    ReservedQty DECIMAL(18,6) NOT NULL CONSTRAINT DF_InventoryBalances_Reserved DEFAULT (0),
    DamagedQty DECIMAL(18,6) NOT NULL CONSTRAINT DF_InventoryBalances_Damaged DEFAULT (0),
    IncomingQty DECIMAL(18,6) NOT NULL CONSTRAINT DF_InventoryBalances_Incoming DEFAULT (0),
    InTransitQty DECIMAL(18,6) NOT NULL CONSTRAINT DF_InventoryBalances_InTransit DEFAULT (0),
    AverageCost DECIMAL(18,4) NULL,
    LastLedgerId BIGINT NULL,
    UpdatedUtc DATETIME2 NOT NULL CONSTRAINT DF_InventoryBalances_UpdatedUtc DEFAULT (SYSUTCDATETIME()),
    RowVersion ROWVERSION,
    /* NULL batch = non-batch balance row; persisted key for unique index. */
    BatchIdScope AS ISNULL(BatchId, 0) PERSISTED,
    CONSTRAINT FK_InventoryBalances_Variant FOREIGN KEY (ProductVariantId) REFERENCES dbo.ProductVariants(ProductVariantId),
    CONSTRAINT FK_InventoryBalances_Warehouse FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouses(WarehouseId),
    CONSTRAINT FK_InventoryBalances_Batch FOREIGN KEY (BatchId) REFERENCES dbo.Batches(BatchId)
  );
  CREATE UNIQUE INDEX UX_InventoryBalances_Scope
    ON dbo.InventoryBalances(TenantId, OrganizationId, ProductVariantId, WarehouseId, BatchIdScope);
  CREATE INDEX IX_InventoryBalances_WarehouseLow
    ON dbo.InventoryBalances(TenantId, OrganizationId, WarehouseId, OnHandQty);
END

/* =========================================================================
   8. Reservations (Reserve → Release → Commit lifecycle)
   ========================================================================= */
IF OBJECT_ID(N'dbo.InventoryReservations', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.InventoryReservations (
    InventoryReservationId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    ReferenceCode NVARCHAR(40) NULL,
    CustomerId BIGINT NULL,
    CustomerLabel NVARCHAR(200) NULL,
    ReservationDateUtc DATETIME2 NOT NULL CONSTRAINT DF_InventoryReservations_ReservationDate DEFAULT (SYSUTCDATETIME()),
    ValidUntilUtc DATETIME2 NULL,
    Status NVARCHAR(24) NOT NULL CONSTRAINT DF_InventoryReservations_Status DEFAULT (N'Active'),
    Notes NVARCHAR(500) NULL,
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_InventoryReservations_CreatedUtc DEFAULT (SYSUTCDATETIME()),
    CreatedBy NVARCHAR(120) NULL,
    UpdatedUtc DATETIME2 NULL,
    CONSTRAINT FK_InventoryReservations_Customer FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId)
  );
  CREATE INDEX IX_InventoryReservations_Org_Status
    ON dbo.InventoryReservations(TenantId, OrganizationId, Status, ValidUntilUtc);
END

IF OBJECT_ID(N'dbo.InventoryReservationLines', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.InventoryReservationLines (
    InventoryReservationLineId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    InventoryReservationId BIGINT NOT NULL,
    ProductVariantId BIGINT NOT NULL,
    WarehouseId BIGINT NOT NULL,
    BatchId BIGINT NULL,
    ProductSerialId BIGINT NULL,
    Quantity DECIMAL(18,6) NOT NULL,
    LedgerReserveTransactionId BIGINT NULL,
    LedgerReleaseTransactionId BIGINT NULL,
    LedgerCommitTransactionId BIGINT NULL,
    Status NVARCHAR(24) NOT NULL CONSTRAINT DF_InventoryReservationLines_Status DEFAULT (N'Active'),
    CONSTRAINT FK_InventoryReservationLines_Reservation FOREIGN KEY (InventoryReservationId)
      REFERENCES dbo.InventoryReservations(InventoryReservationId) ON DELETE CASCADE,
    CONSTRAINT FK_InventoryReservationLines_Variant FOREIGN KEY (ProductVariantId) REFERENCES dbo.ProductVariants(ProductVariantId),
    CONSTRAINT FK_InventoryReservationLines_Warehouse FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouses(WarehouseId)
  );
  CREATE INDEX IX_InventoryReservationLines_Reservation ON dbo.InventoryReservationLines(InventoryReservationId);
END

/* =========================================================================
   9. AuditLog + OutboxEvent
   ========================================================================= */
IF OBJECT_ID(N'dbo.AuditLog', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.AuditLog (
    AuditLogId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    EntityName NVARCHAR(80) NOT NULL,
    EntityId NVARCHAR(80) NOT NULL,
    Action NVARCHAR(32) NOT NULL,
    OldValueJson NVARCHAR(MAX) NULL,
    NewValueJson NVARCHAR(MAX) NULL,
    Reason NVARCHAR(500) NULL,
    UserId NVARCHAR(120) NULL,
    CorrelationId NVARCHAR(80) NULL,
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_AuditLog_CreatedUtc DEFAULT (SYSUTCDATETIME())
  );
  CREATE INDEX IX_AuditLog_Entity ON dbo.AuditLog(TenantId, OrganizationId, EntityName, EntityId);
  CREATE INDEX IX_AuditLog_Created ON dbo.AuditLog(TenantId, OrganizationId, CreatedUtc DESC);
END

IF OBJECT_ID(N'dbo.OutboxEvents', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.OutboxEvents (
    OutboxEventId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    EventType NVARCHAR(80) NOT NULL,
    PayloadJson NVARCHAR(MAX) NOT NULL,
    CorrelationId NVARCHAR(80) NULL,
    AttemptCount INT NOT NULL CONSTRAINT DF_OutboxEvents_Attempts DEFAULT (0),
    PublishedUtc DATETIME2 NULL,
    NextAttemptUtc DATETIME2 NULL,
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_OutboxEvents_CreatedUtc DEFAULT (SYSUTCDATETIME())
  );
  CREATE INDEX IX_OutboxEvents_Pending
    ON dbo.OutboxEvents(TenantId, OrganizationId, PublishedUtc, NextAttemptUtc)
    WHERE PublishedUtc IS NULL;
END

/* =========================================================================
   10. Seed canonical base inventory units per organization (idempotent)
   ========================================================================= */
IF OBJECT_ID(N'dbo.InventoryUnits', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.Organizations', N'U') IS NOT NULL
BEGIN
  ;WITH wanted AS (
    SELECT N'piece' AS Code, N'Piece' AS Name, N'Count' AS Kind, 0 AS Prec UNION ALL
    SELECT N'box',    N'Box',          N'Count',  0 UNION ALL
    SELECT N'kg',     N'Kilogram',     N'Weight', 3 UNION ALL
    SELECT N'gram',   N'Gram',         N'Weight', 3 UNION ALL
    SELECT N'litre',  N'Litre',        N'Volume', 3 UNION ALL
    SELECT N'ml',     N'Millilitre',   N'Volume', 0 UNION ALL
    SELECT N'metre',  N'Metre',        N'Length', 3 UNION ALL
    SELECT N'cm',     N'Centimetre',   N'Length', 1
  )
  INSERT INTO dbo.InventoryUnits (TenantId, OrganizationId, Code, Name, UnitKind, DecimalPrecision, IsBaseUnit)
  SELECT o.TenantId, o.OrganizationId, w.Code, w.Name, w.Kind, w.Prec, 1
  FROM dbo.Organizations o
  CROSS JOIN wanted w
  WHERE o.IsActive = 1
    AND NOT EXISTS (
      SELECT 1 FROM dbo.InventoryUnits u
      WHERE u.TenantId = o.TenantId AND u.OrganizationId = o.OrganizationId AND u.Code = w.Code AND u.IsDeleted = 0);
END
