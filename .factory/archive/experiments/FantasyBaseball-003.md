---
tags:
  - factory
  - experiment
  - FantasyBaseball
project: FantasyBaseball
experiment_id: 3
hypothesis: H3
verdict: keep
score_before: 0.5848
score_after: 0.5848
score_delta: 0.0
date: 2026-05-01
source: factory-archivist
---

# Experiment #3: Category Breakdown and Category Rank Data Scope Fix

## Hypothesis
Fix Category Breakdown formatters against NaN/Infinity edge cases and add week-over-week rank delta tracking to Category Rank page. Addresses GitHub Issues #8 and backlog items for correct data scope.

## Result
**KEEP** — score 0.5848 → 0.5848 (delta: 0.0, neutral)

### Decision Rationale
Score neutral because this was a correctness fix and a UI enhancement to an existing page — neither adds new capability surface nor changes observability metrics. The NaN/Infinity hardening is a mandatory safety fix (matches project code guidelines). The TrendArrow week-over-week delta is a meaningful UX improvement that makes category ranking data actionable. Keeping is correct: fixes resolved real defects, tab toggle deferred as planned.

## Implementation Summary
- Added week-over-week rank deltas with `TrendArrow` component to Category Rank page
- Hardened Category Breakdown formatters against NaN/Infinity edge cases
- Tab toggle deferred (partial backlog clearance noted)
- PR #9 merged to main

### Key Changes
- **Category Rank page**: `TrendArrow` component shows +/- rank movement between weeks
- **Category Breakdown**: formatters now handle division-by-zero and NaN safely (per project code guidelines)
- Backlog items partially cleared (full-season default deferred)

## Lessons
- NaN/Infinity guards in formatters should be applied broadly — found multiple unguarded division sites
- Week-over-week deltas make category rank data significantly more actionable for trade decisions

## Links
- [[FantasyBaseball]]
- Issue: #8
- PR: #9
