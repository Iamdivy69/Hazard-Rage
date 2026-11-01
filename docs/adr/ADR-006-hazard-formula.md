# ADR-006: Weighted Hazard Formula

**Status:** Accepted | **Date:** 2026-11-01 | **Task:** TASK-006

## Decision
`HS = .30V + .25T + .20S + .15F + .10U`, clamp 0–10, Low 0–3 / Med 4–6 / High 7–10, weights admin-configurable.

## Context
Report Ch.4.7 defines weights; deterministic, explainable for demo vs ML black-box.

## Options
- Weighted heuristic: Pros explainable, no training data. Cons manual tuning.
- ML prediction: Pros adaptive. Cons data + time + opacity.

## Reason
Correctness for capstone scope + demo explainability. 91% expert agreement sufficient.

## Trade-offs
Heuristic bias; accept retune + ML forecast as Future Scope.

## Impact
Agent 2: pure computeScore() unit-testable, inputs_json logged. Agent 3: boundary + accuracy tests.
