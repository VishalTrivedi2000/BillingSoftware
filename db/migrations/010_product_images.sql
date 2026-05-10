/* Product gallery images — files stored under ProductImages storage root; paths in DB. */

IF OBJECT_ID(N'dbo.ProductImages', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductImages (
    ProductImageId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    ProductId BIGINT NOT NULL,
    RelativePath NVARCHAR(512) NOT NULL,
    ContentType NVARCHAR(128) NOT NULL,
    SortOrder INT NOT NULL CONSTRAINT DF_ProductImages_SortOrder DEFAULT (0),
    IsPrimary BIT NOT NULL CONSTRAINT DF_ProductImages_IsPrimary DEFAULT (0),
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_ProductImages_CreatedUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_ProductImages_Product FOREIGN KEY (ProductId) REFERENCES dbo.Products(ProductId) ON DELETE CASCADE,
    CONSTRAINT FK_ProductImages_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(TenantId),
    CONSTRAINT FK_ProductImages_Organization FOREIGN KEY (OrganizationId) REFERENCES dbo.Organizations(OrganizationId)
  );

  CREATE INDEX IX_ProductImages_Product ON dbo.ProductImages(TenantId, OrganizationId, ProductId);

  CREATE UNIQUE NONCLUSTERED INDEX UX_ProductImages_OnePrimary
    ON dbo.ProductImages(ProductId)
    WHERE IsPrimary = 1;
END
