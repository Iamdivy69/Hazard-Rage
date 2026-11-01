# Implementation Plan — Hazard Rage (Final Submission)

**Project:** City Waste Monitoring and Analysis System
**Team:** Samay Shah (2301201061), Parth Mewada (2301201112) · Guide: Hiral Patel · KPGU
**Stack (frozen):** React (Vite) + Express + PostgreSQL 16 + PostGIS (Prisma) + Redis 7
**Constraint:** 100% software — no physical items (no IoT, GPS trackers, or sensor hardware at any stage)

---

## 1. Where the project stands today

| Layer | Status | Evidence |
|---|---|---|
| Backend API (`/api/v1`) | ✅ Built | auth, zones, reports+photo upload, hazard engine, alerts, trends, cause, remediation, CSV export, public stats |
| Frontend (11 routes) | ✅ Built | landing, login, register, zones, report form, my-reports, dashboard, heatmap (Leaflet), zone detail, triage table, alerts |
| Database | ✅ Seeded | 20 zones, 500+ history reports, 15 remediation rules, hazard history |
| Tests | ✅ 13/13 green | `npm --prefix backend test` (auth, RBAC, throttle, cache MISS→HIT→invalidate, status chain, exports) |
| Live audit | ✅ 24/24 green | `audit-all.cjs` — every endpoint + all frontend routes verified against running servers |
| Design system | ✅ Applied | pine/sage/safety-orange identity, Plex type family, ledger tables, reduced-motion support |

## 2. Phase plan

### Phase 0 — Foundation ✅ DONE
Docker (Postgres+PostGIS, Redis) · Prisma schema + migrations · seed (20 zones) · health endpoint · API envelope + request IDs · React shell + apiClient.

### Phase 1 — Core loop ✅ DONE
JWT auth + RBAC + Redis login throttle · zone list/detail (cached 60s, invalidated on write) · report submit (multipart photo, 5MB cap) · pure hazard engine (`HS = .30V+.25T+.20S+.15F+.10U`, clamp 0–10) · status chain Pending→In Progress→Resolved with recompute · breach alerts (≥7, Redis NX dedup lock, best-effort email).

### Phase 2 — Analytics ✅ DONE
Admin dashboard (KPIs, alert banner, zone table) · Leaflet heatmap + offline list fallback · zone detail (trend bars, cause hypothesis, recommended action) · remediation matrix (all 15 type×level rules) · trends API (cached) · CSV export (admin-only) · public landing + stats endpoint.

### Phase 3 — Submission hardening (TO BUILD, in priority order)

| # | Task | Why | Effort |
|---|---|---|---|
| 3.1 | Resolve-with-photo-proof (before/after) | Strongest demo moment; proves the citizen feedback loop | 1 session |
| 3.2 | Chart.js trend charts (zone-vs-zone) | Matches report Fig 6.1; evaluators expect a chart library | 1 session |
| 3.3 | In-app notifications (report status changes) | Closes problem P4 visibly | 1 session |
| 3.4 | Threshold + weight config UI for admins | Report promises "configurable"; backend already supports threshold PATCH | 1 session |
| 3.5 | Table search/filter/pagination wiring | Backend paginates; UI currently loads flat 50s | 0.5 session |
| 3.6 | PDF zone report export | FR-10 says "PDF or CSV"; only CSV exists | 1 session |
| 3.7 | Security hygiene: `.gitignore` `.env`, strong `JWT_SECRET` check, drop demo-prefill from bundle, global 100/min throttle, `:id` validation → 400/404 (not 500) | Audit P0s; examiners probe exactly this | 1 session |
| 3.8 | README (5-minute setup) + real screenshots into report Figs 5.1–5.3 + DEMO rehearsal | Submission armor | 1 session |

**Explicitly NOT building:** IoT bins, ML forecasting, mobile app, multi-city, gamification, ERP integration (Chapter 8 future scope — hooks left in schema: PostGIS geo, JSONB inputs log).

## 3. Milestones & acceptance gates

| Milestone | Gate |
|---|---|
| M1 Core loop | Report→score→alert→resolve demo <3 min on seeded data |
| M2 Analytics | Dashboard <3s second load (cache HIT), heatmap renders 20 zones |
| M3 Hardening | `npm test` 13/13+, `audit-all.cjs` 24/24, `vite build` clean |
| M4 Submission | README run-through by a fresh machine, report figures real, viva Q&A rehearsed |

## 4. Resources (software only)

Laptop + Node 18+ + Docker + internet (OSM tiles, fonts; map degrades to list offline). Zero hardware at every phase — IoT/GPS/satellite are documented out-of-scope (report §1.4, docs scope register).

## 5. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Scope creep (hardware/ML) | Frozen by report §1.4; any addition needs range-cut elsewhere |
| Stale cache confusing demo | 60s TTL + write-invalidation (tested MISS→HIT→MISS) |
| Port conflicts on examiner machine (4000-range blocked on some Windows hosts) | `PORT` env override; frontend `VITE_API_URL` |
| SMTP absent during demo | Best-effort mailer; alerts persist in-app regardless |

## 6. Viva prep (one-liners)

- *Why no sensors?* Ch.2: bin sensors miss informal dumps — the actual problem. Citizens + scoring cover the whole city with zero deployment.
- *Why these weights?* Heuristic, explainable, admin-tunable; every score persists its inputs JSON for audit.
- *Why Postgres+Redis?* Relational truth + PostGIS future; Redis only ever cache/throttle/lock, never truth — safe to lose.
- *What breaks at scale?* Offset CSV pagination and sequential recompute; both documented with the fix path.
