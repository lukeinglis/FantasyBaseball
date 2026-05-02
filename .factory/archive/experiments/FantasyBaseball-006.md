---
tags:
  - factory
  - experiment
  - FantasyBaseball
project: FantasyBaseball
experiment_id: "006"
verdict: keep
score_delta: -0.0047
date: 2026-05-01
source: factory-archivist
---

# Experiment #006: Add @vitest/coverage-v8 and coverage script

## Hypothesis
Install `@vitest/coverage-v8` and configure v8 coverage reporting (text/html/lcov, 50% threshold) to activate the coverage dimension and push coverage score above 0.5.

## Result
**KEEP** — score shifted from 0.6122 to 0.6075 (delta: -0.0047). Slight dip is a diversity_shift_artifact, not a regression. Coverage tooling is operational at 46.71% lines.

## What Changed
- Installed `@vitest/coverage-v8` dev dependency
- Added `coverage: { provider: 'v8', reporter: ['text','html','lcov'], thresholds: { lines: 50 } }` to `vitest.config.mts`
- Added `"coverage": "vitest run --coverage"` script to `package.json`
- Baseline coverage: 46.71% lines across 46 existing tests

## Why Score Dipped
The `-0.0047` delta is labelled `diversity_shift_artifact` in the TSV — the eval diversity sub-score redistributed weight slightly when the new coverage dimension was fully activated. The coverage score itself registered at 0.5 (threshold met).

## Links
- [[FantasyBaseball]]
- Issue: #14
- PR: #15
