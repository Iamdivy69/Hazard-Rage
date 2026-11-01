# ADR-005: Leaflet + OSM over Google Maps

**Status:** Accepted | **Date:** 2026-11-01 | **Task:** TASK-009

## Decision
Leaflet.js + OpenStreetMap tiles.

## Context
Free, no API key, offline-friendly college demo, report Ch.3 specifies Leaflet.

## Options
- Google: Pros polish. Cons billing/key, offline risk.
- Leaflet+OSM: Pros free, simple. Cons plainer tiles.
- Mapbox: Pros style. Cons token + cost.

## Reason
Cost + simplicity + report alignment. Polish via emil/apple CSS compensates.

## Trade-offs
Less premium tiles; accept custom styling + list fallback.

## Impact
Agent 2: tile fallback to list view required. Agent 3: offline test.
