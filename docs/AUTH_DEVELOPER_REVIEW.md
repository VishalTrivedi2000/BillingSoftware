# Auth stack — developer review (pre-migration / ops)

Use this checklist before applying schema to a shared or production database.

## Schema script (`db/migrations/001_auth.sql`)

- **Scope**: Creates `Roles`, `Permissions`, `RolePermissions`, `Users`, `UserRoles`, `RefreshTokens`, `Delegations` plus indexes/constraints.
- **Idempotency**: The script runs the whole batch only when `dbo.Delegations` does not exist. It assumes either a **fresh database** or that the auth tables were never partially created. If a prior run failed midway (e.g. `Roles` exists but `Delegations` does not), **manual cleanup or a repair script** may be required before re-running.
- **App seed data**: Demo users and permission/role rows are inserted by **`AuthDatabaseInitializer`** at API startup (not by this SQL file). After migration, run the API once against the same database so seed completes, or replicate seed logic for CI.

## Security

- **JWT signing key**: Must be long random secret in production; rotate with overlap/reissue strategy documented for your deployment.
- **Refresh tokens**: Stored hashed server-side; rotation on refresh reduces replay risk. Consider alerting on reuse detection if you add it later.
- **HTTPS**: Require TLS for API in non-local environments; SPA should call API over HTTPS.
- **CORS**: `JwtAndAuthorizationInstaller` allows `localhost:5173` for dev; tighten origins per environment.
- **Passwords**: Prefer **User Secrets** / env vars / Key Vault for `ConnectionStrings:DefaultConnection` in shared or production environments. Until then, a **temporary plaintext reference** for local dev (SQL `sa`, seeded app users, connection string) lives in **`docs/DEV_CREDENTIALS_TMP.md`** — **delete that file** (and rotate secrets) before production or publishing the repo.
- **`Users.DeveloperPlaintextPassword`**: Migration **`005_users_developer_plaintext_password.sql`** adds an optional dev-only column. Seed **`admin` / `billing` / `accountant`** get plaintext on insert **and** on each startup existing seed users are **updated** to match documented demo passwords. **Drop this column** before production (`ALTER TABLE dbo.Users DROP COLUMN DeveloperPlaintextPassword;`). Auth still uses **`PasswordHash`** only; APIs do **not** return this column.

## RBAC / delegation

- Permissions map to policies (`perm:{name}`). **Admin** role bypass is implemented in `PermissionAuthorizationHandler` — confirm this matches product policy.
- Delegations are time-bounded; effective permissions for a user merge direct roles and **active** delegated roles at token issue / summary load.

## Direct user permission grants (`UserPermissionGrants`)

- **Script**: `db/migrations/002_user_permission_grants.sql` (also applied automatically after `001_auth.sql` when the API starts, if the file exists).
- **Semantics**: Grants attach **extra** permissions to a user outside role assignment. **`ExpiresUtc` NULL** means **permanent** (until revoked). Otherwise the grant is **temporary** (active while `StartsUtc <= now < ExpiresUtc`).
- **`ResourceScope`**: Optional string for future **resource-specific** enforcement (e.g. `invoice:123`). JWT **permission** claims remain **flat** (`permission` claim per permission name); handlers that need scope must read it from `/me` / `activePermissionGrants` or load from DB per request.
- **API**: Create/list/revoke requires **`users.manage`**. Effective grants for self: `GET /api/v1/user-permission-grants/me/active`.
- **Stale JWT**: Short access-token lifetime limits how long an expired grant remains in an old token; refresh re-computes effective permissions.

## Direct user role grants (`UserRoleGrants`)

- **Script**: `db/migrations/003_user_role_grants.sql` (listed in `AuthBootstrapOptions.AdditionalSchemaSqlPaths`).
- **Semantics**: Extra **roles** on top of `UserRoles` membership. Same time model as permission grants: **`ExpiresUtc` NULL** = permanent until revoked; otherwise bounded. Effective roles merge **`UserRoles`** + **`UserRoleGrants`** (active window) + active **delegations**, then permissions come from the merged role set plus direct permission grants.
- **API**: `GET /api/v1/user-role-grants/me/active`; admin CRUD under **`users.manage`**: `GET …/user/{userId}`, `POST …`, `POST …/{grantId}/revoke`.

## Database migration (manual)

1. Ensure the target database exists (`CREATE DATABASE BSDB` if needed).
2. Run schema scripts with a privileged login (example uses SQL authentication). **`001_auth`** first on empty DB, then **`002_user_permission_grants`** on existing installs:

   ```text
   sqlcmd -S "SERVER,1433" -d BSDB -U sa -P "***" -C -i db\migrations\001_auth.sql
   sqlcmd -S "SERVER,1433" -d BSDB -U sa -P "***" -C -i db\migrations\002_user_permission_grants.sql
   sqlcmd -S "SERVER,1433" -d BSDB -U sa -P "***" -C -i db\migrations\003_user_role_grants.sql
   sqlcmd -S "SERVER,1433" -d BSDB -U sa -P "***" -C -i db\migrations\004_user_profiles.sql
   sqlcmd -S "SERVER,1433" -d BSDB -U sa -P "***" -C -i db\migrations\005_users_developer_plaintext_password.sql
   sqlcmd -S "SERVER,1433" -d BSDB -U sa -P "***" -C -i db\migrations\006_billing_core.sql
   ```

   `-C` trusts the server certificate (aligns with `TrustServerCertificate=True`). `001_auth.sql` sets **`ANSI_NULLS` / `QUOTED_IDENTIFIER` ON** so filtered indexes work under `sqlcmd`.

   Alternatively, rely on API startup to apply scripts listed in `AuthBootstrapOptions` (`SchemaSqlPath` + `AdditionalSchemaSqlPaths`).

3. Point `BillingApp.Api` `ConnectionStrings:DefaultConnection` at the same database and start the API once to run initializer seed (if enabled).

## Sign-off

- [ ] Reviewed script vs target SQL Server version (compatibility level).
- [ ] Backup taken (production/staging).
- [ ] Connection strings and JWT secrets are **not** committed with real values.
- [ ] Demo seed accounts disabled or removed before production.
