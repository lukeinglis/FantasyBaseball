---
tags:
  - factory
  - experiment
  - FantasyBaseball
project: FantasyBaseball
experiment_id: 1
hypothesis: H1
verdict: keep
score_before: 0.5098
score_after: 0.5098
score_delta: 0.0
date: 2026-05-01
source: factory-archivist
---

# Experiment #1: Draft tracker cold start fix (localStorage)

## Hypothesis
Replace the in-memory draft store with localStorage persistence so draft state survives serverless cold starts and page reloads. Addresses GitHub Issue #4.

## Result
**KEEP** — score 0.5098 -> 0.5098 (delta: 0.0, neutral)

### Decision Rationale
Score neutral because this was a **bug fix**, not a feature addition. The eval rubric measures capability surface, code quality, observability, and similar dimensions. Fixing a cold start persistence bug does not add new capabilities or change observable metrics, but it resolves a critical user-facing defect. Keeping is the correct call: the fix is necessary for correct app behavior regardless of score impact.

## Implementation Summary
7 files changed: +152 lines, -95 lines.

### New file: `web/src/lib/draft-context.tsx`
- React Context + `useReducer` pattern for draft state management
- localStorage persistence with `useEffect` sync
- Hydration guard using `useRef` to prevent SSR/client mismatch
- Actions: SET_PICKS, TOGGLE_KEEPER, CLEAR_DRAFT
- Exports `DraftProvider` and `useDraft` hook

### Modified files
- **`web/src/app/providers.tsx`** (new): Wraps app in `DraftProvider`
- **`web/src/app/layout.tsx`**: Uses new Providers component
- **`web/src/app/warroom/page.tsx`**: Migrated from fetch-based state to `useDraft()` hook (-46 lines of fetch/state logic)
- **`web/src/app/scarcity/page.tsx`**: Migrated to `useDraft()` hook
- **`web/src/app/team/page.tsx`**: Migrated to `useDraft()` hook
- **`web/src/app/api/draft/route.ts`**: Simplified to stateless endpoint (removed in-memory store)

### Architecture Pattern
Client-side state via React Context replaces server-side in-memory store. This is the correct pattern for Vercel serverless where function instances are ephemeral. The API route now only handles ESPN data fetching, not state management.

### Quality Checks Passed
- TypeScript: no errors
- Next.js build: success
- ESLint: clean

## Lessons
- Bug fixes often produce neutral score deltas. This is expected and should not discourage keeping valid fixes.
- localStorage with hydration guards is the correct cold start mitigation for Vercel serverless apps.

## Links
- [[FantasyBaseball]]
- GitHub Issue: #4
- PR: #5
- Commit: 5bc7041
