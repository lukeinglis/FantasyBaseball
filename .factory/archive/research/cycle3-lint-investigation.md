---
tags:
  - factory
  - research
  - FantasyBaseball
  - lint
project: FantasyBaseball
cycle: 3
date: 2026-05-01
source: factory-archivist
---

# Research: Lint Score Discrepancy (Cycle 3)

## Finding

Eval reports "1 error" for lint, but running `cd web && npx eslint src/` reveals **74 errors and 32 warnings** across 12+ files. The "1 error" report is an artifact of the factory.md eval_command piping through `tail -5`, truncating output.

## Error Breakdown

| Rule | Count | Type |
|---|---|---|
| `@typescript-eslint/no-explicit-any` | 50 | error |
| React Compiler: "Cannot create components during render" | 12 | error |
| React Compiler: "setState synchronously within effect" | 4 | error |
| React Compiler: "memoization could not be preserved" | 6 | warning |
| `@typescript-eslint/no-unused-vars` | 9 | warning |
| `prefer-const` | 1 | error |
| `react/no-unescaped-entities` | 1 | error |

## Root Cause

PRs #17-#25 introduced new code with `any` types in API routes. The bullpen page has a nested component pattern identical to the warroom bug fixed in PR #13.

## Fix Strategy

1. Define ESPN API response interfaces in `web/src/types/espn.ts` (kills 50 `no-explicit-any` errors)
2. Move bullpen nested components to module scope (kills 12 React Compiler errors)
3. Remove dead imports/unused assignments (kills 9 warnings)

## Sources

- [typescript-eslint: no-explicit-any](https://typescript-eslint.io/rules/no-explicit-any/)
- [suppress-eslint-errors codemod](https://github.com/amanda-mitchell/suppress-eslint-errors)
