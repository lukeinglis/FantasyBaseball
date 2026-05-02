---
tags:
  - factory
  - research
  - FantasyBaseball
  - eval
  - root-cause
project: FantasyBaseball
cycle: 3
date: 2026-05-01
source: factory-archivist
---

# Research: Eval Script Root Cause Analysis (Cycle 3)

## Core Finding

**The eval script (`eval/score.py`) is fundamentally broken for this JS/TS project.** This is the primary reason the composite score remains at 0.6468 despite significant real improvements (97 tests, pino logging, 51% coverage, Monte Carlo projections).

## Specific Failures

1. **Observability dimension** scans only `*.py` files, misses all pino/structured logging in TS/JS
2. **No test dimension** exists in eval/score.py or eval_profile.json
3. **No coverage dimension** exists despite Vitest + coverage-v8 being fully configured
4. **Lint error count** is truncated by `tail -5` in factory.md eval_command, reporting "1 error" instead of 74

## Score Impact Estimate

If eval correctly measured this project:
- Tests (97 passing): would score ~1.0
- Coverage (51.75% statement): would score ~0.5-0.7
- Observability (pino across all routes): would score ~0.6-0.8
- Composite: potentially 0.7+ without any application code changes

## CEO Review Notes

- Actual composite is 0.6468 (not ~0.51 as researcher initially stated)
- Score gap to threshold: 0.0532
- 11 experiments, all kept (100% rate)
- Project eval dimensions in config.json are empty, so eval/score.py changes alone won't fix scores without config integration
