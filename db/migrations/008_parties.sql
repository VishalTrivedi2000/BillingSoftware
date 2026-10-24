/* Organization-scoped counterparties (onboarding) — customers, vendors, or other parties. */

IF OBJECT_ID(N'dbo.Parties', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Parties (
    PartyId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    Kind NVARCHAR(32) NOT NULL CONSTRAINT DF_Parties_Kind DEFAULT (N'Customer'),
    DisplayName NVARCHAR(256) NOT NULL,
    LegalName NVARCHAR(256) NULL,
    TaxId NVARCHAR(64) NULL,
    Email NVARCHAR(256) NULL,
    Phone NVARCHAR(64) NULL,
    Notes NVARCHAR(2000) NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_Parties_IsActive DEFAULT (1),
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_Parties_CreatedUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_Parties_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(TenantId),
    CONSTRAINT FK_Parties_Organization FOREIGN KEY (OrganizationId) REFERENCES dbo.Organizations(OrganizationId),
    CONSTRAINT CK_Parties_Kind CHECK (Kind IN (N'Customer', N'Vendor', N'Other'))
  );

  CREATE INDEX IX_Parties_Tenant_Org ON dbo.Parties(TenantId, OrganizationId);
END
