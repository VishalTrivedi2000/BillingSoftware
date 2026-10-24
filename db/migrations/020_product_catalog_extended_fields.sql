/* Extended product catalog fields used by the create/edit product UI. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF OBJECT_ID(N'dbo.Products', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.Products', N'Tags') IS NULL
    ALTER TABLE dbo.Products ADD Tags NVARCHAR(500) NULL;

  IF COL_LENGTH(N'dbo.Products', N'Manufacturer') IS NULL
    ALTER TABLE dbo.Products ADD Manufacturer NVARCHAR(128) NULL;

  IF COL_LENGTH(N'dbo.Products', N'Barcode') IS NULL
    ALTER TABLE dbo.Products ADD Barcode NVARCHAR(80) NULL;

  IF COL_LENGTH(N'dbo.Products', N'CountryOfOrigin') IS NULL
    ALTER TABLE dbo.Products ADD CountryOfOrigin NVARCHAR(64) NULL;

  IF COL_LENGTH(N'dbo.Products', N'InternalCode') IS NULL
    ALTER TABLE dbo.Products ADD InternalCode NVARCHAR(64) NULL;

  IF COL_LENGTH(N'dbo.Products', N'ManufacturerPartNo') IS NULL
    ALTER TABLE dbo.Products ADD ManufacturerPartNo NVARCHAR(80) NULL;

  IF COL_LENGTH(N'dbo.Products', N'Visibility') IS NULL
    ALTER TABLE dbo.Products ADD Visibility NVARCHAR(64) NULL;

  IF COL_LENGTH(N'dbo.Products', N'AllowNegativeStock') IS NULL
    ALTER TABLE dbo.Products ADD AllowNegativeStock BIT NOT NULL
      CONSTRAINT DF_Products_AllowNegativeStock DEFAULT (0);

  IF COL_LENGTH(N'dbo.Products', N'LeadTimeDays') IS NULL
    ALTER TABLE dbo.Products ADD LeadTimeDays INT NULL;

  IF COL_LENGTH(N'dbo.Products', N'WarrantyMonths') IS NULL
    ALTER TABLE dbo.Products ADD WarrantyMonths INT NULL;

  IF COL_LENGTH(N'dbo.Products', N'ShelfLifeDays') IS NULL
    ALTER TABLE dbo.Products ADD ShelfLifeDays INT NULL;

  IF COL_LENGTH(N'dbo.Products', N'IsReturnable') IS NULL
    ALTER TABLE dbo.Products ADD IsReturnable BIT NOT NULL
      CONSTRAINT DF_Products_IsReturnable DEFAULT (1);

  IF COL_LENGTH(N'dbo.Products', N'ReorderQty') IS NULL
    ALTER TABLE dbo.Products ADD ReorderQty DECIMAL(18,4) NULL;

  IF COL_LENGTH(N'dbo.Products', N'MaxStock') IS NULL
    ALTER TABLE dbo.Products ADD MaxStock DECIMAL(18,4) NULL;

  IF COL_LENGTH(N'dbo.Products', N'LowStockAlert') IS NULL
    ALTER TABLE dbo.Products ADD LowStockAlert BIT NOT NULL
      CONSTRAINT DF_Products_LowStockAlert DEFAULT (1);
END
GO

/* Manufacturer was previously stored in Brand when BrandId was null.
   Must be a separate batch so SQL Server sees new columns after ALTER. */
IF OBJECT_ID(N'dbo.Products', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Products', N'Manufacturer') IS NOT NULL
BEGIN
  UPDATE dbo.Products
  SET Manufacturer = Brand
  WHERE Manufacturer IS NULL AND BrandId IS NULL AND Brand IS NOT NULL;
END
