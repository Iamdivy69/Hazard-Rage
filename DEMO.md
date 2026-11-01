# DEMO (3 min) — Hazard Rage

1. `docker compose up -d postgres redis` → `npx prisma migrate dev` → `node prisma/seed.cjs` (20 zones) → `node prisma/seed500.cjs` (500 reports, market/drain high).
2. Citizen: POST /api/v1/reports (zone Vasna, mixed/High) → 201 + hazardScore rises → dashboard Vasna turns red.
3. Admin: GET /api/v1/hazard/trends?days=30 (1st MISS, 2nd HIT) → GET /api/v1/zones/:id (bundle: recent 5 + trend + remediation) → GET /api/v1/alerts (Active for Vasna).
4. Resolve: PATCH /api/v1/reports/:id/status In Progress → Resolved → score falls → alerts Resolved.
5. Export: GET /api/v1/exports/reports.csv (admin 200, citizen 403).
