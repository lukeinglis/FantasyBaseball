## Strategy — 2026-05-02 (Cycle 5, Targeted: Fix Open Issues)

### Observations
- Current composite score: 0.5996 (threshold: 0.7, gap: 0.1004)
- Weakest eval dimensions: research_grounding (0.0), capability_surface (0.28), observability (0.41)
- Last 3 experiments: 17 (keep), 18 (keep), 19 (keep)
- Factory effectiveness: 0.4875 (keep rate 75%, dragged down by exp 12 revert + exp 13 timeout)
- 9 open issues. 5 have kept experiments with open PRs awaiting human merge. 1 superseded. 1 timed out (lint). 1 reverted (eval). 1 not factory-actionable.
- Experiment 13 (lint fix) timed out at 600s trying all 74 errors at once. Must be split into smaller batches.
- Lint breakdown: 51 `no-explicit-any` across ~15 files (API routes + pages), 12 React Compiler nested component errors, 6 memoization warnings, 4 setState-in-effect, 1 unescaped entity, 1 prefer-const, misc unused vars.

### Issue Triage
| Issue | Status | Action |
|---|---|---|
| #39 | Resolved (exp 19, PR #40 open) | Comment and close |
| #37 | Superseded by #39 | Comment and close |
| #35 | Resolved (exp 17, PR #36 open) | Comment and close |
| #33 | Resolved (exp 16, PR #34 open) | Comment and close |
| #31 | Resolved (exp 15, PR #32 open) | Comment and close |
| #29 | Resolved (exp 14, PR #30 open) | Comment and close |
| #28 | Failed (exp 13 timeout) | Fix: lint errors in scoped batches |
| #26 | Failed (exp 12 reverted) | Out of scope this cycle |
| #2 | Manual data entry needed | Not factory-actionable |

### Hypotheses

#### H1: Close resolved issues and fix 74 lint errors in scoped batches
- **Category:** FIX
- **Type:** mixed
- **Backlog item:** Please fix open issues
- **Addresses:** #28, #29, #31, #33, #35, #37, #39
- **What:** Two-part hypothesis covering operational cleanup and code fixes.

  **Part 1: Operational cleanup (close 6 issues)**
  Comment on and close issues whose work is already done:
  - #29 (Bullpen streaming): done in exp 14, PR #30 open awaiting merge
  - #31 (FA weakness-aware): done in exp 15, PR #32 open awaiting merge
  - #33 (Trade Room surplus): done in exp 16, PR #34 open awaiting merge
  - #35 (My Roster z-score): done in exp 17, PR #36 open awaiting merge
  - #39 (GM Advisor accordion): done in exp 19, PR #40 open awaiting merge
  - #37 (GM Advisor three-tier): superseded by #39, PR #38 already closed

  **Part 2: Fix 74 lint errors (issue #28) in 4 batches**
  The previous attempt (exp 13) timed out trying everything at once. Split into ordered batches:

  **Batch A: ESPN API response types (51 `no-explicit-any` errors)**
  Create `web/src/types/espn.ts` with interfaces for all ESPN API response shapes: roster entries, matchup data, scoreboard results, standings rows, player stats, schedule, starts, league stats, H2H data. Replace `any` type annotations in:
  - `web/src/lib/espn.ts` (1 error)
  - `web/src/app/api/espn/roster/route.ts`
  - `web/src/app/api/espn/matchup/route.ts`
  - `web/src/app/api/espn/scoreboard/route.ts`
  - `web/src/app/api/espn/standings/route.ts`
  - `web/src/app/api/espn/player-stats/route.ts`
  - `web/src/app/api/espn/schedule/route.ts`
  - `web/src/app/api/espn/starts/route.ts`
  - `web/src/app/api/espn/league-stats/route.ts`
  - `web/src/app/api/espn/h2h/route.ts`
  - `web/src/app/api/mlb/bvp/route.ts`
  - `web/src/app/api/analysis/advisor/route.ts`

  **Batch B: React Compiler errors (12 nested component + 6 memoization)**
  Extract inline components to module scope with explicit props in:
  - `web/src/app/gm/bullpen/page.tsx` (4 nested components at lines 512, 645-648)
  - `web/src/app/gm/matchup/page.tsx` (nested components around lines 262-284)
  - `web/src/app/gm/roster/page.tsx` (nested components around lines 340-448)
  - `web/src/app/gm/today/page.tsx` (lines 243-245)
  - `web/src/app/gm/starts/page.tsx` (lines 162-163)
  - `web/src/app/gm/free-agents/page.tsx` (memoization warnings)

  **Batch C: setState-in-effect (4 errors)**
  Refactor `useEffect`+`setState` patterns in:
  - `web/src/app/gm/category-breakdown/page.tsx` (line 61)
  - `web/src/app/league/category-rank/page.tsx` (line 106)
  Replace `setLoading(true)` inside effects with a state machine pattern or move loading state outside the effect body.

  **Batch D: Minor fixes (remaining)**
  - `web/src/app/league/category-rank/page.tsx`: `let rankDeltas` -> `const rankDeltas` (prefer-const)
  - `web/src/app/league/category-rank/page.tsx`: remove unused `LOWER_IS_BETTER`
  - `web/src/app/league/power-rankings/page.tsx`: remove unused `current`
  - `web/src/app/strategy/page.tsx`: remove unused `DRAFT_ORDER`, escape `'` -> `&apos;`

- **Execution step:**
  1. Run `gh issue comment` and `gh issue close` for #29, #31, #33, #35, #37, #39
  2. Create `web/src/types/espn.ts` with ESPN response interfaces
  3. Apply Batch A: replace `any` types in all API route handlers and espn.ts
  4. Apply Batch B: extract nested components to module scope
  5. Apply Batch C: fix setState-in-effect patterns
  6. Apply Batch D: fix minor lint issues (const, unused vars, escaping)
  7. Run `npx eslint .` and verify 0 errors
  8. Run `npx tsc --noEmit` to confirm type safety
  9. Run `vitest run` to confirm no test regressions
- **Expected output:**
  - 6 GitHub issues closed with explanatory comments
  - `web/src/types/espn.ts`: new file with typed ESPN API interfaces
  - 0 lint errors (down from 74 errors, 35 warnings)
  - Clean TypeScript compilation
  - All existing tests passing
- **Why:** 6 of 9 open issues are already resolved by kept experiments with PRs awaiting merge. Closing them is pure operational cleanup. Issue #28 is the only actionable code issue. Experiment 13 proved that 74 errors in one pass exceeds the builder timeout. The 4-batch approach (types -> React -> effects -> minor) is ordered by error count and dependency: ESPN types must be defined before they can be used in route handlers, React component extraction is independent per file, and the minor fixes are trivial. The `no-explicit-any` errors (51 of 74) also directly improve the `type_safety` project eval dimension.
- **Expected impact:** lint 0.9 -> 1.0 (+0.0075 weighted), type_safety project eval improvement (significant, 40% project weight), factory_effectiveness recovery via successful experiment. Composite +0.02 to +0.04.
- **Priority:** high

### Anti-patterns to Avoid
- **Do NOT attempt all 74 lint errors in a single pass.** Experiment 13 timed out at 600s doing this. Process in batches, verify each batch compiles before moving to the next.
- **Do NOT modify eval/score.py this cycle.** Experiment 12 (issue #26) was reverted. That is a separate concern.
- **Do NOT touch issue #2.** Historical draft data requires manual CSV creation, not factory code.
- **Do NOT use overly generic types (Record<string, unknown>) as a shortcut.** Define specific interfaces that match actual ESPN API response shapes. Generic types defeat the purpose of type safety.
- **Do NOT introduce new `any` types while fixing existing ones.** Use `unknown` for truly unknown shapes and narrow with type guards.
