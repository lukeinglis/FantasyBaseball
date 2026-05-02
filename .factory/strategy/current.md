## Strategy — 2026-05-01 (Cycle 3)

### Observations
- Current composite score: 0.6468 (threshold: 0.7, gap: 0.0532)
- Eval weights: 40% hygiene, 20% growth, 40% project eval
- Score progression: 0.5098 -> 0.6122 -> 0.6468 (11 experiments, 100% keep rate)
- Hygiene: tests 1.0, type_check 1.0, lint 0.9, coverage 0.5 (not detected), guard_patterns 0.7, config_parser 1.0
- Growth: capability_surface 0.28 (weakest overall), observability 0.406, experiment_diversity 1.0, research_grounding 0.0 (vault unconfigured), factory_effectiveness 0.6
- **Critical eval bug:** `eval/score.py` `eval_observability()` scans only `*.py` files. This JS/TS project has zero Python sources, so it always returns 0.0. Pino structured logging IS deployed (experiment 7) but invisible to eval. `eval_syntax_check()` runs `true` (no-op).
- **Lint reality:** 74 errors, not "1 error". Breakdown: 51 `no-explicit-any`, 18 `no-unused-vars` (warnings), 4 `react-hooks/set-state-in-effect`, 1 `no-unescaped-entities`, 1 `prefer-const`. Spread across 19 files, concentrated in API routes and bullpen page. The eval reports "1 error" because `factory.md` eval_command pipes through `tail -5`.
- **Coverage reality:** 97 Vitest tests pass, v8 coverage at 51.75% statement coverage, but eval reports 0.5/"not detected" because no eval dimension exercises it.
- **Backlog:** 5 unique items after CEO-confirmed deduplication (Bullpen, Free Agents, Trade Room, My Roster, GM Advisor). Prior cycle completed Category Breakdown, Today, Matchup, Scoreboard, Schedule.
- **GitHub:** Issue #3 already fixed by PR #5 (needs closing). Issue #2 is manual data entry (out of scope).
- **CEO priorities:** (1) Fix eval/score.py for JS/TS, (2) Fix 74 lint errors, (3) Clear backlog
- Pattern: Project has shipped real improvements (pino, vitest, coverage, 5 feature pages) but the eval cannot measure them. Fixing eval infrastructure is the highest-leverage action to close the 0.053 gap.

### Design Space
| Dimension | Score | Notes |
|---|---|---|
| Features | 4 | Today, Matchup, Scoreboard, Schedule, H2H all enhanced in cycles 1-2 |
| Bug fixes | 4 | Draft cold start, category scope, proTeamId truthiness all resolved |
| Instrumentation | 3 | Pino deployed across all API routes, but eval cannot detect it |
| Flow changes | 2 | H2H 3-tab consolidation was the only architectural change |
| New agents | 0 | N/A for this project |
| Prompt engineering | 0 | N/A for this project |
| Eval improvements | 1 | eval/score.py is fundamentally broken for JS/TS: scans *.py only |
| Knowledge management | 0 | No vault configured |
| Infrastructure | 3 | Vitest + MSW + coverage-v8 fully operational, 97 tests |
| Operational execution | 0 | No pipeline runs needed |
| Self-evolution | 1 | Eval script needs rewrite to match project language |

**Underserved:** Eval improvements (1), Self-evolution (1), remaining capability features

### Hypotheses

#### H1: Rewrite eval/score.py to scan JS/TS files and detect pino structured logging
- **Category:** FIX
- **Type:** code
- **New:** (eval infrastructure is broken for JS/TS projects)
- **What:** Rewrite `eval/score.py` in two parts: (1) Replace `eval_syntax_check()` (which runs `true`) with a real TypeScript check: `cd web && npx tsc --noEmit`. Parse exit code for pass/fail, count error lines for partial scoring. (2) Rewrite `eval_observability()` to glob `*.ts`, `*.tsx`, `*.js`, `*.jsx` instead of `*.py`. Replace Python `ast.parse` function detection with regex: `function\s+\w+`, `const\s+\w+\s*=\s*(async\s+)?\(`, `export\s+(default\s+)?(async\s+)?function`. Keep existing `log_pats`, `struct_pats` (already includes `\bpino\b`), and `trace_pats` arrays. Update weights to split evenly between the two real dimensions. Add `eval/**` to the modifiable scope in `factory.md`.
- **Why:** The eval scans zero source files because it only globs `*.py`. Pino structured logging and request tracing are already deployed (experiment 7) but invisible. This single fix should move the factory's observability detection from broken to functional. `eval_syntax_check` running `true` wastes 83% of the eval weight on a no-op.
- **Expected impact:** observability 0.406 -> 0.7+ (factory heuristic aligns with actual codebase), factory_effectiveness 0.6 -> 0.65+
- **Growth dimension:** factory_effectiveness
- **Priority:** high

#### H2: Fix 74 lint errors with ESPN API response types
- **Category:** FIX
- **Type:** code
- **New:** (lint has 74 real errors, not "1")
- **What:** (1) Create `web/src/types/espn.ts` with typed interfaces for ESPN API responses: roster entries, matchup data, scoreboard results, standings rows, player stats, schedule data. (2) Replace `any` with these types at API boundaries in all 19 affected files: cast `(await res.json()) as EspnRosterResponse` etc. This kills 51 `no-explicit-any` errors. (3) Remove 18 unused variable declarations. (4) Fix 1 `prefer-const` and 1 `no-unescaped-entities` in strategy/page.tsx. (5) Address 4 `react-hooks/set-state-in-effect` by wrapping setState calls in proper async patterns. Verify `npx eslint src/` returns zero errors after all fixes.
- **Why:** Lint is reported at 0.9 but has 74 real errors (truncated by `tail -5` in eval_command). The `no-explicit-any` errors are concentrated in API route handlers where ESPN responses flow in untyped. A shared types file kills 51 errors while genuinely improving type_safety (project eval dimension). The remaining 23 are mechanical. Cross-project insights show bugfix has 100% keep rate.
- **Expected impact:** lint 0.9 -> 1.0, type_safety (project eval) significant improvement, edge_case_handling +0.05
- **Priority:** high

#### H3: Close GitHub issue #3 (already fixed by PR #5)
- **Category:** FIX
- **Type:** operational
- **New:** (housekeeping)
- **What:** Close GitHub issue #3 ("War room draft tracker resets on page reload") with a comment referencing PR #5 which shipped localStorage persistence.
- **Execution step:** `gh issue close 3 --comment "Fixed by PR #5: draft state now persists via localStorage."`
- **Expected output:** Issue #3 transitions to Closed state on GitHub
- **Why:** Issue was fixed in cycle 1 (experiment 1) but never closed. CEO flagged this explicitly.
- **Expected impact:** No eval impact, project hygiene
- **Priority:** high

#### H4: Bullpen streaming pitcher intelligence
- **Category:** EXPLOIT
- **Type:** code
- **Backlog item:** [Exploit] Bullpen (/gm/bullpen): Elevate streaming pitcher intelligence. Prioritize double-starter identification, accurate starts tracking, and streaming targets for current + next week.
- **What:** Enhance `/gm/bullpen/page.tsx` with three sections: (1) **Double Starters** listing pitchers with 2+ scheduled starts in the current scoring period, sourced from the existing probable pitchers API data. (2) **Streaming Targets** showing available FA pitchers with favorable upcoming matchups, ranked by opponent team batting z-scores (lower opponent z = better streaming target). (3) **Starts Tracker** showing team starts used vs. league limit with a progress bar. Cross-reference with existing `/api/espn/starts` route data. Sanitize all inputs for NaN/Infinity/null/division-by-zero. Add Vitest tests for double-starter detection logic and streaming target ranking.
- **Why:** Bullpen is described as a "core team strategy pillar" in the backlog. The existing page has basic pitcher data but no streaming intelligence. Double-starter identification is the single most valuable streaming insight in H2H categories leagues. All required data is already available from existing API routes.
- **Expected impact:** capability_surface +0.04, test_coverage +0.01
- **Growth dimension:** capability_surface
- **Priority:** medium

#### H5: Free Agents weakness-aware recommendations
- **Category:** EXPLOIT
- **Type:** code
- **Backlog item:** [Exploit] Free Agents (/gm/free-agents): Add weakness-aware FA recommendations. Cross-reference team z-score gaps with FA metrics and FAR scores. Highlight projected double-starters for following week.
- **What:** On `/gm/free-agents/page.tsx`, add a "Recommended" section at the top: (1) fetch user's team z-scores per category from the existing z-scores API, (2) identify the 3 weakest categories, (3) rank available free agents by their contribution to those weak categories using existing FAR scores and per-stat z-scores. Add a "Streaming Pitchers" toggle filtering to pitchers sorted by opponent quality for the next 7 days. Highlight players with 2+ starts in the upcoming period. Guard against empty FA pools, missing z-scores, division by zero. Add Vitest tests for the weakness-gap ranking algorithm.
- **Why:** The free agents page shows all players without context. Cross-referencing team weaknesses with FA strengths is the core value: "which FA helps my team the most right now?" Z-score infrastructure already exists. Cross-project insights show feature experiments have 100% keep rate.
- **Expected impact:** capability_surface +0.04, edge_case_handling +0.02
- **Growth dimension:** capability_surface
- **Priority:** medium

#### H6: Trade Room surplus detection and gap analysis
- **Category:** EXPLOIT
- **Type:** code
- **Backlog item:** [Exploit] Trade Room (/gm/trade): Add surplus detection, sell-high candidates from own roster, gap analysis vs opposing rosters, and metric arbitrage identification.
- **What:** Enhance `/gm/trade/page.tsx` with: (1) **Surplus Detector** identifying categories where team ranks top-3 in the league, flagging highest-contributing players as trade chips. (2) **Gap Analysis** showing per-opponent category differentials, highlighting potential trade partners (opponents strong where user is weak). (3) **Sell-High Candidates** listing own-roster players whose recent 30-day z-scores exceed season z-scores by >0.5 SD. (4) **Metric Arbitrage** flagging players where team z-score ranking differs significantly from ESPN's default rank (undervalued by other managers). Sanitize all z-score comparisons. Add Vitest tests for surplus detection and sell-high identification.
- **Why:** Trade analysis combines team z-scores, league rankings, and player performance trends, all of which exist in the API layer. Most analytically complex remaining backlog item but uses only existing data sources. High user value for in-season management.
- **Expected impact:** capability_surface +0.05, test_coverage +0.01
- **Growth dimension:** capability_surface
- **Priority:** medium

#### H7: My Roster deep stat breakdown with z-score detail
- **Category:** EXPLOIT
- **Type:** code
- **Backlog item:** [Exploit] My Roster (/gm/roster): Deeper roster analysis with full stat breakdowns, z-score detail by category, and performance trends.
- **What:** On `/gm/roster/page.tsx`, add expandable player rows with: (1) **Full Stats** showing all counting and rate stats for the season. (2) **Z-Score Breakdown** per-category z-scores with league percentile (e.g., "HR z: 1.2, top 15%"). (3) **Trend Sparklines** using inline SVG showing last-4-weeks performance per key stat. Fetch z-score data from existing `/api/analysis/z-scores` endpoint. Color code: green z > 0.5, red z < -0.5, neutral otherwise. Guard against missing stats, empty arrays, null z-scores. Add Vitest tests for percentile calculation and trend direction logic.
- **Why:** The roster page is the "deepest dive" page per backlog. Players' z-score contributions are computed server-side but not exposed in detail. This transforms the roster from a list into an analytical tool.
- **Expected impact:** capability_surface +0.03, edge_case_handling +0.02
- **Growth dimension:** capability_surface
- **Priority:** medium

#### H8: GM Advisor three-tier cached analysis
- **Category:** EXPLORE
- **Type:** code
- **Backlog item:** [Explore] GM Advisor on My Roster (/gm/roster): Add three-tier cached AI analysis sections.
- **What:** Update `/gm/roster/page.tsx` to load from three static JSON files: `web/public/gm-advice-week.json`, `web/public/gm-advice-month.json`, `web/public/gm-advice-season.json`. Render each as a collapsible accordion section ("This Week", "Next 30 Days", "Win the League"). Update the existing `gm-advice` Claude Code skill to generate all three files with escalating analysis depth and harsh top-GM tone. If a JSON file is missing or malformed, render an inline prompt to run the skill instead of crashing. Add null guards and error boundaries.
- **Why:** Single-tier GM Advisor already exists and works. Three tiers add strategic depth across time horizons with zero API cost (skill-based generation, static JSON). Scaffolding is partially built. Lowest priority because it depends on skill infrastructure and has the least analytical impact compared to other backlog items.
- **Expected impact:** capability_surface +0.03
- **Growth dimension:** capability_surface
- **Priority:** low

### Anti-patterns to Avoid
- **Do not scan `*.py` in eval_observability():** Entire project is JS/TS. Prior eval returned 0.0 because no Python sources exist.
- **Do not use `tail -5` for lint eval:** Truncates 74 errors to "1 error". Need the full summary line.
- **Do not bulk-convert `any` to `unknown` with auto-fix:** Creates cascading type errors. Define proper interfaces and cast at API boundaries.
- **Do not mock ESPN data in ways confused with real data:** Project guard.
- **Do not add pino to client components:** Server-side only, already excluded via serverExternalPackages.
- **Do not regenerate completed backlog items:** Category Breakdown, Today, Matchup, Scoreboard, Schedule all completed in cycles 1-2.
- **Do not attempt issue #2 (historical draft data 2015-2018):** Requires manual CSV creation from non-API sources, not a code change.
- **Do not introduce calendar-time estimates in any hypothesis text.**

## New Backlog Items

None. All 5 remaining backlog items are addressed by hypotheses H4-H8. The 3 new items (H1-H3) are eval fixes and housekeeping.
