# Fantasy Baseball Draft Rankings
### Tampa's Finest — ESPN League (10-team H2H Each Category)

A data-driven, season-by-season fantasy baseball system built on 10 years of league history.
Designed for draft prep, in-season management, and future seasons.

---

## Repository Structure

```
FantasyBaseball/
├── seasons/
│   ├── 2016/ … 2025/              Historical seasons
│   │   ├── standings.csv          Final standings + season category totals
│   │   ├── matchups.csv           Weekly category W/L results (needs ESPN fetch)
│   │   ├── rosters.csv            End-of-season rosters (needs ESPN fetch)
│   │   └── draft_results.csv      Pick-by-pick draft order (needs ESPN fetch)
│   └── 2026/                      Current season
│       ├── projections/
│       │   ├── steamer_batters.csv   → download from FanGraphs
│       │   └── steamer_pitchers.csv  → download from FanGraphs
│       ├── draft_results.csv         → fill in after draft night (Mar 24)
│       └── matchups.csv              → updated weekly during season
│
├── analysis/
│   ├── category_weights.py        Derives category weights from history
│   └── player_rankings.py         Ranks players via weighted z-scores
│
├── scripts/
│   └── fetch_espn_history.py      Pulls matchups/rosters/drafts via ESPN API
│
├── data/
│   └── fbb10yr.xlsx               Original 10-year standings (source of truth)
│
└── output/
    ├── category_weights.json      Derived weights + correlations
    └── draft_rankings.csv         Final ranked cheat sheet
```

---

## Quick Start

```bash
pip install -r requirements.txt

# Step 1: derive category weights from league history
python3 analysis/category_weights.py

# Step 2: generate draft rankings
python3 analysis/player_rankings.py
```

---

## Getting Better Data (Recommended Before Draft)

### 1 — Add 2026 Steamer Projections (biggest upgrade)

Download free CSVs from FanGraphs and drop them in `seasons/2026/projections/`:

| File | URL |
|---|---|
| `steamer_batters.csv` | fangraphs.com → Projections → Steamer → Batters → Export |
| `steamer_pitchers.csv` | fangraphs.com → Projections → Steamer → Pitchers → Export |

Then re-run `python3 analysis/player_rankings.py`.

### 2 — Pull ESPN Historical Data (biggest analytical upgrade)

Fetches weekly matchup W/L by category, rosters, and draft history for all available seasons.
This unlocks direct H2H category correlation instead of relying on season totals.

**Get your ESPN cookies:**
1. Log in at espn.com in Chrome/Safari
2. Open DevTools → Application → Cookies → espn.com
3. Copy `espn_s2` and `SWID`

```bash
export ESPN_S2="AExxxxxxxxx..."
export ESPN_SWID="{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}"

python3 scripts/fetch_espn_history.py          # pulls all available years
python3 analysis/category_weights.py           # re-derives weights (now H2H-based)
python3 analysis/player_rankings.py            # re-ranks players
```

---

## League Settings

| Setting | Value |
|---|---|
| Teams | 10 |
| Format | Head-to-Head Each Category |
| Draft | Snake, Mar 24 2026 @ 8:30 PM EDT |
| Roster | 24 total: C, 1B, 2B, 3B, SS, OF×3, UTIL \| SP×5, RP×2, P×2 \| 6 bench, 2 IL |

**Batting (8):** H · R · HR · TB · RBI · BB · SB · AVG

**Pitching (8):** K · QS · W · L · SV · HD · ERA · WHIP

---

## Category Weights (current — standings-based)

Derived via Spearman correlation between within-year category rank and win PCT.
Will be updated to direct H2H-based weights after running `fetch_espn_history.py`.

| Category | Weight | Notes |
|---|---|---|
| TB | 10.2% | Most predictive |
| R | 9.6% | |
| K | 8.9% | |
| WHIP | 7.8% | Lower = better |
| QS | 7.7% | |
| W | 7.6% | |
| H | 7.4% | |
| RBI | 7.0% | |
| HR | 6.7% | |
| ERA | 6.1% | Lower = better |
| AVG | 5.2% | |
| BB | 5.1% | |
| SB | 4.1% | |
| HD | 4.0% | 6 seasons of data |
| L | 1.5% | Lower = better |
| SV | 1.1% | Weakest predictor |

---

## Roadmap

- [ ] Add 2026 Steamer projections CSVs (`seasons/2026/projections/`)
- [ ] Run `fetch_espn_history.py` to populate weekly matchup/roster/draft data
- [ ] Re-derive weights using direct H2H matchup evidence
- [ ] Add ESPN ADP to surface value picks (high z-score, low ADP)
- [ ] Add position-by-position rankings
- [ ] Track 2026 draft results and weekly matchups during the season

---

## Data Notes

- `seasons/2019/standings.csv` — AVG column is corrupted in source (shows ~6.3 instead of ~0.263); excluded from AVG correlation
- ESPN API history is available from 2019 onwards; 2016–2018 standings are from the manually maintained Excel file
- CG (Complete Games) was a scoring category in 2016–2019, replaced by HD in 2020
