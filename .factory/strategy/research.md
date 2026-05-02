# Research: Fix Issues #26 and #41

## Context

- Composite score: 0.6366
- Target: fix two open GitHub issues in a single hypothesis
- Issue #26: Rewrite eval/score.py for JS/TS scanning (reverted experiment 12)
- Issue #41: Close resolved issues and fix 74 lint errors (kept experiment 20, PR #42 open)

## Issue #26: eval/score.py Rewrite

### Current State

`eval/score.py` has two evals, both broken for this JS/TS project:

1. **`eval_syntax_check()`** runs `['true']` (a literal no-op). Always passes with score 1.0. Does not validate any code.
2. **`eval_observability()`** scans `*.py` files using Python `ast.parse`. This project has zero Python source files, so it finds 0 functions and returns score 0.0.

Current output: `syntax_check=1.0 (weight 0.83), observability=0.0 (weight 0.17)`.

### Experiment 12 Analysis

Experiment 12 (PR #27, branch `experiment/12-eval-js-ts-rewrite`) wrote a correct rewrite:
- `syntax_check` ran `npx tsc --noEmit` from `cwd="web"`
- `observability` scanned `*.ts/*.tsx/*.js/*.jsx` with regex function detection
- Reviewer verdict: **KEEP** (score 0.771, above 0.7 threshold)
- PR was closed without merge because the **precheck** failed: `score_direction` regression from factory_effectiveness dropping (keep rate 11/11 to 11/13 after this revert + experiment 13 timeout). The code change itself caused no regression.

**Root cause of revert: circular dependency.** Reverting the eval rewrite lowered the keep rate, which lowered factory_effectiveness, which lowered the composite score, which caused the precheck to fail for the eval rewrite. The code was correct.

### What the Rewrite Needs

The reverted version at commit `8a503d5` is a valid implementation. Key design decisions that were correct:

1. **syntax_check**: `npx tsc --noEmit` with `cwd="web"`, 120s timeout
2. **observability**: regex function detection (`function\s+\w+`, `const\s+\w+=\s*(async\s+)?\(`, `export\s+(default\s+)?(async\s+)?function`)
3. **Skip dirs**: node_modules, .next, dist, build added alongside existing skips
4. **Struct patterns**: already includes `\bpino\b`
5. **Weights**: 0.5/0.5 split between the two evals

**One issue to fix**: `factory.md` scope needs `eval/**` added to modifiable list. The reverted commit modified `factory.md` to add this. Current `factory.md` does not include `eval/**`.

## Issue #41: Close Resolved Issues + Fix Lint Errors

### Issue Closure Status

All 6 issues from the original scope are already closed:
- #29 CLOSED (Bullpen streaming intelligence)
- #31 CLOSED (FA weakness-aware recs)
- #33 CLOSED (Trade Room surplus/gap)
- #35 CLOSED (My Roster z-score detail)
- #37 CLOSED (GM Advisor three-tier)
- #39 CLOSED (GM Advisor accessible accordion)

**Part 1 (issue closure) is DONE.** Experiment 20 / PR #42 closed all 6 issues.

### Lint Error Status

PR #42 (experiment 20) claims 0 lint errors, but it is not merged to main. On the current main branch:

**74 errors, 33 warnings** across 19 files.

Error breakdown by category:
| Category | Count | Rule |
|---|---|---|
| `no-explicit-any` | ~51 | `@typescript-eslint/no-explicit-any` |
| Nested components in render | 12 | `react-compiler/react-compiler` (Cannot create components during render) |
| Memoization preservation | 6 | `react-compiler/react-compiler` (Compilation Skipped) |
| setState in effect | 4 | `react-hooks/set-state-in-effect` |
| Unescaped entities | 1 | `react/no-unescaped-entities` |
| prefer-const | 1 | `prefer-const` |

Files with errors (19 files):
- API routes (10): advisor, h2h, league-stats, matchup, player-stats, roster, schedule, scoreboard, standings, starts, bvp
- Page components (7): bullpen, category-breakdown, free-agents, matchup, roster, starts, today
- Other (2): category-rank, strategy, espn.ts

### PR #42 Assessment

PR #42 is open, mergeable, changes 100 files, and claims to fix all 74 errors. It also created `web/src/types/espn.ts` with typed ESPN interfaces. However, it has NOT been merged. The issue (#41) remains open.

**Decision point**: should the hypothesis merge PR #42, or re-implement the fix on main? PR #42 touches 100 files, which is large. Given that the fix was verified (0 errors, tests pass, build succeeds), merging is the simpler path.

## Recommended Approach

### Combined Hypothesis: Fix both issues in sequence

**Step 1: Rewrite eval/score.py (issue #26)**
- Take the reverted implementation from commit `8a503d5` as the starting point
- It was correct, just reverted due to a precheck false positive
- Add `eval/**` to factory.md modifiable scope
- Run `python3 eval/score.py` to verify valid JSON output

**Step 2: Fix lint errors (issue #41)**
- Two options:
  - **Option A (preferred)**: Merge PR #42 if branch rebases cleanly on main. This is already verified work.
  - **Option B (fallback)**: Re-implement the 4-batch fix if PR #42 has conflicts. The batch approach from experiment 20 was proven: ESPN types first, then React Compiler, then setState-in-effect, then minor fixes.

**Step 3: Close both issues**
- Close #26 with reference to the new commit
- Close #41 (part 1 already done, part 2 done by merge/re-implementation)

### Risk Assessment

- **eval/score.py rewrite**: Low risk. The code was reviewed, verified (score 0.771), and only reverted due to circular precheck logic. The implementation is sound.
- **Lint fixes**: Medium risk if re-implementing (100 files), low risk if merging PR #42. The PR was verified (0 errors, 115 tests pass, build succeeds).
- **Score impact**: The eval rewrite will change how the project is scored. The old eval gives syntax_check=1.0 (trivially, via `true`). The new eval will also give 1.0 if `tsc --noEmit` passes (which it does). Observability will jump from 0.0 to ~0.54, which improves the composite score.

## References

- Issue #26: eval/score.py rewrite (reverted experiment 12)
- Issue #41: close resolved issues + fix lint (experiment 20, PR #42 open)
- PR #27 (reverted eval rewrite): closed without merge, reviewer said KEEP
- PR #42 (lint fix, 100 files): open, mergeable, verified
- Experiment 12 branch: `experiment/12-eval-js-ts-rewrite` (commit `8a503d5`)
- Experiment 20 branch: `experiment/20-fix-open-issues-lint`
