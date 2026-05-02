---
tags:
  - factory
  - research
  - FantasyBaseball
date: 2026-05-02
source: factory-archivist
---

# Cycle 5 Research: CEO Direct Analysis (Researcher Timeout)

## Context
Researcher agent timed out at 300s. CEO performed direct analysis of all 9 open issues and current project state.

## Key Findings

### Issue Triage (9 open issues)
1. **Already resolved by kept experiments (5 issues):**
   - #29 (Bullpen streaming intelligence): PR open, needs human merge
   - #31 (FA weakness-aware recommendations): PR open, needs human merge
   - #33 (Trade Room surplus/gap analysis): PR open, needs human merge
   - #35 (My Roster deep stat breakdown): PR open, needs human merge
   - #39 (GM Advisor three-tier accordion): PR open, needs human merge

2. **Superseded (1 issue):**
   - #37 (GM Advisor three-tier): Superseded by #39, PR #38 closed. Can be closed.

3. **Actionable (1 issue):**
   - #28 (74 lint errors): Main target. Experiment 13 timed out at 600s trying all 74 at once. Needs scoped approach.

4. **Previously reverted (1 issue):**
   - #26 (Eval rewrite): Experiment 12 reverted due to structural precheck failure.

5. **Not factory-actionable (1 issue):**
   - #2 (Historical draft data 2015-2018): Requires manual CSV creation from non-API sources.

### Lint Error Breakdown (Issue #28)
- 51 `no-explicit-any` errors (ESPN API response types)
- 12 React Compiler nested component violations
- 4 setState-in-effect warnings
- Misc others across ~20 files
- Previous attempt failed by trying all 74 at once (timeout)

### Strategic Recommendation
- Close #37 (superseded by #39)
- Merge 5 open PRs (#29, #31, #33, #35, #39)
- Tackle #28 in smaller scoped batches (e.g., by file or error category)
- #26 eval rewrite needs different approach (avoid structural precheck)
- #2 requires manual historical data, defer

## Implications for Strategy
Single hypothesis cycle: scope lint fix to one file or one error category to avoid timeout. The previous 600s timeout on all 74 errors confirms that batch size must shrink.
