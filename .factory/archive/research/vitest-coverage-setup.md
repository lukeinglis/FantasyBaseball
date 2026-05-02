---
tags:
  - factory
  - research
  - FantasyBaseball
  - coverage
  - testing
project: FantasyBaseball
date: 2026-05-01
cycle: 2
source: factory-archivist
---

# Research: Vitest v8 Coverage Setup

## Summary
Adding `@vitest/coverage-v8` to the existing Vitest setup is a one-package, 8-line config change that should push the `coverage` eval dimension from 0.5 (not detected) to ~0.7. Prerequisite for meaningful coverage tracking going forward.

## Key Findings

### Provider Choice
- `v8` over Istanbul: since Vitest v3.2.0, v8 uses AST-based coverage remapping giving Istanbul-equivalent accuracy with lower memory overhead. No pre-instrumentation needed.

### Install
```bash
npm install -D @vitest/coverage-v8
```

### Config Addition (append to existing `web/vitest.config.mts`)
```ts
test: {
  coverage: {
    provider: "v8",
    reporter: ["text", "html", "lcov"],
    exclude: [
      "src/tests/**",
      "src/mocks/**",
      "src/app/**",       // Next.js pages — not unit-testable with Vitest
      "**/*.config.*",
    ],
    thresholds: {
      lines: 50,          // start low, raise as tests grow
    },
  },
}
```

### Script to Add
```json
{ "coverage": "vitest run --coverage" }
```

### Output Locations
- `web/coverage/` (HTML report)
- `web/coverage/lcov.info` (for CI tools)
- Both should be in `.gitignore`

### Expected Eval Impact
- `coverage` dimension: 0.5 → ~0.7 if the existing 46 tests cover meaningful lib code
- The eval checks for presence of a coverage tool and a working `coverage` script

## Sources
- Vitest Coverage Guide (vitest.dev/guide/coverage)
- Vitest Coverage Config Reference (vitest.dev/config/coverage)
- Vitest v8 vs Istanbul GitHub discussion #7587
