---
tags:
  - factory
  - experiment
  - FantasyBaseball
project: FantasyBaseball
experiment_id: "014"
verdict: keep
score_before: 0.6468
score_after: 0.6326
score_delta: -0.0142
date: 2026-05-01
source: factory-archivist
---

# Experiment #014: Bullpen streaming pitcher intelligence

## Hypothesis
Add streaming pitcher intelligence to the Bullpen page: Double Starters identification, Streaming Targets recommendations, and a Starts Tracker for weekly SP start limits. This expands capability_surface with a high-value feature for H2H category managers.

## Result
**KEEP (CEO override)** — score 0.6468 → 0.6326 (delta: -0.0142)

### Decision Rationale
Score regression (-0.0142) came from factory meta-dimensions (experiment_diversity, factory_effectiveness), not from code quality degradation. The feature itself is solid: 13 new tests pass, lint clean, type-check clean. CEO overrode the negative delta because the regression reflects scoring methodology artifacts, not actual code quality issues.

## What Changed
- **Double Starters section**: Identifies pitchers with two starts in the current matchup week
- **Streaming Targets section**: Recommends streamable pitchers based on matchup quality
- **Starts Tracker**: Monitors weekly SP start counts against league limits
- **13 new tests**: Full coverage of the three new Bullpen features via Vitest + MSW

## Files Changed
- Bullpen page components (streaming intelligence UI)
- Test files (13 new test cases)
- PR #29 merged

## Lessons
- Negative score deltas can originate from factory meta-dimensions (diversity, effectiveness) rather than code issues. CEO override is appropriate when the code itself is sound.
- Streaming pitcher intelligence is a natural extension of the Bullpen page, grouping related pitcher management features together.

## Links
- [[FantasyBaseball]]
- Branch: experiment/14-bullpen-streaming
- PR: #29
- Commit: c0bdec8
