# API Architecture — Hazard Rage

Base `/api/v1`. URL: `/api/v1/{resource}/{id?}/{sub-resource?}`. Envelope `{success,data,meta:{timestamp,request_id}}`. Errors `{success:false,error:{code,message,details},meta}`.

## Auth

`Authorization: Bearer <jwt>` except register/login/health. Roles via `authorize()`.

## Endpoints

```
POST /auth/register {name,email,password} → 201 {user,token} | 409 duplicate | 400 validation
POST /auth/login {email,password} → 200 {user,token} | 401 bad creds
GET  /auth/me (Bearer) → 200 {user} | 401

GET  /zones → 200 [{id,name,lat,lng,current_score,current_level}]
GET  /zones/:id → 200 {zone,recent_reports[5],trend[30d],remediation[]} | 404
PATCH /zones/:id/threshold (admin) {threshold:0-10} → 200

POST /reports (citizen, multipart: zone_id,waste_type,severity,description?,image?) → 201 {report,hazardScore} | 400 | 401
GET  /reports?zone_id&status&page&limit&sort → 200 {items,pagination}
GET  /reports/:id → 200 | 404
PATCH /reports/:id/status (admin) {status: Pending|In Progress|Resolved} → 200 {report,newScore} | 403 citizen | 422 bad transition

GET /hazard/scores?zone_id → 200 [{score,level,computed_at}]
GET /hazard/trends?days=30 → 200 {zones:[{zone_id,points:[]}]}
GET /alerts?status → 200
PATCH /alerts/:id/ack (admin) → 200

GET /remediation/suggest?waste_type&level → 200 {actions[]} | 404 + default
GET /exports/reports.csv (admin) → file download | 403
```

## Validation

zone_id int exists, waste_type/severity/status enums, image jpg/png/webp ≤5MB, description ≤2000 chars, email format, password ≥6.

## Status Codes

200 OK, 201 Created, 400 VALIDATION_ERROR, 401 UNAUTHORIZED, 403 FORBIDDEN, 404 NOT_FOUND, 409 CONFLICT, 422 UNPROCESSABLE, 429 rate-limit, 500 INTERNAL.

## Pagination

`?page=1&limit=20(max100)&sort=reported_at:desc` → `{data:[],pagination:{page,limit,total_items,total_pages,has_next,has_previous}}`. Count + page via Prisma `count` + `findMany` in single `$transaction`.

## Rate Limit (Redis-backed)

100 req/min global, 10/min login/register per IP (`rate-limit-redis`). 429 returns `Retry-After` + `RATE_LIMITED`. Cacheable GETs send `Cache-Control: public, max-age=60` + `ETag`.

## Hazard Spec

Inputs 0–10: Volume_Index, Type_Severity (biomedical 10, mixed 8, plastic 6, construction 5, organic 4), Spread_Radius, Frequency, Unresolved_Duration.
`HS = .30V + .25T + .20S + .15F + .10U`, clamp 0–10. Low 0–3, Med 4–6, High 7–10 trigger alert.
