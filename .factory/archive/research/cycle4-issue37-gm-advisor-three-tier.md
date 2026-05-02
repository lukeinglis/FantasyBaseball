---
tags:
  - factory
  - research
  - FantasyBaseball
project: FantasyBaseball
date: 2026-05-02
source: factory-archivist
---

# Research: Issue #37, Three-Tier GM Advisor with Cached JSON

## Target
GitHub issue #37: Expand GM Advisor to load from three separate JSON files with collapsible accordion UI and Vitest tests.

## Key Finding: PR #38 Exists

PR #38 (branch `experiment/18-gm-advisor-three-tier`) already implements the core requirements:
- Three-file loading (`gm-advice-week.json`, `gm-advice-month.json`, `gm-advice-season.json`) via `Promise.all`
- Accordion UI replacing tab-based interface, multiple sections open simultaneously
- Exported `parseGmTierJson(raw: unknown)` parser with null guards
- 12 Vitest tests covering edge cases (null, undefined, non-object, missing bullets, empty arrays)
- Bonus: NaN/Infinity sanitization in z-scores, free-agents, and trade pages

**Merge status:** MERGEABLE, CLEAN merge state, no conflicts. 4 commits, 423 lines diff.

## Three Gaps Identified

### 1. Skill File Not Updated
`.claude/commands/gm-advice.md` still writes a single `gm-advice.json`. After merge, all three tiers show "No analysis available" until skill is updated to write three separate files.

### 2. ARIA Accessibility Missing
AccordionSection lacks required WAI-ARIA attributes:
- `aria-expanded` on button
- `aria-controls` linking button to panel
- `role="region"` on panels
- `aria-labelledby` on panels
- Heading wrapper (`<h2>`) around button
- `id` attributes for linking

### 3. No Backward Compatibility
Old `gm-advice.json` is ignored entirely. Optional fallback: if three files missing but single file exists, load and split it.

## CEO Verdict
PROCEED. Strategy should produce one hypothesis incorporating PR #38's core changes plus ARIA polish and backward compatibility. Close PR #38 to avoid conflicts, implement fresh on new branch.

## ARIA Research Summary

WAI-ARIA accordion pattern (W3C, aditus.io):

| Attribute | Element | Purpose |
|---|---|---|
| `aria-expanded` | button | Communicates open/closed state |
| `aria-controls` | button | Links to panel id |
| `role="region"` | panel | Landmark (appropriate for <= 6 panels) |
| `aria-labelledby` | panel | Links back to button id |
| `hidden` | panel | Hides collapsed content from assistive tech |

For 3 panels, `role="region"` is appropriate. Native `<details>/<summary>` doesn't match existing design system.

## References
- [WAI-ARIA Accordion Pattern (Aditus)](https://www.aditus.io/patterns/accordion/)
- [Accessible React Accordion Guide](https://accessible-react.eevis.codes/components/accordion)
- [Building an Accessible Accordion with React (DEV)](https://dev.to/eevajonnapanula/expand-the-content-inclusively-building-an-accessible-accordion-with-react-2ded)
