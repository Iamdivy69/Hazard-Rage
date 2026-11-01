# System Architecture — Hazard Rage

Style: **Modular Monolith, 3-tier, synchronous REST** (ADR-001). Data: **Postgres 16 + PostGIS via Prisma** (ADR-007). Ephemeral: **Redis 7 cache/rate-limit** (ADR-008). Frontend: **React SPA** confirmed.

```
Frontend (React + Vite SPA, Citizen + Admin)
  Leaflet+OSM, Chart.js, JWT memory, React Query (SWR 60s)
        │ HTTPS JSON REST /api/v1, Bearer JWT
Backend (Node + Express)
  routes → controllers → services → Prisma repos → PostgreSQL
  services: auth, reports, hazard-engine, alerts, remediation, exports
  cross-cutting: common/cache (ioredis), rateLimit (Redis), requestId
        │ Prisma (parameterized)      │ ioredis (TTL 60)
PostgreSQL 16 + PostGIS: users, zones (+GEOGRAPHY), waste_reports, hazard_scores(JSONB), alerts, remediation_rules
Redis 7: hz:v1:zones:list, hz:v1:zone:{id}, hz:v1:trend:{days}, rl:* , alert:lock:*
Static: /uploads (5MB cap) | External: OSM tiles, SMTP
```

## Frontend / Backend Separation

- React renders only; no business rules. Only talks via `apiClient` to `/api/v1`.
- Backend owns auth, validation, hazard math, alerts, persistence + cache invalidation.
- Contract: `{success,data,meta}` / `{success:false,error,meta}`, versioned URL, Bearer auth. `ETag`/`Cache-Control: max-age=60` on cacheable GETs.

## Module Boundaries

| Module | Owns | Exposes | Depends On | Does NOT Do |
|--------|------|---------|------------|-------------|
| auth | users | login/register/me | Prisma User, Redis rl | hazard |
| reports | waste_reports | CRUD + status | zones, hazard-engine, alerts, cache.invalidate | map render |
| hazard-engine | hazard_scores | computeScore(), recomputeZone() | Prisma Zone/Report | HTTP/email/Redis |
| alerts | alerts | list/ack/trigger()+lock | hazard-engine, mailer, Redis lock | score math |
| remediation | remediation_rules | suggest(type,level) | Prisma | scoring |
| zones | zones (+PostGIS) | list/detail | Prisma + cache | reports |
| exports | csv | exportReports() (streams Postgres cursor) | reports | auth |
| common/cache | Redis keys | get/set/del(`hz:v1:*`) | ioredis | business logic |

Rules: controllers never touch Prisma directly (via services); hazard-engine never imports Express/Redis.

## Folder Structure

```
hazard-rage/
 frontend/ (React+Vite) src/{pages,features,ui,layout,providers,services,hooks,router,styles}
 backend/src/{modules/{auth,users,zones,reports,hazard-engine,alerts,remediation,exports},common(cache,errors,pagination),middleware(authenticate,authorize,validate,rateLimit,requestId),config(env,prisma,redis,mailer)}
 prisma/{schema.prisma,migrations/,seed.ts}
 docker-compose.yml (postgres:16-postgis, redis:7) uploads/ docs/ scripts/
```

## Data Flows (with cache)

Submit: `Citizen → POST /reports → validate → Prisma tx insert → recompute HS → DEL cache → if ≥7 (Redis lock NX 30s) insert Alert + email → 201 {report,score} → frontend invalidate Query`.
Read: `GET /zones → cache HIT? return : Postgres → SET 60s → return + Cache-Control`.
Resolve: `PATCH status → tx update → recompute → DEL cache → Alert Resolved`.

## Integrations

| Integration | Protocol | Auth | Failure |
|-------------|----------|------|---------|
| Postgres | TCP Prisma | DATABASE_URL | 500 + requestId, no partial write (tx rollback) |
| Redis | TCP ioredis | REDIS_URL | WARN log + bypass (fail-open read, fail-closed throttle → 429 only if Redis up) |
| OSM | HTTPS | none | grey grid + list fallback |
| SMTP | SMTP | env | log + 3x retry, alert still stored |

## Caching (authoritative)

- Keys `hz:v1:*` TTL 60s. Write-through invalidation on report/zone/status writes.
- React Query 60s SWR mirrors server TTL. Vite hashed assets long-cache.
- Never cache `POST`, auth, or PII beyond TTL; never treat miss as error.
