/* Purchase bills: supplier inward costs + optional stock increment on catalog lines. Apply after 012. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF OBJECT_ID(N'dbo.PurchaseBills', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.PurchaseBills (
    PurchaseBillId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PartyId BIGINT NOT NULL,
    PurchaseNumber NVARCHAR(32) NULL,
    ReceivedUtc DATETIME2 NOT NULL CONSTRAINT DF_PurchaseBills_ReceivedUtc DEFAULT (SYSUTCDATETIME()),
    Currency NVARCHAR(8) NOT NULL CONSTRAINT DF_PurchaseBills_Currency DEFAULT (N'INR'),
    TotalAmount DECIMAL(18,2) NOT NULL CONSTRAINT DF_PurchaseBills_TotalAmount DEFAULT (0),
    Status NVARCHAR(32) NOT NULL CONSTRAINT DF_PurchaseBills_Status DEFAULT (N'Draft'),
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_PurchaseBills_CreatedUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_PurchaseBills_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(TenantId),
    CONSTRAINT FK_PurchaseBills_Organization FOREIGN KEY (OrganizationId) REFERENCES dbo.Organizations(OrganizationId),
    CONSTRAINT FK_PurchaseBills_Party FOREIGN KEY (PartyId) REFERENCES dbo.Parties(PartyId)
  );

  CREATE INDEX IX_PurchaseBills_Org_Received ON dbo.PurchaseBills(TenantId, OrganizationId, ReceivedUtc DESC);
  CREATE UNIQUE INDEX UX_PurchaseBills_Number ON dbo.PurchaseBills(PurchaseNumber) WHERE PurchaseNumber IS NOT NULL;
END

IF OBJECT_ID(N'dbo.PurchaseLines', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.PurchaseLines (
    PurchaseLineId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    PurchaseBillId BIGINT NOT NULL,
    ProductId BIGINT NULL,
    Description NVARCHAR(500) NOT NULL,
    Quantity DECIMAL(18,4) NOT NULL,
    UnitCost DECIMAL(18,2) NOT NULL,
    LineTotal DECIMAL(18,2) NOT NULL,
    CONSTRAINT FK_PurchaseLines_Bill FOREIGN KEY (PurchaseBillId) REFERENCES dbo.PurchaseBills(PurchaseBillId) ON DELETE CASCADE,
    CONSTRAINT FK_PurchaseLines_Product FOREIGN KEY (ProductId) REFERENCES dbo.Products(ProductId)
  );

  CREATE INDEX IX_PurchaseLines_Bill ON dbo.PurchaseLines(PurchaseBillId);
END
