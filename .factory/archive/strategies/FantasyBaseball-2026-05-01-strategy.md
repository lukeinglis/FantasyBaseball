---
tags:
  - factory
  - strategy
  - FantasyBaseball
date: 2026-05-01
source: factory-archivist
---

# Strategy: FantasyBaseball, 2026-05-01

## Context
- Composite score: 0.5098 (threshold: 0.7)
- Eval weights: 40% hygiene, 20% growth, 40% project eval
- Weakest dimensions: research_grounding (0.0), capability_surface (0.28), observability (0.41)
- First Improve cycle: zero experiments run previously
- 2 open GitHub issues from owner: #3 (draft state cold start), #2 (historical draft data)

## Strategy Decisions

### Hypotheses Generated: 11
The strategist produced 11 hypotheses spanning FIX (5), EXPLOIT (5), and EXPLORE (1).

### CEO Approved Top 6 (priority order)

1. **H1: Fix draft tracker cold start with localStorage persistence** (FIX)
   - Addresses GitHub #3
   - Replace in-memory draft store with localStorage-backed React context
   - Expected: api_reliability +0.15, edge_case_handling +0.05

2. **H4: Set up Vitest + MSW testing infrastructure** (FIX)
   - Zero test coverage is the biggest project eval gap
   - vitest, MSW, testing-library stack
   - Expected: tests 0.5 to 0.75, coverage 0.5 to 0.65

3. **H3: Fix Category Breakdown and Category Rank data scope** (FIX)
   - Two pages showing wrong timeframe data
   - Add tab toggle for cumulative vs weekly view
   - Expected: edge_case_handling +0.05, capability_surface +0.02

4. **H6: Consolidate vs League + Team H2H with All-Play Record** (EXPLOIT)
   - Merge three backlog items into one tabbed page
   - This Week H2H, Season H2H, All-Play Record tabs
   - Expected: capability_surface +0.04

5. **H5: Add structured logging with pino** (FIX)
   - Replace 117 console.log/error calls with pino structured logging
   - Add request ID tracing
   - Expected: observability 0.41 to 0.7

6. **H2: Add historical draft results 2015-2018** (FIX)
   - Addresses GitHub #2
   - CSV fallback for pre-2019 seasons
   - Expected: edge_case_handling +0.05

### Deferred to Backlog (H7-H11)
- H7: Monte Carlo category projections (medium priority)
- H8: Per-category team rankings on Scoreboard (medium priority)
- H9: Enhance Today page as daily command center (medium priority)
- H10: Matchup strength indicator on Schedule (medium priority)
- H11: Expand GM Advisor with three-tier analysis (low priority)

### Additional Backlog Items (not addressed this cycle)
- Bullpen streaming intelligence
- Free Agents weakness-aware recommendations
- Trade Room surplus detection
- My Roster deeper analysis

## CEO Verdict
**PROCEED (with prioritization)**
- 11 hypotheses is ambitious; execute in priority order, stop when time/context allows
- No issues with hypothesis quality
- Growth dimension coverage confirmed: H3 (capability_surface), H5 (observability), H6 (capability_surface)
- At least 2 growth hypotheses in top 6
- Execute H1 first: draft state fix is the most critical user-facing bug

## Anti-patterns Noted
- No database for draft state: localStorage is the right solution
- No mocking ESPN data in ways confused with real data
- No async server component tests with Vitest: use for data transformations and API routes only
- No calendar-time estimates: scope by complexity, not duration
