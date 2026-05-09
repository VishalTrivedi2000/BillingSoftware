# Build

## Backend (.NET 8)

```powershell
cd d:\AkashSir\BS
dotnet build BillingApp.sln
dotnet run --project src/BillingApp.Api
```

Health check: `GET https://localhost:<port>/api/v1/health` (see launchSettings for port).

SQL Server: set `ConnectionStrings:DefaultConnection` in `src/BillingApp.Api/appsettings.json` or user secrets.

## Frontend (Vite + React + TS)

```powershell
cd d:\AkashSir\BS\web
copy .env.example .env   # set VITE_BASE_API_URL (must end with /api, e.g. /api or https://localhost:7256/api)
npm install
npm run dev
```

Environment: `web/.env` → **`VITE_BASE_API_URL`** is the only base URL for REST (see `src/shared/config/api.ts`). Relative `/api` uses Vite proxy to `http://localhost:5151`.

## Documents

- Requirements v1 lock: `docs/REQUIREMENTS_V1_LOCK.md`
- Implementation plan (Markdown): `docs/IMPLEMENTATION_PLAN_V1.md`
- Implementation plan (Word): `docs/Billing_App_Implementation_Plan_V1.docx` (run `python docs/generate_implementation_plan_docx.py`)
