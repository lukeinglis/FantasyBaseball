---
tags:
  - factory
  - strategy
  - research
  - FantasyBaseball
date: 2026-05-01
cycle: 2
source: factory-archivist
---

# Research Snapshot: FantasyBaseball — Cycle 2

## Context
Entering cycle 2 with score 0.5848 (after 2 experiments: draft localStorage fix, Vitest infrastructure). Threshold: 0.7. Remaining weak dimensions: capability_surface (0.28), observability (0.41), coverage (0.5), lint (0.9, 1 error). Active branch: `experiment/4-h2h-consolidation`.

## Research Coverage (4 areas)

### 1. Pino Structured Logging
- Recommended library: Pino (not Winston — no sync transports blocking event loop)
- Next.js App Router caveat: must add to `serverComponentsExternalPackages` to prevent webpack bundling
- AsyncLocalStorage does NOT propagate from Middleware to Route Handlers (Next.js open issue #67305) — use per-handler `reqId = crypto.randomUUID()` instead
- 117 `console.*` calls to replace: priority `espn.ts` > API routes > `data.ts`
- Target: observability 0.41 → 0.7

### 2. Vitest Coverage
- Provider: `@vitest/coverage-v8` (AST-based remapping since v3.2.0, Istanbul-equivalent)
- One package install + 8 lines of config + one `coverage` script
- Exclude `src/app/**` (Next.js pages not unit-testable with Vitest)
- Target: coverage 0.5 → ~0.7

### 3. H2H All-Play Record
- Types already defined in `h2h/page.tsx` (lines 26-43)
- Matchup-level all-play: simulate vs every team per week, aggregate W-L-T
- Client-side computation over existing `LeagueStatsData` — zero new API calls
- Tie rule: catWins === catLosses → matchup tie (confirm vs ESPN rounding for rate stats)

### 4. Monte Carlo Category Projections
- Drop-in replacement for existing lock percentage step (not a rewrite)
- Box-Muller normal sample, no external dependencies
- 5000 iterations × 10 categories ≈ 5-15ms client-side
- DAILY_SD constants already defined in matchup page
- Normal is sufficient for V1; Poisson better for SV/W (low-count, 1-3/week) as V2
- Independent per-category for V1 (~5% error in edge cases); correlation matrix in V2

## Recommended Priority Order for Strategist
1. Coverage tooling (@vitest/coverage-v8) — one install, fixes eval gap
2. Pino structured logging — observability from 0.41 to target 0.7
3. Monte Carlo matchup projections — self-contained upgrade, no new deps
4. Scoreboard category rankings — data already fetched, low complexity
5. H2H all-play — types pre-defined, client-side computation only

## CEO Verdict
PROCEED — research grounded and actionable, specific implementation details provided, no calendar estimates.

## New Backlog Items Identified
- [Fix] Add @vitest/coverage-v8 and coverage script (prerequisite for coverage dimension)
- [New] Poisson distribution option for low-count categories in Monte Carlo (V2 follow-on)
