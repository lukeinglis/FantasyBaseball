---
tags:
  - factory
  - strategy
  - FantasyBaseball
date: 2026-05-02
cycle: 4
mode: targeted
source: factory-archivist
---

# Strategy: FantasyBaseball, Cycle 4 (Targeted: Issue #37)

## Context
- Composite score: 0.6279 (threshold: 0.7, gap: 0.0721)
- Experiment history: 18 total, 16 kept, 1 reverted, 1 error (89% keep rate)
- Mode: targeted (single issue #37)
- CEO verdict: PROCEED, plan approved with no issues

## Single Hypothesis

### H1: GM Advisor three-tier cached analysis with accessible accordion UI

**Category:** EXPLOIT
**Priority:** high
**Addresses:** Issue #37

Five deliverables in a single PR:

1. **Three-file JSON loading:** Replace single `gm-advice.json` with `Promise.all` for `gm-advice-week.json`, `gm-advice-month.json`, `gm-advice-season.json`. Export `parseGmTierJson(raw: unknown)` parser with full null/type guards.

2. **Accessible accordion UI:** Replace tab bar with collapsible `AccordionSection` components using WAI-ARIA pattern: `aria-expanded`, `aria-controls`, `role="region"`, `aria-labelledby`, `hidden` attribute on collapsed panels. Multiple sections open simultaneously. Existing tier color scheme preserved (orange/blue/purple).

3. **Backward compatibility:** If all three tier files 404 but legacy `gm-advice.json` exists, fall back to splitting its `week[]`/`month[]`/`season[]` arrays into three-tier structure.

4. **Unmount safety:** `useRef` mounted flag guarding all `setState` calls in async fetch chain.

5. **Vitest tests:** `web/src/tests/gm-advisor.test.ts` with 12+ tests covering parser edge cases (null, undefined, non-object, missing fields, mixed valid/invalid bullets), accordion rendering, empty state, loading spinner, and ARIA attribute verification.

## Anti-patterns
- Do not modify `.claude/commands/gm-advice.md` (outside factory scope)
- Do not merge PR #38 directly (CEO directive: close and implement fresh)
- Do not use `<details>/<summary>` (does not match Tailwind design system)
- Do not skip `hidden` attribute on collapsed panels (required for screen readers)
- Do not add pino logging (client component, pino is server-side only)

## Expected Impact
- capability_surface: +0.03 (AccordionSection component, parseGmTierJson export)
- test_coverage: +0.01 (12+ new Vitest tests)
- edge_case_handling: +0.01 (parser guards, backward compat, unmount safety)

## Builder Instructions
1. Close PR #38
2. Create fresh branch from main
3. Implement all 5 deliverables referencing PR #38's diff
4. Run tests
5. Open new PR targeting main
