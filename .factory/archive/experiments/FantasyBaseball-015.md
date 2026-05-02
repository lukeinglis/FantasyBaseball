---
tags:
  - factory
  - experiment
  - FantasyBaseball
project: FantasyBaseball
experiment_id: "015"
verdict: keep
score_before: 0.6326
score_after: null
score_delta: null
date: 2026-05-01
source: factory-archivist
---

# Experiment #015: Weakness-aware Free Agent recommendations

## Hypothesis
Enhance the Free Agents page with weakness-aware recommendations: analyze team category weaknesses and surface free agents who address the biggest gaps. Expands capability_surface with targeted roster improvement advice.

## Result
**KEEP** — backlog item cleared, feature adds meaningful analytical depth

## What Changed
- **Weakness analysis**: Identifies team category weaknesses via z-score gaps
- **Targeted FA recommendations**: Surfaces free agents who address the team's weakest categories
- **New utility module**: `free-agent-recs.ts` (88 lines) with recommendation logic
- **Test coverage**: `free-agent-recs.test.ts` (149 lines) with full test suite
- **3 files changed**: 458 insertions, 43 deletions

## Files Changed
- `web/src/app/gm/free-agents/page.tsx` (264 lines modified)
- `web/src/lib/free-agent-recs.ts` (88 lines, new)
- `web/src/tests/free-agent-recs.test.ts` (149 lines, new)

## Links
- [[FantasyBaseball]]
- Branch: experiment/15-free-agents-weakness
- PR: #32
- Commit: f4fbc6f
