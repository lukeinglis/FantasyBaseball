---
tags:
  - factory
  - strategy
  - FantasyBaseball
date: 2026-05-01
phase: post-research
source: factory-archivist
---

# Strategy Snapshot: FantasyBaseball — 2026-05-01 (Post-Research)

## Research Phase Complete

CEO verdict: PROCEED. No issues found.

## Key Findings for Strategy Formation

### Fix Candidates
1. **Draft state persistence (Issue #3)**: localStorage pattern. Clear win, low risk.
2. **vs League redirect (Issue #2)**: Merge into H2H page. UI consolidation.

### Growth Candidates
1. **Monte Carlo matchup projections**: Replace deterministic lock percentages with continuous win probabilities. Client-side, ~50ms for 5K iterations.
2. **Today command center (backlog #4)**: Medium complexity, multiple data sources.
3. **H2H + vs League consolidation (backlog #14)**: UI merge, achievable.

### Foundation Work
- **Testing infrastructure**: vitest + MSW stack. Zero coverage currently. Priority: data transformations, edge cases, API routes.

## Strategist Guidance (from CEO)
- Prioritize Issues #2 and #3 as Fix hypotheses
- Include testing infrastructure
- At least one growth hypothesis targeting capability_surface
