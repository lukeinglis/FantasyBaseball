---
name: FantasyBaseball Strategy Snapshot — 2026-05-01
description: CEO-approved cycle 2 strategy with 8 hypotheses targeting lint, coverage, observability, and capability_surface
type: project
tags:
  - factory
  - strategy
  - FantasyBaseball
date: 2026-05-01
source: factory-archivist
project: FantasyBaseball
cycle: 2
hypotheses_approved: 8
ceo_verdict: PROCEED
---

# Strategy: FantasyBaseball — 2026-05-01

## Context

- Composite score: 0.6122 (threshold: 0.7, gap: 0.0878)
- Eval weights: 40% hygiene, 20% growth, 40% project eval
- Cycle 2 baseline: 4 experiments all kept (draft fix, vitest/MSW, category scope + rank trends, H2H 3-tab consolidation)
- Score progression to date: 0.5098 → 0.6122 (+0.1024 across 4 kept experiments)
- CEO verdict: PROCEED — all 8 hypotheses approved, no issues found

## Eval Gaps Targeted

| Dimension | Current | Target | Gap |
|---|---|---|---|
| lint | 0.9 | 1.0 | 1 error in warroom/page.tsx |
| coverage | 0.5 | 0.7+ | no coverage tool installed |
| observability | 0.41 | 0.7 | no structured logging, no request tracing |
| capability_surface | 0.28 | 0.4+ | weakest growth dimension |

## Approved Hypotheses

### H1: Fix lint error in warroom/page.tsx
- **Category:** FIX
- **Priority:** high
- **What:** Extract `SortTh` to module scope (react/no-unstable-nested-components); replace unescaped apostrophes/quotes with `&apos;`/`{'"'}` (react/no-unescaped-entities)
- **Expected impact:** lint 0.9 → 1.0

### H2: Add @vitest/coverage-v8 and coverage script
- **Category:** FIX
- **Priority:** high
- **What:** Install `@vitest/coverage-v8`, add v8 coverage config to `web/vitest.config.mts`, add `coverage` script to `web/package.json`, add `web/coverage/` to `.gitignore`
- **Expected impact:** coverage 0.5 → 0.7+

### H3: Add pino structured logging with per-request tracing
- **Category:** EXPLOIT
- **Growth dimension:** observability
- **Priority:** high
- **What:** Install `pino`/`pino-pretty`, create `web/src/lib/logger.ts` singleton, add `serverExternalPackages` to `next.config.ts`, replace `console.log`/`console.error` in `espn.ts` and Route Handlers with structured pino calls including `{ reqId, op, durationMs, endpoint }` fields. Server-side only.
- **Expected impact:** observability 0.41 → 0.7, api_reliability +0.05

### H4: Add per-category team rankings to Scoreboard page
- **Category:** EXPLOIT
- **Growth dimension:** capability_surface
- **Priority:** high
- **What:** Add "Category Rankings" section to `/league/scoreboard/page.tsx` — heatmapped grid ranking all 10 teams per category, highlight user's team row. Sanitize NaN/Infinity/null. Add 2 Vitest tests for ranking and tie-handling.
- **Expected impact:** capability_surface +0.03, edge_case_handling +0.02

### H5: Monte Carlo category win probabilities on Matchup page
- **Category:** EXPLOIT
- **Growth dimension:** capability_surface
- **Priority:** medium
- **What:** `web/src/lib/monte-carlo.ts` — 5,000-iteration Box-Muller simulation; replace deterministic lock% labels with 0-100% per-category win probability. Guard days_remaining <= 0, NaN, Infinity. Add 3 Vitest tests.
- **Expected impact:** capability_surface +0.04, type_safety +0.03

### H6: Enhance Today page as daily command center
- **Category:** EXPLOIT
- **Growth dimension:** capability_surface
- **Priority:** medium
- **What:** Three sections on `/gm/today/page.tsx`: Category Status (winning/losing categories with margin), Today's Starters (confirmed starters with season stats), Action Items (benched eligible players ranked by projected contribution). Roster-only scope, no FA. Vitest tests for sorting logic.
- **Expected impact:** capability_surface +0.05

### H7: Add matchup strength indicator to Schedule page
- **Category:** EXPLOIT
- **Growth dimension:** capability_surface
- **Priority:** medium
- **What:** "Matchup Difficulty" badge on `/league/schedule/page.tsx` — z-score gap `mean(opp_z[cat] - my_z[cat])`, color-coded green/yellow/red, tooltip with top 2 driving categories. Guard null z-scores as 0. Add 1 Vitest test.
- **Expected impact:** capability_surface +0.02

### H8: Expand GM Advisor to three-tier cached analysis
- **Category:** EXPLORE
- **Growth dimension:** capability_surface
- **Priority:** low
- **What:** Three JSON files: `gm-advice-week.json`, `gm-advice-month.json`, `gm-advice-season.json`. Collapsible sections in `/gm/roster/page.tsx` with Refresh buttons. Null guard on JSON load. Update `gm-advice` skill for all three time horizons.
- **Expected impact:** capability_surface +0.03

## Execution Order (per CEO)

H1 → H2 → H3 → H4 → (H5 → H6 → H7 → H8 if time permits)

## Anti-patterns to Avoid

- Do not revisit Category Breakdown (Exp 3) or H2H consolidation (Exp 4)
- Do not use localStorage beyond draft state
- Do not test async Next.js server components with Vitest
- Do not mock ESPN data in a way that could be confused with real data
- Do not add pino to client components or test files
- Do not introduce calendar-time estimates in hypothesis text

## New Backlog (deferred from this cycle)

- [Exploit] Bullpen (/gm/bullpen): streaming pitcher intelligence, double-starter identification
- [Exploit] Free Agents (/gm/free-agents): weakness-aware FA recommendations, FAR scores, projected double-starters
- [Exploit] Trade Room (/gm/trade): surplus detection, sell-high candidates, gap analysis, metric arbitrage
- [Exploit] My Roster (/gm/roster): full stat breakdowns, z-score detail by category, performance trends
