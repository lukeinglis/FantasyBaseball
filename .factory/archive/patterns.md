---
tags:
  - factory
  - patterns
source: factory-archivist
updated: 2026-05-02T15:30:00
---

# Factory Patterns

## Factory Eval Is Internal, Not Delegated
Discovered in [[FantasyBaseball]] experiment #012.
The factory framework computes eval dimensions (tests, lint, coverage, observability, capability_surface, etc.) using its own internal detection logic. It does NOT delegate to the project's `eval/score.py`. Rewriting or fixing eval/score.py has zero effect on factory composite scores. Experiments targeting score improvement must change what the factory's internal harness actually detects (e.g., fixing lint errors, adding tests, adding logging calls) rather than changing how a project-level eval script counts them.

## Precheck Threshold Can Be Structural
Discovered in [[FantasyBaseball]] experiment #012.
When a project has never met the factory's score threshold (e.g., 0.7), precheck failures on that threshold are structural, not fixable by any single experiment. The gap must be closed incrementally across multiple dimensions. Do not treat threshold precheck failure as evidence that a specific experiment failed; it may simply mean the project needs more cumulative improvement.

## Meta-dimension Regressions Warrant CEO Override
Discovered in [[FantasyBaseball]] experiment #014.
Score regressions caused by factory meta-dimensions (experiment_diversity, factory_effectiveness) rather than code quality degradation are candidates for CEO override. When the code itself is sound (tests pass, lint clean, type-check clean) but the composite score drops due to how the factory weights its own process metrics, the negative delta does not reflect actual project quality decline. CEO override is appropriate in these cases.

## Rapid Backlog Clearing Over Score Optimization
Discovered in [[FantasyBaseball]] cycle 3 (experiments #015-018).
When remaining score levers are limited or uncertain (e.g., factory detection of coverage/capability_surface is opaque), switching from score optimization to rapid feature delivery can be more productive. In cycle 3, after the eval root cause discovery (Exp 12) showed limited remaining levers, the factory shifted to clearing all 5 backlog items in 4 experiments. This delivered more user value than chasing marginal score gains. The z-score analysis pattern (used in Free Agents, Trade Room, My Roster) emerged as a reusable analytical primitive across multiple features.

## Z-Score Analysis as a Reusable Analytical Primitive
Discovered in [[FantasyBaseball]] cycle 3 (experiments #015-017).
Z-score comparison against league averages proved to be a versatile pattern across three distinct features: weakness-aware free agent recommendations (Exp 15), trade surplus/gap detection (Exp 16), and roster deep stat breakdown (Exp 17). When building analytical features for fantasy sports or similar competitive contexts, z-scores provide a consistent, interpretable framework for "how does X compare to the field." Consider z-scores as a first-pass analytical tool when adding comparative features.

## Scope Lint Fixes by Category, Not All At Once
Discovered in [[FantasyBaseball]] experiments #013 and #020.
Attempting to fix all 74 lint errors in a single experiment timed out at 600s (Exp 13). Scoping into 4 batches by error category (A: 51 no-explicit-any via typed interfaces, B: 18 React Compiler via component extraction, C: 4 setState-in-effect, D: 1 minor) with 1800s timeout succeeded (Exp 20). Batch size directly correlates with builder timeout risk. The typed interface approach (creating `espn.ts`) eliminated the largest single error category at its root.

## Typed Interfaces Eliminate Whole Error Categories
Discovered in [[FantasyBaseball]] experiment #020.
When a large number of lint errors share a common root cause (e.g., 51 `no-explicit-any` errors from untyped API responses), creating a shared type definition file eliminates the entire category at once. In Exp 20, `web/src/types/espn.ts` (110 lines) replaced `any` across 15+ files. This is more maintainable than fixing each `any` individually and prevents recurrence.
