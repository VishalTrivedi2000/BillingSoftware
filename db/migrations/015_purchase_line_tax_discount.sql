/* Purchase line discount + GST columns. Apply after 014. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF OBJECT_ID(N'dbo.PurchaseLines', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.PurchaseLines', 'DiscountPercent') IS NULL
    ALTER TABLE dbo.PurchaseLines ADD DiscountPercent DECIMAL(9,4) NOT NULL CONSTRAINT DF_PurchaseLines_DiscountPercent DEFAULT (0);

  IF COL_LENGTH('dbo.PurchaseLines', 'DiscountAmount') IS NULL
    ALTER TABLE dbo.PurchaseLines ADD DiscountAmount DECIMAL(18,4) NOT NULL CONSTRAINT DF_PurchaseLines_DiscountAmount DEFAULT (0);

  IF COL_LENGTH('dbo.PurchaseLines', 'TaxRatePercent') IS NULL
    ALTER TABLE dbo.PurchaseLines ADD TaxRatePercent DECIMAL(9,4) NOT NULL CONSTRAINT DF_PurchaseLines_TaxRatePercent DEFAULT (0);

  IF COL_LENGTH('dbo.PurchaseLines', 'TaxAmount') IS NULL
    ALTER TABLE dbo.PurchaseLines ADD TaxAmount DECIMAL(18,2) NOT NULL CONSTRAINT DF_PurchaseLines_TaxAmount DEFAULT (0);

  IF COL_LENGTH('dbo.PurchaseLines', 'TaxableAmount') IS NULL
    ALTER TABLE dbo.PurchaseLines ADD TaxableAmount DECIMAL(18,2) NOT NULL CONSTRAINT DF_PurchaseLines_TaxableAmount DEFAULT (0);
END
