/* Incremental: direct user permission grants (temporary or permanent). Safe to run on existing BSDB. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF OBJECT_ID(N'dbo.UserPermissionGrants', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.UserPermissionGrants (
    GrantId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    UserId BIGINT NOT NULL,
    PermissionId INT NOT NULL,
    StartsUtc DATETIME2 NOT NULL,
    ExpiresUtc DATETIME2 NULL,
    RevokedUtc DATETIME2 NULL,
    ResourceScope NVARCHAR(256) NULL,
    Notes NVARCHAR(500) NULL,
    CONSTRAINT FK_UserPermissionGrants_User FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_UserPermissionGrants_Permission FOREIGN KEY (PermissionId) REFERENCES dbo.Permissions(PermissionId),
    CONSTRAINT CK_UserPermissionGrants_Dates CHECK (ExpiresUtc IS NULL OR ExpiresUtc > StartsUtc)
  );

  CREATE INDEX IX_UserPermissionGrants_User_NotRevoked
    ON dbo.UserPermissionGrants(UserId)
    WHERE RevokedUtc IS NULL;
END
