# Interaction Study — FantasyBaseball

Analyzed 30 conversation log(s), 54 relevant messages.

## User Messages (6)
- Project: /Users/linglis/projects/FantasyBaseball
Mode: improve
- Project: /Users/linglis/projects/FantasyBaseball
Mode: improve
- merge and continue.
- [Request interrupted by user for tool use]
- Project: /Users/linglis/projects/FantasyBaseball
Mode: improve
- whoami

## Errors and Issues (48)
- Now I need to fix the `stats.R` reference - the field in the API is actually "R" for Runs. Let me verify the stat mapping and then check for TypeScript compatibility:
- `playingBatters` and `startingToday` are regular `const` declarations after the early returns — not `useMemo` hooks. I need to move `todayStartersWithStats` and `actionItems` to after those declaratio
- One test failed. Let me check the `getProTeam` function behavior for `proTeamId: 0`. The issue is that `0` is falsy in JS, so `if (player.proTeamId && ...)` evaluates to false.
- Actually, this is exactly the kind of edge case the issue wants me to find. The code has a truthiness bug with `proTeamId: 0`. I should fix the code since FA players won't get mapped correctly. Let me
- - Found and fixed a real bug: `getProTeam` had a truthiness bug where `proTeamId: 0` (free agent) was treated as falsy
- | H1 | FIX | Fix lint error in warroom/page.tsx | high |
- | H2 | FIX | Add @vitest/coverage-v8 + coverage script | high |
- **3 new items** (exactly at cap): lint fix, coverage tooling, pino — all directly addressing known eval gaps.
- Fix the TypeScript error in the test - need to cast the empty categories object:
- - `web/src/tests/schedule.test.ts`: 12 new Vitest tests covering both functions: score direction for stronger/weaker opponents, missing z-score handling, zero-variance category safety, lower-is-better
- - `getProTeam` truthiness fix is correct: `proTeamId=0` maps to FA and the old check would silently drop free agents
- Let me check which route files have console.log/error calls, and read a few more to understand the patterns.
- The log.info ended up after the return statement (unreachable). Let me fix that:
- Now add log.info/error at the return/catch points for the mlb routes:
- - **`web/src/lib/espn.ts`**: `espnFetch` now times the HTTP call and logs `{op, views, durationMs}` on success/error
- The `draft-context.tsx` lint error is gone. All remaining errors are pre-existing in `warroom/page.tsx` (SortTh component-in-render and unescaped entities). Let me verify these are pre-existing.
- Confirmed: same 9 errors exist on main. My changes introduce zero new lint errors. Now let me run the build.
- TypeScript check is clean (no output = no errors). The `next lint` command has a pre-existing issue with this Next.js version. Let me also check if there are eval scripts to run.
- - TypeScript check, Next.js build, and lint all pass with no new errors.
- - Fixes the `proTeamId` truthiness bug (null check)
- | 1 | Fix draft tracker cold start (localStorage) | #5 | Open, awaiting review |
- | 3 | Fix Category Breakdown/Rank data scope + trend tracking | #9 | Open, awaiting review |
- - `lint`: 0.9 (1 error)
- Strategy archived. Starting experiment execution — H1 (lint fix) first.
- **Experiment 5 — H1: Fix lint error in warroom/page.tsx**
- Warroom lint passes clean. The "1 error" in eval is a different fixable error (unrelated to the PR). The fix is correct but the eval score is unchanged. Let me run the full eval and precheck.
- Precheck fails on threshold (expected) and scope false-positive (empty violations = `.gitignore` dirty check). Score unchanged — this is a code quality fix that doesn't move the eval needle directly. 
- - `experiments/FantasyBaseball-003.md` — Category Breakdown/Rank scope fix (KEEP, neutral)
- - **Experiment note**: `.factory/archive/experiments/FantasyBaseball-002.md` — H4 Vitest+MSW, verdict KEEP, +0.075, tests dimension 0.5 to 1.0, 46 tests, getProTeam bug found
- I'll start by reading the issue and project context, then implement the fix.
- Now I'll create the branch and run lint to see the exact errors before fixing.
- Good - only the nested component error. Now I'll implement the fix: move `SortTh` to module scope with explicit props for `sortCol`, `sortDir`, and `onSort`.
- No more warroom errors. Now run the tests:
- 1. `SortTh` moved to module scope with `sortCol`, `sortDir`, `onSort` as explicit props — fixes `react/no-unstable-nested-components`
- 2. Apostrophes in FAR glossary text escaped to `&apos;` — fixes `react/no-unescaped-entities`
- Good. Baseline composite score is **0.5098**. Key weaknesses: capability_surface (0.28), observability (0.41), tests (0.5/not detected), lint (0.9 with 1 error). Now let me spawn the Strategist.
- 5. **FEEC ordering:** Fix first (H1-H5), then Exploit (H6-H10), then Explore (H11). Correct.
- Strategy phase complete. Now executing experiments. Starting with H1: Fix draft tracker cold start.
- - Proper error handling for corrupted/unavailable localStorage
- Score unchanged at 0.5098. This is a bug fix that doesn't directly improve eval dimensions (no new tests, no new public functions). The change is valuable for the user but score-neutral. Let me run th
- Precheck failed on two checks:
- 2. **scope**: "Guard violations: " (empty), meaning it failed but with no actual violations. Likely a parsing issue.
- The score_direction check is problematic because the project starts at 0.5098 and the threshold is 0.7. With zero test suite and zero vault config, reaching 0.7 from a bug fix alone isn't possible. Th
- I'm in the `web` subdirectory. Let me fix the path.
- H4 complete. Moving to H3: Fix Category Breakdown and Category Rank data scope. This is a growth hypothesis (capability_surface).
- - H1-H3: FIX (draft cold start, historical data, category scope)
- - H4-H5: FIX/NEW (testing infra, structured logging, both foundational)
- 1. **Draft state persistence**: localStorage is the right fix. Draft data is per-user, per-session, small. Move state to client-side React context, persist via `useEffect`, hydrate on mount with SSR g

## Similar Projects
No similar projects found.

## Open GitHub Issues

### Your Issues (2) — actionable, may generate fix hypotheses

- **#3** War room draft tracker resets on page reload (serverless cold start) (by @lukeinglis)
  > ## Problem  `web/src/lib/draft-store.ts` stores the draft session (drafted players, my picks) as in-memory module state. Vercel serverless functions go cold between requests, wiping all picks. Any page reload during a live draft loses everything.  ## Root cause  ```ts // draft-store.ts — resets to e
- **#2** Historical draft results missing for 2015–2018 (by @lukeinglis)
  > ## Problem  `getDraftResults()` in `web/src/lib/data.ts` covers 2019–2026 via the ESPN API. Pre-2019 data isn't available through the API, so the `/league/draft-history` page shows nothing for those seasons.  ## Fix  Manually create `seasons/YYYY/draft_results.csv` for each missing year (2015, 2016,

## Backlog

**15 items** in the backlog. Clear as many as possible this cycle.

- [Fix] Category Breakdown (/gm/category-breakdown): Page should default to full season data, not current week. Add tab toggle for cumulative vs weekly view. Currently showing wrong timeframe.
- [Exploit] Today (/gm/today): Enhance as daily command center. Add scoreboard highlights for categories at risk or to target, roster move recommendations, and FA pickup suggestions. Should be the one-stop morning briefing.
- [Exploit] Matchup (/gm/matchup): Add prediction algorithm that projects remaining category outcomes for the week based on roster composition, pitching schedule, and historical performance. Show both rosters and projected final category scores.
- [Exploit] Bullpen (/gm/bullpen): Elevate streaming pitcher intelligence. Prioritize double-starter identification, accurate starts tracking, and streaming targets for current + next week. This is a core team strategy pillar.
- [Exploit] Free Agents (/gm/free-agents): Add weakness-aware FA recommendations. Cross-reference team z-score gaps with FA metrics and FAR scores. Highlight projected double-starters for following week. Tab or toggle for streaming pitcher focus.
- [Exploit] Trade Room (/gm/trade): Add surplus detection, sell-high candidates from own roster, gap analysis vs opposing rosters, and metric arbitrage identification (players our z-score rates higher than ESPN rank).
- [Exploit] My Roster (/gm/roster): Deeper roster analysis with full stat breakdowns, z-score detail by category, and performance trends. Should be the deepest dive into current roster composition.
- [Exploit] Scoreboard (/league/scoreboard): Add per-category team ranking for the current week alongside matchup results. Show where each team ranks in each category this week.
- [Exploit] Schedule (/league/schedule): Add matchup strength indicator. Rank upcoming opponents by how they stack up against my team's category profile. Flag good and bad matchups.
- [Explore] GM Advisor on My Roster (/gm/roster): Add three-tier cached AI analysis sections: (1) Advice for the week, (2) Advice for next 30 days, (3) Advice to win the league. Tone: harsh, top-GM-in-the-game analysis. Cache results, refresh on demand via Claude Code skill (no API key needed). Existing gm-advice.md skill is partial scaffolding.
- [Exploit] Bullpen (/gm/bullpen): Elevate streaming pitcher intelligence. Prioritize double-starter identification, accurate starts tracking, and streaming targets for current + next week.
- [Exploit] Free Agents (/gm/free-agents): Add weakness-aware FA recommendations. Cross-reference team z-score gaps with FA metrics and FAR scores. Highlight projected double-starters.
- [Exploit] Trade Room (/gm/trade): Add surplus detection, sell-high candidates, gap analysis vs opposing rosters, and metric arbitrage identification.
- [Exploit] My Roster (/gm/roster): Deeper roster analysis with full stat breakdowns, z-score detail by category, and performance trends.
- [Exploit] Free Agents (/gm/free-agents): Add weakness-aware FA recommendations. Cross-reference team z-score gaps with FA metrics and FAR scores. Highlight projected double-starters for following week.

## Observability Coverage
- **Score:** 51.8%
- **Function coverage:** 46/50 functions have logging (92%)
- **Total log statements:** 117
- **Structured logging:** No
- **Request tracing:** No

### Observability Recommendations
- Add structured logging (structlog for Python, pino for Node.js) for machine-parseable log output
- Add request ID tracing (contextvars + unique ID per request) for end-to-end request correlation

## Prior Knowledge (Obsidian)
No prior notes found.

## Cross-Project Insights

Analyzed 1 projects (FantasyBaseball), 11 experiments, 100% overall keep rate.

**Winning categories:** bugfix, feature

Full report: /Users/linglis/projects/FantasyBaseball/.factory/strategy/insights.md

## Hypothesis Budget

**Backlog items: 15** (clear as many as possible this cycle)
**New items: at most 3** (researcher/strategist may add new ideas)
**Growth minimum: 2** (at least 2 hypotheses must target growth dimensions)

### Rules

- Read the backlog first. Pick items to implement this cycle — no cap on clearing.
- You may add at most 3 NEW items that aren't already in the backlog.
- At least 2 hypotheses must target growth dimensions (capability_surface, factory_effectiveness, research_grounding, experiment_diversity, observability). Each MUST have a `**Growth dimension:**` tag.
- FEEC ordering applies for prioritizing within the backlog (FIX > EXPLOIT > EXPLORE > COMBINE).
- Your open GitHub issues and critical bugs should be addressed as FIX hypotheses.
- Community issues (filed by others) must NOT be auto-fixed — suggest the author creates a PR instead.
- Write any new items not implemented this cycle to a `## New Backlog Items` section in current.md.

*Budget is configurable: set `min_growth`, `max_new` in factory.md under `## Hypothesis Budget`, or pass `--min-growth`, `--max-new` on the CLI.*