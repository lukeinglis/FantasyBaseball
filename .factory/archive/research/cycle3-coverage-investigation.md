---
tags:
  - factory
  - research
  - FantasyBaseball
  - coverage
  - eval
project: FantasyBaseball
cycle: 3
date: 2026-05-01
source: factory-archivist
---

# Research: Coverage Score Undetected (Cycle 3)

## Finding

Coverage works correctly. `cd web && npx vitest run --coverage` produces:
- 97 tests pass (8 test files)
- Statement coverage: 51.75%
- Line coverage: 54.26%
- Reporters: text, html, lcov

The eval does not detect any of this.

## Root Cause

`eval/score.py` defines only two dimensions: `eval_syntax_check` (runs `true`, always passes) and `eval_observability` (scans only `*.py` files). There is **no test runner dimension** and **no coverage dimension** in either eval/score.py or eval_profile.json.

## Fix

Add test and coverage dimensions to `eval_profile.json`:

```json
{
  "name": "tests",
  "command": "cd web && npx vitest run 2>&1; echo \"exit:$?\"",
  "weight": 0.4,
  "parser": "exit_code"
},
{
  "name": "coverage",
  "command": "cd web && npx vitest run --coverage 2>&1; echo \"exit:$?\"",
  "weight": 0.2,
  "parser": "exit_code"
}
```

## Sources

- [Vitest Coverage Guide](https://vitest.dev/guide/coverage)
