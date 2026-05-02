---
tags:
  - factory
  - research
  - FantasyBaseball
date: 2026-05-01
source: factory-archivist
cycle: 3
---

# Cycle 3 Research Findings

## 1. Eval Scoring is Broken for JS/TS Projects

`eval/score.py` scans only `*.py` files for capability_surface, coverage, and observability dimensions. FantasyBaseball is a Next.js/TypeScript project, so these dimensions are structurally undetectable:

- **capability_surface**: counts Python public functions only; JS/TS exports ignored
- **coverage**: looks for Python coverage artifacts; Vitest coverage reports undetected
- **observability**: scans Python files for logging calls; Pino structured logging invisible

This is the root cause of the persistent score plateau. Functional improvements (Pino logging, Vitest coverage, new page exports) produced zero score movement because the eval never sees them.

## 2. Lint: 74 Errors Remain

Despite Exp 5 fixing warroom/page.tsx lint, 74 errors persist across other files. The lint dimension dropped from 1.0 back to lower values as new code introduced violations. Primary offenders likely in recently added pages (matchup, schedule, today).

## 3. Coverage and Observability Are Functional But Invisible

- **Coverage**: @vitest/coverage-v8 is configured and working (Exp 2). Coverage reports generate correctly. But eval/score.py cannot find them because it looks for Python coverage artifacts.
- **Observability**: Pino structured logging added (PR #17, merged). 117+ console.* calls replaced. But eval/score.py cannot detect it because it scans .py files.

## 4. Backlog Deduplicated

Backlog reduced from 15 items to 5 actionable items. Duplicate and completed items removed. Issue #3 (stale/completed) closed.

## Implications for Cycle 3 Strategy

The highest-leverage fix is patching `eval/score.py` to scan JS/TS files. This would unlock score credit for:
- Existing Pino logging (observability)
- Existing Vitest coverage (coverage)
- All exported functions in pages/components (capability_surface)

Without this fix, no amount of feature work will move the score significantly.
