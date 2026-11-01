# ADR-002: MySQL Relational over NoSQL

**Status:** Accepted | **Date:** 2026-11-01 | **Task:** TASK-003/006

## Decision
MySQL 8 (InnoDB) as primary store.

## Context
Zone-report-score joins + history + FK integrity + team knows MySQL/XAMPP.

## Options
- MySQL: Pros XAMPP bundled, joins/aggregates easy, FKs. Cons weaker geo than PostGIS.
- Postgres+PostGIS: Pros geo queries. Cons XAMPP friction, team unfamiliar.
- Mongo: Pros flexible docs. Cons joins/history harder, no FKs.

## Reason
Simplicity + team skill + report Ch.3 specifies MySQL. Geo stored as lat/lng + GeoJSON text for now.

## Trade-offs
Give up native geo-index; accept app-level distance until PostGIS migration.

## Impact
Agent 2: mysql2 parameterized, indexes per DATABASE_DESIGN. Agent 3: FK constraint tests.
