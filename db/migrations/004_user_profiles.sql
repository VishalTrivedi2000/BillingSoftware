/* User profile fields + picture metadata (1:1 with Users). Apply after 003. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF OBJECT_ID(N'dbo.UserProfiles', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.UserProfiles (
    UserId BIGINT NOT NULL PRIMARY KEY,
    DisplayName NVARCHAR(200) NULL,
    Email NVARCHAR(256) NULL,
    Phone NVARCHAR(50) NULL,
    JobTitle NVARCHAR(128) NULL,
    Department NVARCHAR(128) NULL,
    Bio NVARCHAR(2000) NULL,
    TimeZone NVARCHAR(64) NULL,
    Locale NVARCHAR(32) NULL,
    ProfilePictureRelativePath NVARCHAR(512) NULL,
    ProfilePictureContentType NVARCHAR(100) NULL,
    ProfilePictureUpdatedUtc DATETIME2 NULL,
    UpdatedUtc DATETIME2 NOT NULL CONSTRAINT DF_UserProfiles_UpdatedUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_UserProfiles_User FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId) ON DELETE CASCADE
  );
END
