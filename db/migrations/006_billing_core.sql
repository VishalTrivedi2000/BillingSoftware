/* Phase 1 core billing: customers, products, invoices (minimal MVP spine). Apply after 005. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF OBJECT_ID(N'dbo.Customers', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Customers (
    CustomerId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Name NVARCHAR(200) NOT NULL,
    TaxId NVARCHAR(50) NULL,
    Email NVARCHAR(256) NULL,
    Phone NVARCHAR(50) NULL,
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_Customers_CreatedUtc DEFAULT (SYSUTCDATETIME())
  );
END

IF OBJECT_ID(N'dbo.Products', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Products (
    ProductId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Sku NVARCHAR(64) NULL,
    Name NVARCHAR(200) NOT NULL,
    UnitPrice DECIMAL(18,2) NOT NULL CONSTRAINT DF_Products_UnitPrice DEFAULT (0),
    IsActive BIT NOT NULL CONSTRAINT DF_Products_IsActive DEFAULT (1),
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_Products_CreatedUtc DEFAULT (SYSUTCDATETIME())
  );
END

IF OBJECT_ID(N'dbo.Invoices', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Invoices (
    InvoiceId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CustomerId BIGINT NOT NULL,
    InvoiceNumber NVARCHAR(32) NULL,
    IssueUtc DATETIME2 NOT NULL CONSTRAINT DF_Invoices_IssueUtc DEFAULT (SYSUTCDATETIME()),
    Currency NVARCHAR(8) NOT NULL CONSTRAINT DF_Invoices_Currency DEFAULT (N'INR'),
    TotalAmount DECIMAL(18,2) NOT NULL CONSTRAINT DF_Invoices_TotalAmount DEFAULT (0),
    Status NVARCHAR(32) NOT NULL CONSTRAINT DF_Invoices_Status DEFAULT (N'Posted'),
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_Invoices_CreatedUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_Invoices_Customer FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId)
  );
  CREATE INDEX IX_Invoices_Customer ON dbo.Invoices(CustomerId);
  CREATE UNIQUE INDEX UX_Invoices_Number ON dbo.Invoices(InvoiceNumber) WHERE InvoiceNumber IS NOT NULL;
END

IF OBJECT_ID(N'dbo.InvoiceLines', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.InvoiceLines (
    InvoiceLineId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    InvoiceId BIGINT NOT NULL,
    ProductId BIGINT NULL,
    Description NVARCHAR(500) NOT NULL,
    Quantity DECIMAL(18,4) NOT NULL,
    UnitPrice DECIMAL(18,2) NOT NULL,
    LineTotal DECIMAL(18,2) NOT NULL,
    CONSTRAINT FK_InvoiceLines_Invoice FOREIGN KEY (InvoiceId) REFERENCES dbo.Invoices(InvoiceId) ON DELETE CASCADE,
    CONSTRAINT FK_InvoiceLines_Product FOREIGN KEY (ProductId) REFERENCES dbo.Products(ProductId)
  );
  CREATE INDEX IX_InvoiceLines_Invoice ON dbo.InvoiceLines(InvoiceId);
END
