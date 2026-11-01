# Setup Guide — Run Hazard Rage on Your Laptop (No Experience Needed)

This guide takes you from **zero to a working app in about 30 minutes**. Follow it top to bottom, in order. Every step tells you what success looks like.

> Jargon buster: **terminal** = the black box where you type commands (PowerShell on Windows). **Backend** = the kitchen that does the work. **Frontend** = the dining room you see. **Database** = the storeroom where everything is saved.

---

## Part 1 — Install the tools (one time only)

### 1. Node.js (runs our code)
1. Go to **https://nodejs.org** → download the **LTS** version → install with all defaults.
2. Open PowerShell and type:
   ```powershell
   node --version
   npm --version
   ```
   ✅ Success: you see version numbers like `v20.x.x` and `10.x.x`.

### 2. Docker Desktop (gives us database boxes)
1. Go to **https://www.docker.com/products/docker-desktop** → download → install → **restart your computer** if asked.
2. Open Docker Desktop and wait until it says **Running** (bottom-left corner).
3. In PowerShell type:
   ```powershell
   docker --version
   ```
   ✅ Success: you see a version number.

### 3. Git (copies code) — optional if you got the project as a ZIP
1. Go to **https://git-scm.com/download/win** → install with defaults.
2. Check with `git --version`. ✅ A version number means done.

### 4. VS Code (to read/edit code) — optional but recommended
Download from **https://code.visualstudio.com**. Open the project folder with **File → Open Folder**.

---

## Part 2 — Get the project running

Do all of this **inside the project folder** (`D:\PROJECTS\PARTH` or wherever you put it). In PowerShell, go there first:

```powershell
cd D:\PROJECTS\PARTH
```

### Step 1 — Start the databases
```powershell
docker compose up -d postgres redis
docker ps --format "table {{.Names}}\t{{.Status}}"
```
✅ Success: you see `hazard-postgres` and `hazard-redis`, both **Up / healthy**.
❌ If Docker errors: open Docker Desktop first and wait for **Running**.

### Step 2 — Create your settings file
```powershell
Copy-Item .env.example .env
```
This `.env` file holds passwords and addresses. **Never share it or upload it anywhere.** The defaults already work on your laptop — no editing needed.

### Step 3 — Backend setup (first time)
```powershell
npm --prefix backend install
npm --prefix backend exec prisma -- migrate dev --schema=prisma/schema.prisma
$env:NODE_PATH="backend\node_modules"; node prisma/seed.cjs
$env:NODE_PATH="backend\node_modules"; node prisma/seed500.cjs
```
What just happened: installed libraries → created database tables → added 2 cities + 26 wards → added 500 sample reports. The last line prints something like `[seed500] reports=500`.

### Step 4 — Start the backend (keep this window open!)
```powershell
$env:PORT="3001"; node backend/src/server.js
```
✅ Success: `[INFO] hazard-rage api listening on :3001`.
👉 Leave this terminal running. Open a **new** terminal for the next steps.
🔍 Check in your browser: **http://localhost:3001/api/v1/health** — all four should say `true`.

### Step 5 — Frontend setup (new terminal)
```powershell
npm --prefix frontend install
"VITE_API_URL=http://localhost:3001/api/v1" | Out-File frontend/.env -Encoding utf8
npm --prefix frontend run dev -- --port 5173 --host
```
✅ Success: it prints `Local: http://localhost:5173/`.

### Step 6 — Open the app 🎉
Go to **http://localhost:5173**. Click **Login → Admin demo** (fills `admin@hazard.local` / `password123`), or register your own citizen account.

---

## Part 3 — Try the 3-minute demo

1. As a **citizen**: Report → pick Vasna → type mixed → severity High → attach any photo → Submit.
2. Open **Heatmap** (or a second tab): Vasna turns red. Check **Alerts**: a new alert exists.
3. As **admin**: Reports → Start → **Resolve + photo** (attach any image).
4. Back as citizen in **My reports**: see **before → after** photos and Resolved status.

## Part 4 — Run the tests (prove it works)

```powershell
npm --prefix backend test
```
✅ Success: `pass 19, fail 0`.

## Part 5 — When something breaks

| What you see | What it means | Fix |
|---|---|---|
| `EACCES ... 4000` | That port is blocked on your PC | Use `3001` instead (as in Step 4) |
| `Cannot connect to Docker` | Docker Desktop isn't running | Open it, wait for Running |
| `P1001 can't reach database` | Postgres container is down | `docker compose up -d postgres`, wait 10s |
| Login page says Failed to fetch | Backend isn't running or frontend points to wrong port | Start backend; check `frontend/.env` URL matches backend port |
| `Unknown argument` Prisma error | Code and database drifted | Stop backend, run the migrate command again, restart backend |
| Map is grey | Map tiles blocked on your network | Normal — the app auto-shows the offline ward plot instead |
| `command not found: prisma` | Install didn't finish | Re-run `npm --prefix backend install` |

**Golden rule:** backend terminal shows a live log of every request. When stuck, read the last red lines there — they almost always name the problem.
