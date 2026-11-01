# Security Architecture — Hazard Rage

## Authentication

- bcrypt cost 12, JWT HS256 24h expiry, stored in memory (not localStorage). `authenticate` verifies, attaches `req.user`.
- Rate-limit via Redis (ADR-008): login/register 10/min/IP (`rl:login:{ip}`), global 100/min. Redis down → fail-closed on auth routes (429 + Retry-After) to prevent brute-force; fail-open on reads with WARN log.

## Authorization (RBAC)
| Role | Permissions |
|------|-------------|
| citizen | POST reports, GET own + public zones/scores |
| municipal_admin | + PATCH status, threshold, exports, ack alerts |
| system_admin | + zones CRUD, weight config, user roles |

`authorize('municipal_admin')` on threshold/status/export/ack. Citizens PATCH → 403.

## Input & Data Protection

- express-validator all inputs, Multer mime+size (jpg/png/webp ≤5MB), description ≤2000.
- Prisma parameterized only (no string-concat SQL; `prisma.$queryRaw` only with template-tag params for PostGIS). React escape + server sanitize.
- Postgres RLS off (app-enforced RBAC); ENUM + CHECK constraints as second defense.
- HTTPS prod (NGINX TLS), HSTS, Helmet (CSP, DENY frame, nosniff). CORS allowlist FRONTEND_URL only.

## Secrets

`.env` only: DATABASE_URL (postgres), REDIS_URL, JWT_SECRET, SMTP_*, FRONTEND_URL, CACHE_TTL=60. `.env.example` template, fail-fast at boot, never commit. Redis has no PII beyond TTL; JWT never cached.

## Audit & Logging

Audit `user_id, action, report_id, timestamp` in Postgres for status + threshold changes. Logs `[ISO][LEVEL][reqId][module] msg` — never passwords/tokens/PII. RequestId per call, propagated to Prisma + Redis logs.

## OWASP Checklist

- [ ] No secrets in code/logs/URLs
- [ ] Uploads inline + cap, no exec
- [ ] Export requires admin
- [ ] 401 no token, 403 wrong role, 404 unknown zone, 429 throttled
- [ ] Redis lock prevents double-alert on concurrent breach
