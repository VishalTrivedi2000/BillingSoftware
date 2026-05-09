# Billing Application - Implementation Plan (Multipart) v1.0

**Stack:** ASP.NET Core Web API - Dapper - Clean Architecture - SQL Server - React + TypeScript + Vite  
**Requirements baseline:** LOCKED v1 - see `docs/REQUIREMENTS_V1_LOCK.md`  
**Companion artifact:** Generate Word via `python docs/generate_implementation_plan_docx.py`

---

## Document control

| Field | Value |
|-------|--------|
| Plan version | 1.0 |
| Related requirements | Billing Spec v1.0 LOCKED + stakeholder PDF |
| Backend | .NET 8 LTS (adjust pin in repo as needed) |
| Frontend | React 18+, TypeScript strict, Vite |
| ORM | **Not used** - Dapper + hand-written SQL only |

---

## Part 1 - Objectives and scope alignment

### 1.1 Goals

- Deliver **CORE-01 through CORE-15** (MVP) with **minimal rework** later: stable domain model, explicit SQL contracts, versioned APIs.
- Lay foundations for **FR-*** extensions (inventory depth, marketplace catalog, advanced IAM) via extension points, not hacks.

### 1.2 Out of MVP (explicit)

- Full marketplace variant matrix (FR-CAT-16) - scaffold hooks only if needed.
- Full ABAC / delegation (FR-IAM-18/19) - MVP aligns with **CORE-02** roles; JWT/RBAC baseline sufficient for v1 unless promoted.

### 1.3 Quality bar

- **Calculation fidelity:** Invoice line + summary formulas match stakeholder Section 1.4.5-1.4.7 exactly; golden tests.
- **Audit:** Immutable audit trail for financial edits (CORE-15 / stakeholder PDF Section 6).
- **API stability:** `/api/v1/...` versioning; breaking changes require v2.

---

## Part 2 - High-level solution architecture

```
+-----------------+     HTTPS/JWT      +----------------------+
| React (Vite)    | <---------------> | ASP.NET Core API     |
| PWA + SW        |    SignalR (hub)   | Controllers          |
+-----------------+                    +----------+-----------+
      | offline cache                           |
      v                                           v
 IndexedDB                              +-------------------+
 sync queue                             | Application layer |
                                        | (use cases)       |
                                        +---------+---------+
                                                  |
                                        +---------+---------+
                                        v                   v
                                  +-----------+   +---------------+
                                  | Domain    |   | Infrastructure |
                                  | entities  |   | Dapper + SQL   |
                                  +-----------+   +--------+-------+
                                                           |
                                                    SQL Server
```

### 2.1 Bounded contexts (logical modules)

Align folders and Db schemas by module: **Identity**, **Masters** (customers, products), **Sales**, **Purchases**, **Payments**, **CashBank**, **Reports**, **Audit**.

---

## Part 3 - Backend (ASP.NET Core + Clean Architecture + Dapper)

### 3.1 Project layout

```
src/
  BillingApp.Domain/           # Entities, value objects, domain exceptions (no deps)
  BillingApp.Application/      # Interfaces, commands/queries, validators, DTOs for app layer
  BillingApp.Infrastructure/   # Dapper repositories, SqlConnection factory, migrations runner
  BillingApp.Api/              # Controllers, auth middleware, SignalR hubs, DI composition
```

**References**

- `Application` -> `Domain`
- `Infrastructure` -> `Application`, `Domain`
- `Api` -> `Application`, `Infrastructure`

### 3.2 Clean Architecture rules

- **Domain:** Pure C# - invoice math as domain methods where appropriate **or** dedicated **CalculationService** in Application with deterministic decimal behaviour (`decimal`, explicit rounding half-up at boundaries).
- **Application:** One use-case per command/query file or cohesive service; interfaces `ICustomerRepository`, etc.; FluentValidation validators.
- **Infrastructure:** Only layer that touches ADO/Dapper/SQL; map rows to domain entities via explicit mappers (no EF navigation graphs).
- **Api:** Thin controllers - validate HTTP, call mediator/handlers, map to HTTP responses.

### 3.3 Dapper and repository pattern

- `IDbConnectionFactory` opens `SqlConnection` scoped per HTTP request (`using` + async).
- Repositories implement interfaces from Application; **no generic God repository.**
- Prefer **stored procedures** for heavy reporting *or* parameterized SQL in repo classes - team picks one style per module and stays consistent.
- Always **`DynamicParameters`** / anonymous params; guard against SQL injection.

### 3.4 Cross-cutting

- **ProblemDetails** for errors; correlation ID middleware.
- **Serilog** (file + Seq optional).
- **Health checks** for DB connectivity.

### 3.5 API conventions

- REST `/api/v1/resource`
- Pagination `skip/take` or cursor for large lists
- Idempotency-Key header on POST payments (recommended)

---

## Part 4 - Database (Microsoft SQL Server)

### 4.1 Principles

- **Naming:** `dbo.Customers`, `InvoiceId`, `CreatedUtc` - pick PascalCase for columns and **stick to it**.
- **Keys:** `uniqueidentifier` or `bigint` identity - choose one cluster strategy document-wide (recommend **bigint** identity for performance simplicity).
- **Money:** `decimal(18,2)` for monetary columns; never `float`.

### 4.2 Migrations (no EF Core)

Options (pick one in sprint 0):

- **FluentMigrator** in `Infrastructure` + CI runner, or  
- **DbUp** embedded SQL scripts in assembly.

Store scripts under `db/migrations/` with sequential numbering.

### 4.3 Core tables (MVP sketch)

- `Users`, `Roles`, `UserRoles`
- `Customers`, `CustomerInvoiceLabels` (4 labels)
- `Products`
- `Invoices`, `InvoiceLines`
- `Payments`
- `CreditNotes`
- `SaleOrders`, `DeliveryChallans` (if MVP includes docs beyond invoice - match CORE-13)
- `Purchases`, `PurchaseOrders`, `DebitNotes`
- `BankAccounts`, `CashLedger`, `Cheques`
- `AuditLog`

Add FK + indexes on `Invoice.CustomerId`, `InvoiceLines.InvoiceId`, `Payments.InvoiceId`.

### 4.4 Row-level scope

Prepare optional `BranchId` nullable columns early if multi-branch is likely - avoids painful migrations.

---

## Part 5 - Frontend (React + TypeScript + Vite)

### 5.1 Project layout

```
web/
  src/
    app/              # router, providers
    features/         # domain slices: invoices, customers, dashboard
    entities/         # types mirroring API contracts
    shared/           # ui kit, http client, hooks
    widgets/
```

### 5.2 Type safety

- **Strict TS** - `"strict": true`
- OpenAPI-generated clients optional phase 1b - otherwise hand-maintained `types/api.v1.ts` synced with backend.

### 5.3 State and data fetching

- **TanStack Query** for server cache + retries + stale-while-revalidate.
- Auth token in memory + refresh via http-only cookie pattern **preferred** for web (requires backend cookie endpoints).

### 5.4 UI

- Component library: **MUI** or **Ant Design** - pick one for consistency (dashboards benefit from mature grids).

---

## Part 6 - Online / offline support

### 6.1 Requirements interpretation

- **Offline-capable POS-lite:** queue mutations locally when navigator offline; sync when online.
- **Conflict strategy:** Server wins on totals; client sees conflict payload if invoice changed server-side.

### 6.2 Implementation sketch

- Service Worker (Workbox) for shell cache + API GET caching policy **careful** for finance - prefer **online-first**, offline queue **writes only** with explicit user acknowledgement.
- **IndexedDB** tables: `outbox`, `snapshot_catalog`, `session`.
- Background sync or manual "Sync now" button.

### 6.3 Minimal-change posture

- All mutations hit **same REST endpoints** when online; offline replay sends identical payloads with client-generated **dedupe keys**.

---

## Part 7 - Live dashboards

### 7.1 Backend

- **SignalR** hub `dashboardHub` - broadcast aggregates on invoice saved/payment posted (or poll fallback).
- MVP metrics mirror CORE-04: counts/sums with cached snapshots optional (`DashboardSnapshot` table refreshed by triggers/jobs **later** - start with query).

### 7.2 Frontend

- Subscribe on dashboard route mount; unsubscribe on leave.
- TanStack Query `invalidateQueries` on hub events.

---

## Part 8 - Security and IAM (v1)

### 8.1 MVP

- ASP.NET Core **JWT Bearer** access + refresh rotation endpoints (align future work with FR-IAM-*).
- Password hashing **ASP.NET Core Identity PasswordHasher** or dedicated user store - avoid storing plain passwords.
- Role claims map to **Admin / BillingStaff / Accountant** from CORE-02.

### 8.2 Transport and headers

- HTTPS only prod; HSTS; secure cookies if refresh pattern uses cookies.

---

## Part 9 - Multipart delivery roadmap

### Phase 0 - Foundation (Week 1-2)

- Solution skeleton, CI build, SQL migrations runner, auth skeleton, health checks.
- DB schema v0: Users/Roles, Customers, Products stub.

### Phase 1 - CORE billing spine (Week 3-6)

- Invoice CRUD + calculation engine + PDF invoice output.
- Payments partial + statuses.
- Dashboard metrics endpoints + React dashboard page.

### Phase 2 - Documents and purchasing (Week 7-9)

- Estimates, sale orders, DCs; purchase side mirrors stakeholder Section 5.
- Credit/debit notes linkage.

### Phase 3 - Cash and bank + reports (Week 10-12)

- Bank/cash/cheque flows; report endpoints + export (Excel/PDF).
- Audit trail UI slice.

### Phase 4 - Hardening (Week 13-14)

- Performance tuning, security review, offline queue polish, E2E tests.

*(Calendar illustrative - adjust with team velocity.)*

---

## Part 10 - Testing, CI/CD, ops

### 10.1 Testing pyramid

- **Domain/Application:** unit tests for calculations (highest ROI).
- **Infrastructure:** integration tests against **Docker SQL Server** or LocalDB.
- **Api:** WebApplicationFactory tests for auth + invoice happy paths.
- **Frontend:** Vitest + RTL; Playwright smoke.

### 10.2 CI

- `dotnet test`, `npm test`, lint, `dotnet format` optional.

### 10.3 Deployment

- Containerize API optional; static hosting for Vite build (CDN).

---

## Part 11 - Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Invoice rounding ambiguity ("nearest 1") | Product owner signs single rounding rule; golden tests |
| Offline conflicts | Idempotency keys + server versioning on invoices |
| SQL drift | Migrations only via repo scripts; no manual prod edits |
| Scope creep | REQUIREMENTS_V1_LOCK + change requests |

---

## Appendix A - Repository conventions

- `main` protected; PR reviews required.
- Feature branches `feat/`, fixes `fix/`.

## Appendix B - Next enhancements (post-v1)

Promote via Requirements v2: FR-CAT-16 marketplace taxonomy, full IAM ABAC, inventory batches, e-invoice APIs.

---

## Appendix C - Repository scaffold (Version-1 kickoff)

| Path | Purpose |
|------|---------|
| `BillingApp.sln` | .NET solution |
| `src/BillingApp.Domain` | Domain layer (add aggregates next) |
| `src/BillingApp.Application` | Use cases + `Abstractions/Data/IDbConnectionFactory` |
| `src/BillingApp.Infrastructure` | Dapper + `SqlServerConnectionFactory` + `DependencyInjection` |
| `src/BillingApp.Api` | ASP.NET Core API, Swagger, `GET /api/v1/health` |
| `web/` | React + TS + Vite; TanStack Query; `@microsoft/signalr` for live dashboards (wire in Phase 1) |
| `db/migrations/` | SQL scripts; add FluentMigrator or DbUp runner |

Word export: `python docs/generate_implementation_plan_docx.py` produces `docs/Billing_App_Implementation_Plan_V1.docx`.
