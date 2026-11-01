# 🔥 Hazard Rage — City Waste Monitoring & Analysis System

> **See waste. Score hazard. Clean the city.**
> A citizen-powered, data-driven command center for urban sanitation — report in 60 seconds, watch the whole city re-score live.

![Stack](https://img.shields.io/badge/React-Vite-61DAFB?logo=react&logoColor=white)
![Backend](https://img.shields.io/badge/Express-Node.js-339933?logo=node.js&logoColor=white)
![DB](https://img.shields.io/badge/PostgreSQL_16-PostGIS-4169E1?logo=postgresql&logoColor=white)
![Cache](https://img.shields.io/badge/Redis_7-DC382D?logo=redis&logoColor=white)
![Tests](https://img.shields.io/badge/tests-19/19_passing-brightgreen)

---

## 🎯 The Problem

Indian cities drown in **informal waste dumps** that no system tracks. Bin sensors only watch formal bins. Complaint portals collect reports into a black hole with zero analytics. Municipal crews clean blind — no priorities, no trends, no feedback to citizens.

## 💡 Our Solution

Hazard Rage turns every citizen phone into a sensor and every report into a number:

1. **Citizen pins waste** — photo + GPS + waste type in under a minute.
2. **Hazard Engine scores every ward 0–10** — `HS = .30·volume + .25·toxicity + .20·spread + .15·frequency + .10·backlog`. Anything ≥ **7 auto-pages the crew**.
3. **Officers triage on a live command center** — vector street map, 30-day trends, likely-cause analysis, one-click CSV, resolve **with cleanup-photo proof**.
4. **The loop closes** — reporter sees before → after photos and the ward score fall in real time (push updates, no refresh).

---

## ✨ Key Features

| Area | What works |
|---|---|
| 📍 Reporting | GPS auto-locate → nearest ward, camera capture or file upload, severity + type, 5MB guard |
| 🧮 Hazard Engine | Deterministic 0–10 score per ward, every input persisted as JSON for audit |
| 🗺️ Live map | Vector streets (GPU-rendered, works offline-capable), ward discs resize/recolour live, click → ward file |
| 🏙️ Multi-city | City switcher, add city + click-to-place new wards on the survey plot |
| 🚨 Alerts | Auto-created on breach ≥ 7, Redis-deduped, acknowledged from the alerts board |
| 📊 Analytics | KPI command center, per-ward trends, cause hypothesis, 15-rule remediation matrix |
| 📷 Proof of work | Resolve requires a cleanup photo — citizens see before → after |
| ⚡ Realtime | Server-sent change events → heatmap/discs/lists update instantly; 30s poll fallback |
| 🔐 Auth | JWT + bcrypt-12 + RBAC (citizen / officer / sysadmin), login throttling |
| 📦 Data | Seeded demo city: 2 cities, 26 wards, 500+ history reports |

## 🛠️ Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 18 + Vite, MapLibre GL vector maps + SVG offline fallback | GPU streets, no API keys, never a grey screen |
| Backend | Node.js + Express REST (`/api/v1`) | Single deployable, envelope + request-ID tracing |
| Database | PostgreSQL 16 + PostGIS (Prisma ORM) | Relational truth, native ENUMs, JSONB score inputs, geo-ready |
| Ephemeral | Redis 7 | 60s response cache, shared rate limits, alert dedup locks — never source of truth |
| Auth | JWT (24h) + bcrypt(12) | Stateless, memory-stored tokens |

## 🚀 Run It in 5 Minutes

**Prerequisites:** Node 18+, Docker, internet (map data/fonts).

```powershell
# 1. Databases
docker compose up -d postgres redis

# 2. Backend
npm --prefix backend install
npm --prefix backend exec prisma -- migrate deploy --schema=prisma/schema.prisma
$env:NODE_PATH="backend\node_modules"; node prisma/seed.cjs      # 2 cities · 26 wards
$env:NODE_PATH="backend\node_modules"; node prisma/seed500.cjs   # 500 history reports

# 3. Backend API (port 3001 — change via $env:PORT if needed)
$env:PORT="3001"; node backend/src/server.js

# 4. Frontend (new terminal)
npm --prefix frontend install
"VITE_API_URL=http://localhost:3001/api/v1" | Out-File frontend/.env -Encoding utf8
npm --prefix frontend run dev -- --port 5173 --host
```

Open **http://localhost:5173** → Register, or one-click demo:
| Role | Email | Password |
|---|---|---|
| Citizen | `citizen@hazard.local` | `password123` |
| Officer | `admin@hazard.local` | `password123` |

**3-minute demo script:** citizen files a High mixed report in Vasna → watch the ward turn red + alert fire → open `/admin/map` in a second tab and see it update live → Start → Resolve + cleanup photo → citizen's My Reports shows before → after.

## ☁️ Deploying (Vercel + Render)

Full guide: **[DEPLOY.md](./DEPLOY.md)** — Vercel frontend (Root Directory `frontend`, `VITE_API_URL` env), Render API + Postgres (blueprint `render.yaml`), Upstash Redis, Cloudinary photo storage. The three production killers are documented there: exact `FRONTEND_URL` for CORS, Cloudinary vars or photos vanish on redeploy, and waking the free tier before your demo.

## 🧪 Tests

```powershell
npm --prefix backend test   # 19 tests: auth/RBAC/throttle, cache, hazard math,
                            # status chain, photo resolve, geo auto-select, SSE push,
                            # cities/zones CRUD, CSV allow/deny — all green
node audit-all.cjs          # 24 live end-to-end checks against running servers
```

## 🗂️ Project Layout

```
├── backend/src/         # routes → services → Prisma (auth, zones, cities,
│                        # reports, hazard-engine, alerts, remediation, exports,
│                        # tiles, events/SSE) + Redis cache/rate-limit
├── frontend/src/        # pages (Landing, Auth, Citizen, Admin, Heatmap, Cities),
│                        # MapLibre live map + SVG offline fallback, design system
├── prisma/              # schema (City/Zone/Report/Score/Alert/Rule) + migrations + seeds
├── docs/                # architecture, ADRs, roadmap, submission plan
├── docker-compose.yml   # postgres:16-postgis + redis:7
└── DEMO.md              # evaluator walkthrough
```

## 🧠 Design Decisions (ask us anything)

- **No sensors, no hardware** — bin sensors miss informal dumps (the actual problem). Phones + math cover the whole city with zero deployment.
- **Heuristic score, not ML** — explainable, auditable, admin-tunable; every score stores its inputs.
- **Redis is never truth** — cache/throttle/locks only; the system survives Redis going down.
- **Tiles proxied + vector-first** — maps work on hostile networks; offline SVG fallback guarantees a demo never dies.

## 👥 Team

**Samay Shah** (2301201061) · **Parth Mewada** (2301201112) — B.Tech CSE, KPGU
Guide: **Hiral Patel**

## 📄 License

MIT — built for hackathons, kept for cities.
