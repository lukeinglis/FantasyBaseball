---
tags:
  - factory
  - experiment
  - FantasyBaseball
project: FantasyBaseball
experiment_id: "012"
verdict: revert
score_before: 0.6468
score_after: 0.6468
score_delta: 0.0
date: 2026-05-01
source: factory-archivist
---

# Experiment #012: Rewrite eval/score.py for JS/TS scanning

## Hypothesis
The eval script only scans `*.py` files via `glob("**/*.py")`, making it blind to the JS/TS codebase. Rewriting eval/score.py to scan `.ts/.tsx/.js/.jsx` files and replacing the Python `ast.parse` syntax check with `npx tsc --noEmit` will unblock coverage, observability, and capability_surface scoring.

## Result
**REVERT** — score 0.6468 → 0.6468 (delta: 0.0, neutral)

### Decision Rationale
The experiment was score-neutral because the factory framework uses its own internal eval dimensions to compute the composite score, not the project's `eval/score.py`. The rewritten `eval/score.py` would only affect scoring if the factory's eval harness delegated to it, which it does not. The precheck also failed on threshold: the 0.7 target has never been met by this project, making it a structural barrier rather than something fixable by rewriting the eval script.

### Root Cause of Failure
Misidentified leverage point. The cycle 3 research correctly identified that `eval/score.py` only scans Python files, but incorrectly assumed the factory's composite score derives from running that script. The factory computes dimensions internally (tests, lint, type_check, coverage, etc.) using its own detection logic. Rewriting eval/score.py changed nothing the factory measures.

## What Changed
- **Syntax check**: Replaced no-op Python syntax check with TypeScript compiler validation (`npx tsc --noEmit`)
- **Observability eval**: Rewrote to scan `.ts/.tsx/.js/.jsx` files using regex-based function detection
- **factory.md**: Created with full project configuration
- **Scope**: Added `eval/**` to modifiable scope

## Files Changed
- `eval/score.py` (148 lines, new file)
- `factory.md` (86 lines, new file)
- `.gitignore` (+3 lines)

## Lessons
- The factory's internal eval harness is the source of truth for scoring, not `eval/score.py`. Future experiments targeting score improvement must change what the factory actually measures.
- Precheck threshold failures can be structural (project has never met 0.7) rather than fixable by any single experiment. The 0.7 threshold may require multiple dimension improvements, not one silver bullet.
- Always verify the causal chain: identify what actually computes the score before trying to change the scoring input.

## Links
- [[FantasyBaseball]]
- Branch: experiment/12-eval-js-ts-rewrite (reverted)
- Commit: 8a503d5 (reverted)
