# ADR-007: PostgreSQL (Supersedes ADR-002 MySQL)

**Status:** Accepted | **Date:** 2026-11-01 | **Task:** DB change request — Postgres + Redis

Supersedes: ADR-002 (MySQL)

## Decision
Use **PostgreSQL 16 + PostGIS** as primary store, accessed via **Prisma ORM**. Docker Compose for local/prototype.

## Context
User requested Postgres. Need zone geo-boundaries, JSONB hazard inputs, stronger concurrency for 10k target, RETURNING/CTEs for atomic recompute, full-text search on reports.

## Options Considered

### Option 1: PostgreSQL 16 + Prisma (Chosen)
- **Pros:** Native ENUMs, JSONB for `inputs_json`, PostGIS GEOGRAPHY for zone polygons + near-market/drain queries, CTE/transactional recompute, Prisma migrations + typed client matching TS contracts, full-text search, proven with Express+React.
- **Cons:** Heavier than MySQL/XAMPP, requires Docker, Prisma learning curve, PostGIS extension setup.

### Option 2: MySQL 8 (Previous)
- **Pros:** XAMPP bundled, team familiar.
- **Cons:** Weaker geo (no PostGIS), JSON handling weaker, no RETURNING, rejected per user request.

### Option 3: Postgres with raw `pg` + `node-pg-migrate`
- **Pros:** Lightest, full SQL control.
- **Cons:** No type safety, manual migration discipline, more boilerplate for Agent 2.

## Reason
Correctness (geo + JSONB + concurrency) > Simplicity loss. Prisma maximizes maintainability/testability for Agent 2/3 despite small learning cost. Aligns with scalability goal.

## Trade-offs
Give up XAMPP zero-setup; accept Docker dependency + Prisma generate step. Mitigated with `docker-compose.yml` + `prisma migrate dev` one-command boot.

## Impact
- Modules affected: all repositories, seed, migrate, config.
- Agent 2: use `prisma/schema.prisma` as single source of truth; never raw SQL except PostGIS CTE where Prisma.raw needed; run `npx prisma migrate dev`.
- Agent 3: test ENUM violations, FK RESTRICT, PostGIS containment, JSONB shape.
- Follow-up: ADR-008 Redis; enable `postgis` extension in migration 001.
