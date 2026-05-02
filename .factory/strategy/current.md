## Strategy — 2026-05-02 (Cycle 4, Targeted: Issue #37)

### Observations
- Current composite score: 0.6279 (threshold: 0.7, gap: 0.0721)
- Experiment history: 18 total, 16 kept, 1 reverted, 1 error (89% keep rate)
- Last 3 experiments: 16 (Trade Room, keep), 17 (My Roster, keep), 18 (GM Advisor, keep)
- PR #38 (experiment 18) is OPEN but never merged despite KEEP verdict. CLEAN merge state, no conflicts.
- Current GM Advisor on main (`web/src/app/gm/roster/page.tsx` lines 160-261): single-file loading (`gm-advice.json`), tab-based UI with three tabs (This Week, Next 30 Days, Win the League), no tests, no ARIA attributes
- PR #38 delivers: three-file loading via `Promise.all`, accordion UI replacing tabs, exported `parseGmTierJson(raw: unknown)` parser, 12 Vitest tests, unmount cleanup, NaN/Infinity sanitization in other pages
- PR #38 gaps: (1) no ARIA accessibility attributes on accordion, (2) no backward compatibility with existing `gm-advice.json`, (3) skill file not updated (outside scope)
- CEO directive: close PR #38 and implement fresh on a new branch to avoid conflicts
- Feature category has 100% keep rate across 5 experiments (cross-project insights)
- Research confirms all three gaps are low complexity and additive

### Hypotheses

#### H1: GM Advisor three-tier cached analysis with accessible accordion and backward compatibility
- **Category:** EXPLOIT
- **Type:** code
- **Backlog item:** Please fix issue 37
- **Addresses:** #37
- **What:** Close PR #38, then implement the full three-tier GM Advisor on a fresh branch using PR #38's diff as reference. Five deliverables in a single PR:
  1. **Three-file JSON loading:** Replace single `gm-advice.json` fetch with `Promise.all` for `gm-advice-week.json`, `gm-advice-month.json`, `gm-advice-season.json`. Each file schema: `{ bullets: string[], generatedAt: string }`. Export a `parseGmTierJson(raw: unknown)` parser with null/undefined/type guards for every field, filtering non-string bullets and defaulting missing `generatedAt` to null.
  2. **Accessible accordion UI:** Replace the existing tab bar (lines 227-241 in `page.tsx`) with collapsible `AccordionSection` components. WAI-ARIA pattern required: `<h3>` wrapping a `<button>` with `id="btn-{tier}"`, `aria-expanded={isOpen}`, `aria-controls="panel-{tier}"`; panel `<div>` with `id="panel-{tier}"`, `role="region"`, `aria-labelledby="btn-{tier}"`, `hidden={!isOpen}`. Multiple sections can be open simultaneously. Keep existing tier color scheme (orange for week, blue for month, purple for season). Keyboard: native button handling covers Enter/Space.
  3. **Backward compatibility:** If all three tier files return 404 but legacy `gm-advice.json` exists, fall back to loading and splitting its `week[]`, `month[]`, `season[]` arrays into the three-tier structure. This ensures the advisor displays content immediately after merge without requiring a skill re-run.
  4. **Unmount safety:** Use a `mounted` ref flag (via `useRef`) to guard all `setState` calls in the async fetch chain, preventing React state updates after component unmount.
  5. **Vitest tests:** Create `web/src/tests/gm-advisor.test.ts` with tests covering: `parseGmTierJson` with null input, undefined input, non-object input (string, number, array), missing `bullets` field, empty `bullets` array, mixed valid/invalid bullets, missing `generatedAt`, extra unrecognized fields. Test accordion rendering with valid multi-tier data, empty state (no files), and loading spinner. Verify ARIA attributes are present on rendered accordion.
- **Why:** Experiment 18 proved the three-tier approach works (KEPT) but PR #38 was never merged. The existing tab UI on main loads a single JSON file. Three gaps need filling: ARIA accessibility (per WAI-ARIA accordion pattern for screen reader support with 3 panels), backward compatibility (graceful degradation so current `/gm-advice` skill output still works), and comprehensive tests. The `.claude/commands/gm-advice.md` skill file is outside factory scope and must not be modified by the Builder. All required data structures already exist; this is a contained component rewrite within a single file plus a new test file.
- **Expected impact:** capability_surface +0.03 (new AccordionSection component, parseGmTierJson export), test_coverage +0.01 (12+ new Vitest tests), edge_case_handling +0.01 (parser null guards, backward compat fallback, unmount safety)
- **Priority:** high

### Anti-patterns to Avoid
- **Do not modify `.claude/commands/gm-advice.md`:** Outside factory scope. The backward compatibility fallback ensures the advisor works with the existing skill output.
- **Do not merge PR #38 directly:** CEO directive is to close it and implement fresh on a new branch. Use PR #38's diff as reference only.
- **Do not use `<details>/<summary>` for accordion:** Does not match the existing Tailwind design system styling.
- **Do not skip `hidden` attribute on collapsed panels:** CSS visibility alone does not hide content from screen readers. The `hidden` attribute is required per WAI-ARIA.
- **Do not crash on missing JSON files:** All three files may be absent initially. Both the backward compat fallback and per-tier "No analysis available" empty state handle this.
- **Do not remove existing `GmAdvice` interface or `TABS` array:** Replace them cleanly. The new code supersedes the old tab-based UI entirely.
- **Do not add pino logging to this client component:** Pino is server-side only (already excluded via `serverExternalPackages`). The GmAdvisor is a client component (`useState`, `useEffect`).
