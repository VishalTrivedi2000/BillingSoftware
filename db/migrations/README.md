# SQL Server migrations

Use **FluentMigrator** or **DbUp** (no EF Core migrations).

Place ordered scripts here, for example:

- `001_initial.sql`
- `002_add_invoices.sql`

The BS repo applies **`006_billing_core.sql`** automatically via API bootstrap (customers, products, invoices, lines).

The implementation plan (`docs/IMPLEMENTATION_PLAN_V1.md`) describes core MVP tables.
