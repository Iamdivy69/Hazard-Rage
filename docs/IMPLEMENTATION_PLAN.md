# Implementation Plan (Master) — Hazard Rage

> Consolidated entry point. Details live in `architecture/`, `roadmap/`, `adr/`. Source: `PARTH REPORT.md`. Updated: Postgres + Redis + React (ADR-007/008).

## 1. Executive Summary
Reactive waste management → no zone visibility, no scoring, citizen disconnect. Build modular-monolith 3-tier: **React SPA** + Express `/api/v1` + **PostgreSQL 16 + PostGIS via Prisma** (truth) + **Redis 7** (60s cache, rate-limit, alert lock). Citizen crowdsourcing → deterministic Hazard Engine (0–10, alert ≥7) → admin heatmap/trends/remediation. Decisions: monolith (001), Postgres supersedes MySQL (007/002), JWT (003), CSR React (004), Leaflet+OSM (005), Redis cache (008). Frontend via `npx skills add emilkowalski/skill` + apple-design: fluid, sub-300ms, translucent.

## 2. What to Build (P0→P2)
P0: Docker boot, Prisma migrate+seed, auth, report submit, hazard compute, status workflow, threshold alerts (+Redis invalidate/lock), dashboard. P1: heatmap (PostGIS), trends (cached), cause (full-text), remediation. P2: CSV export (cursor stream), BullMQ email queue optional, polish, 500-seed demo.

## 3. Architecture at a Glance
`React (Query 60s SWR) → REST Bearer → Express routes→controllers→services→Prisma → Postgres; sidecar ioredis hz:v1:*`. hazard-engine pure, alerts use Redis NX lock. See `architecture/SYSTEM_ARCHITECTURE.md`.

## 4. Database at a Glance
Postgres ENUMs, JSONB inputs, PostGIS center/boundary, GIN full-text, Prisma migrations. Redis never truth. See `DATABASE_DESIGN.md`.

## 5. API at a Glance
`/auth/*, /zones, /reports, /hazard/*, /alerts, /remediation/suggest, /exports`. Prisma count+findMany tx pagination, Redis 429 + Cache-Control. See `API_ARCHITECTURE.md`.

## 6. Frontend at a Glance
React CSR confirmed, pages→features→ui, apiClient only, Query TTL mirrors Redis. Motion/material/type per emil+apple. See `FRONTEND_ARCHITECTURE.md`.

## 7. Build Order
000 Docker+Prisma boot → 001 scaffold → 002 auth (Redis throttle) + 003 zones/PostGIS + 004 base → 005 reporting + 006 engine → 007 status/alerts (lock+invalidate) → 008 dashboard (cached) → 009 map → 010 cause/remed → 011 export/polish → 012 seed/demo. See `roadmap/`.

## 8. How to Run Smoothly
1. `docker compose up -d postgres redis` → `npx prisma migrate dev` → `seed` Day 1 so UI has data. 2. Contracts first. 3. Cache rule: every write DELs `hz:v1:*`. 4. Redis down drill: reads bypass, auth throttles closed. 5. Lint + Postman green. 6. Motion audit <300ms.

## 9. Pointers
Requirements → `architecture/REQUIREMENTS.md`. Security → `SECURITY_ARCHITECTURE.md`. Standards → `ENGINEERING_STANDARDS.md`. AC → `ACCEPTANCE_CRITERIA.md`. Decisions → `adr/ADR-007-postgres.md`, `ADR-008-redis.md`. Risks → `RISKS_AND_VALIDATION.md`. Env → `/.env.example`, `/docker-compose.yml`.
