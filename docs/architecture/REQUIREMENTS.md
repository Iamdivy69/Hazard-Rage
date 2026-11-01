# Requirements Analysis — Hazard Rage

Source: `PARTH REPORT.md` Ch.1, Ch.4.

## 1. Functional Requirements

| ID | Description | Priority |
|----|-------------|----------|
| FR-01 | Citizens register / login | P0 |
| FR-02 | Submit report: zone + type + image + description + severity | P0 |
| FR-03 | Compute + update Hazard Score per zone | P0 |
| FR-04 | Admin zone-wise analytics dashboard | P0 |
| FR-05 | Auto-alert when score >= threshold (7.0) | P0 |
| FR-07 | Admin update status Pending / In Progress / Resolved | P0 |
| FR-06 | Interactive city map with spread patterns | P1 |
| FR-08 | Cause analysis by zone-type + history | P1 |
| FR-09 | Remedial suggestions by category + severity | P1 |
| FR-10 | Export PDF/CSV | P2 |

## 2. Non-Functional Requirements

| ID | Attribute | Target |
|----|-----------|--------|
| NFR-01 | Performance | Dashboard <3s, API p95 <400ms |
| NFR-02 | Scalability | Stateless API, prototype 100 concurrent, design for 10k |
| NFR-03 | Security | bcrypt, JWT, RBAC, parameterized queries, HTTPS |
| NFR-04 | Reliability | 99.5%/mo, alert dispatch <5s (target 2s) |
| NFR-05 | Usability | Non-technical citizen, mobile-responsive, SUS >80 |
| NFR-06 | Maintainability | Layered MVC, module boundaries, linted |

## 3. Technical Requirements (Postgres + Redis + React — ADR-007/008)

- Frontend: React (Vite), React Router, Leaflet+OSM, Chart.js, TanStack Query (60s SWR mirrors Redis TTL), Hook Form + zod
- Backend: Node.js + Express, Prisma ORM + PostgreSQL 16 + PostGIS, ioredis 5 (cache/rate-limit/lock), BullMQ optional P2 email queue, JWT, bcrypt, Multer, Nodemailer, express-validator, Helmet, express-rate-limit + rate-limit-redis
- Infra: Docker Compose (postgres:16-postgis, redis:7), VS Code, Git/GitHub, Postman, Figma, NGINX proxy
- Tooling: `npx prisma migrate dev`, `npx prisma db seed`, `docker compose up -d postgres redis`

## 4. Business Requirements

Capstone-I SRS completeness, demo on 20 zones / 500 reports / 6 months, ~91% hazard agreement vs experts, 15-user trial. Out of scope: IoT bins, truck GPS, satellite.

## 5. User Personas & Workflows

### Citizen Reporter
Goals: report in 60s, track resolution. Workflow: Register → ReportNew (geolocate → zone → type → severity → photo → desc) → Submit → My Reports → resolved notice. Can: create own, read public scores. Cannot: change status, see admin analytics.

### Municipal Admin
Goals: daily prioritization. Workflow: Login → /admin (KPIs, heatmap, alerts) → ZoneDetail drawer → status update → export → ack alerts. Can: read all, update status/thresholds, export.

### System Admin
Full incl. zones, weights, roles.

Critical path: `POST /reports → validate → store → recompute HS → if >=7 Alert+email → dashboard refresh → resolve → HS drops`.

## 6. Assumptions Register

| Ambiguity | Assumption | Rationale | Risk if wrong |
|-----------|------------|-----------|---------------|
| Zone bounds | 20 pre-seeded zones with lat/lng + GeoJSON | No GIS dept data | Rework with ward shapefiles |
| Images | Path storage, 5MB jpg/png/webp | No S3 budget | Migrate to S3 later |
| Weights | W .30/.25/.20/.15/.10 configurable | From Ch.4.7 | Retune on real data |
| Single city | city_id=1, schema multi-city ready | Demo simplicity | Multi-tenant rework |
| Alerts | In-app + SMTP email | No SMS budget | Add SMS later |
