---
tags:
  - factory
  - research
  - FantasyBaseball
  - pattern
project: FantasyBaseball
date: 2026-05-02
cycle: 6
source: factory-archivist
---

# Research: Circular Precheck Dependency Pattern

## Pattern Discovered

When an experiment modifies the eval scoring system itself, revert decisions create a circular dependency:

1. Experiment rewrites eval/score.py (correct code, reviewer says KEEP)
2. Experiment gets reverted for unrelated reason (e.g., timeout on another experiment)
3. Revert lowers keep rate, which lowers `factory_effectiveness` sub-score
4. Lower composite score causes precheck `score_direction` to fail
5. Precheck failure prevents re-applying the correct eval rewrite
6. The eval stays broken, which keeps scores artificially low

## Impact

Experiment 12 (eval/score.py rewrite) was caught in this loop. The code was correct (reviewer scored 0.771, above 0.7 threshold) but could not be re-applied because the precheck compared against a score inflated by the broken eval.

## Mitigation

- Eval rewrites should bypass `score_direction` precheck, or
- Precheck should compare against a baseline that accounts for eval methodology changes, or
- Force-apply eval fixes with CEO override when research confirms correctness

## Links
- [[FantasyBaseball]]
- [[FantasyBaseball-012]]
- Issue: #26
