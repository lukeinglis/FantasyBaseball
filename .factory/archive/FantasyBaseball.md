---
tags:
  - factory
  - project
  - FantasyBaseball
source: factory-archivist
updated: 2026-05-02T15:00:00
---

# Factory: FantasyBaseball

## Status
- **State**: Cycle 4 complete. Experiment 19 kept (PR #40).
- **Current Score**: 0.6279 (threshold: 0.7, gap: 0.0721)
- **Experiments Run**: 19
- **Kept**: 17, **Reverted**: 1, **Errors**: 1
- **Keep Rate**: 94% (of decided)

## Project Summary
Next.js 16.2.1 fantasy baseball app ("War Room") for ESPN private leagues. Features: draft tracker, matchup projections with Monte Carlo win probabilities, GM advisor (three-tier cached with accessible accordion), roster analysis with z-scores, free agent recommendations, trade intelligence, bullpen streaming intelligence, league analytics, schedule strength, and daily command center. 130+ tests with Vitest + MSW. Pino structured logging. H2H page with 3-tab interface (This Week, Season H2H, All-Play Record).

## Score Progression
| Experiment | Hypothesis | Verdict | Before | After | Delta |
|------------|-----------|---------|--------|-------|-------|
| 001 | Draft localStorage persistence | KEEP | 0.5098 | 0.5098 | 0.0 |
| 002 | Vitest + MSW testing infrastructure | KEEP | 0.5098 | 0.5848 | +0.075 |
| 003 | Category Breakdown/Rank scope fix | KEEP | 0.5848 | 0.5848 | 0.0 |
| 004 | H2H consolidation + All-Play Record | KEEP | 0.5848 | 0.6122 | +0.0274 |
| 005 | Fix lint errors in warroom/page.tsx | KEEP | 0.6122 | 0.6122 | 0.0 |
| 006 | Vitest coverage-v8 setup | KEEP | 0.6122 | 0.6122 | 0.0 |
| 007 | Pino structured logging | KEEP | 0.6122 | 0.6468 | +0.0346 |
| 008 | Scoreboard category rankings | KEEP | 0.6468 | 0.6468 | 0.0 |
| 009 | Monte Carlo category win% | KEEP | 0.6468 | 0.6468 | 0.0 |
| 010 | Today page command center | KEEP | 0.6468 | 0.6468 | 0.0 |
| 011 | Schedule matchup strength | KEEP | 0.6468 | 0.6468 | 0.0 |
| 012 | Eval/score.py JS/TS rewrite | REVERT | 0.6468 | 0.6468 | 0.0 |
| 013 | Fix 74 lint errors | ERROR | 0.6468 | 0.6468 | 0.0 |
| 014 | Bullpen streaming intelligence | KEEP (override) | 0.6468 | 0.6326 | -0.0142 |
| 015 | Free Agents weakness-aware recs | KEEP | 0.6326 | 0.6326 | 0.0 |
| 016 | Trade Room surplus/gap analysis | KEEP | 0.6326 | 0.6326 | 0.0 |
| 017 | My Roster deep stat z-scores | KEEP | 0.6326 | 0.6326 | 0.0 |
| 018 | GM Advisor three-tier cached | KEEP | 0.6326 | 0.6326 | 0.0 |
| 019 | GM Advisor accessible accordion | KEEP | 0.6279 | 0.6279 | 0.0 |

## Cycle History

### Cycle 1 (Experiments 1-5)
Foundation: localStorage persistence, testing infrastructure, category fix, H2H consolidation, lint cleanup. Score: 0.5098 → 0.6122 (+0.1024).

### Cycle 2 (Experiments 6-11)
Expansion: coverage setup, Pino logging, scoreboard rankings, Monte Carlo, Today page, schedule strength. Score: 0.6122 → 0.6468 (+0.0346).

### Cycle 3 (Experiments 12-18)
Discovery + backlog clearing: learned factory eval is internal (Exp 12 revert), lint fix timed out (Exp 13 error), then rapid feature delivery clearing all 5 backlog items. Score: 0.6468 → 0.6326 (-0.0142, meta-dimension regression only).

### Cycle 4 (Experiment 19)
Targeted issue #37/#39. Replaced tab-based GM Advisor with accessible accordion (WAI-ARIA compliant), three-file `Promise.all` loading, backward compat fallback, unmount safety, 14 new tests. Score: 0.6279 → 0.6279 (0.0). Precheck failed on structural threshold gap, not regression. 130/130 tests pass.

## Dimension Status (end of cycle 4, from last_eval.json)
| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| tests | 1.0 | 0.15 | PASS (130 tests) |
| lint | 0.9 | 0.075 | 1 error remaining (was 74 at start of cycle 3) |
| type_check | 1.0 | 0.05 | PASS |
| coverage | 0.5 | 0.125 | not detected by factory eval |
| guard_patterns | 0.7 | 0.05 | 7/10 pattern tests pass |
| config_parser | 1.0 | 0.05 | PASS |
| capability_surface | 0.28 | 0.14 | 28/100 target (largest remaining lever) |
| experiment_diversity | 0.9 | 0.11 | 6 categories in last 10 experiments |
| observability | 0.406 | 0.1 | function_coverage=0.64, structured_logging not detected |
| research_grounding | 0.0 | 0.08 | vault not configured |
| factory_effectiveness | 0.4875 | 0.07 | keep_rate=0.75 (last 8), delta_score=0.50 |

## Known Issue: Structural Score Gap
Composite score 0.6279 is below threshold 0.7 (gap: 0.0721). The `score_direction` precheck consistently fails because the composite has never reached 0.7, not because experiments cause regressions. This is a structural gap, not a quality issue. Future cycles should target capability_surface (weight 0.14) and research_grounding (weight 0.08) for highest leverage.

## Experiment History
- [[FantasyBaseball-001]] — Draft localStorage persistence (**KEEP**, +0.0)
- [[FantasyBaseball-002]] — Vitest + MSW testing infrastructure (**KEEP**, +0.075)
- [[FantasyBaseball-003]] — Category Breakdown/Rank scope fix (**KEEP**, +0.0)
- [[FantasyBaseball-004]] — H2H consolidation with All-Play Record (**KEEP**, +0.0274)
- [[FantasyBaseball-005]] — Fix lint errors in warroom/page.tsx (**KEEP**, +0.0, PR #13)
- [[FantasyBaseball-006]] — Vitest coverage-v8 setup (**KEEP**, +0.0)
- [[FantasyBaseball-007]] — Pino structured logging (**KEEP**, +0.0346)
- [[FantasyBaseball-008]] — Scoreboard category rankings (**KEEP**, +0.0)
- [[FantasyBaseball-009]] — Monte Carlo category win% (**KEEP**, +0.0)
- [[FantasyBaseball-010]] — Today page command center (**KEEP**, +0.0)
- [[FantasyBaseball-011]] — Schedule matchup strength (**KEEP**, +0.0)
- [[FantasyBaseball-012]] — Eval/score.py JS/TS rewrite (**REVERT**, +0.0)
- [[FantasyBaseball-013]] — Fix 74 lint errors (**ERROR**, timeout)
- [[FantasyBaseball-014]] — Bullpen streaming intelligence (**KEEP**, -0.0142, CEO override)
- [[FantasyBaseball-015]] — Free Agents weakness-aware recs (**KEEP**, PR #32)
- [[FantasyBaseball-016]] — Trade Room surplus/gap analysis (**KEEP**, PR #34)
- [[FantasyBaseball-017]] — My Roster deep stat z-scores (**KEEP**, PR #36)
- [[FantasyBaseball-018]] — GM Advisor three-tier cached (**KEEP**, PR #38)
- [[FantasyBaseball-019]] — GM Advisor accessible accordion (**KEEP**, PR #40)

## Research Archive
- [[draft-state-localstorage]] — localStorage for serverless cold start (cycle 1)
- [[vitest-msw-testing-stack]] — Vitest + MSW stack (cycle 1)
- [[monte-carlo-category-projections]] — Monte Carlo matchup projections (cycle 1)
- [[backlog-assessment]] — 14 backlog items assessed (cycle 1)
- [[pino-structured-logging]] — Pino setup for Next.js, AsyncLocalStorage caveat (cycle 2)
- [[vitest-coverage-setup]] — @vitest/coverage-v8 config (cycle 2)
- [[h2h-allplay-calculation]] — All-play computation pattern, tie handling (cycle 2)
- [[cycle3-eval-root-cause]] — eval/score.py scans only .py files, blind to JS/TS (cycle 3)
- [[cycle3-lint-investigation]] — 74 lint errors remain across project (cycle 3)
- [[cycle3-coverage-investigation]] — Vitest coverage functional but undetected by eval (cycle 3)
- [[cycle3-observability-investigation]] — Pino logging functional but undetected by eval (cycle 3)
- [[cycle3-backlog-dedup]] — Backlog reduced from 15 to 5 items, issue #3 closed (cycle 3)
- [[cycle3-findings-summary]] — Consolidated cycle 3 findings: eval fix is highest leverage (cycle 3)
- [[cycle4-issue37-gm-advisor-three-tier]] — Issue #37 research: PR #38 exists, needs ARIA + backward compat (cycle 4)
- [[aria-accordion-best-practices]] — WAI-ARIA accordion pattern requirements (cycle 4)

## Strategy Snapshots
- [[FantasyBaseball-2026-05-01-strategy]] — Cycle 1: 11 hypotheses, top 6 approved
- [[FantasyBaseball-2026-05-01-research-cycle2]] — Cycle 2 research: 4 areas, priority order
- [[FantasyBaseball-2026-05-01]] — Cycle 2 strategy: 8 hypotheses approved
- [[FantasyBaseball-2026-05-01-research-cycle3]] — Cycle 3 research: eval root cause, lint, backlog dedup
- [[FantasyBaseball-2026-05-01-strategy-cycle3]] — Cycle 3 strategy: 7 hypotheses approved
- [[FantasyBaseball-2026-05-01-cycle3-summary]] — Cycle 3 final summary: 7 experiments, 5 kept, backlog cleared
- [[FantasyBaseball-2026-05-02-strategy-cycle4]] — Cycle 4 strategy: single H1, GM Advisor three-tier + ARIA + backward compat
- [[FantasyBaseball-2026-05-02-cycle4-summary]] — Cycle 4 final summary: 1 experiment, KEEP, targeted mode, score neutral

## CEO Verdicts Summary
- **Cycle 1 Research**: PROCEED
- **Cycle 1 Strategy**: PROCEED, execute H1-H6 in order
- **Exp 1-5**: All KEEP
- **Cycle 2 Research**: PROCEED
- **Cycle 2 Strategy**: PROCEED, all 8 hypotheses approved
- **Exp 6-11**: All KEEP
- **Cycle 3 Research**: PROCEED, root cause found (eval blind to JS/TS)
- **Cycle 3 Strategy**: PROCEED, 7 hypotheses approved
- **Exp 12**: REVERT. eval/score.py rewrite was score-neutral; factory uses internal eval
- **Exp 13**: ERROR. Lint fix timed out
- **Exp 14**: KEEP (CEO override). Meta-dimension regression only
- **Exp 15-18**: KEEP. Rapid backlog clearing, all 5 items completed
- **Cycle 4 Research**: PROCEED. PR #38 has solid implementation, patch ARIA + backward compat
- **Cycle 4 Strategy**: PROCEED. Single hypothesis H1 approved, 5 deliverables, no issues found
- **Exp 19**: KEEP. All 5 deliverables implemented, 130/130 tests pass. Score 0.0 delta (structural threshold gap, not regression).

## Key Technical Facts
- ESPN API calls: in `espn.ts`, 117 console.* calls total across project
- All-play types pre-defined in `h2h/page.tsx` (lines 26-43)
- DAILY_SD constants already in matchup page, Monte Carlo drop-in ready
- `safe()` sanitizer pattern established in Exp 4 for category math edge cases
- AsyncLocalStorage does NOT propagate Middleware to Route Handlers in Next.js
- eval/score.py is NOT the scoring bottleneck; factory eval harness computes dimensions internally
- Z-score analysis pattern used across Free Agents, Trade Room, and My Roster pages
- GM Advisor uses three-tier JSON loading with backward compat fallback (Exp 18-19)
- WAI-ARIA accordion pattern with aria-expanded, aria-controls, role=region, aria-labelledby (Exp 19)
