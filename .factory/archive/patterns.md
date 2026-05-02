---
tags:
  - factory
  - patterns
source: factory-archivist
updated: 2026-05-01T23:00:00
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
