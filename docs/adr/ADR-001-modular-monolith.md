# ADR-001: Modular Monolith over Microservices

**Status:** Accepted | **Date:** 2026-11-01 | **Task:** Roadmap Phase 0

## Decision
Build Hazard Rage as a modular monolith (React SPA + Express API + MySQL single deploy).

## Context
Capstone single team, 7-day budget, demo on 20 zones/500 reports, XAMPP-friendly deploy.

## Options
- Monolith: Pros simple deploy, no network overhead, easy demo. Cons scale ceiling.
- Microservices: Pros independent scale. Cons ops complexity, inter-service auth, demo risk.
- Serverless: Pros auto-scale. Cons cold starts, vendor lock, MySQL mismatch.

## Reason
Correctness + simplicity + maintainability outweigh scale for prototype. Stateless API allows later horizontal split.

## Trade-offs
Give up independent scaling; accept future extract of hazard-engine/alerts if needed.

## Impact
Agent 2: module imports only via public service APIs. Agent 3: single Postman collection. Follow-up: ADR if splitting.
