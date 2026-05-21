/* Universal inventory extras: returns/RMA, stock counts, adjustment approvals, BOM/kits,
   sale-line serials/cost allocations, cost layers, license keys.
   Apply after 017. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

/* =========================================================================
   1. Returns (customer + supplier)
   ========================================================================= */
IF OBJECT_ID(N'dbo.ReturnAuthorizations', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ReturnAuthorizations (
    ReturnAuthorizationId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    ReturnNumber NVARCHAR(40) NULL,
    ReturnType NVARCHAR(24) NOT NULL,                  -- CustomerReturn | SupplierReturn | Exchange | WarrantyClaim
    SourceDocumentType NVARCHAR(40) NULL,              -- Invoice | PurchaseBill
    SourceDocumentId BIGINT NULL,
    PartyId BIGINT NULL,                               -- customer for sale return, supplier for purchase return
    WarehouseId BIGINT NULL,
    Reason NVARCHAR(400) NULL,
    Status NVARCHAR(32) NOT NULL CONSTRAINT DF_ReturnAuthorizations_Status DEFAULT (N'Requested'),
    TotalRefundAmount DECIMAL(18,2) NULL,
    Notes NVARCHAR(1000) NULL,
    RequestedUtc DATETIME2 NOT NULL CONSTRAINT DF_ReturnAuthorizations_RequestedUtc DEFAULT (SYSUTCDATETIME()),
    ApprovedUtc DATETIME2 NULL,
    ReceivedUtc DATETIME2 NULL,
    InspectedUtc DATETIME2 NULL,
    CompletedUtc DATETIME2 NULL,
    CreatedBy NVARCHAR(120) NULL,
    CONSTRAINT FK_ReturnAuthorizations_Party FOREIGN KEY (PartyId) REFERENCES dbo.Parties(PartyId),
    CONSTRAINT FK_ReturnAuthorizations_Warehouse FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouses(WarehouseId)
  );
  CREATE UNIQUE INDEX UX_ReturnAuthorizations_Number ON dbo.ReturnAuthorizations(ReturnNumber) WHERE ReturnNumber IS NOT NULL;
  CREATE INDEX IX_ReturnAuthorizations_Org_Status ON dbo.ReturnAuthorizations(TenantId, OrganizationId, Status);
END

IF OBJECT_ID(N'dbo.ReturnLines', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ReturnLines (
    ReturnLineId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    ReturnAuthorizationId BIGINT NOT NULL,
    ProductVariantId BIGINT NULL,
    ProductSerialId BIGINT NULL,
    BatchId BIGINT NULL,
    Quantity DECIMAL(18,6) NOT NULL,
    UnitRefundAmount DECIMAL(18,4) NULL,
    LineRefundAmount DECIMAL(18,2) NULL,
    Reason NVARCHAR(200) NULL,
    Disposition NVARCHAR(24) NULL,                     -- Sellable | Damaged | Repair | Refurbish | Scrap | SupplierReturn
    InspectionResult NVARCHAR(24) NULL,
    Notes NVARCHAR(500) NULL,
    CONSTRAINT FK_ReturnLines_Header FOREIGN KEY (ReturnAuthorizationId) REFERENCES dbo.ReturnAuthorizations(ReturnAuthorizationId) ON DELETE CASCADE,
    CONSTRAINT FK_ReturnLines_Variant FOREIGN KEY (ProductVariantId) REFERENCES dbo.ProductVariants(ProductVariantId),
    CONSTRAINT FK_ReturnLines_Serial FOREIGN KEY (ProductSerialId) REFERENCES dbo.ProductSerials(ProductSerialId),
    CONSTRAINT FK_ReturnLines_Batch FOREIGN KEY (BatchId) REFERENCES dbo.Batches(BatchId)
  );
  CREATE INDEX IX_ReturnLines_Header ON dbo.ReturnLines(ReturnAuthorizationId);
END

/* =========================================================================
   2. Physical stock counts
   ========================================================================= */
IF OBJECT_ID(N'dbo.StockCountSessions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.StockCountSessions (
    StockCountSessionId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    WarehouseId BIGINT NOT NULL,
    SessionDate DATETIME2 NOT NULL CONSTRAINT DF_StockCountSessions_SessionDate DEFAULT (SYSUTCDATETIME()),
    Reason NVARCHAR(200) NULL,
    Notes NVARCHAR(500) NULL,
    Status NVARCHAR(24) NOT NULL CONSTRAINT DF_StockCountSessions_Status DEFAULT (N'Draft'),
    PostedUtc DATETIME2 NULL,
    CreatedBy NVARCHAR(120) NULL,
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_StockCountSessions_CreatedUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_StockCountSessions_Warehouse FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouses(WarehouseId)
  );
  CREATE INDEX IX_StockCountSessions_Org_Status ON dbo.StockCountSessions(TenantId, OrganizationId, Status);
END

IF OBJECT_ID(N'dbo.StockCountLines', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.StockCountLines (
    StockCountLineId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    StockCountSessionId BIGINT NOT NULL,
    ProductVariantId BIGINT NOT NULL,
    BatchId BIGINT NULL,
    SystemQty DECIMAL(18,6) NOT NULL CONSTRAINT DF_StockCountLines_SystemQty DEFAULT (0),
    ActualQty DECIMAL(18,6) NULL,
    AdjustmentQty AS (ISNULL(ActualQty, 0) - SystemQty),
    Reason NVARCHAR(200) NULL,
    Notes NVARCHAR(500) NULL,
    CONSTRAINT FK_StockCountLines_Session FOREIGN KEY (StockCountSessionId)
      REFERENCES dbo.StockCountSessions(StockCountSessionId) ON DELETE CASCADE,
    CONSTRAINT FK_StockCountLines_Variant FOREIGN KEY (ProductVariantId)
      REFERENCES dbo.ProductVariants(ProductVariantId)
  );
  CREATE INDEX IX_StockCountLines_Session ON dbo.StockCountLines(StockCountSessionId);
END

/* =========================================================================
   3. Inventory adjustment approval workflow
   ========================================================================= */
IF OBJECT_ID(N'dbo.InventoryAdjustmentApprovals', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.InventoryAdjustmentApprovals (
    InventoryAdjustmentApprovalId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    AdjustmentNumber NVARCHAR(40) NULL,
    WarehouseId BIGINT NOT NULL,
    Reason NVARCHAR(200) NOT NULL,
    Notes NVARCHAR(500) NULL,
    Status NVARCHAR(24) NOT NULL CONSTRAINT DF_InventoryAdjustmentApprovals_Status DEFAULT (N'Draft'),
    PayloadJson NVARCHAR(MAX) NULL,
    RequestedBy NVARCHAR(120) NULL,
    RequestedUtc DATETIME2 NOT NULL CONSTRAINT DF_InventoryAdjustmentApprovals_RequestedUtc DEFAULT (SYSUTCDATETIME()),
    ApprovedBy NVARCHAR(120) NULL,
    ApprovedUtc DATETIME2 NULL,
    RejectedBy NVARCHAR(120) NULL,
    RejectedUtc DATETIME2 NULL,
    CONSTRAINT FK_InventoryAdjustmentApprovals_Warehouse FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouses(WarehouseId)
  );
  CREATE INDEX IX_InventoryAdjustmentApprovals_Org_Status
    ON dbo.InventoryAdjustmentApprovals(TenantId, OrganizationId, Status);
END

/* =========================================================================
   4. Product bundles / kits (BOM)
   ========================================================================= */
IF OBJECT_ID(N'dbo.ProductBundleComponents', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductBundleComponents (
    ProductBundleComponentId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    ParentProductVariantId BIGINT NOT NULL,
    ChildProductVariantId BIGINT NOT NULL,
    Quantity DECIMAL(18,6) NOT NULL CONSTRAINT DF_ProductBundleComponents_Qty DEFAULT (1),
    IsOptional BIT NOT NULL CONSTRAINT DF_ProductBundleComponents_IsOptional DEFAULT (0),
    SortOrder INT NOT NULL CONSTRAINT DF_ProductBundleComponents_SortOrder DEFAULT (0),
    CONSTRAINT FK_ProductBundleComponents_Parent FOREIGN KEY (ParentProductVariantId) REFERENCES dbo.ProductVariants(ProductVariantId),
    CONSTRAINT FK_ProductBundleComponents_Child FOREIGN KEY (ChildProductVariantId) REFERENCES dbo.ProductVariants(ProductVariantId),
    CONSTRAINT CK_ProductBundleComponents_NotSelf CHECK (ParentProductVariantId <> ChildProductVariantId)
  );
  CREATE INDEX IX_ProductBundleComponents_Parent ON dbo.ProductBundleComponents(TenantId, OrganizationId, ParentProductVariantId);
END

/* =========================================================================
   5. Sales invoice line — serial + cost split for item-wise profitability
   ========================================================================= */
IF OBJECT_ID(N'dbo.SalesInvoiceLineSerials', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SalesInvoiceLineSerials (
    SalesInvoiceLineSerialId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    InvoiceLineId BIGINT NOT NULL,
    ProductSerialId BIGINT NOT NULL,
    SellingPrice DECIMAL(18,4) NULL,
    CostPrice DECIMAL(18,4) NULL,
    GrossProfit DECIMAL(18,4) NULL,
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_SalesInvoiceLineSerials_CreatedUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_SalesInvoiceLineSerials_Line FOREIGN KEY (InvoiceLineId) REFERENCES dbo.InvoiceLines(InvoiceLineId),
    CONSTRAINT FK_SalesInvoiceLineSerials_Serial FOREIGN KEY (ProductSerialId) REFERENCES dbo.ProductSerials(ProductSerialId)
  );
  CREATE UNIQUE INDEX UX_SalesInvoiceLineSerials_Serial
    ON dbo.SalesInvoiceLineSerials(TenantId, OrganizationId, ProductSerialId);
  CREATE INDEX IX_SalesInvoiceLineSerials_Line ON dbo.SalesInvoiceLineSerials(InvoiceLineId);
END

IF OBJECT_ID(N'dbo.SalesInvoiceLineCostAllocations', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SalesInvoiceLineCostAllocations (
    SalesInvoiceLineCostAllocationId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    InvoiceLineId BIGINT NOT NULL,
    BatchId BIGINT NULL,
    PurchaseLineId BIGINT NULL,
    InventoryCostLayerId BIGINT NULL,
    Quantity DECIMAL(18,6) NOT NULL,
    CostPerUnit DECIMAL(18,4) NOT NULL,
    TotalCost DECIMAL(18,4) NOT NULL,
    CostingMethod NVARCHAR(24) NOT NULL,
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_SalesInvoiceLineCostAllocations_CreatedUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_SalesInvoiceLineCostAllocations_Line FOREIGN KEY (InvoiceLineId) REFERENCES dbo.InvoiceLines(InvoiceLineId)
  );
  CREATE INDEX IX_SalesInvoiceLineCostAllocations_Line ON dbo.SalesInvoiceLineCostAllocations(InvoiceLineId);
END

/* =========================================================================
   6. Cost layers (FIFO / weighted average)
   ========================================================================= */
IF OBJECT_ID(N'dbo.InventoryCostLayers', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.InventoryCostLayers (
    InventoryCostLayerId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    ProductVariantId BIGINT NOT NULL,
    WarehouseId BIGINT NOT NULL,
    BatchId BIGINT NULL,
    PurchaseLineId BIGINT NULL,
    ReceivedUtc DATETIME2 NOT NULL,
    QuantityReceived DECIMAL(18,6) NOT NULL,
    QuantityRemaining DECIMAL(18,6) NOT NULL,
    CostPerUnit DECIMAL(18,4) NOT NULL,
    Status NVARCHAR(24) NOT NULL CONSTRAINT DF_InventoryCostLayers_Status DEFAULT (N'Open'),
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_InventoryCostLayers_CreatedUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_InventoryCostLayers_Variant FOREIGN KEY (ProductVariantId) REFERENCES dbo.ProductVariants(ProductVariantId),
    CONSTRAINT FK_InventoryCostLayers_Warehouse FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouses(WarehouseId)
  );
  CREATE INDEX IX_InventoryCostLayers_Lookup
    ON dbo.InventoryCostLayers(TenantId, OrganizationId, ProductVariantId, WarehouseId, ReceivedUtc);
END

/* =========================================================================
   7. License keys (digital products) — optional, prepared for phase 2.
   ========================================================================= */
IF OBJECT_ID(N'dbo.ProductLicenseKeys', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductLicenseKeys (
    ProductLicenseKeyId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    ProductVariantId BIGINT NOT NULL,
    LicenseKey NVARCHAR(200) NOT NULL,
    Status NVARCHAR(24) NOT NULL CONSTRAINT DF_ProductLicenseKeys_Status DEFAULT (N'Available'),
    DeliveredUtc DATETIME2 NULL,
    SoldInvoiceLineId BIGINT NULL,
    Notes NVARCHAR(500) NULL,
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_ProductLicenseKeys_CreatedUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_ProductLicenseKeys_Variant FOREIGN KEY (ProductVariantId) REFERENCES dbo.ProductVariants(ProductVariantId)
  );
  CREATE UNIQUE INDEX UX_ProductLicenseKeys_Key
    ON dbo.ProductLicenseKeys(TenantId, OrganizationId, ProductVariantId, LicenseKey);
END
