/* Invoice settlement ledger: partial/full collections against posted invoices. Apply after 011. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF OBJECT_ID(N'dbo.InvoicePayments', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.InvoicePayments (
    InvoicePaymentId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenantId BIGINT NOT NULL,
    OrganizationId BIGINT NOT NULL,
    InvoiceId BIGINT NOT NULL,
    Amount DECIMAL(18,2) NOT NULL,
    ReceivedUtc DATETIME2 NOT NULL CONSTRAINT DF_InvoicePayments_ReceivedUtc DEFAULT (SYSUTCDATETIME()),
    Channel NVARCHAR(64) NULL,
    ReferenceNote NVARCHAR(256) NULL,
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_InvoicePayments_CreatedUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_InvoicePayments_Amount_Positive CHECK (Amount > 0),
    CONSTRAINT FK_InvoicePayments_Invoice FOREIGN KEY (InvoiceId) REFERENCES dbo.Invoices(InvoiceId) ON DELETE CASCADE
  );

  CREATE INDEX IX_InvoicePayments_Invoice ON dbo.InvoicePayments(TenantId, OrganizationId, InvoiceId);
END
