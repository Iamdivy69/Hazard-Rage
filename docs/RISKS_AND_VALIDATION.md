# Risks, Trade-offs & Validation — Hazard Rage

## Risks

| Risk | Prob | Impact | Mitigation | Owner |
|------|------|--------|------------|-------|
| Docker/PostGIS setup friction (replaces XAMPP) | Med | Med | One-command compose + Prisma docs, TASK-000 smoke | Arch/Agent 2 |
| Cache invalidation bug (stale scores) | Med | High | Write DELs `hz:v1:*`, AC-C01 test, short 60s TTL | Agent 2/QA |
|------|------|--------|------------|-------|
| Scope creep (IoT/ML/mobile) | High | High | Freeze P0, Future Scope only | Arch |
| Image bloat | Med | Med | 5MB cap, /uploads, S3 path doc'd | Agent 2 |
| Weights mis-tuned | Med | High | Configurable weights, seed validation | Agent 2/QA |
| OSM offline demo | Med | Med | List fallback, pre-cache shots | Agent 2 |
| JWT XSS | Low | High | Memory store, CSP, sanitize | Agent 2 |
| Slow dashboard | Med | Med | Pagination, aggregates not N+1, Query cache | Agent 2 |
| Over-animation | Med | Med | <300ms, no kbd anim, reduced-motion | Agent 2/QA |

Accepted debt: no Redis/SMS/multi-tenant, best-effort email.

## Validation Checklist

- [ ] All P0 have architecture + tasks + AC
- [ ] Module boundaries defined
- [ ] API contracts + auth + pagination specified
- [ ] DB covers all entities + indexes + FKs
- [ ] Auth covers all roles
- [ ] Security addressed
- [ ] Frontend taxonomy + emil/apple tokens done
- [ ] Tasks have AC
- [ ] ADRs logged
- [ ] No circular deps (hazard-engine leaf)
- [ ] Error/logging/config/deployment defined

Next: Agent 2 starts TASK-001 → 002+003+004 → 005+006 → demo chain.
