# Agent 2 Task Specifications — Hazard Rage (Postgres + Redis + React)

> One task = one slice. Prisma schema is truth. Redis `hz:v1:*` TTL 60 — invalidate on every write. Do not guess interfaces.

## TASK-000 Docker + Prisma Boot (P0, deps: None)
Goal: `docker compose up -d` Postgres+Redis + `prisma migrate dev` + seed smoke.
In: `/docker-compose.yml`, `prisma/schema.prisma`, `/.env.example`. Out: features.
AC: `pg_isready` + `redis-cli ping` ok, `ENABLE postgis` true, seed inserts 20 zones, `GET /health` shows `{postgres:true,redis:true}`.
Output: `prisma/*`, `docker-compose.yml`, `.env.example`.

## TASK-001 Scaffold + Env (P0, deps: 000)
Goal: runnable monorepo + lint + Prisma + Redis clients + health. In: Vite React + Express + ioredis + Prisma + docs/adr + .env.example + compose. Out: logic/auth/UI.
Contracts: `GET /api/v1/health → {success:true,data:{ok:true,postgres:true,redis:true}}`; config throws if DATABASE_URL/REDIS_URL/JWT_SECRET missing; Redis singleton `enableOfflineQueue:false`.
AC: dev boots both, /health 200, lint green.
Output: backend/src/config/*, common/*, frontend apiClient.ts, .env.example.

## TASK-002 Auth + RBAC (P0, deps: 001)
Goal: register/login/me JWT + Redis throttle + guards. In: bcrypt, Prisma User, authenticate/authorize, rateLimit-redis. Out: reset/OAuth.
Contracts: `POST /auth/register {name,email,password≥6} → 201 {user,token}`; `POST /auth/login → 200`; `GET /auth/me Bearer → 200`; citizen→admin 403.
AC: dup 409, bad pass 401, no token 401, hash not plaintext, 11th login/min → 429 + Retry-After.
Notes: token in memory, interceptor attach.

## TASK-003 Zones + Seed (P0, deps: 001)
Goal: zones read (cached) + 20 zones PostGIS + remediation matrix. In: Prisma Zone, PostGIS center/boundary, GET /zones (cache hz:v1:zones:list 60s), GET /zones/:id, seed.ts. Out: geo-edit UI.
AC: 20 seeded, detail = zone+recent5+trend30, bad id 404, second GET served from Redis (x-cache:HIT), write DELs keys.

## TASK-004 Frontend Base emil+apple (P0, deps: 001)
Goal: tokens/shells/providers/guards/skeletons. In: tokens.css, AppShell/AdminShell, providers, router, ui/*.
Contracts: apiClient.get/post/patch + requestId; RequireAuth → /login?redirect=.
AC: press scale(.97) 160ms, modal 250ms ease-out center, popover from trigger, reduced-motion fade only, translucent toolbar.
Notes: run `npx skills add emilkowalski/skill`; apply apple translucency/type.

## TASK-005 Waste Reporting (P0, deps: 002,003,004)
Goal: citizen submit (Prisma tx) + own list + cache invalidate. In: POST /reports multipart, GET /reports?mine, ReportForm. Out: scoring impl, status change.
Contracts: `POST {zone_id,waste_type,severity,description?,image?} → 201 {report,hazardScore}`; >5MB/non-image 400.
AC: valid 201 + in My Reports + `hz:v1:zone:{id}` invalidated, missing zone 400, unauth 401.

## TASK-006 Hazard Engine (P0, deps: 003)
Goal: pure computeScore + Prisma recomputeZone + persist JSONB. In: hazard-engine/service (no Express/Redis), weight config. Out: HTTP/email.
Contracts: `computeScore({volumeIndex,typeSeverity,spreadRadius,frequency,unresolvedDuration}:0-10) → {score,level}`; `recomputeZone(id) → {score,level}`. Formula §API doc, clamp, Low 0-3 Med 4-6 High 7-10.
AC: boundary tests pass, <200ms on 500 rows.

## TASK-007 Status + Alerts (P0, deps: 005,006)
Goal: status transition → recompute → Redis alert lock + invalidate + email. In: PATCH /reports/:id/status (Prisma tx), alerts table, Nodemailer (+BullMQ optional), GET/PATCH /alerts, lock `alert:lock:zone:{id}` NX 30s. Out: SMS.
AC: valid chain Pending→In Progress→Resolved, bad jump 422, breach → Active + email <5s, citizen PATCH 403, SMTP down still stores.

## TASK-008 Admin Dashboard (P0, deps: 003,004,006)
Goal: KPIs + TrendChart + ZoneTable (cached trends). In: AdminDashboard, analytics/*, GET /hazard/trends (Redis hz:v1:trend:{days}). Out: map.
AC: <3s on seed, stagger 50ms, skeleton, empty state, badge color+label, cache HIT on repeat.

## TASK-009 Heatmap + Zone Detail (P1, deps: 008)
Goal: Leaflet OSM green-yellow-red + spring drawer. In: ZoneHeatmap, ZoneDetail.
Contracts: click → GET /zones/:id; drawer drag with capture/velocity/rubber-band.
AC: 20 pins, drawer from marker origin, flick dismiss, OSM fail → list fallback.

## TASK-010 Cause + Remediation (P1, deps: 006,008)
Goal: cause + actions. In: GET /remediation/suggest, CausePanel/RemediationCard. Out: ML.
Contracts: `GET ?waste_type&level → {actions[]}` 15-rule matrix.
AC: each detail ≥1 cause + ≥1 action.

## TASK-011 Export + Polish (P2, deps: 007-010)
Goal: CSV (Postgres cursor stream) + a11y + perf. In: GET /exports/reports.csv.
AC: admin CSV 500 rows <2s, citizen 403, Lighthouse a11y >90, keyboard nav, Redis-down still exports (bypass).

## TASK-012 Seed Demo + Docs (P2, deps: 011)
Goal: deterministic 500 seed (Prisma + PostGIS) + 3-min demo. In: prisma/seed.ts, Postman, DEMO.md. Out: prod.
AC: fresh migrate+seed reproduces market/drain high + intervention decline; cache MISS→HIT visible; walkthrough passes.
