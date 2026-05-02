---
tags:
  - factory
  - research
  - FantasyBaseball
  - backlog
project: FantasyBaseball
cycle: 3
date: 2026-05-01
source: factory-archivist
---

# Research: Backlog Deduplication (Cycle 3)

## Finding

Original backlog had 15 items. Analysis:
- **5 completed** by merged PRs #9, #23, #21, #19, #25
- **4 duplicates** (Bullpen x2, Free Agents x3, Trade Room x2, My Roster x2)
- **5 unique remaining** after dedup

## Completed Items (remove)

| Item | Completed By |
|---|---|
| Category Breakdown: default to full season data | PR #9 |
| Today: daily command center | PR #23 |
| Matchup: prediction with Monte Carlo | PR #21 |
| Scoreboard: per-category team ranking | PR #19 |
| Schedule: matchup strength indicator | PR #25 |

## Deduplicated Backlog (5 items)

1. **[Exploit] Bullpen** (/gm/bullpen): Double-starter ID, accurate starts tracking, streaming targets
2. **[Exploit] Free Agents** (/gm/free-agents): Weakness-aware FA recommendations, z-score gap cross-reference
3. **[Exploit] Trade Room** (/gm/trade): Surplus detection, sell-high candidates, gap analysis
4. **[Exploit] My Roster** (/gm/roster): Full stat breakdowns, z-score detail by category
5. **[Explore] GM Advisor** (/gm/roster): Three-tier cached AI analysis

## Actions Taken

- Issue #3 closed (already fixed by PR #5)
- Issue #2 left open (requires manual CSV data entry, not a code change)
