/* Incremental: extra role assignments per user (temporary or permanent). Apply after 002. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF OBJECT_ID(N'dbo.UserRoleGrants', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.UserRoleGrants (
    GrantId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    UserId BIGINT NOT NULL,
    RoleId INT NOT NULL,
    StartsUtc DATETIME2 NOT NULL,
    ExpiresUtc DATETIME2 NULL,
    RevokedUtc DATETIME2 NULL,
    Notes NVARCHAR(500) NULL,
    CONSTRAINT FK_UserRoleGrants_User FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_UserRoleGrants_Role FOREIGN KEY (RoleId) REFERENCES dbo.Roles(RoleId),
    CONSTRAINT CK_UserRoleGrants_Dates CHECK (ExpiresUtc IS NULL OR ExpiresUtc > StartsUtc)
  );

  CREATE INDEX IX_UserRoleGrants_User_NotRevoked
    ON dbo.UserRoleGrants(UserId)
    WHERE RevokedUtc IS NULL;
END
