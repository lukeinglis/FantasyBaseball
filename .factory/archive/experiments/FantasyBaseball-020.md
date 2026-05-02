---
tags:
  - factory
  - experiment
  - FantasyBaseball
project: FantasyBaseball
experiment_id: 20
verdict: keep
score_delta: 0.0
date: 2026-05-02
source: factory-archivist
---

# Experiment #020: Close resolved issues and fix 74 lint errors in scoped batches

## Hypothesis
Close 7 resolved GitHub issues and fix all 74 lint errors by scoping fixes into 4 batches: (A) ESPN API types for 51 no-explicit-any errors, (B) React Compiler component extraction for 12+6 errors, (C) setState-in-effect fixes for 4 errors, (D) minor prefer-const and unescaped entity.

## Result
**KEEP** — score 0.6279 to 0.6279 (+0.0000, structural threshold gap)

74 lint errors reduced to 0. 7 GitHub issues closed. This succeeded where Exp 13 failed (timeout at 600s) by using 1800s timeout and batched scoping strategy.

## What Changed

### Batch A: ESPN API Types (51 errors fixed)
- Created `web/src/types/espn.ts` (110 lines) with typed interfaces: `EspnLeagueData`, `EspnScoreByStat`, `EspnScheduleRecord`, `EspnRosterEntry`, `EspnPlayer`, and related types
- Replaced all `any` types across 10 API route handlers + 5 page components + espn.ts
- Removed all `eslint-disable @typescript-eslint/no-explicit-any` comments

### Batch B: React Compiler (18 errors fixed)
- Extracted `PitcherCard` and `PitcherSection` from bullpen page to module scope
- Extracted `RosterSection` from matchup and roster pages to module scope
- Removed 6 manual `useMemo` calls that React Compiler cannot preserve

### Batch C: setState-in-effect (4 errors fixed)
- Removed synchronous `setLoading(true)` from useEffect in category-breakdown/rank pages
- Removed `setLoading(true)` from fetchData useCallback in matchup page
- Derived `resolvedTeam` from state instead of synchronous setState in roster page

### Batch D: Minor (1 error fixed)
- `let` to `const` for `rankDeltas` in league-stats route
- Escaped apostrophe in strategy page JSX

### Issue Closures
- #28 (lint errors), #29, #31, #33, #35, #37, #39: all confirmed CLOSED on GitHub

## Verification
- `npx eslint src/`: 0 errors (27 warnings remain, all unused vars/imports)
- `npx tsc --noEmit`: clean
- `npx vitest run`: 115 tests pass (9 test files)
- `npx next build`: succeeds

## Notes
- This experiment validated the batched lint fix pattern from cycle 5 research. Exp 13 failed attempting all 74 at once; scoping by error category (A/B/C/D) with 1800s timeout succeeded.
- New `web/src/types/espn.ts` establishes typed ESPN API interfaces, eliminating the largest single category of lint errors.
- 27 lint warnings remain (unused variables), accepted as non-blocking.
- Score delta +0.0 reflects structural threshold gap (0.6279 vs 0.7 target), not regression.

## Links
- [[FantasyBaseball]]
- Previous failed attempt: [[FantasyBaseball-013]]
- PR: #42
- Issues closed: #28, #29, #31, #33, #35, #37, #39
