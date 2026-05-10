/* Product catalog tree (Flipkart/Amazon-style categories), inventory qty on products. Apply after 008. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF OBJECT_ID(N'dbo.ProductCategories', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductCategories (
    CategoryId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    ParentCategoryId BIGINT NULL,
    Slug NVARCHAR(96) NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    SortOrder INT NOT NULL CONSTRAINT DF_ProductCategories_SortOrder DEFAULT (0),
    IsActive BIT NOT NULL CONSTRAINT DF_ProductCategories_IsActive DEFAULT (1),
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_ProductCategories_CreatedUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_ProductCategories_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(TenantId),
    CONSTRAINT FK_ProductCategories_Organization FOREIGN KEY (OrganizationId) REFERENCES dbo.Organizations(OrganizationId),
    CONSTRAINT FK_ProductCategories_Parent FOREIGN KEY (ParentCategoryId) REFERENCES dbo.ProductCategories(CategoryId),
    CONSTRAINT UQ_ProductCategories_Org_Slug UNIQUE (TenantId, OrganizationId, Slug)
  );
  CREATE INDEX IX_ProductCategories_Org_Parent ON dbo.ProductCategories(TenantId, OrganizationId, ParentCategoryId);
END

IF OBJECT_ID(N'dbo.Products', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.Products', 'CategoryId') IS NULL
    ALTER TABLE dbo.Products ADD CategoryId BIGINT NULL;

  IF COL_LENGTH('dbo.Products', 'Brand') IS NULL
    ALTER TABLE dbo.Products ADD Brand NVARCHAR(128) NULL;

  IF COL_LENGTH('dbo.Products', 'StockQty') IS NULL
    ALTER TABLE dbo.Products ADD StockQty DECIMAL(18,4) NOT NULL CONSTRAINT DF_Products_StockQty DEFAULT (0);

  IF COL_LENGTH('dbo.Products', 'LowStockThreshold') IS NULL
    ALTER TABLE dbo.Products ADD LowStockThreshold DECIMAL(18,4) NULL;

  IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.Products') AND name = N'FK_Products_ProductCategory')
    AND COL_LENGTH('dbo.Products', 'CategoryId') IS NOT NULL
    ALTER TABLE dbo.Products ADD CONSTRAINT FK_Products_ProductCategory
      FOREIGN KEY (CategoryId) REFERENCES dbo.ProductCategories(CategoryId) ON DELETE SET NULL;

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Products') AND name = N'IX_Products_Org_Category')
    CREATE INDEX IX_Products_Org_Category ON dbo.Products(TenantId, OrganizationId, CategoryId);

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Products') AND name = N'IX_Products_Org_Name')
    CREATE INDEX IX_Products_Org_Name ON dbo.Products(TenantId, OrganizationId, Name);
END

/*
  Seed marketplace-style category trees per active organization (idempotent by slug).
*/
IF OBJECT_ID(N'dbo.ProductCategories', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.Organizations', N'U') IS NOT NULL
BEGIN
  /* Root categories */
  INSERT INTO dbo.ProductCategories (TenantId, OrganizationId, ParentCategoryId, Slug, Name, SortOrder, IsActive)
  SELECT o.TenantId, o.OrganizationId, NULL, N'electronics', N'Electronics', 10, 1
  FROM dbo.Organizations o WHERE o.IsActive = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.ProductCategories x WHERE x.TenantId = o.TenantId AND x.OrganizationId = o.OrganizationId AND x.Slug = N'electronics');

  INSERT INTO dbo.ProductCategories (TenantId, OrganizationId, ParentCategoryId, Slug, Name, SortOrder, IsActive)
  SELECT o.TenantId, o.OrganizationId, NULL, N'fashion', N'Fashion', 20, 1
  FROM dbo.Organizations o WHERE o.IsActive = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.ProductCategories x WHERE x.TenantId = o.TenantId AND x.OrganizationId = o.OrganizationId AND x.Slug = N'fashion');

  INSERT INTO dbo.ProductCategories (TenantId, OrganizationId, ParentCategoryId, Slug, Name, SortOrder, IsActive)
  SELECT o.TenantId, o.OrganizationId, NULL, N'home-kitchen', N'Home & Kitchen', 30, 1
  FROM dbo.Organizations o WHERE o.IsActive = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.ProductCategories x WHERE x.TenantId = o.TenantId AND x.OrganizationId = o.OrganizationId AND x.Slug = N'home-kitchen');

  INSERT INTO dbo.ProductCategories (TenantId, OrganizationId, ParentCategoryId, Slug, Name, SortOrder, IsActive)
  SELECT o.TenantId, o.OrganizationId, NULL, N'grocery', N'Grocery & Gourmet', 40, 1
  FROM dbo.Organizations o WHERE o.IsActive = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.ProductCategories x WHERE x.TenantId = o.TenantId AND x.OrganizationId = o.OrganizationId AND x.Slug = N'grocery');

  INSERT INTO dbo.ProductCategories (TenantId, OrganizationId, ParentCategoryId, Slug, Name, SortOrder, IsActive)
  SELECT o.TenantId, o.OrganizationId, NULL, N'beauty', N'Beauty & Personal Care', 50, 1
  FROM dbo.Organizations o WHERE o.IsActive = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.ProductCategories x WHERE x.TenantId = o.TenantId AND x.OrganizationId = o.OrganizationId AND x.Slug = N'beauty');

  INSERT INTO dbo.ProductCategories (TenantId, OrganizationId, ParentCategoryId, Slug, Name, SortOrder, IsActive)
  SELECT o.TenantId, o.OrganizationId, NULL, N'toys-books-sports', N'Toys, Books & Sports', 60, 1
  FROM dbo.Organizations o WHERE o.IsActive = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.ProductCategories x WHERE x.TenantId = o.TenantId AND x.OrganizationId = o.OrganizationId AND x.Slug = N'toys-books-sports');

  /* Electronics children */
  INSERT INTO dbo.ProductCategories (TenantId, OrganizationId, ParentCategoryId, Slug, Name, SortOrder, IsActive)
  SELECT o.TenantId, o.OrganizationId, NULL, N'electronics-mobiles', N'Mobiles & Accessories', 11, 1
  FROM dbo.Organizations o WHERE o.IsActive = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.ProductCategories x WHERE x.TenantId = o.TenantId AND x.OrganizationId = o.OrganizationId AND x.Slug = N'electronics-mobiles');

  INSERT INTO dbo.ProductCategories (TenantId, OrganizationId, ParentCategoryId, Slug, Name, SortOrder, IsActive)
  SELECT o.TenantId, o.OrganizationId, NULL, N'electronics-laptops', N'Laptops & Computers', 12, 1
  FROM dbo.Organizations o WHERE o.IsActive = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.ProductCategories x WHERE x.TenantId = o.TenantId AND x.OrganizationId = o.OrganizationId AND x.Slug = N'electronics-laptops');

  INSERT INTO dbo.ProductCategories (TenantId, OrganizationId, ParentCategoryId, Slug, Name, SortOrder, IsActive)
  SELECT o.TenantId, o.OrganizationId, NULL, N'electronics-tv', N'TV & Appliances', 13, 1
  FROM dbo.Organizations o WHERE o.IsActive = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.ProductCategories x WHERE x.TenantId = o.TenantId AND x.OrganizationId = o.OrganizationId AND x.Slug = N'electronics-tv');

  INSERT INTO dbo.ProductCategories (TenantId, OrganizationId, ParentCategoryId, Slug, Name, SortOrder, IsActive)
  SELECT o.TenantId, o.OrganizationId, NULL, N'electronics-audio', N'Audio & Headphones', 14, 1
  FROM dbo.Organizations o WHERE o.IsActive = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.ProductCategories x WHERE x.TenantId = o.TenantId AND x.OrganizationId = o.OrganizationId AND x.Slug = N'electronics-audio');

  /* Fashion children */
  INSERT INTO dbo.ProductCategories (TenantId, OrganizationId, ParentCategoryId, Slug, Name, SortOrder, IsActive)
  SELECT o.TenantId, o.OrganizationId, NULL, N'fashion-men', N'Men''s Clothing', 21, 1
  FROM dbo.Organizations o WHERE o.IsActive = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.ProductCategories x WHERE x.TenantId = o.TenantId AND x.OrganizationId = o.OrganizationId AND x.Slug = N'fashion-men');

  INSERT INTO dbo.ProductCategories (TenantId, OrganizationId, ParentCategoryId, Slug, Name, SortOrder, IsActive)
  SELECT o.TenantId, o.OrganizationId, NULL, N'fashion-women', N'Women''s Clothing', 22, 1
  FROM dbo.Organizations o WHERE o.IsActive = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.ProductCategories x WHERE x.TenantId = o.TenantId AND x.OrganizationId = o.OrganizationId AND x.Slug = N'fashion-women');

  INSERT INTO dbo.ProductCategories (TenantId, OrganizationId, ParentCategoryId, Slug, Name, SortOrder, IsActive)
  SELECT o.TenantId, o.OrganizationId, NULL, N'fashion-kids', N'Kids'' Fashion', 23, 1
  FROM dbo.Organizations o WHERE o.IsActive = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.ProductCategories x WHERE x.TenantId = o.TenantId AND x.OrganizationId = o.OrganizationId AND x.Slug = N'fashion-kids');

  INSERT INTO dbo.ProductCategories (TenantId, OrganizationId, ParentCategoryId, Slug, Name, SortOrder, IsActive)
  SELECT o.TenantId, o.OrganizationId, NULL, N'fashion-footwear', N'Footwear', 24, 1
  FROM dbo.Organizations o WHERE o.IsActive = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.ProductCategories x WHERE x.TenantId = o.TenantId AND x.OrganizationId = o.OrganizationId AND x.Slug = N'fashion-footwear');

  /* Wire ParentCategoryId */
  UPDATE c SET c.ParentCategoryId = p.CategoryId
  FROM dbo.ProductCategories c
  INNER JOIN dbo.ProductCategories p ON p.TenantId = c.TenantId AND p.OrganizationId = c.OrganizationId AND p.Slug = N'electronics'
  WHERE c.Slug IN (N'electronics-mobiles', N'electronics-laptops', N'electronics-tv', N'electronics-audio');

  UPDATE c SET c.ParentCategoryId = p.CategoryId
  FROM dbo.ProductCategories c
  INNER JOIN dbo.ProductCategories p ON p.TenantId = c.TenantId AND p.OrganizationId = c.OrganizationId AND p.Slug = N'fashion'
  WHERE c.Slug IN (N'fashion-men', N'fashion-women', N'fashion-kids', N'fashion-footwear');
END
