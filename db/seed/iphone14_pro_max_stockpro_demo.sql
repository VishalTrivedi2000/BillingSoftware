/*
  StockPro-style demo seed: iPhone 14 Pro Max 256GB
  - Product + 4 color variants
  - 4 warehouses + warehouse stock distribution (245 units on default variant)
  - Purchase bills, sales invoices, customers, supplier party
  - Serial / IMEI rows (sample set + extra units for pagination demo)
  - Inventory ledger + balances

  Target: TenantId = 1, OrganizationId = 1 (default dev seed)
  Idempotent: skips if product SKU IP14PM-256-PRP already exists for org 1.

  Run on BSDB (e.g. DESKTOP-4TKGMET):
    sqlcmd -S DESKTOP-4TKGMET -d BSDB -E -i db\seed\iphone14_pro_max_stockpro_demo.sql
*/
SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

DECLARE @TenantId BIGINT = 1;
DECLARE @OrgId BIGINT = 1;

IF NOT EXISTS (SELECT 1 FROM dbo.Tenants WHERE TenantId = @TenantId)
   OR NOT EXISTS (SELECT 1 FROM dbo.Organizations WHERE OrganizationId = @OrgId)
BEGIN
  RAISERROR(N'Run migrations 001–020 first. Expected TenantId=1 and OrganizationId=1.', 16, 1);
  RETURN;
END

IF EXISTS (
  SELECT 1 FROM dbo.Products
  WHERE TenantId = @TenantId AND OrganizationId = @OrgId AND Sku = N'IP14PM-256-PRP')
BEGIN
  PRINT N'Demo iPhone product already seeded (SKU IP14PM-256-PRP). Skipping.';
  RETURN;
END

/* ---------- Reference tables ---------- */
DECLARE @CategoryId BIGINT;
DECLARE @BrandId BIGINT;
DECLARE @UnitId BIGINT;

IF NOT EXISTS (SELECT 1 FROM dbo.ProductCategories WHERE TenantId = @TenantId AND OrganizationId = @OrgId AND Slug = N'smartphones')
BEGIN
  INSERT INTO dbo.ProductCategories (TenantId, OrganizationId, ParentCategoryId, Slug, Name, SortOrder, IsActive)
  VALUES (@TenantId, @OrgId, NULL, N'smartphones', N'Smartphones', 10, 1);
END
SELECT @CategoryId = CategoryId FROM dbo.ProductCategories
WHERE TenantId = @TenantId AND OrganizationId = @OrgId AND Slug = N'smartphones';

IF NOT EXISTS (SELECT 1 FROM dbo.ProductBrands WHERE TenantId = @TenantId AND OrganizationId = @OrgId AND Slug = N'apple')
BEGIN
  INSERT INTO dbo.ProductBrands (TenantId, OrganizationId, Slug, Name, SortOrder, IsActive)
  VALUES (@TenantId, @OrgId, N'apple', N'Apple', 10, 1);
END
SELECT @BrandId = BrandId FROM dbo.ProductBrands
WHERE TenantId = @TenantId AND OrganizationId = @OrgId AND Slug = N'apple';

IF NOT EXISTS (SELECT 1 FROM dbo.ProductUnits WHERE TenantId = @TenantId AND OrganizationId = @OrgId AND Code = N'EA')
BEGIN
  INSERT INTO dbo.ProductUnits (TenantId, OrganizationId, Code, DisplayName, SortOrder, IsActive)
  VALUES (@TenantId, @OrgId, N'EA', N'Each', 1, 1);
END
SELECT @UnitId = UnitId FROM dbo.ProductUnits
WHERE TenantId = @TenantId AND OrganizationId = @OrgId AND Code = N'EA';

/* ---------- Warehouses (StockPro names) ---------- */
DECLARE @WhMain BIGINT, @WhDowntown BIGINT, @WhAirport BIGINT, @WhOnline BIGINT;

IF NOT EXISTS (SELECT 1 FROM dbo.Warehouses WHERE TenantId = @TenantId AND OrganizationId = @OrgId AND Code = N'MAIN')
  INSERT INTO dbo.Warehouses (TenantId, OrganizationId, Code, Name, WarehouseType, IsDefault, IsActive)
  VALUES (@TenantId, @OrgId, N'MAIN', N'Main Warehouse', N'Distribution', 1, 1);
SELECT @WhMain = WarehouseId FROM dbo.Warehouses WHERE TenantId = @TenantId AND OrganizationId = @OrgId AND Code = N'MAIN';

IF NOT EXISTS (SELECT 1 FROM dbo.Warehouses WHERE TenantId = @TenantId AND OrganizationId = @OrgId AND Code = N'DOWNTOWN')
  INSERT INTO dbo.Warehouses (TenantId, OrganizationId, Code, Name, WarehouseType, IsDefault, IsActive)
  VALUES (@TenantId, @OrgId, N'DOWNTOWN', N'Downtown Store', N'Store', 0, 1);
SELECT @WhDowntown = WarehouseId FROM dbo.Warehouses WHERE TenantId = @TenantId AND OrganizationId = @OrgId AND Code = N'DOWNTOWN';

IF NOT EXISTS (SELECT 1 FROM dbo.Warehouses WHERE TenantId = @TenantId AND OrganizationId = @OrgId AND Code = N'AIRPORT')
  INSERT INTO dbo.Warehouses (TenantId, OrganizationId, Code, Name, WarehouseType, IsDefault, IsActive)
  VALUES (@TenantId, @OrgId, N'AIRPORT', N'Airport Store', N'Store', 0, 1);
SELECT @WhAirport = WarehouseId FROM dbo.Warehouses WHERE TenantId = @TenantId AND OrganizationId = @OrgId AND Code = N'AIRPORT';

IF NOT EXISTS (SELECT 1 FROM dbo.Warehouses WHERE TenantId = @TenantId AND OrganizationId = @OrgId AND Code = N'ONLINE')
  INSERT INTO dbo.Warehouses (TenantId, OrganizationId, Code, Name, WarehouseType, IsDefault, IsActive)
  VALUES (@TenantId, @OrgId, N'ONLINE', N'Online Warehouse', N'Fulfillment', 0, 1);
SELECT @WhOnline = WarehouseId FROM dbo.Warehouses WHERE TenantId = @TenantId AND OrganizationId = @OrgId AND Code = N'ONLINE';

/* ---------- Product (parent SKU = default variant) ---------- */
DECLARE @ProductId BIGINT;

INSERT INTO dbo.Products (
  TenantId, OrganizationId, CategoryId, BrandId, UnitId,
  Sku, Name, Brand, UnitPrice, StockQty, LowStockThreshold,
  HsnCode, Description, Mrp, PurchasePrice, TaxRatePercent,
  StorageLocation, IsService,
  Tags, Manufacturer, Barcode, CountryOfOrigin, InternalCode, ManufacturerPartNo, Visibility,
  ProductNature, InventoryTrackingMode, HasVariants,
  AllowNegativeStock, LeadTimeDays, WarrantyMonths, ShelfLifeDays, IsReturnable, LowStockAlert,
  IsActive)
VALUES (
  @TenantId, @OrgId, @CategoryId, @BrandId, @UnitId,
  N'IP14PM-256-PRP', N'iPhone 14 Pro Max 256GB', N'Apple', 135000, 245, 10,
  N'85171200',
  N'Premium flagship smartphone with ProMotion display and 48MP camera.' + CHAR(10) + CHAR(10)
    + N'Apple A16 Bionic, 256GB storage, iOS 18 ready.',
  149900, 105000, 18,
  N'A-12-04', 0,
  N'Smartphone, Apple, Premium Device', N'Apple Inc.', N'8901234567890', N'China', N'PRD-IP14PM-256', N'MQ9T3HN/A',
  N'Visible in Sales Channels',
  N'Physical', N'Serial', 1,
  0, 7, 12, NULL, 1, 1,
  1);

SET @ProductId = SCOPE_IDENTITY();

/* ---------- Variants (4 colors) ---------- */
DECLARE @VarPurple BIGINT, @VarGold BIGINT, @VarSilver BIGINT, @VarBlack BIGINT;

INSERT INTO dbo.ProductVariants (
  TenantId, OrganizationId, ProductId, Sku, Barcode, DisplayName, AttributeHash,
  Mrp, SalePrice, PurchasePrice, InventoryTrackingMode, IsDefault, Status, IsActive)
VALUES
  (@TenantId, @OrgId, @ProductId, N'IP14PM-256-PRP', N'8901234567890', N'Deep Purple 256GB', N'@color:deep-purple',
   149900, 135000, 105000, N'Serial', 1, N'Active', 1);
SET @VarPurple = SCOPE_IDENTITY();

INSERT INTO dbo.ProductVariants (
  TenantId, OrganizationId, ProductId, Sku, Barcode, DisplayName, AttributeHash,
  Mrp, SalePrice, PurchasePrice, InventoryTrackingMode, IsDefault, Status, IsActive)
VALUES
  (@TenantId, @OrgId, @ProductId, N'IP14PM-256-GLD', N'8901234567891', N'Gold 256GB', N'@color:gold',
   149900, 135000, 105000, N'Serial', 0, N'Active', 1);
SET @VarGold = SCOPE_IDENTITY();

INSERT INTO dbo.ProductVariants (
  TenantId, OrganizationId, ProductId, Sku, Barcode, DisplayName, AttributeHash,
  Mrp, SalePrice, PurchasePrice, InventoryTrackingMode, IsDefault, Status, IsActive)
VALUES
  (@TenantId, @OrgId, @ProductId, N'IP14PM-256-SLV', N'8901234567892', N'Silver 256GB', N'@color:silver',
   149900, 135000, 105000, N'Serial', 0, N'Active', 1);
SET @VarSilver = SCOPE_IDENTITY();

INSERT INTO dbo.ProductVariants (
  TenantId, OrganizationId, ProductId, Sku, Barcode, DisplayName, AttributeHash,
  Mrp, SalePrice, PurchasePrice, InventoryTrackingMode, IsDefault, Status, IsActive)
VALUES
  (@TenantId, @OrgId, @ProductId, N'IP14PM-256-BLK', N'8901234567893', N'Space Black 256GB', N'@color:space-black',
   149900, 135000, 107000, N'Serial', 0, N'Active', 1);
SET @VarBlack = SCOPE_IDENTITY();

UPDATE dbo.Products
SET DefaultVariantId = @VarPurple, HasVariants = 1, InventoryTrackingMode = N'Serial'
WHERE ProductId = @ProductId;

INSERT INTO dbo.ProductVariantAttributes (ProductVariantId, [Key], [Value])
VALUES
  (@VarPurple, N'Color', N'Deep Purple'),
  (@VarGold, N'Color', N'Gold'),
  (@VarSilver, N'Color', N'Silver'),
  (@VarBlack, N'Color', N'Space Black');

/* ---------- Parties & customers ---------- */
DECLARE @VendorPartyId BIGINT;
IF NOT EXISTS (SELECT 1 FROM dbo.Parties WHERE TenantId = @TenantId AND OrganizationId = @OrgId AND DisplayName = N'Apple Authorized Distributor')
BEGIN
  INSERT INTO dbo.Parties (TenantId, OrganizationId, Kind, DisplayName, LegalName, Email, Phone, IsActive)
  VALUES (@TenantId, @OrgId, N'Vendor', N'Apple Authorized Distributor', N'Apple India Pvt Ltd', N'procurement@apple-dist.demo', N'+91-80-00000001', 1);
END
SELECT @VendorPartyId = PartyId FROM dbo.Parties
WHERE TenantId = @TenantId AND OrganizationId = @OrgId AND DisplayName = N'Apple Authorized Distributor';

DECLARE @CustMichael BIGINT, @CustSarah BIGINT;
IF NOT EXISTS (SELECT 1 FROM dbo.Customers WHERE Name = N'Michael Brown')
  INSERT INTO dbo.Customers (TenantId, OrganizationId, Name, Email, Phone)
  VALUES (@TenantId, @OrgId, N'Michael Brown', N'michael.brown@demo.mail', N'+91-9876500001');
SELECT @CustMichael = CustomerId FROM dbo.Customers WHERE TenantId = @TenantId AND OrganizationId = @OrgId AND Name = N'Michael Brown';

IF NOT EXISTS (SELECT 1 FROM dbo.Customers WHERE Name = N'Sarah Johnson')
  INSERT INTO dbo.Customers (TenantId, OrganizationId, Name, Email, Phone)
  VALUES (@TenantId, @OrgId, N'Sarah Johnson', N'sarah.johnson@demo.mail', N'+91-9876500002');
SELECT @CustSarah = CustomerId FROM dbo.Customers WHERE TenantId = @TenantId AND OrganizationId = @OrgId AND Name = N'Sarah Johnson';

/* ---------- Purchase bills (GRN) ---------- */
DECLARE @Po1 BIGINT, @Po2 BIGINT;
DECLARE @Po1Line BIGINT, @Po2Line BIGINT;

INSERT INTO dbo.PurchaseBills (TenantId, OrganizationId, PartyId, PurchaseNumber, ReceivedUtc, Currency, TotalAmount, Status)
VALUES (@TenantId, @OrgId, @VendorPartyId, N'PO-2025-0418-0023', '2025-04-18T10:00:00', N'INR', 5250000, N'Posted');
SET @Po1 = SCOPE_IDENTITY();

INSERT INTO dbo.PurchaseLines (PurchaseBillId, ProductId, Description, Quantity, UnitCost, LineTotal)
VALUES (@Po1, @ProductId, N'iPhone 14 Pro Max 256GB — batch 0418 (5000 units)', 5000, 1050, 5250000);
SET @Po1Line = SCOPE_IDENTITY();

INSERT INTO dbo.PurchaseBills (TenantId, OrganizationId, PartyId, PurchaseNumber, ReceivedUtc, Currency, TotalAmount, Status)
VALUES (@TenantId, @OrgId, @VendorPartyId, N'PO-2025-0422-0077', '2025-04-22T14:30:00', N'INR', 2140000, N'Posted');
SET @Po2 = SCOPE_IDENTITY();

INSERT INTO dbo.PurchaseLines (PurchaseBillId, ProductId, Description, Quantity, UnitCost, LineTotal)
VALUES (@Po2, @ProductId, N'iPhone 14 Pro Max 256GB — batch 0422 (2000 units)', 2000, 1070, 2140000);
SET @Po2Line = SCOPE_IDENTITY();

/* ---------- Sales invoices ---------- */
DECLARE @Inv1 BIGINT, @Inv2 BIGINT;
DECLARE @Inv1Line BIGINT, @Inv2Line BIGINT;

INSERT INTO dbo.Invoices (TenantId, OrganizationId, CustomerId, InvoiceNumber, IssueUtc, Currency, TotalAmount, Status)
VALUES (@TenantId, @OrgId, @CustMichael, N'INV-2025-0521-1187', '2025-05-21T11:20:00', N'INR', 135000, N'Posted');
SET @Inv1 = SCOPE_IDENTITY();

INSERT INTO dbo.InvoiceLines (InvoiceId, ProductId, Description, Quantity, UnitPrice, LineTotal)
VALUES (@Inv1, @ProductId, N'iPhone 14 Pro Max 256GB — Deep Purple', 1, 135000, 135000);
SET @Inv1Line = SCOPE_IDENTITY();

INSERT INTO dbo.Invoices (TenantId, OrganizationId, CustomerId, InvoiceNumber, IssueUtc, Currency, TotalAmount, Status)
VALUES (@TenantId, @OrgId, @CustSarah, N'INV-2025-0530-1299', '2025-05-30T16:45:00', N'INR', 138000, N'Posted');
SET @Inv2 = SCOPE_IDENTITY();

INSERT INTO dbo.InvoiceLines (InvoiceId, ProductId, Description, Quantity, UnitPrice, LineTotal)
VALUES (@Inv2, @ProductId, N'iPhone 14 Pro Max 256GB — Deep Purple', 1, 138000, 138000);
SET @Inv2Line = SCOPE_IDENTITY();

/* Credit note style return (second invoice line on same customer for demo) */
DECLARE @InvReturn BIGINT, @InvReturnLine BIGINT;
INSERT INTO dbo.Invoices (TenantId, OrganizationId, CustomerId, InvoiceNumber, IssueUtc, Currency, TotalAmount, Status)
VALUES (@TenantId, @OrgId, @CustMichael, N'CRN-2025-0525-0012', '2025-05-25T09:00:00', N'INR', -135000, N'Posted');
SET @InvReturn = SCOPE_IDENTITY();
INSERT INTO dbo.InvoiceLines (InvoiceId, ProductId, Description, Quantity, UnitPrice, LineTotal)
VALUES (@InvReturn, @ProductId, N'Return — iPhone 14 Pro Max (Michael Brown)', 1, -135000, -135000);
SET @InvReturnLine = SCOPE_IDENTITY();

/* ---------- Serial / IMEI (screenshot rows + extras for demo counts) ---------- */
/* Status values match UI: Available (=In Stock), Reserved, Sold, Returned, Damaged (=Repair) */

INSERT INTO dbo.ProductSerials (
  TenantId, OrganizationId, ProductVariantId, SerialNumber, Imei1,
  WarehouseId, PurchaseLineId, PurchaseCostPerUnit, Status, SoldInvoiceLineId,
  WarrantyStartUtc, WarrantyEndUtc, Notes)
VALUES
  (@TenantId, @OrgId, @VarPurple, N'357593980123456', N'357593980123456', @WhMain, @Po1Line, 1050, N'Available', NULL,
   '2025-04-18', DATEADD(MONTH, 12, '2025-04-18'), NULL),
  (@TenantId, @OrgId, @VarPurple, N'357593980123457', N'357593980123457', @WhDowntown, @Po1Line, 1050, N'Reserved', NULL,
   '2025-04-18', DATEADD(MONTH, 12, '2025-04-18'), N'Reserved for walk-in customer'),
  (@TenantId, @OrgId, @VarPurple, N'357593980123458', N'357593980123458', NULL, @Po1Line, 1050, N'Sold', @Inv1Line,
   '2025-04-18', DATEADD(MONTH, 12, '2025-04-18'), N'Sold to Michael Brown'),
  (@TenantId, @OrgId, @VarPurple, N'357593980123459', N'357593980123459', NULL, @Po1Line, 1050, N'Returned', NULL,
   '2025-04-18', DATEADD(MONTH, 12, '2025-04-18'), N'Return CRN-2025-0525-0012'),
  (@TenantId, @OrgId, @VarPurple, N'357593980123460', N'357593980123460', @WhAirport, @Po2Line, 1070, N'Available', NULL,
   '2025-04-22', DATEADD(MONTH, 12, '2025-04-22'), NULL),
  (@TenantId, @OrgId, @VarPurple, N'357593980123461', N'357593980123461', @WhOnline, @Po2Line, 1070, N'Damaged', NULL,
   '2025-04-22', DATEADD(MONTH, 12, '2025-04-22'), N'In repair — screen replacement'),
  (@TenantId, @OrgId, @VarPurple, N'357593980123462', N'357593980123462', NULL, @Po2Line, 1070, N'Sold', @Inv2Line,
   '2025-04-22', DATEADD(MONTH, 12, '2025-04-22'), N'Sold to Sarah Johnson');

/* Extra serials per color for variants tab / serial pagination (not full 1,305) */
DECLARE @i INT = 1;
WHILE @i <= 12
BEGIN
  INSERT INTO dbo.ProductSerials (
    TenantId, OrganizationId, ProductVariantId, SerialNumber, WarehouseId,
    PurchaseLineId, PurchaseCostPerUnit, Status, WarrantyStartUtc, WarrantyEndUtc)
  VALUES (
    @TenantId, @OrgId, @VarGold, CONCAT(N'357593980200', RIGHT(CONCAT(N'000', @i), 3)),
    CASE @i % 4 WHEN 0 THEN @WhMain WHEN 1 THEN @WhDowntown WHEN 2 THEN @WhAirport ELSE @WhOnline END,
    @Po1Line, 1050, N'Available', '2025-04-18', DATEADD(MONTH, 12, '2025-04-18'));
  SET @i += 1;
END

SET @i = 1;
WHILE @i <= 8
BEGIN
  INSERT INTO dbo.ProductSerials (
    TenantId, OrganizationId, ProductVariantId, SerialNumber, WarehouseId,
    PurchaseLineId, PurchaseCostPerUnit, Status, WarrantyStartUtc, WarrantyEndUtc)
  VALUES (
    @TenantId, @OrgId, @VarSilver, CONCAT(N'357593980300', RIGHT(CONCAT(N'000', @i), 3)),
    @WhMain, @Po1Line, 1050, N'Available', '2025-04-18', DATEADD(MONTH, 12, '2025-04-18'));
  SET @i += 1;
END

SET @i = 1;
WHILE @i <= 6
BEGIN
  INSERT INTO dbo.ProductSerials (
    TenantId, OrganizationId, ProductVariantId, SerialNumber, WarehouseId,
    PurchaseLineId, PurchaseCostPerUnit, Status, WarrantyStartUtc, WarrantyEndUtc)
  VALUES (
    @TenantId, @OrgId, @VarBlack, CONCAT(N'357593980400', RIGHT(CONCAT(N'000', @i), 3)),
    @WhDowntown, @Po2Line, 1070, N'Available', '2025-04-22', DATEADD(MONTH, 12, '2025-04-22'));
  SET @i += 1;
END

/* Bulk Available serials on default variant to approach reference KPI scale in counts */
SET @i = 1;
WHILE @i <= 200
BEGIN
  INSERT INTO dbo.ProductSerials (
    TenantId, OrganizationId, ProductVariantId, SerialNumber, WarehouseId,
    PurchaseLineId, PurchaseCostPerUnit, Status)
  VALUES (
    @TenantId, @OrgId, @VarPurple, CONCAT(N'357593981', RIGHT(CONCAT(N'00000', @i), 5)),
    CASE @i % 4
      WHEN 0 THEN @WhMain WHEN 1 THEN @WhDowntown WHEN 2 THEN @WhAirport ELSE @WhOnline END,
    CASE WHEN @i <= 120 THEN @Po1Line ELSE @Po2Line END,
    CASE WHEN @i <= 120 THEN 1050 ELSE 1070 END,
    N'Available');
  SET @i += 1;
END

/* Sold serials history (drives sold-stock flavour in serial browse; invoice history separate) */
SET @i = 1;
WHILE @i <= 30
BEGIN
  INSERT INTO dbo.ProductSerials (
    TenantId, OrganizationId, ProductVariantId, SerialNumber,
    PurchaseLineId, PurchaseCostPerUnit, Status, SoldInvoiceLineId, WarrantyStartUtc, WarrantyEndUtc)
  VALUES (
    @TenantId, @OrgId, @VarPurple, CONCAT(N'357593982', RIGHT(CONCAT(N'00000', @i), 5)),
    @Po1Line, 1050, N'Sold', @Inv1Line, '2025-03-01', DATEADD(MONTH, 12, '2025-03-01'));
  SET @i += 1;
END

/* ---------- Inventory balances (warehouse donut: 128 + 68 + 28 + 21 = 245 on purple variant) ---------- */
MERGE dbo.InventoryBalances AS tgt
USING (
  SELECT @TenantId AS TenantId, @OrgId AS OrganizationId, @VarPurple AS ProductVariantId, @WhMain AS WarehouseId,
         CAST(128 AS DECIMAL(18,6)) AS OnHand, CAST(0 AS DECIMAL(18,6)) AS Reserved
  UNION ALL SELECT @TenantId, @OrgId, @VarPurple, @WhDowntown, 68, 1
  UNION ALL SELECT @TenantId, @OrgId, @VarPurple, @WhAirport, 28, 0
  UNION ALL SELECT @TenantId, @OrgId, @VarPurple, @WhOnline, 21, 0
  UNION ALL SELECT @TenantId, @OrgId, @VarGold, @WhMain, 5, 0
  UNION ALL SELECT @TenantId, @OrgId, @VarSilver, @WhMain, 4, 0
  UNION ALL SELECT @TenantId, @OrgId, @VarBlack, @WhDowntown, 3, 0
) AS src
ON tgt.TenantId = src.TenantId AND tgt.OrganizationId = src.OrganizationId
   AND tgt.ProductVariantId = src.ProductVariantId AND tgt.WarehouseId = src.WarehouseId
   AND tgt.BatchId IS NULL
WHEN MATCHED THEN
  UPDATE SET OnHandQty = src.OnHand, ReservedQty = src.Reserved, UpdatedUtc = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
  INSERT (TenantId, OrganizationId, ProductVariantId, WarehouseId, BatchId, OnHandQty, ReservedQty, AverageCost)
  VALUES (src.TenantId, src.OrganizationId, src.ProductVariantId, src.WarehouseId, NULL, src.OnHand, src.Reserved, 105000);

UPDATE dbo.Products SET StockQty = 245 WHERE ProductId = @ProductId;

/* ---------- Inventory ledger (purchases, sales, activity tab) ---------- */
INSERT INTO dbo.InventoryTransactions (
  TenantId, OrganizationId, ProductVariantId, WarehouseId, TransactionType, QuantityBucket,
  QtyChange, CostPerUnit, SourceDocumentType, SourceDocumentId, SourceLineId, IdempotencyKey, Reason, CreatedBy)
VALUES
  (@TenantId, @OrgId, @VarPurple, @WhMain, N'PURCHASE_RECEIPT', N'Available', 5000, 1050,
   N'PurchaseBill', @Po1, @Po1Line, CONCAT(N'PO-SEED:', @Po1), N'GRN PO-2025-0418-0023', N'seed:iphone14'),
  (@TenantId, @OrgId, @VarPurple, @WhMain, N'PURCHASE_RECEIPT', N'Available', 2000, 1070,
   N'PurchaseBill', @Po2, @Po2Line, CONCAT(N'PO-SEED:', @Po2), N'GRN PO-2025-0422-0077', N'seed:iphone14'),
  (@TenantId, @OrgId, @VarPurple, @WhMain, N'SALE_ISSUE', N'Available', -1, 1050,
   N'Invoice', @Inv1, @Inv1Line, CONCAT(N'INV-SEED:', @Inv1), N'Sale INV-2025-0521-1187', N'seed:iphone14'),
  (@TenantId, @OrgId, @VarPurple, @WhMain, N'SALE_ISSUE', N'Available', -1, 1070,
   N'Invoice', @Inv2, @Inv2Line, CONCAT(N'INV-SEED:', @Inv2), N'Sale INV-2025-0530-1299', N'seed:iphone14'),
  (@TenantId, @OrgId, @VarPurple, @WhMain, N'SALE_RETURN', N'Available', 1, 1050,
   N'Invoice', @InvReturn, @InvReturnLine, CONCAT(N'CRN-SEED:', @InvReturn), N'Return CRN-2025-0525-0012', N'seed:iphone14');

PRINT CONCAT(N'iPhone 14 Pro Max demo seeded. ProductId=', @ProductId,
  N' — open /products/', @ProductId, N' in the app.');
