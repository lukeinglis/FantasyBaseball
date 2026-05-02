---
tags:
  - factory
  - strategy
  - FantasyBaseball
date: 2026-05-01
cycle: 3
phase: strategy
source: factory-archivist
---

# Strategy: FantasyBaseball Cycle 3, 2026-05-01

## Context

Composite score: 0.6468, threshold: 0.7, gap: 0.0532. Eval script is blind to JS/TS (scans only .py). 74 lint errors remain. Backlog deduped to 5 unique items. 11 experiments run, 100% keep rate.

## Approved Hypotheses (7 of 8)

H3 was removed by CEO (already completed during cycle 2 by CEO directly).

| ID | Hypothesis | Category | Growth Dim | Priority | Expected Impact |
|----|-----------|----------|------------|----------|-----------------|
| H1 | Fix eval/score.py to scan JS/TS files | FIX | tests, coverage, observability, capability_surface | critical | +0.15 to +0.20 composite |
| H2 | Fix 74 lint errors across project | FIX | lint | high | lint score 0.0 to 1.0, +0.075 composite |
| H4 | Bullpen Usage Analyzer page | EXPLOIT | capability_surface | medium | cap_surface +0.02 |
| H5 | Free Agent Finder page | EXPLOIT | capability_surface | medium | cap_surface +0.02 |
| H6 | Trade Room page | EXPLOIT | capability_surface | medium | cap_surface +0.02 |
| H7 | My Roster page | EXPLOIT | capability_surface | medium | cap_surface +0.02 |
| H8 | GM Advisor enhancements | EXPLOIT | capability_surface | low | cap_surface +0.01 |

## Execution Order

CEO approved: H1 first (highest leverage, unlocks score visibility), H2 second (quick lint cleanup), then H4 through H8 as backlog clearing.

## Rationale

- **H1 is the single highest-leverage fix**: patching eval to scan JS/TS should unlock 0.15+ composite points immediately by making tests, coverage, observability, and capability_surface visible to the scoring framework.
- **H2 is quick hygiene**: 74 lint errors are mostly `no-explicit-any` and React Compiler violations. Fixing them should push lint from ~0.0 to 1.0.
- **H4-H8 are backlog clearing**: each adds a new page/feature, incrementally growing capability_surface. These were deduped from the original 15-item backlog down to 5 unique items in cycle 3 research.

## Key Decisions

1. H3 (Pino structured logging) removed from cycle 3 because CEO already implemented it during cycle 2.
2. Backlog items (H4-H8) are treated as lower priority than eval/lint fixes since the fixes have higher expected composite impact.
3. All hypotheses target the 0.0532 gap to threshold. H1 + H2 alone should close or exceed it.

## CEO Verdict

PROCEED. All 7 hypotheses approved. H1 first, H2 second, then backlog.
