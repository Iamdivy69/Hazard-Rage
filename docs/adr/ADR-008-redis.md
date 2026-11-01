# ADR-008: Redis for Cache + Rate-Limit (+ Optional Queue)

**Status:** Accepted | **Date:** 2026-11-01 | **Task:** DB change request — Postgres + Redis

## Decision
Add **Redis 7** as *ephemeral* layer only (never source of truth): L1 cache for hot reads, distributed rate-limit store, alert-dedup lock. Email queue (BullMQ) optional P2.

## Context
Postgres solves truth; NFR-01 (<3s dashboard) + NFR-02 (10k concurrent) need cheap hot-read path for `GET /zones`, `GET /hazard/trends`, throttling login/register. User said "redis if needed" — needed here.

## Options Considered

### Option 1: Redis cache-aside + rate-limit (Chosen)
- **Pros:** 60s TTL on zones/scores/trends cuts Postgres QPS 10x, shared rate-limit across replicas, dedup alert trigger via SET NX, graceful fallback if down, tiny code surface (`cache:get/set/del`, middleware).
- **Cons:** Extra container, cache invalidation discipline, cold-start miss.

### Option 2: No Redis (HTTP + React Query only)
- **Pros:** Zero ops.
- **Cons:** Postgres hammered on dashboard polling, per-instance memory rate-limit breaks under horizontal scale, fails NFR-02.

### Option 3: Redis as queue/session store for everything
- **Pros:** Full async + sessions.
- **Cons:** Over-engineering for Capstone; sessions stay stateless JWT, email fire-and-forget suffices P0.

## Reason
Scalability + performance with minimal complexity: cache-aside is simplest pattern that meets NFRs. Security (shared throttle) bonus.

## Trade-offs
Accept invalidation burden. Rule: write-through invalidation — on `POST/PATCH reports/zones` → `DEL cache:zones* cache:trend*`. Redis down → log WARN + bypass (fail-open read, fail-closed throttle).

## Impact
- Modules: `common/cache.ts` (get/set/del with namespace `hz:v1:`), `middleware/rateLimit` backed by Redis, `alerts` uses lock `alert:lock:zone:{id}` 30s TTL.
- Agent 2: `ioredis` client singleton, `CACHE_TTL=60`, never store PII without TTL, never assume hit.
- Agent 3: test hit/miss/invalidate, Redis-down fallback, throttle 429.
- Keys: `hz:v1:zones:list`, `hz:v1:zone:{id}`, `hz:v1:trend:{days}`, `rl:login:{ip}`.
