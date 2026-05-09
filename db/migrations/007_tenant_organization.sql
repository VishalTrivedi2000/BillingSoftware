/* Tenants, organizations, user memberships; scope billing rows by TenantId + OrganizationId. Apply after 006. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF OBJECT_ID(N'dbo.Tenants', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Tenants (
    TenantId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Slug NVARCHAR(64) NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_Tenants_IsActive DEFAULT (1),
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_Tenants_CreatedUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_Tenants_Slug UNIQUE (Slug)
  );
END

IF OBJECT_ID(N'dbo.Organizations', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Organizations (
    OrganizationId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    Code NVARCHAR(64) NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_Organizations_IsActive DEFAULT (1),
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_Organizations_CreatedUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_Organizations_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(TenantId),
    CONSTRAINT UQ_Organizations_Tenant_Code UNIQUE (TenantId, Code)
  );
  CREATE INDEX IX_Organizations_Tenant ON dbo.Organizations(TenantId);
END

/* Existing installs: dbo.Organizations created without tenancy — add TenantId and FK (skipped when CREATE ran above). */
IF OBJECT_ID(N'dbo.Organizations', N'U') IS NOT NULL
  AND COL_LENGTH('dbo.Organizations', 'TenantId') IS NULL
BEGIN
  ALTER TABLE dbo.Organizations ADD TenantId BIGINT NULL;
  UPDATE dbo.Organizations SET TenantId = 1 WHERE TenantId IS NULL;
  ALTER TABLE dbo.Organizations ALTER COLUMN TenantId BIGINT NOT NULL;

  IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE parent_object_id = OBJECT_ID(N'dbo.Organizations') AND name = N'FK_Organizations_Tenant')
    ALTER TABLE dbo.Organizations ADD CONSTRAINT FK_Organizations_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(TenantId);

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Organizations') AND name = N'IX_Organizations_Tenant')
    CREATE INDEX IX_Organizations_Tenant ON dbo.Organizations(TenantId);

  IF NOT EXISTS (
    SELECT 1 FROM sys.key_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.Organizations') AND name = N'UQ_Organizations_Tenant_Code')
  BEGIN
    BEGIN TRY
      ALTER TABLE dbo.Organizations ADD CONSTRAINT UQ_Organizations_Tenant_Code UNIQUE (TenantId, Code);
    END TRY BEGIN CATCH END CATCH
  END
END

IF OBJECT_ID(N'dbo.UserOrganizations', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.UserOrganizations (
    UserId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    IsDefault BIT NOT NULL CONSTRAINT DF_UserOrganizations_IsDefault DEFAULT (0),
    AssignedUtc DATETIME2 NOT NULL CONSTRAINT DF_UserOrganizations_AssignedUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_UserOrganizations PRIMARY KEY (UserId, OrganizationId),
    CONSTRAINT FK_UserOrganizations_User FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId) ON DELETE CASCADE,
    CONSTRAINT FK_UserOrganizations_Organization FOREIGN KEY (OrganizationId) REFERENCES dbo.Organizations(OrganizationId)
  );
  CREATE UNIQUE NONCLUSTERED INDEX UX_UserOrganizations_OneDefault
    ON dbo.UserOrganizations(UserId)
    WHERE IsDefault = 1;
END

/* Seed default tenant + organization (stable IDs for dev backfill) */
IF NOT EXISTS (SELECT 1 FROM dbo.Tenants WHERE TenantId = 1)
BEGIN
  SET IDENTITY_INSERT dbo.Tenants ON;
  INSERT INTO dbo.Tenants (TenantId, Slug, Name, IsActive)
  VALUES (1, N'default', N'Default tenant', 1);
  SET IDENTITY_INSERT dbo.Tenants OFF;
END

IF NOT EXISTS (SELECT 1 FROM dbo.Organizations WHERE OrganizationId = 1)
BEGIN
  SET IDENTITY_INSERT dbo.Organizations ON;
  INSERT INTO dbo.Organizations (OrganizationId, TenantId, Code, Name, IsActive)
  VALUES (1, 1, N'main', N'Main organization', 1);
  SET IDENTITY_INSERT dbo.Organizations OFF;
END

/*
  Billing tenancy: add TenantId + OrganizationId BEFORE any API/repository uses them.
  Prerequisites (above): dbo.Tenants, dbo.Organizations, seed ids (1,1).
  Requires dbo.Customers/Products/Invoices from 006 — skip ALTER if table missing.
*/
IF OBJECT_ID(N'dbo.Customers', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.Customers', 'TenantId') IS NULL AND COL_LENGTH('dbo.Customers', 'OrganizationId') IS NULL
  BEGIN
    ALTER TABLE dbo.Customers ADD TenantId BIGINT NULL, OrganizationId BIGINT NULL;
    UPDATE dbo.Customers SET TenantId = 1, OrganizationId = 1 WHERE TenantId IS NULL;
    ALTER TABLE dbo.Customers ALTER COLUMN TenantId BIGINT NOT NULL;
    ALTER TABLE dbo.Customers ALTER COLUMN OrganizationId BIGINT NOT NULL;
  END
  ELSE IF COL_LENGTH('dbo.Customers', 'TenantId') IS NOT NULL AND COL_LENGTH('dbo.Customers', 'OrganizationId') IS NULL
  BEGIN
    ALTER TABLE dbo.Customers ADD OrganizationId BIGINT NULL;
    UPDATE dbo.Customers SET OrganizationId = 1 WHERE OrganizationId IS NULL;
    ALTER TABLE dbo.Customers ALTER COLUMN OrganizationId BIGINT NOT NULL;
  END

  IF COL_LENGTH('dbo.Customers', 'TenantId') IS NOT NULL AND COL_LENGTH('dbo.Customers', 'OrganizationId') IS NOT NULL
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.Customers') AND name = N'FK_Customers_Tenant')
      ALTER TABLE dbo.Customers ADD CONSTRAINT FK_Customers_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(TenantId);
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.Customers') AND name = N'FK_Customers_Organization')
      ALTER TABLE dbo.Customers ADD CONSTRAINT FK_Customers_Organization FOREIGN KEY (OrganizationId) REFERENCES dbo.Organizations(OrganizationId);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Customers') AND name = N'IX_Customers_Tenant_Org')
      CREATE INDEX IX_Customers_Tenant_Org ON dbo.Customers(TenantId, OrganizationId);
  END
END

IF OBJECT_ID(N'dbo.Products', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.Products', 'TenantId') IS NULL AND COL_LENGTH('dbo.Products', 'OrganizationId') IS NULL
  BEGIN
    ALTER TABLE dbo.Products ADD TenantId BIGINT NULL, OrganizationId BIGINT NULL;
    UPDATE dbo.Products SET TenantId = 1, OrganizationId = 1 WHERE TenantId IS NULL;
    ALTER TABLE dbo.Products ALTER COLUMN TenantId BIGINT NOT NULL;
    ALTER TABLE dbo.Products ALTER COLUMN OrganizationId BIGINT NOT NULL;
  END
  ELSE IF COL_LENGTH('dbo.Products', 'TenantId') IS NOT NULL AND COL_LENGTH('dbo.Products', 'OrganizationId') IS NULL
  BEGIN
    ALTER TABLE dbo.Products ADD OrganizationId BIGINT NULL;
    UPDATE dbo.Products SET OrganizationId = 1 WHERE OrganizationId IS NULL;
    ALTER TABLE dbo.Products ALTER COLUMN OrganizationId BIGINT NOT NULL;
  END

  IF COL_LENGTH('dbo.Products', 'TenantId') IS NOT NULL AND COL_LENGTH('dbo.Products', 'OrganizationId') IS NOT NULL
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.Products') AND name = N'FK_Products_Tenant')
      ALTER TABLE dbo.Products ADD CONSTRAINT FK_Products_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(TenantId);
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.Products') AND name = N'FK_Products_Organization')
      ALTER TABLE dbo.Products ADD CONSTRAINT FK_Products_Organization FOREIGN KEY (OrganizationId) REFERENCES dbo.Organizations(OrganizationId);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Products') AND name = N'IX_Products_Tenant_Org')
      CREATE INDEX IX_Products_Tenant_Org ON dbo.Products(TenantId, OrganizationId);
  END
END

IF OBJECT_ID(N'dbo.Invoices', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.Invoices', 'TenantId') IS NULL AND COL_LENGTH('dbo.Invoices', 'OrganizationId') IS NULL
  BEGIN
    ALTER TABLE dbo.Invoices ADD TenantId BIGINT NULL, OrganizationId BIGINT NULL;
    UPDATE dbo.Invoices SET TenantId = 1, OrganizationId = 1 WHERE TenantId IS NULL;
    ALTER TABLE dbo.Invoices ALTER COLUMN TenantId BIGINT NOT NULL;
    ALTER TABLE dbo.Invoices ALTER COLUMN OrganizationId BIGINT NOT NULL;
  END
  ELSE IF COL_LENGTH('dbo.Invoices', 'TenantId') IS NOT NULL AND COL_LENGTH('dbo.Invoices', 'OrganizationId') IS NULL
  BEGIN
    ALTER TABLE dbo.Invoices ADD OrganizationId BIGINT NULL;
    UPDATE dbo.Invoices SET OrganizationId = 1 WHERE OrganizationId IS NULL;
    ALTER TABLE dbo.Invoices ALTER COLUMN OrganizationId BIGINT NOT NULL;
  END

  IF COL_LENGTH('dbo.Invoices', 'TenantId') IS NOT NULL AND COL_LENGTH('dbo.Invoices', 'OrganizationId') IS NOT NULL
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.Invoices') AND name = N'FK_Invoices_Tenant')
      ALTER TABLE dbo.Invoices ADD CONSTRAINT FK_Invoices_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(TenantId);
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.Invoices') AND name = N'FK_Invoices_Organization')
      ALTER TABLE dbo.Invoices ADD CONSTRAINT FK_Invoices_Organization FOREIGN KEY (OrganizationId) REFERENCES dbo.Organizations(OrganizationId);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Invoices') AND name = N'IX_Invoices_Tenant_Org')
      CREATE INDEX IX_Invoices_Tenant_Org ON dbo.Invoices(TenantId, OrganizationId);
  END
END
