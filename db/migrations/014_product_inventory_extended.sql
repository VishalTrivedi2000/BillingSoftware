/* Extended catalog fields (HSN, pricing tiers, tax hint, location). Apply after 013. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF OBJECT_ID(N'dbo.Products', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.Products', 'HsnCode') IS NULL
    ALTER TABLE dbo.Products ADD HsnCode NVARCHAR(16) NULL;

  IF COL_LENGTH('dbo.Products', 'Description') IS NULL
    ALTER TABLE dbo.Products ADD Description NVARCHAR(2000) NULL;

  IF COL_LENGTH('dbo.Products', 'Mrp') IS NULL
    ALTER TABLE dbo.Products ADD Mrp DECIMAL(18,4) NULL;

  IF COL_LENGTH('dbo.Products', 'PurchasePrice') IS NULL
    ALTER TABLE dbo.Products ADD PurchasePrice DECIMAL(18,4) NULL;

  IF COL_LENGTH('dbo.Products', 'WholesalePrice') IS NULL
    ALTER TABLE dbo.Products ADD WholesalePrice DECIMAL(18,4) NULL;

  IF COL_LENGTH('dbo.Products', 'MinWholesaleQty') IS NULL
    ALTER TABLE dbo.Products ADD MinWholesaleQty DECIMAL(18,4) NULL;

  IF COL_LENGTH('dbo.Products', 'TaxRatePercent') IS NULL
    ALTER TABLE dbo.Products ADD TaxRatePercent DECIMAL(9,4) NULL;

  IF COL_LENGTH('dbo.Products', 'StorageLocation') IS NULL
    ALTER TABLE dbo.Products ADD StorageLocation NVARCHAR(200) NULL;

  IF COL_LENGTH('dbo.Products', 'IsService') IS NULL
    ALTER TABLE dbo.Products ADD IsService BIT NOT NULL CONSTRAINT DF_Products_IsService DEFAULT (0);
END
