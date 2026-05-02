---
tags:
  - factory
  - experiment
  - FantasyBaseball
project: FantasyBaseball
experiment_id: 2
verdict: keep
score_delta: +0.075
date: 2026-05-01
source: factory-archivist
---

# Experiment #2: Vitest + MSW Testing Infrastructure

## Hypothesis
H4: Adding Vitest + MSW testing infrastructure will improve the tests dimension from 0.5 to 1.0 and establish the foundation all future experiments need for regression safety.

## Result
**KEEP**: score changed from 0.5098 to 0.5848 (+0.075)

Tests dimension improved from 0.5 to 1.0 (maximum).

## What Changed
- Added Vitest as test runner with jsdom environment
- Added MSW (Mock Service Worker) for API mocking in tests
- Created 46 tests across the codebase
- Discovered and fixed `getProTeam` bug during test writing (mapping returned undefined for unlisted teams)
- Test infrastructure covers utils, hooks, components, and API routes
- MSW handlers mock ESPN API responses for deterministic testing

## Key Finding
Writing tests surfaced a real bug in `getProTeam`: the team mapping function returned `undefined` for teams not in the lookup table instead of a sensible default. This validates the hypothesis that test infrastructure pays for itself by catching latent defects.

## Quantitative Impact
| Dimension | Before | After | Delta |
|-----------|--------|-------|-------|
| Tests     | 0.5    | 1.0   | +0.5  |
| Overall   | 0.5098 | 0.5848| +0.075|

## Links
- [[FantasyBaseball]]
- Issue: #6
- PR: #7
