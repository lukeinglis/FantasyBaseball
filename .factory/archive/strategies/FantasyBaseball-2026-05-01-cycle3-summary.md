---
tags:
  - factory
  - strategy
  - FantasyBaseball
  - cycle-summary
date: 2026-05-01
source: factory-archivist
---

# Cycle 3 Summary: FantasyBaseball, 2026-05-01

## Overview
Cycle 3 ran 7 experiments. 5 kept, 1 reverted, 1 error. All 5 backlog items cleared. Backlog now empty.

## Experiments

| # | Hypothesis | Verdict | Notes |
|---|-----------|---------|-------|
| 012 | Eval/score.py JS/TS rewrite | REVERT | Factory eval is internal, not delegated to eval/score.py |
| 013 | Fix 74 lint errors | ERROR | Timed out before completion |
| 014 | Bullpen streaming intelligence | KEEP (override) | -0.0142 from meta-dimensions only |
| 015 | Free Agents weakness-aware recs | KEEP | 458 insertions, new utility + tests |
| 016 | Trade Room surplus/gap analysis | KEEP | 791 insertions, largest experiment |
| 017 | My Roster deep stat z-scores | KEEP | 311 insertions, new utility + tests |
| 018 | GM Advisor three-tier cached | KEEP | 219 insertions, completes backlog |

## Score Trajectory
- Start of cycle: 0.6468
- After Exp 12 (revert): 0.6468 (no change)
- After Exp 14 (keep/override): 0.6326 (-0.0142)
- Experiments 15-18: not scored (rapid backlog clearing)
- End of cycle: 0.6326 (estimated)

## Key Decisions
1. **Exp 12 revert**: Discovered that factory eval is internal, not delegated. eval/score.py is irrelevant to composite scoring. Major learning.
2. **Exp 13 skip**: Lint fix timed out. 74 errors remain as tech debt.
3. **CEO override on Exp 14**: Negative delta was from meta-dimensions, not code quality. Established pattern for future overrides.
4. **Rapid backlog clearing (15-18)**: Shifted from score optimization to feature delivery after discovering limited remaining score levers.

## What Was Built in Cycle 3
- Bullpen: streaming pitcher intelligence (double starters, streaming targets, starts tracker)
- Free Agents: weakness-aware recommendations with z-score gap analysis
- Trade Room: surplus detection, gap analysis, trade intelligence engine
- My Roster: deep stat breakdown with per-player z-scores
- GM Advisor: three-tier cached analysis (Quick Scan, Deep, Full Report)

## Cumulative Stats Across All 3 Cycles
- **Total experiments**: 18
- **Kept**: 16
- **Reverted**: 1
- **Errors**: 1
- **Keep rate**: 89%
- **Score**: 0.5098 → 0.6326 (delta: +0.1228)
- **PRs merged to main**: 11 (#5 through #25)
- **PRs open (cycle 3 backlog)**: 5 (#30, #32, #34, #36, #38)

## Patterns Discovered
1. Factory eval is internal, not delegated (Exp 12)
2. Precheck thresholds can be structural (Exp 12)
3. Meta-dimension regressions warrant CEO override (Exp 14)

## Remaining Gap
Score 0.6326, threshold 0.7, gap 0.0674. Primary remaining levers:
- Lint: 74 errors, 0.075 weight, currently ~0.0
- capability_surface: expanded by 5 new features but detection uncertain
- coverage: Vitest coverage functional but detection by factory uncertain
