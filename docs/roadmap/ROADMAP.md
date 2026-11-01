# Development Roadmap — Hazard Rage

## Phases

**Phase 0 — Setup (0.5d):** TASK-000 Docker Postgres+Redis + Prisma migrate + seed boot, TASK-001 scaffold + env + lint + health (Redis ping).

**Phase 1 — Foundation P0 (1–2d):** TASK-002 auth (Redis throttle), TASK-003 zones + PostGIS + seed, TASK-004 frontend base (emil+apple tokens, shells, apiClient, guards).

**Phase 2 — Core P0 (2–3d):** TASK-005 reporting, TASK-006 hazard-engine, TASK-007 status+alerts+email.

**Phase 3 — Analytics P1 (2d):** TASK-008 dashboard, TASK-009 heatmap+detail drawer, TASK-010 cause+remediation.

**Phase 4 — Polish P2 (1d):** TASK-011 CSV export + a11y + perf, TASK-012 500-seed + demo script + Postman.

Total ~7–9d solo, ~4–5d parallel (005||008 after 001–004).

## Status Board

| Task | Feature | Priority | Status | Depends On | Notes |
|------|---------|----------|--------|------------|-------|
| TASK-000 | Docker+Prisma boot | P0 | ✅ Done | None | Postgres 16 + PostGIS + Redis 7 containers healthy |
| TASK-001 | Scaffold | P0 | ✅ Done | 000 | Express API + Vite React + health checks green |
| TASK-002 | Auth | P0 | ✅ Done | 001 | JWT + bcrypt + Redis rate limiting & RBAC guards |
| TASK-003 | Zones+Seed | P0 | ✅ Done | 001 | 20 zones seeded with PostGIS, cached reads |
| TASK-004 | Frontend base | P0 | ✅ Done | 001 | Emil+Apple design tokens, auth/toast providers |
| TASK-005 | Reporting | P0 | ✅ Done | 002,003,004 | Multipart image upload + instant preview + disk store |
| TASK-006 | Hazard engine | P0 | ✅ Done | 003 | HS = .30V+.25T+.20S+.15F+.10U formula & automatic scoring |
| TASK-007 | Status+Alerts | P0 | ✅ Done | 005,006 | Pending→In Progress→Resolved flow + Redis NX alert lock |
| TASK-008 | Dashboard | P0 | ✅ Done | 003,004,006 | Admin KPIs + 30d trend lines + responsive zone listing |
| TASK-009 | Map+Detail | P1 | ✅ Done | 008 | Leaflet OSM heatmap with threshold tuning per zone |
| TASK-010 | Cause+Remed | P1 | ✅ Done | 006,008 | 15-rule remediation matrix + zone cause hypothesis |
| TASK-011 | Export+Polish | P2 | ✅ Done | 007–010 | Cursor-streamed CSV export + image previews + proxy |
| TASK-012 | Seed+Demo | P2 | ✅ Done | 011 | 500-seed dataset + E2E automated test audit |

Statuses: ⬜ Not Started, 🔵 In Progress, ✅ Done, 🔴 Blocked, ⚫ Cut.
