# Engineering Standards — Hazard Rage

## Naming

| Element | Convention | Example |
|---------|------------|---------|
| General files | kebab-case | `zone-service.js` |
| Components | PascalCase | `ZoneHeatmap.tsx` |
| Classes | PascalCase | `ReportService` |
| Funcs/vars (JS) | camelCase | `computeScore` |
| Constants | SCREAMING | `HAZARD_THRESHOLD` |
| DB tables | snake singular | `waste_report` |
| Endpoints | kebab plural | `/api/v1/order-items` → `/api/v1/waste-reports` (use `/reports`) |
| Env | SCREAMING | `JWT_SECRET` |

## Code Organization

One module folder = `routes, controller, service, repository, schema`. `common/` errors/pagination/asyncHandler. `middleware/` authenticate/authorize/validate/rateLimit/requestId. `config/` env/db/mailer.

## Errors

Typed `ApiError(code,status,details)`, `asyncHandler` wrapper, never swallow, ErrorBoundary per route. Every external call try/catch with requestId.

## Logging

Levels ERROR/WARN/INFO/DEBUG(dev). Format `[TS][LVL][reqId][mod] msg | {ctx}`. Log boundaries not loops. No sensitive data.

## Config

Central `config/index.js`, validates at boot (DATABASE_URL, REDIS_URL, JWT_SECRET, SMTP_*), separates dev/staging/prod. Prisma schema is DB truth; `prisma generate` in postinstall. Redis client singleton with `enableOfflineQueue:false`, `maxRetriesPerRequest:2`; all cache calls wrapped try/catch + bypass.

## Git

`main ← develop ← feature/*, fix/*, arch/*`. Commits `type(scope): desc` — `feat(reporting): add image upload`, `arch(db): define hazard_scores`.

## Gates

ESLint+Prettier green, `tsc --noEmit` if TS, Postman collection passes before merge. Controllers no DB, services no HTTP in hazard-engine, no fetch outside services/.
