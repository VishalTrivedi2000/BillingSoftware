/* Brands & units of measure (Flipkart/Amazon-style taxonomy). Apply after 010. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF OBJECT_ID(N'dbo.ProductBrands', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductBrands (
    BrandId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    Slug NVARCHAR(96) NOT NULL,
    Name NVARCHAR(160) NOT NULL,
    SortOrder INT NOT NULL CONSTRAINT DF_ProductBrands_SortOrder DEFAULT (0),
    IsActive BIT NOT NULL CONSTRAINT DF_ProductBrands_IsActive DEFAULT (1),
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_ProductBrands_CreatedUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_ProductBrands_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(TenantId),
    CONSTRAINT FK_ProductBrands_Organization FOREIGN KEY (OrganizationId) REFERENCES dbo.Organizations(OrganizationId),
    CONSTRAINT UQ_ProductBrands_Org_Slug UNIQUE (TenantId, OrganizationId, Slug)
  );
  CREATE INDEX IX_ProductBrands_Org ON dbo.ProductBrands(TenantId, OrganizationId);
END

IF OBJECT_ID(N'dbo.ProductUnits', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductUnits (
    UnitId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    Code NVARCHAR(32) NOT NULL,
    DisplayName NVARCHAR(80) NOT NULL,
    SortOrder INT NOT NULL CONSTRAINT DF_ProductUnits_SortOrder DEFAULT (0),
    IsActive BIT NOT NULL CONSTRAINT DF_ProductUnits_IsActive DEFAULT (1),
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_ProductUnits_CreatedUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_ProductUnits_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(TenantId),
    CONSTRAINT FK_ProductUnits_Organization FOREIGN KEY (OrganizationId) REFERENCES dbo.Organizations(OrganizationId),
    CONSTRAINT UQ_ProductUnits_Org_Code UNIQUE (TenantId, OrganizationId, Code)
  );
  CREATE INDEX IX_ProductUnits_Org ON dbo.ProductUnits(TenantId, OrganizationId);
END

IF OBJECT_ID(N'dbo.Products', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.Products', 'BrandId') IS NULL
    ALTER TABLE dbo.Products ADD BrandId BIGINT NULL;

  IF COL_LENGTH('dbo.Products', 'UnitId') IS NULL
    ALTER TABLE dbo.Products ADD UnitId BIGINT NULL;

  IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.Products') AND name = N'FK_Products_ProductBrand')
    AND COL_LENGTH('dbo.Products', 'BrandId') IS NOT NULL
    ALTER TABLE dbo.Products ADD CONSTRAINT FK_Products_ProductBrand
      FOREIGN KEY (BrandId) REFERENCES dbo.ProductBrands(BrandId) ON DELETE SET NULL;

  IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.Products') AND name = N'FK_Products_ProductUnit')
    AND COL_LENGTH('dbo.Products', 'UnitId') IS NOT NULL
    ALTER TABLE dbo.Products ADD CONSTRAINT FK_Products_ProductUnit
      FOREIGN KEY (UnitId) REFERENCES dbo.ProductUnits(UnitId) ON DELETE SET NULL;

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Products') AND name = N'IX_Products_Org_Brand')
    CREATE INDEX IX_Products_Org_Brand ON dbo.Products(TenantId, OrganizationId, BrandId);

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Products') AND name = N'IX_Products_Org_Unit')
    CREATE INDEX IX_Products_Org_Unit ON dbo.Products(TenantId, OrganizationId, UnitId);
END

/* Backfill distinct legacy Brand text into ProductBrands and link BrandId */
IF OBJECT_ID(N'dbo.ProductBrands', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.Products', N'U') IS NOT NULL
BEGIN
  INSERT INTO dbo.ProductBrands (TenantId, OrganizationId, Slug, Name, SortOrder, IsActive)
  SELECT DISTINCT p.TenantId, p.OrganizationId,
    CONCAT(N'temp-', REPLACE(CONVERT(NVARCHAR(36), NEWID()), N'-', N'')),
    LTRIM(RTRIM(p.Brand)), 0, 1
  FROM dbo.Products p
  WHERE p.Brand IS NOT NULL AND LTRIM(RTRIM(p.Brand)) <> N''
    AND NOT EXISTS (
      SELECT 1 FROM dbo.ProductBrands b
      WHERE b.TenantId = p.TenantId AND b.OrganizationId = p.OrganizationId AND b.Name = LTRIM(RTRIM(p.Brand))
    );

  UPDATE dbo.ProductBrands SET Slug = CONCAT(N'b-', CAST(BrandId AS NVARCHAR(20)))
  WHERE Slug LIKE N'temp-%';

  UPDATE p SET p.BrandId = b.BrandId
  FROM dbo.Products p
  INNER JOIN dbo.ProductBrands b ON b.TenantId = p.TenantId AND b.OrganizationId = p.OrganizationId AND b.Name = LTRIM(RTRIM(p.Brand))
  WHERE p.Brand IS NOT NULL AND LTRIM(RTRIM(p.Brand)) <> N'' AND p.BrandId IS NULL;
END

/* Seed common units per active organization */
IF OBJECT_ID(N'dbo.ProductUnits', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.Organizations', N'U') IS NOT NULL
BEGIN
  INSERT INTO dbo.ProductUnits (TenantId, OrganizationId, Code, DisplayName, SortOrder, IsActive)
  SELECT o.TenantId, o.OrganizationId, N'each', N'Each / Piece', 10, 1
  FROM dbo.Organizations o WHERE o.IsActive = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.ProductUnits u WHERE u.TenantId = o.TenantId AND u.OrganizationId = o.OrganizationId AND u.Code = N'each');

  INSERT INTO dbo.ProductUnits (TenantId, OrganizationId, Code, DisplayName, SortOrder, IsActive)
  SELECT o.TenantId, o.OrganizationId, N'kg', N'Kilogram', 20, 1
  FROM dbo.Organizations o WHERE o.IsActive = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.ProductUnits u WHERE u.TenantId = o.TenantId AND u.OrganizationId = o.OrganizationId AND u.Code = N'kg');

  INSERT INTO dbo.ProductUnits (TenantId, OrganizationId, Code, DisplayName, SortOrder, IsActive)
  SELECT o.TenantId, o.OrganizationId, N'g', N'Gram', 30, 1
  FROM dbo.Organizations o WHERE o.IsActive = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.ProductUnits u WHERE u.TenantId = o.TenantId AND u.OrganizationId = o.OrganizationId AND u.Code = N'g');

  INSERT INTO dbo.ProductUnits (TenantId, OrganizationId, Code, DisplayName, SortOrder, IsActive)
  SELECT o.TenantId, o.OrganizationId, N'l', N'Litre', 40, 1
  FROM dbo.Organizations o WHERE o.IsActive = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.ProductUnits u WHERE u.TenantId = o.TenantId AND u.OrganizationId = o.OrganizationId AND u.Code = N'l');

  INSERT INTO dbo.ProductUnits (TenantId, OrganizationId, Code, DisplayName, SortOrder, IsActive)
  SELECT o.TenantId, o.OrganizationId, N'ml', N'Millilitre', 50, 1
  FROM dbo.Organizations o WHERE o.IsActive = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.ProductUnits u WHERE u.TenantId = o.TenantId AND u.OrganizationId = o.OrganizationId AND u.Code = N'ml');

  INSERT INTO dbo.ProductUnits (TenantId, OrganizationId, Code, DisplayName, SortOrder, IsActive)
  SELECT o.TenantId, o.OrganizationId, N'pack', N'Pack', 60, 1
  FROM dbo.Organizations o WHERE o.IsActive = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.ProductUnits u WHERE u.TenantId = o.TenantId AND u.OrganizationId = o.OrganizationId AND u.Code = N'pack');

  INSERT INTO dbo.ProductUnits (TenantId, OrganizationId, Code, DisplayName, SortOrder, IsActive)
  SELECT o.TenantId, o.OrganizationId, N'box', N'Box', 70, 1
  FROM dbo.Organizations o WHERE o.IsActive = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.ProductUnits u WHERE u.TenantId = o.TenantId AND u.OrganizationId = o.OrganizationId AND u.Code = N'box');

  INSERT INTO dbo.ProductUnits (TenantId, OrganizationId, Code, DisplayName, SortOrder, IsActive)
  SELECT o.TenantId, o.OrganizationId, N'pair', N'Pair', 80, 1
  FROM dbo.Organizations o WHERE o.IsActive = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.ProductUnits u WHERE u.TenantId = o.TenantId AND u.OrganizationId = o.OrganizationId AND u.Code = N'pair');
END
