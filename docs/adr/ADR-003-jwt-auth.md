# ADR-003: JWT Stateless Auth

**Status:** Accepted | **Date:** 2026-11-01 | **Task:** TASK-002

## Decision
JWT Bearer (HS256, 24h) + bcrypt(12) + RBAC middleware.

## Context
React SPA, stateless API, no sticky sessions, simple demo.

## Options
- Session: Pros revocation easy. Cons store + sticky + CSRF.
- JWT: Pros stateless, SPA-friendly. Cons revocation harder.
- OAuth: Pros SSO. Cons overkill for capstone.

## Reason
Maintainability + SPA fit. Short TTL mitigates revocation.

## Trade-offs
No instant revoke; accept re-login + future refresh-token rotation.

## Impact
Agent 2: `authenticate` + `authorize(role)` middleware. Agent 3: 401/403 matrix tests.
