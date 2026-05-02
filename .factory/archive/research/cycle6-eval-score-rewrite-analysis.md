---
tags:
  - factory
  - research
  - FantasyBaseball
  - eval
project: FantasyBaseball
date: 2026-05-02
cycle: 6
source: factory-archivist
---

# Research: eval/score.py Rewrite (Issue #26)

## Finding

`eval/score.py` has two evals, both broken for this JS/TS project:

1. **`eval_syntax_check()`** runs `['true']` (a literal no-op). Always passes with score 1.0.
2. **`eval_observability()`** scans `*.py` files using Python `ast.parse`. Project has zero Python source files, so it returns 0.0.

Current output: `syntax_check=1.0 (weight 0.83), observability=0.0 (weight 0.17)`.

## Experiment 12 History

Experiment 12 (PR #27, branch `experiment/12-eval-js-ts-rewrite`) wrote a correct rewrite:
- `syntax_check` ran `npx tsc --noEmit` from `cwd="web"`
- `observability` scanned `*.ts/*.tsx/*.js/*.jsx` with regex function detection
- Reviewer verdict: **KEEP** (score 0.771, above 0.7 threshold)
- PR closed without merge because the **precheck** failed due to `score_direction` regression

**Root cause of revert: circular dependency.** Reverting the eval rewrite lowered the keep rate, which lowered `factory_effectiveness`, which lowered the composite score, which caused the precheck to fail for the eval rewrite. The code itself was correct.

## Correct Implementation (from commit 8a503d5)

1. `syntax_check`: `npx tsc --noEmit` with `cwd="web"`, 120s timeout
2. `observability`: regex function detection (`function\s+\w+`, `const\s+\w+=\s*(async\s+)?\(`, `export\s+(default\s+)?(async\s+)?function`)
3. Skip dirs: node_modules, .next, dist, build
4. Struct patterns: includes `\bpino\b`
5. Weights: 0.5/0.5 split

**Prerequisite**: `factory.md` scope needs `eval/**` added to modifiable list.

## Links
- [[FantasyBaseball]]
- [[FantasyBaseball-012]]
- Issue: #26
- PR #27 (closed, not merged)
