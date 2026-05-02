---
tags:
  - factory
  - experiment
  - FantasyBaseball
project: FantasyBaseball
experiment_id: "008"
verdict: keep
score_delta: +0.0097
date: 2026-05-01
source: factory-archivist
---

# Experiment #008: Add per-category team rankings to Scoreboard page

## Hypothesis
Add a `CategoryRankingsGrid` component to the Scoreboard page with heatmap colouring (green/yellow/red) and user-row highlight to increase capability_surface via new exported utility functions.

## Result
**KEEP** — score rose from 0.6185 to 0.6282 (delta: +0.0097). capability_surface improved with three new exported utility functions. Test count grew from 46 to 60 (+14 tests).

## What Changed
- New `CategoryRankingsGrid` component: heatmap (green/yellow/red scale), per-category rankings, user-row highlight
- Exported utility functions to public API: `sanitizeCatVal`, `rankByCategory`, `buildTeamCatValues`
- 14 new unit tests covering ranking edge cases and sanitization
- Test count: 46 → 60

## Links
- [[FantasyBaseball]]
- Issue: #18
- PR: #19
