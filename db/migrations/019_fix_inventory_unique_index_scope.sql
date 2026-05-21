/*
  Repair migration: SQL Server does not allow ISNULL() inside CREATE INDEX column lists.
  Adds persisted computed scope columns and recreates unique indexes.

  Safe to run multiple times (idempotent).
*/

/* ProductCustomFieldDefinitions */
IF OBJECT_ID(N'dbo.ProductCustomFieldDefinitions', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.ProductCustomFieldDefinitions', N'CategoryIdScope') IS NULL
    ALTER TABLE dbo.ProductCustomFieldDefinitions
      ADD CategoryIdScope AS ISNULL(CategoryId, 0) PERSISTED;

  IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_ProductCustomFieldDefinitions_Org_Cat_Key'
      AND object_id = OBJECT_ID(N'dbo.ProductCustomFieldDefinitions'))
    DROP INDEX UX_ProductCustomFieldDefinitions_Org_Cat_Key ON dbo.ProductCustomFieldDefinitions;

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_ProductCustomFieldDefinitions_Org_Cat_Key'
      AND object_id = OBJECT_ID(N'dbo.ProductCustomFieldDefinitions'))
    CREATE UNIQUE INDEX UX_ProductCustomFieldDefinitions_Org_Cat_Key
      ON dbo.ProductCustomFieldDefinitions(TenantId, OrganizationId, CategoryIdScope, FieldKey)
      WHERE IsDeleted = 0;
END

/* ProductCustomFieldValues */
IF OBJECT_ID(N'dbo.ProductCustomFieldValues', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.ProductCustomFieldValues', N'ProductVariantIdScope') IS NULL
    ALTER TABLE dbo.ProductCustomFieldValues
      ADD ProductVariantIdScope AS ISNULL(ProductVariantId, 0) PERSISTED;

  IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_ProductCustomFieldValues_Scope'
      AND object_id = OBJECT_ID(N'dbo.ProductCustomFieldValues'))
    DROP INDEX UX_ProductCustomFieldValues_Scope ON dbo.ProductCustomFieldValues;

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_ProductCustomFieldValues_Scope'
      AND object_id = OBJECT_ID(N'dbo.ProductCustomFieldValues'))
    CREATE UNIQUE INDEX UX_ProductCustomFieldValues_Scope
      ON dbo.ProductCustomFieldValues(TenantId, OrganizationId, ProductId, ProductVariantIdScope, FieldKey);
END

/* InventoryBalances */
IF OBJECT_ID(N'dbo.InventoryBalances', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.InventoryBalances', N'BatchIdScope') IS NULL
    ALTER TABLE dbo.InventoryBalances
      ADD BatchIdScope AS ISNULL(BatchId, 0) PERSISTED;

  IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_InventoryBalances_Scope'
      AND object_id = OBJECT_ID(N'dbo.InventoryBalances'))
    DROP INDEX UX_InventoryBalances_Scope ON dbo.InventoryBalances;

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_InventoryBalances_Scope'
      AND object_id = OBJECT_ID(N'dbo.InventoryBalances'))
    CREATE UNIQUE INDEX UX_InventoryBalances_Scope
      ON dbo.InventoryBalances(TenantId, OrganizationId, ProductVariantId, WarehouseId, BatchIdScope);
END
