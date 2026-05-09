/* DEV ONLY: optional plaintext password alongside PasswordHash — remove column before production. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF COL_LENGTH(N'dbo.Users', N'DeveloperPlaintextPassword') IS NULL
BEGIN
  ALTER TABLE dbo.Users ADD DeveloperPlaintextPassword NVARCHAR(256) NULL;
END
