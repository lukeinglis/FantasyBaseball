---
tags:
  - factory
  - strategy
  - FantasyBaseball
date: 2026-05-02
cycle: 5
mode: targeted
source: factory-archivist
---

# Strategy: FantasyBaseball, Cycle 5 (2026-05-02)

## Mode
Targeted (fix open issues). Growth constraints suspended.

## Context
- Composite score: 0.5996 (threshold: 0.7, gap: 0.1004)
- 19 experiments completed: 17 kept, 1 reverted, 1 error
- 9 open issues triaged: 5 resolved (PRs awaiting merge), 1 superseded, 1 actionable (#28 lint), 1 reverted (#26), 1 not factory-actionable (#2)
- Experiment 13 timed out attempting all 74 lint errors at once

## CEO Verdict
**APPROVED.** Single mixed hypothesis, well-scoped. 4-batch lint approach directly addresses exp 13 timeout root cause. Issue triage accurate.

## Approved Hypothesis

### H1: Close resolved issues + fix 74 lint errors in scoped batches (mixed, FIX, high priority)

**Part 1: Operational cleanup (close 6 issues)**
Comment and close issues whose work is already done:
- #29 (Bullpen streaming): exp 14, PR #30
- #31 (FA weakness-aware): exp 15, PR #32
- #33 (Trade Room surplus): exp 16, PR #34
- #35 (My Roster z-score): exp 17, PR #36
- #39 (GM Advisor accordion): exp 19, PR #40
- #37 (GM Advisor three-tier): superseded by #39

**Part 2: Fix 74 lint errors (issue #28) in 4 batches**
- **Batch A:** ESPN API response types (51 `no-explicit-any` errors). Create `web/src/types/espn.ts` with typed interfaces for all ESPN API response shapes.
- **Batch B:** React Compiler errors (12 nested component + 6 memoization). Extract inline components to module scope.
- **Batch C:** setState-in-effect (4 errors). Refactor `useEffect`+`setState` patterns.
- **Batch D:** Minor fixes (prefer-const, unused vars, unescaped entity).

**Execution order:** Close issues first, then A -> B -> C -> D with compilation check after each batch.

**Expected impact:** lint 0.9 -> 1.0, type_safety improvement, composite +0.02 to +0.04.

## Builder Notes (from CEO)
- Timeout: 1800 (mixed type with operational + large code scope)
- Process batches in order: A -> B -> C -> D
- Verify compilation after each batch
- Close issues first (fast, independent of code changes)

## Anti-patterns
- Do NOT attempt all 74 lint errors in a single pass (exp 13 timeout)
- Do NOT modify eval/score.py (exp 12 was reverted)
- Do NOT use overly generic types (Record<string, unknown>) as shortcut
- Do NOT introduce new `any` types while fixing existing ones
