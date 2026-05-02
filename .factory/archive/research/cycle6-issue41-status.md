---
tags:
  - factory
  - research
  - FantasyBaseball
  - lint
project: FantasyBaseball
date: 2026-05-02
cycle: 6
source: factory-archivist
---

# Research: Issue #41 Status (Close Issues + Fix Lint)

## Issue Closure Status (Part 1): DONE

All 6 sub-issues already closed:
- #29 CLOSED (Bullpen streaming intelligence)
- #31 CLOSED (FA weakness-aware recs)
- #33 CLOSED (Trade Room surplus/gap)
- #35 CLOSED (My Roster z-score detail)
- #37 CLOSED (GM Advisor three-tier)
- #39 CLOSED (GM Advisor accessible accordion)

Experiment 20 / PR #42 closed all 6 issues.

## Lint Error Status (Part 2): UNMERGED

PR #42 claims 0 lint errors but is NOT merged to main. Current main has **74 errors, 33 warnings** across 19 files.

### Error Breakdown
| Category | Count | Rule |
|---|---|---|
| `no-explicit-any` | ~51 | `@typescript-eslint/no-explicit-any` |
| Nested components in render | 12 | `react-compiler/react-compiler` |
| Memoization preservation | 6 | `react-compiler/react-compiler` |
| setState in effect | 4 | `react-hooks/set-state-in-effect` |
| Unescaped entities | 1 | `react/no-unescaped-entities` |
| prefer-const | 1 | `prefer-const` |

### PR #42 Assessment
- Open, mergeable, changes 100 files
- Verified: 0 errors, 115 tests pass, build succeeds
- Created `web/src/types/espn.ts` with typed ESPN interfaces
- Preferred path: merge PR #42 rather than re-implement

## Links
- [[FantasyBaseball]]
- [[FantasyBaseball-020]]
- Issue: #41
- PR #42 (open, unmerged)
