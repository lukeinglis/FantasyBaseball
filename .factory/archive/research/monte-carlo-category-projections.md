---
tags:
  - factory
  - research
  - FantasyBaseball
  - projections
  - monte-carlo
project: FantasyBaseball
date: 2026-05-01
source: factory-archivist
---

# Research: Monte Carlo Category Projections

## Current Implementation
Deterministic projection in `web/src/app/gm/matchup/page.tsx`:
- Hard-coded DAILY_SD per category (H: 3, AVG: 0.012, ERA: 0.6, etc.)
- Rate stats use 1.4x variance multiplier
- Lock percentage based on gap vs remaining variance
- Discrete labels: Locked (90%), Likely (75%), Lean (55%), Toss-up, Behind, Unlikely, Lost

## Recommended Enhancement: Monte Carlo Simulation

**Counting stats** (HR, RBI, R, K, W, SB, SV):
- Model remaining production as N(projected_remaining, daily_sd * sqrt(days_remaining))
- Run 1,000-10,000 simulations
- Win probability = fraction where team A > team B

**Rate stats** (AVG, ERA, WHIP):
- Model remaining volume as uncertain
- Model rate as Beta (batting) or Gamma (pitching) distribution
- Combine volume and rate uncertainty in simulation

**Output:** Continuous 0-100% win probability per category (replaces discrete labels)

**Performance:** Client-side in ~50ms for 5,000 iterations across 10 categories.

## Advanced Options (Future)
- Correlation-aware simulation (H/AVG, HR/R/RBI, ERA/WHIP)
- Schedule-weighted projections (opponent quality, park factors)
- Standings Gain Points (SGP) for roto-style trade valuation

## Sources
- [FanGraphs Punting Analysis (Monte Carlo)](https://fantasy.fangraphs.com/punting-theres-no-punting-in-baseball/)
- [FTN Fantasy VDP Projections](https://ftnfantasy.com/mlb/fantasy-baseball-2025-how-to-use-vdp-projections)
- [Monte Carlo MLB Simulation (GitHub)](https://github.com/snoozle-software/monte-carlo-mlb)
- [Razzball Dynamic Projections](https://razzball.com/fantasy-baseball-tools/)
