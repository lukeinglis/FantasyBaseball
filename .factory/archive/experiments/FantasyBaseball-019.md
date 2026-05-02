---
tags:
  - factory
  - experiment
  - FantasyBaseball
project: FantasyBaseball
experiment_id: 19
verdict: keep
score_delta: 0.0
date: 2026-05-02
source: factory-archivist
---

# Experiment #19: GM Advisor three-tier accessible accordion

## Hypothesis
GM Advisor three-tier cached analysis with accessible accordion and backward compatibility.

## Result
**KEEP**: score 0.6279 → 0.6279 (delta: 0.0)

Precheck `score_direction` failed on structural threshold gap (0.6279 < 0.7), not regression. CEO override applied: code quality is sound, feature is correct.

## Implementation (Builder)
**PR:** #40 (branch: experiment/19-gm-advisor-accessible-accordion)
**Files changed:** 2 (287 insertions, 59 deletions)

### Changes
- `web/src/app/gm/roster/page.tsx`: Replaced tab-based GmAdvisor with accessible accordion. Added `parseGmTierJson` parser (exported), `GmTierAdvice`/`TierKey`/`GmTierResult` types (exported), `AccordionSection` with full WAI-ARIA attributes (aria-expanded, aria-controls, role=region, aria-labelledby, hidden), three-file `Promise.all` loading with backward compat fallback to `gm-advice.json`, and `useRef` unmount safety.
- `web/src/tests/gm-advisor.test.ts`: 14 new tests covering all parser edge cases.

### Deliverables Completed
1. Three-file loading (`gm-advice-now.json`, `gm-advice-next.json`, `gm-advice-later.json`) with `Promise.all`
2. Accessible accordion with full WAI-ARIA: `aria-expanded`, `aria-controls`, `role=region`, `aria-labelledby`, `hidden`
3. Backward compatibility fallback to single `gm-advice.json`
4. `useRef` unmount safety guard
5. 14 Vitest tests for `parseGmTierJson` parser

### Verification
- 130/130 tests pass
- TypeScript clean
- No new lint errors

## Links
- [[FantasyBaseball]]
- Issue: #37, #39
- PR: #40
- Related: [[FantasyBaseball-018]] (prior GM Advisor experiment)
- Research: [[aria-accordion-best-practices]], [[cycle4-issue37-gm-advisor-three-tier]]
