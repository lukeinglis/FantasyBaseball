---
tags:
  - factory
  - research
  - FantasyBaseball
  - h2h
  - allplay
project: FantasyBaseball
date: 2026-05-01
cycle: 2
source: factory-archivist
---

# Research: H2H All-Play Record Calculation

## Summary
The H2H page already had `allPlay` types defined. The missing piece was the computation. Cycle 2 implemented matchup-level all-play: each week, simulate matchup against every other team; season record = aggregate of all simulated matchups.

## Key Findings

### Two Valid Interpretations
**Option A — Matchup-level all-play** (implemented): Each week, simulate a matchup against every other team. Win if catWins > catLosses. For 10-team league: 9 simulated matchups/week × 18 weeks = 162 total simulated matchups per season.

**Option B — Category-level all-play**: Each week, for each category, rank all teams. Win = teams beaten. More granular, harder to present as a simple W-L record. Not selected — doesn't fit the existing `AllPlayWeek` type.

### Computation Pattern
```ts
function computeAllPlayWeek(
  myStats: Record<string, number>,
  allTeams: TeamCategoryStats[],
  myTeamId: number
): AllPlayWeek {
  let wins = 0, losses = 0, ties = 0;
  for (const opp of allTeams) {
    if (opp.teamId === myTeamId) continue;
    let catWins = 0, catLosses = 0;
    for (const cat of ALL_CATS) {
      const mine = safe(myStats[cat]);
      const theirs = safe(opp.categories[cat]);
      const lowerIsBetter = LOWER_IS_BETTER.has(cat);
      if (lowerIsBetter ? mine < theirs : mine > theirs) catWins++;
      else if (lowerIsBetter ? mine > theirs : mine < theirs) catLosses++;
    }
    if (catWins > catLosses) wins++;
    else if (catLosses > catWins) losses++;
    else ties++;
  }
  return { week, wins, losses, ties };
}
```

### Data Source
Client-side computation over existing `LeagueStatsData` — no new API calls. The `allPlay` interface was pre-defined in `h2h/page.tsx` (lines 26-43) from cycle 1.

### Tie Handling
Category tie = values exactly equal. Matchup tie = catWins === catLosses. Future work: verify against ESPN's actual tie rule for rate stats (ESPN rounds some categories).

## Sources
- ESPN: Scoring Formats (support.espn.com)
- FanGraphs: Best Settings for Your League
- Oddsmyth: H2H vs Roto scoring explained
