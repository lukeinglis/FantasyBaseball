---
tags:
  - factory
  - experiment
  - FantasyBaseball
project: FantasyBaseball
experiment_id: "017"
verdict: keep
score_before: null
score_after: null
score_delta: null
date: 2026-05-01
source: factory-archivist
---

# Experiment #017: My Roster deep stat breakdown with z-scores

## Hypothesis
Add deep stat breakdown with z-score detail to the My Roster page. Show per-player statistical context relative to league averages, enabling informed roster decisions. Expands capability_surface.

## Result
**KEEP** — backlog item cleared, feature provides granular player evaluation

## What Changed
- **Z-score stat detail**: Per-player z-score breakdown across all scoring categories
- **Deep stat breakdown**: Expandable stat detail for each rostered player
- **Roster utilities**: `roster-utils.ts` (33 lines) with z-score computation helpers
- **Test coverage**: `roster-utils.test.ts` (76 lines) with full test suite
- **3 files changed**: 311 insertions, 63 deletions

## Files Changed
- `web/src/app/gm/roster/page.tsx` (265 lines modified)
- `web/src/lib/roster-utils.ts` (33 lines, new)
- `web/src/tests/roster-utils.test.ts` (76 lines, new)

## Links
- [[FantasyBaseball]]
- Branch: experiment/17-roster-deep-stats
- PR: #36
- Commit: 58f31f0
