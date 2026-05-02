---
tags:
  - factory
  - experiment
  - FantasyBaseball
project: FantasyBaseball
experiment_id: 4
hypothesis: H6
verdict: keep
score_before: 0.5848
score_after: 0.6122
score_delta: +0.0274
date: 2026-05-01
source: factory-archivist
---

# Experiment #4: H2H Consolidation with All-Play Record

## Hypothesis
Consolidate the vs League page and Team H2H page into a unified H2H page with 3 tabs (This Week, Season H2H, All-Play Record). Remove dead vs League nav link. Add all-play record computation from existing league stats data.

## Result
**KEEP** — score 0.5848 → 0.6122 (+0.0274)

### Decision Rationale
Score improvement driven by `experiment_diversity` dimension reaching 3 distinct categories (bugfix, testing, feature) in the last 4 experiments. The all-play record computation is a new analytical capability. Removing the dead nav link and consolidating pages reduces UI surface debt. Full backlog clearance noted (vs League redirect + H2H enhancement items both resolved).

## Implementation Summary
7 files changed. Rebuilt H2H page with 3-tab interface on branch `experiment/4-h2h-consolidation`.

### New components
- **`SeasonH2HView`**: Displays historical matchup record with win/loss coloring
- **`AllPlayView`**: Renders all-play record computed from LeagueStatsData

### Architecture
- All-play computation done client-side over existing `LeagueStatsData` — no new API calls needed
- `allPlay` types were already defined in `h2h/page.tsx` (lines 26-43); this experiment implemented the computation
- `safe()` sanitizer applied throughout to guard against NaN/Infinity in category math
- Matchup-level all-play: each week, simulate matchup against every other team; win = catWins > catLosses

### Tie handling
Category tie when values exactly equal. Matchup tie when catWins === catLosses. Aligns with ESPN behavior for exact-value categories (note: ESPN rounds some rate stats, future work to verify).

## Quantitative Impact
| Dimension              | Before  | After   | Delta   |
|------------------------|---------|---------|---------|
| experiment_diversity   | lower   | 0.6857  | +       |
| Overall                | 0.5848  | 0.6122  | +0.0274 |

## Lessons
- Types-first implementation (types defined in cycle 1) dramatically lowers the effort to implement the computation in cycle 2
- All-play computation can be fully client-side if league stats data is already fetched — no API changes needed
- Experiment diversity dimension rewards mixing bugfix/testing/feature experiment types across cycles

## Links
- [[FantasyBaseball]]
- Issue: #10
- PR: #11
- Branch: experiment/4-h2h-consolidation
