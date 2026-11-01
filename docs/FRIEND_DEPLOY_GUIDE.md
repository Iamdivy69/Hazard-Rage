# Deploy Guide — Put Hazard Rage on the Internet (No Experience Needed)

**Goal:** anyone in the world can open your site, even with your laptop switched off. We use only **free** services. Budget ~1 hour, mostly waiting for installs.

> Plain-English map: **Vercel** hosts the pages people see · **Render** runs the backend kitchen + the database storeroom · **Upstash** is a free helper memory (Redis) · **Cloudinary** is a free photo album (because Render forgets uploaded files on every update).

**Before you start:** the project runs on your laptop (see `FRIEND_SETUP_GUIDE.md`), and you have the code in a folder.

---

## Part 1 — Put the code on GitHub (15 min)

Websites deploy **from GitHub**, so first the code must live there.

1. Create a free account at **https://github.com** (if needed) and install Git from **https://git-scm.com/download/win**.
2. On GitHub, click **+ → New repository** → name it `hazard-rage` → **Create** (keep it Public on the free plan if you want free Render deploys without a card).
3. In PowerShell, inside the project folder:
   ```powershell
   git init
   git add .
   git status
   ```
   ⚠️ **STOP and read the list.** If you see `.env` in it, DO NOT continue — that file has passwords. It should be hidden automatically (there's a `.gitignore` file doing that job). If it appears anyway, tell the project owner before proceeding.
4. Then:
   ```powershell
   git commit -m "hazard rage submission"
   git branch -M main
   git remote add origin https://github.com/YOUR-NAME/hazard-rage.git
   git push -u origin main
   ```
   ✅ Success: your files appear on the GitHub page.

## Part 2 — Database on Render (10 min)

1. Sign up at **https://render.com** (free, GitHub login is easiest).
2. Dashboard → **New + → PostgreSQL** → name `hazard-rage-db` → pick the region nearest you → plan **Free** → **Create Database**. Wait ~3 minutes.
3. Open the database → **Connect** → copy the **Internal Database URL** into a temporary notepad. It looks like `postgresql://hazard:xxxx@...`.
4. Still on Render, we need PostGIS switched on **once**. Easiest: after Part 3 deploys the backend, open the backend service → **Shell** tab and run:
   ```sql
   psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS postgis;"
   ```
   (Save this for later — it goes in Part 3, step 5.)

## Part 3 — Free helper memory on Upstash (5 min)

1. Sign up at **https://upstash.com** (free, no card) → **Create Database** → pick a nearby region.
2. Open it → copy the **Node (ioredis)** URL — it starts with `rediss://` (note the extra **s**). Save it in your notepad.
3. (If you skip this, the app still runs, just slower with no login protection. Better to set it.)

## Part 4 — Free photo album on Cloudinary (5 min)

Render **deletes uploaded photos on every update** — without this step, all report photos vanish after each deploy.

1. Sign up at **https://cloudinary.com** (free) → Dashboard.
2. Copy three values into your notepad: **Cloud name**, **API Key**, **API Secret** (click Reveal for the secret).

## Part 5 — Backend on Render (15 min + waiting)

1. Render Dashboard → **New + → Blueprint** → connect your `hazard-rage` repo. Render reads `render.yaml`, which already describes the backend + database wiring.
2. Before clicking deploy, fill the **Environment** values from your notepad:
   - `DATABASE_URL` → the Render Postgres URL (Blueprint fills this itself — check it's there)
   - `REDIS_URL` → your Upstash URL
   - `JWT_SECRET` → press **Generate** (or paste any long random text)
   - `FRONTEND_URL` → leave blank for now, you'll come back after Part 6
   - `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` → from Part 4
   - Email settings (`SMTP_*`) → **skip** (alerts still work in-app without email)
3. Click **Apply/Deploy** and wait (~5–8 min, watch the Logs tab).
4. Now do the PostGIS step from Part 2: backend service → **Shell** tab:
   ```bash
   psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS postgis;"
   ```
5. Still in Shell, add the demo data:
   ```bash
   NODE_PATH=backend/node_modules node prisma/seed.cjs
   NODE_PATH=backend/node_modules node prisma/seed500.cjs
   ```
6. ✅ Check: open `https://YOUR-API-NAME.onrender.com/api/v1/health` — all four values must be `true`.
   > ⏳ Free Render sleeps when idle — the first visit can take ~50 seconds. Always open the health page first before demoing. This is normal, not an error.

## Part 6 — Frontend on Vercel (10 min)

1. Sign up at **https://vercel.com** (free, Continue with GitHub).
2. **Add New → Project** → Import `hazard-rage` → set **Root Directory** to `frontend` → Framework will say Vite (correct, leave it).
3. Open **Environment Variables** and add exactly one:
   - Name: `VITE_API_URL` — Value: `https://YOUR-API-NAME.onrender.com/api/v1` (your Render backend address from Part 5!)
   - ⚠️ Triple-check for typos — the site silently can't log in if this is wrong.
4. Click **Deploy**, wait ~2 min. You get a URL like `https://hazard-rage.vercel.app`.
5. **Go back to Render** → backend service → Environment → set `FRONTEND_URL` to that Vercel URL → **Save** (this redeploys; it tells the backend "this website is allowed to talk to me").

## Part 7 — Final check ✅

1. Open your Vercel URL → Register a new account → file a report with a photo.
2. Login as `admin@hazard.local` / `password123` → triage it → Resolve + photo.
3. Back as citizen → before → after photos visible.
4. If all three work, **you are deployed**. Send the Vercel link to anyone.

## When something breaks

| What you see | Fix |
|---|---|
| Vercel site loads but login says Failed to fetch | `VITE_API_URL` wrong or backend asleep — open the `/api/v1/health` link first, then retry |
| Browser CORS error mentioning origin | `FRONTEND_URL` on Render doesn't exactly match the Vercel URL (no trailing `/`) — fix and redeploy API |
| Photos disappear after a redeploy | Cloudinary keys missing/wrong on Render — set all three |
| Health page shows `redis: false` | `REDIS_URL` wrong — copy the `rediss://` URL fresh from Upstash |
| Health page shows `postgres: false` | Database still starting or URL wrong — check DB status on Render |
| Deploy fails on `prisma migrate` | Database URL unreachable at build time — confirm the DB exists in the same Render account |
| Everything slow first time | Free-tier cold start — wait a minute, then it's fast |

**Costs:** $0 on all services. Limits to know: Render free sleeps when idle (cold starts), free Postgres keeps modest data (plenty for this project), Upstash/Cloudinary free tiers are generous for demos. For exam day: open the health URL 2 minutes early to wake everything up.
