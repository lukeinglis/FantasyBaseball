# Research: Issue #37 (Three-Tier GM Advisor with Cached JSON)

## Target
GitHub issue #37: Expand GM Advisor to load from three separate JSON files with collapsible accordion UI and Vitest tests.

## Current State (main branch)

- `web/src/app/gm/roster/page.tsx` lines 160-261: GmAdvisor component loads a single `/gm-advice.json` with tab-based UI (three tabs: This Week, Next 30 Days, Win the League)
- `web/public/gm-advice.json`: single file containing `week[]`, `month[]`, `season[]` arrays plus `generatedAt`
- `.claude/commands/gm-advice.md`: skill writes to single `web/public/gm-advice.json`
- No existing tests for the GM advisor on main (no `web/src/tests/gm*` files)

## PR #38 Analysis (experiment/18-gm-advisor-three-tier)

**Branch:** `experiment/18-gm-advisor-three-tier` (4 commits, 423 lines diff)
**Merge status:** MERGEABLE, CLEAN merge state, no conflicts
**State:** OPEN, never merged despite being KEPT in experiment 18

### What PR #38 delivers

1. **Three-file loading:** Fetches `gm-advice-week.json`, `gm-advice-month.json`, `gm-advice-season.json` via `Promise.all`
2. **Accordion UI:** Replaces tabs with collapsible `AccordionSection` components, multiple sections can be open simultaneously
3. **Parser function:** Exported `parseGmTierJson(raw: unknown)` with null guards for all edge cases
4. **Tier fallback:** Inline "No analysis available" prompt per tier instead of crashing
5. **Unmount cleanup:** `mounted` flag prevents state updates after component unmount
6. **Vitest tests:** 12 tests in `web/src/tests/gm-advisor.test.ts` covering: null, undefined, non-object, missing bullets, empty arrays, mixed invalid bullets, missing generatedAt, extra fields
7. **Bonus fixes:** NaN/Infinity sanitization in z-scores, free-agents, and trade pages

### What PR #38 is missing

1. **Skill not updated:** `.claude/commands/gm-advice.md` still writes to a single `gm-advice.json`. The three separate files (`gm-advice-week.json`, `gm-advice-month.json`, `gm-advice-season.json`) don't exist in `web/public/`. Merging PR #38 as-is means the GM advisor will show "No analysis available" for all tiers until the skill is updated.

2. **ARIA accessibility gaps:** The accordion uses a plain `<button>` without:
   - `aria-expanded` attribute
   - `aria-controls` linking button to panel
   - `role="region"` on panels
   - `aria-labelledby` on panels
   - Heading wrapper (`<h2>`) around button
   - `id` attributes for linking

3. **No backward compatibility:** Old `gm-advice.json` is ignored. If someone runs the current `/gm-advice` skill after merge, no advice appears.

## Accessibility Research: Accordion Best Practices

WAI-ARIA accordion pattern requires (per W3C, aditus.io/patterns/accordion, and accessible-react.eevis.codes):

| Attribute | Element | Purpose |
|---|---|---|
| `aria-expanded` | button | Communicates open/closed state to screen readers |
| `aria-controls` | button | Links to panel id |
| `role="region"` | panel | Identifies panel as landmark (appropriate for <= 6 panels) |
| `aria-labelledby` | panel | Links back to button id |
| `hidden` | panel | Hides collapsed content from keyboard and screen readers |

Keyboard: Enter/Space toggles panel, Tab navigates between focusable elements.

For only 3 panels, `role="region"` is appropriate. Native `<details>/<summary>` is a 2025 trend but doesn't match the existing design system's styling.

### Minimal accessible pattern
```jsx
<h3>
  <button id="btn-week" aria-expanded={isOpen} aria-controls="panel-week">
    This Week
  </button>
</h3>
<div id="panel-week" role="region" aria-labelledby="btn-week" hidden={!isOpen}>
  {content}
</div>
```

## Recommended Implementation Path

**Merge PR #38, then patch three gaps:**

1. **Update `.claude/commands/gm-advice.md`** to write three separate JSON files instead of one. Each file contains `{ "bullets": [...], "generatedAt": "..." }`. The skill should also delete the old `gm-advice.json` on first run (or the builder can remove it).

2. **Add ARIA attributes** to `AccordionSection`: `aria-expanded`, `aria-controls`, `role="region"`, `aria-labelledby`, `id` attributes, and `hidden` on collapsed panels.

3. **Backward compatibility (optional):** If three files are all missing but `gm-advice.json` exists, fall back to loading and splitting the single file. This is transitional and can be removed after the first `/gm-advice` run with the updated skill.

### Why merge first

- PR is clean, well-tested, aligns with issue #37's three requirements
- The NaN/Infinity fixes in the PR are independently valuable
- CLEAN merge state means no conflict resolution needed
- Patches are additive (don't require reworking existing code)

## Complexity Assessment

- **Core change (already in PR #38):** Low complexity, contained to one component
- **Skill update:** Low complexity, change output format from one file to three
- **ARIA fix:** Low complexity, add 5-6 attributes to existing AccordionSection
- **Backward compat:** Low complexity, optional fallback fetch
- **Dependencies:** None beyond existing stack (React, Vitest, Next.js)

## References

- [WAI-ARIA Accordion Pattern (Aditus)](https://www.aditus.io/patterns/accordion/)
- [Accessible React Accordion Guide](https://accessible-react.eevis.codes/components/accordion)
- [react-accessible-accordion (deprecated in favor of native)](https://github.com/springload/react-accessible-accordion)
- [Building an Accessible Accordion with React (DEV)](https://dev.to/eevajonnapanula/expand-the-content-inclusively-building-an-accessible-accordion-with-react-2ded)
