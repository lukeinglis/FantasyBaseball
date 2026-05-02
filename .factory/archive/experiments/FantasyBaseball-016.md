---
tags:
  - factory
  - experiment
  - FantasyBaseball
project: FantasyBaseball
experiment_id: "016"
verdict: keep
score_before: null
score_after: null
score_delta: null
date: 2026-05-01
source: factory-archivist
---

# Experiment #016: Trade Room surplus detection and gap analysis

## Hypothesis
Add surplus detection and gap analysis to the Trade Room page. Identify categories where the team has surplus value (trade chips) and categories where they have gaps (trade targets). Expands capability_surface with trade intelligence.

## Result
**KEEP** — backlog item cleared, feature provides actionable trade guidance

## What Changed
- **Surplus detection**: Identifies categories where the team overperforms relative to the league
- **Gap analysis**: Highlights categories where the team underperforms and needs trade acquisitions
- **Trade analysis engine**: `trade-analysis.ts` (329 lines) with full surplus/gap computation
- **Z-score API endpoint**: New route for team z-score data
- **Test coverage**: `trade-analysis.test.ts` (297 lines) with comprehensive tests
- **4 files changed**: 791 insertions, 45 deletions

## Files Changed
- `web/src/app/gm/trade/page.tsx` (204 lines modified)
- `web/src/lib/trade-analysis.ts` (329 lines, new)
- `web/src/tests/trade-analysis.test.ts` (297 lines, new)
- `web/src/app/api/analysis/z-scores/route.ts` (6 lines added)

## Links
- [[FantasyBaseball]]
- Branch: experiment/16-trade-room-analysis
- PR: #34
- Commit: d7cb21d
