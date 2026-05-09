/* BillingApp v1 — identity & authorization schema (SQL Server). Run once against target DB. */
/* Required for filtered indexes under sqlcmd / legacy defaults */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF OBJECT_ID(N'dbo.Delegations', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Roles (
    RoleId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Name NVARCHAR(64) NOT NULL UNIQUE,
    Description NVARCHAR(256) NULL
  );

  CREATE TABLE dbo.Permissions (
    PermissionId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Name NVARCHAR(128) NOT NULL UNIQUE
  );

  CREATE TABLE dbo.RolePermissions (
    RoleId INT NOT NULL,
    PermissionId INT NOT NULL,
    CONSTRAINT PK_RolePermissions PRIMARY KEY (RoleId, PermissionId),
    CONSTRAINT FK_RolePermissions_Role FOREIGN KEY (RoleId) REFERENCES dbo.Roles(RoleId),
    CONSTRAINT FK_RolePermissions_Permission FOREIGN KEY (PermissionId) REFERENCES dbo.Permissions(PermissionId)
  );

  CREATE TABLE dbo.Users (
    UserId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Username NVARCHAR(128) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(500) NOT NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT (1),
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_Users_CreatedUtc DEFAULT (SYSUTCDATETIME())
  );

  CREATE TABLE dbo.UserRoles (
    UserId BIGINT NOT NULL,
    RoleId INT NOT NULL,
    CONSTRAINT PK_UserRoles PRIMARY KEY (UserId, RoleId),
    CONSTRAINT FK_UserRoles_User FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_UserRoles_Role FOREIGN KEY (RoleId) REFERENCES dbo.Roles(RoleId)
  );

  CREATE TABLE dbo.RefreshTokens (
    RefreshTokenId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    UserId BIGINT NOT NULL,
    TokenHash VARBINARY(64) NOT NULL,
    ExpiresUtc DATETIME2 NOT NULL,
    CreatedUtc DATETIME2 NOT NULL CONSTRAINT DF_RefreshTokens_CreatedUtc DEFAULT (SYSUTCDATETIME()),
    RevokedUtc DATETIME2 NULL,
    ReplacedByTokenId BIGINT NULL,
    CONSTRAINT FK_RefreshTokens_User FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_RefreshTokens_ReplacedBy FOREIGN KEY (ReplacedByTokenId) REFERENCES dbo.RefreshTokens(RefreshTokenId),
    CONSTRAINT UQ_RefreshTokens_TokenHash UNIQUE (TokenHash)
  );

  CREATE INDEX IX_RefreshTokens_UserId ON dbo.RefreshTokens(UserId);

  CREATE TABLE dbo.Delegations (
    DelegationId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    DelegatorUserId BIGINT NOT NULL,
    DelegateeUserId BIGINT NOT NULL,
    RoleId INT NOT NULL,
    StartsUtc DATETIME2 NOT NULL,
    ExpiresUtc DATETIME2 NOT NULL,
    RevokedUtc DATETIME2 NULL,
    Notes NVARCHAR(500) NULL,
    CONSTRAINT FK_Delegations_Delegator FOREIGN KEY (DelegatorUserId) REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_Delegations_Delegatee FOREIGN KEY (DelegateeUserId) REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_Delegations_Role FOREIGN KEY (RoleId) REFERENCES dbo.Roles(RoleId),
    CONSTRAINT CK_Delegations_Dates CHECK (ExpiresUtc > StartsUtc),
    CONSTRAINT CK_Delegations_NotSelf CHECK (DelegatorUserId <> DelegateeUserId)
  );

  CREATE INDEX IX_Delegations_Delegatee_Active
    ON dbo.Delegations(DelegateeUserId, StartsUtc, ExpiresUtc)
    WHERE RevokedUtc IS NULL;
END
