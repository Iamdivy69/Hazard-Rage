# Hazard Rage — Docs Index

City Waste Monitoring and Analysis System — Architecture + Implementation Plans.

Source: `PARTH REPORT.md` (Capstone-I Report).

## Contents

| Doc | Purpose |
|-----|---------|
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | Consolidated master plan (all 16 sections) |
| [architecture/REQUIREMENTS.md](./architecture/REQUIREMENTS.md) | Classified requirements, priorities, assumptions |
| [architecture/SYSTEM_ARCHITECTURE.md](./architecture/SYSTEM_ARCHITECTURE.md) | Style, diagram, modules, workflows, integrations |
| [architecture/DATABASE_DESIGN.md](./architecture/DATABASE_DESIGN.md) | Entities, ER, indexes, constraints, seeds |
| [architecture/API_ARCHITECTURE.md](./architecture/API_ARCHITECTURE.md) | Endpoint contracts, errors, pagination |
| [architecture/FRONTEND_ARCHITECTURE.md](./architecture/FRONTEND_ARCHITECTURE.md) | React + emilkowalski/skill + apple-design system |
| [architecture/SECURITY_ARCHITECTURE.md](./architecture/SECURITY_ARCHITECTURE.md) | Auth, RBAC, OWASP, secrets, audit |
| [architecture/ENGINEERING_STANDARDS.md](./architecture/ENGINEERING_STANDARDS.md) | Naming, errors, logging, config, git |
| [roadmap/ROADMAP.md](../roadmap/ROADMAP.md) | Phased roadmap + status board |
| [roadmap/AGENT2_TASKS.md](../roadmap/AGENT2_TASKS.md) | TASK-001 → TASK-012 specs for Agent 2 |
| [ACCEPTANCE_CRITERIA.md](./ACCEPTANCE_CRITERIA.md) | Testable AC per feature |
| [adr/](./adr/) | ADR-001 → ADR-008 decision log (007 Postgres supersedes 002, 008 Redis) |
| [RISKS_AND_VALIDATION.md](./RISKS_AND_VALIDATION.md) | Risks + validation checklist |

## Roles

- Agent 1 (Architect): owns everything in `docs/`
- Agent 2 (Implementation): reads `roadmap/AGENT2_TASKS.md` + contracts, builds code
- Agent 3 (QA): validates against `ACCEPTANCE_CRITERIA.md`
- Agent 4 (Docs): publishes from these files

## Stack (frozen — ADR-007/008)

Frontend: React (Vite) + Leaflet+OSM + Chart.js
Backend: Node.js + Express REST `/api/v1` + Prisma ORM
DB: PostgreSQL 16 + PostGIS (truth) — supersedes MySQL
Ephemeral: Redis 7 (cache 60s + rate-limit + alert lock, fail-open reads)
Auth: JWT + bcrypt + RBAC
Design: `npx skills add emilkowalski/skill` + `apple-design` skill
