# ADR-004: React CSR SPA

**Status:** Accepted | **Date:** 2026-11-01 | **Task:** TASK-004/008

## Decision
Vite React CSR SPA, no SSR.

## Context
Authenticated dashboard, no SEO, fastest build + HMR.

## Options
- CSR: Pros simple, SPA routing, Vite fast. Cons slower first paint.
- SSR/Next: Pros SEO/first paint. Cons server ops, demo complexity.
- SSG: Pros static fast. Cons dynamic data mismatch.

## Reason
Simplicity wins; skeletons + code-split mitigate first paint.

## Trade-offs
First load heavier; accept code-splitting admin routes.

## Impact
Agent 2: React Query + guards, no server components.
