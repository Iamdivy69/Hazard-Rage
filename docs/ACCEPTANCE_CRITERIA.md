# Acceptance Criteria — Hazard Rage (Postgres + Redis + React)

## Infra (TASK-000/001)
- [x] AC-I01 `docker compose up -d` + `prisma migrate dev` + seed green; `/health` reports postgres+redis true
- [x] AC-I02 Redis down → reads bypass with WARN, auth routes 429-closed, no crash

## Reporting (TASK-005)
- [x] AC-001 citizen submits zone/type/image → 201 + in My Reports
- [x] AC-E01 missing zone → 400 VALIDATION_ERROR
- [x] AC-S01 no token → 401
- [x] AC-X01 6MB image → 400 with message

## Hazard (TASK-006)
- [x] AC-002 new report recomputes zone <2s
- [x] AC-P01 recompute <200ms on 500 rows
- [x] AC-X02 clamp 0–10; Low 0–3, Med 4–6, High 7–10

## Alerts (TASK-007)
- [x] AC-003 breach ≥7 → Active alert + email
- [x] AC-S02 citizen ack → 403
- [x] AC-E02 SMTP down → stored + logged retry

## Dashboard/Map (008–009)
- [x] AC-004 KPIs + heatmap <3s (2nd load cache HIT)
- [x] AC-P02 20 zones interactive <1s
- [x] AC-X03 OSM offline → list view usable
- [x] AC-C01 write invalidates `hz:v1:*` (stale never >60s); concurrent breach → single Active alert (Redis NX lock)

## Security (global)
- [x] AC-S03 bcrypt, JWT on all except register/login/health, no PII in logs, CORS blocks foreign

## Demo chain
- [x] report → score rise → alert → resolve → score fall live in <3 min
