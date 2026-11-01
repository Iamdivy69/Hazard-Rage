# Deploying Hazard Rage — Vercel (frontend) + Render (backend, Postgres)

**Map:** Vercel serves the React app · Render runs the API + PostgreSQL · Upstash provides Redis · Cloudinary stores photos. All have free tiers.

## 0. Push to GitHub first

```powershell
git init; git add .; git commit -m "feat: hazard rage submission"
git remote add origin <your-repo-url>; git push -u origin main
```

`.gitignore` already excludes `node_modules/`, `.env`, `dist/` and uploaded photos. Never commit `.env`.

## 1. Database — Render PostgreSQL (free)

1. Render Dashboard → **New + → PostgreSQL** → name `hazard-rage-db`, region nearest you, plan Free → Create.
2. After it provisions, open a **Shell** on the database (or any connected service) and enable PostGIS once:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
3. Copy the **Internal Database URL** (starts `postgresql://…`) — you'll paste it as `DATABASE_URL`.

## 2. Redis — Upstash (free, no card)

1. [upstash.com](https://upstash.com) → Create Database → Regional, any nearby region.
2. Copy the **Node (ioredis)** endpoint (`rediss://…`) → paste as `REDIS_URL`.
   - The app also runs without Redis (fail-open reads, closed auth throttle) — but set it, alerts and caching need it.

## 3. Backend — Render Web Service (free)

Option A — one click: **New + → Blueprint** → point at this repo (`render.yaml` provisions API + DB wiring; then add the manual env vars below).
Option B — manual: **New + → Web Service** → connect repo:
- **Build:** `npm --prefix backend install && cd backend && ./node_modules/.bin/prisma migrate deploy --schema=../prisma/schema.prisma && ./node_modules/.bin/prisma generate --schema=../prisma/schema.prisma && cd .. && NODE_PATH=backend/node_modules node prisma/seed.cjs`
- **Start:** `node backend/src/server.js` (Render injects `PORT` automatically)
- **Health check:** `/api/v1/health`

**Environment variables** (Render Dashboard → service → Environment):

| Key | Value |
|---|---|
| `DATABASE_URL` | Render Postgres internal URL |
| `REDIS_URL` | Upstash `rediss://` URL |
| `JWT_SECRET` | long random string (generate one) |
| `FRONTEND_URL` | your Vercel URL, e.g. `https://hazard-rage.vercel.app` |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | from cloudinary.com (free tier) — without these, uploads die with each deploy (ephemeral disk) |
| `SMTP_HOST/PORT/USER/PASS` | optional — alerts still persist in-app without email |

Deploy, then open `https://<your-api>.onrender.com/api/v1/health` — all four (`postgres`, `postgis`, `redis`) should be `true`.
> Free Render instances **sleep after inactivity** — first request can take ~50s. Warm it before your demo.

## 4. Frontend — Vercel (free)

1. Vercel → **Add New Project** → import the repo → set **Root Directory** to `frontend` (framework auto-detected as Vite).
2. **Environment → `VITE_API_URL` = `https://<your-api>.onrender.com/api/v1`** (production build bakes this in — set it *before* deploying).
3. Deploy. Client-side routes (`/admin/map` etc.) work via the included `vercel.json` rewrites.
4. Back in Render, set `FRONTEND_URL` to the Vercel URL and redeploy the API (CORS allowlist).

## 5. Seed demo data (production)

In the Render service **Shell** tab:

```bash
NODE_PATH=backend/node_modules node prisma/seed.cjs      # cities, wards, demo users
NODE_PATH=backend/node_modules node prisma/seed500.cjs   # 500 history reports (optional)
```

Demo logins: `citizen@hazard.local` / `admin@hazard.local`, password `password123` — rotate or remove before any public launch.

## Troubleshooting

| Symptom | Cause → fix |
|---|---|
| `Unknown argument` Prisma errors | Stale generated client — rebuild ran `generate` after `migrate`; redeploy |
| Photos vanish after redeploy | Cloudinary vars missing — set all three |
| CORS errors in browser | `FRONTEND_URL` must exactly match the Vercel URL |
| First load hangs ~1 min | Free-tier cold start — open `/api/v1/health` first to wake it |
| Map grey | Upstream tiles blocked on that network — app auto-falls back to the survey plot |
