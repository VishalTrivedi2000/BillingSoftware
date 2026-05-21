/* Backfill default warehouse per organization, default variant per existing product,
   and opening-balance ledger entries. Apply after 016. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

/* ---------- 1. One default 'Main' warehouse per active organization ---------- */
IF OBJECT_ID(N'dbo.Warehouses', N'U') IS NOT NULL
BEGIN
  INSERT INTO dbo.Warehouses (TenantId, OrganizationId, Code, Name, WarehouseType, IsDefault, IsActive)
  SELECT o.TenantId, o.OrganizationId, N'MAIN', N'Main Warehouse', N'Store', 1, 1
  FROM dbo.Organizations o
  WHERE o.IsActive = 1
    AND NOT EXISTS (
      SELECT 1 FROM dbo.Warehouses w
      WHERE w.TenantId = o.TenantId AND w.OrganizationId = o.OrganizationId AND w.IsDeleted = 0);
END

/* ---------- 2. Default variant per product (one per product, marked IsDefault). ---------- */
IF OBJECT_ID(N'dbo.ProductVariants', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.Products', N'U') IS NOT NULL
BEGIN
  /* Stage products that need a default variant. */
  DECLARE @stage TABLE (
    ProductId BIGINT PRIMARY KEY,
    TenantId BIGINT,
    OrganizationId BIGINT,
    Sku NVARCHAR(80),
    Name NVARCHAR(255),
    UnitPrice DECIMAL(18,4),
    PurchasePrice DECIMAL(18,4),
    Mrp DECIMAL(18,4)
  );

  /* Link DefaultVariantId when variants already exist (e.g. created via API before migration ran). */
  UPDATE p
  SET p.DefaultVariantId = pick.ProductVariantId,
      p.HasVariants = CASE
        WHEN EXISTS (
          SELECT 1 FROM dbo.ProductVariants x
          WHERE x.TenantId = p.TenantId AND x.OrganizationId = p.OrganizationId
            AND x.ProductId = p.ProductId AND x.IsDeleted = 0
            AND x.ProductVariantId <> pick.ProductVariantId)
        THEN 1 ELSE 0 END
  FROM dbo.Products p
  CROSS APPLY (
    SELECT TOP 1 v.ProductVariantId
    FROM dbo.ProductVariants v
    WHERE v.TenantId = p.TenantId AND v.OrganizationId = p.OrganizationId
      AND v.ProductId = p.ProductId AND v.IsDeleted = 0
    ORDER BY v.IsDefault DESC, v.ProductVariantId ASC
  ) pick
  WHERE p.DefaultVariantId IS NULL;

  INSERT INTO @stage (ProductId, TenantId, OrganizationId, Sku, Name, UnitPrice, PurchasePrice, Mrp)
  SELECT p.ProductId, p.TenantId, p.OrganizationId, p.Sku, p.Name, p.UnitPrice,
         p.PurchasePrice, p.Mrp
  FROM dbo.Products p
  WHERE p.DefaultVariantId IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM dbo.ProductVariants v
      WHERE v.TenantId = p.TenantId AND v.OrganizationId = p.OrganizationId
        AND v.ProductId = p.ProductId AND v.IsDeleted = 0);

  /* Insert default variants. */
  INSERT INTO dbo.ProductVariants (
    TenantId, OrganizationId, ProductId, Sku, Barcode, DisplayName, AttributeHash,
    Mrp, SalePrice, PurchasePrice, IsDefault, Status, IsActive)
  SELECT s.TenantId, s.OrganizationId, s.ProductId,
         /* If two products share the same SKU we'd hit the unique index — append productid. */
         CASE WHEN EXISTS (
                    SELECT 1 FROM dbo.ProductVariants v
                    WHERE v.TenantId = s.TenantId AND v.OrganizationId = s.OrganizationId AND v.Sku = s.Sku AND v.IsDeleted = 0)
              THEN CONCAT(ISNULL(s.Sku, N'SKU'), N'-', s.ProductId)
              ELSE s.Sku END,
         NULL,
         s.Name,
         N'@default',
         s.Mrp, s.UnitPrice, s.PurchasePrice,
         1, N'Active', 1
  FROM @stage s;

  /* Wire Products.DefaultVariantId. */
  UPDATE p
  SET p.DefaultVariantId = v.ProductVariantId,
      p.HasVariants = 0
  FROM dbo.Products p
  INNER JOIN dbo.ProductVariants v
    ON v.ProductId = p.ProductId AND v.IsDefault = 1 AND v.IsDeleted = 0
  WHERE p.DefaultVariantId IS NULL;
END

/* ---------- 3. Opening balance ledger import from legacy Products.StockQty ---------- */
IF OBJECT_ID(N'dbo.InventoryTransactions', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.InventoryBalances', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.Warehouses', N'U') IS NOT NULL
BEGIN
  /* Bring in opening rows only once: identify by IdempotencyKey 'OPENING:{productId}'. */
  ;WITH src AS (
    SELECT
      p.ProductId,
      p.TenantId,
      p.OrganizationId,
      p.DefaultVariantId AS ProductVariantId,
      (SELECT TOP 1 w.WarehouseId FROM dbo.Warehouses w
         WHERE w.TenantId = p.TenantId AND w.OrganizationId = p.OrganizationId AND w.IsDeleted = 0
         ORDER BY w.IsDefault DESC, w.WarehouseId) AS WarehouseId,
      p.StockQty
    FROM dbo.Products p
    WHERE p.DefaultVariantId IS NOT NULL
      AND p.StockQty IS NOT NULL
      AND p.StockQty <> 0
  )
  INSERT INTO dbo.InventoryTransactions (
    TenantId, OrganizationId, ProductVariantId, WarehouseId,
    TransactionType, QuantityBucket, QtyChange, CostPerUnit,
    SourceDocumentType, SourceDocumentId, IdempotencyKey, Reason, CreatedBy)
  SELECT
    s.TenantId, s.OrganizationId, s.ProductVariantId, s.WarehouseId,
    N'OPENING_BALANCE', N'Available', s.StockQty, NULL,
    N'OpeningBalance', s.ProductId,
    CONCAT(N'OPENING:', s.ProductId),
    N'Opening balance imported from legacy Products.StockQty',
    N'system:migration'
  FROM src s
  WHERE s.WarehouseId IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM dbo.InventoryTransactions x
      WHERE x.TenantId = s.TenantId AND x.OrganizationId = s.OrganizationId AND x.IdempotencyKey = CONCAT(N'OPENING:', s.ProductId));

  /* Upsert into InventoryBalances. */
  MERGE dbo.InventoryBalances AS tgt
  USING (
    SELECT t.TenantId, t.OrganizationId, t.ProductVariantId, t.WarehouseId,
           SUM(t.QtyChange) AS OnHand,
           MAX(t.InventoryTransactionId) AS LastLedgerId
    FROM dbo.InventoryTransactions t
    GROUP BY t.TenantId, t.OrganizationId, t.ProductVariantId, t.WarehouseId
  ) AS src
    ON src.TenantId = tgt.TenantId
       AND src.OrganizationId = tgt.OrganizationId
       AND src.ProductVariantId = tgt.ProductVariantId
       AND src.WarehouseId = tgt.WarehouseId
       AND tgt.BatchId IS NULL
  WHEN MATCHED THEN
    UPDATE SET tgt.OnHandQty = src.OnHand, tgt.LastLedgerId = src.LastLedgerId, tgt.UpdatedUtc = SYSUTCDATETIME()
  WHEN NOT MATCHED BY TARGET THEN
    INSERT (TenantId, OrganizationId, ProductVariantId, WarehouseId, BatchId, OnHandQty, LastLedgerId)
    VALUES (src.TenantId, src.OrganizationId, src.ProductVariantId, src.WarehouseId, NULL, src.OnHand, src.LastLedgerId);
END
