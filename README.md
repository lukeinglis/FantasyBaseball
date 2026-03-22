# Fantasy Baseball Draft Rankings
### Tampa's Finest — ESPN League (10-team H2H Each Category)

A data-driven, season-by-season fantasy baseball system built on 10 years of league history.
Designed for draft prep, in-season management, and future seasons.


## Source Of Truth

This repository is the single source of truth for Tampa's Finest baseball data and application code.

- Data + analysis pipeline: `analysis/`, `scripts/`, `seasons/`, `owners/`, `output/`
- Public web app code (deployed to `baseball.lukeinglis.me`): `web/`
- Legacy local Streamlit tool: `app.py`

`baseball.lukeinglis.me` is served by the Vercel `web` project and reads data generated from this same repository.

---

## Inglis War Room

Interactive dashboard for draft prep, opponent scouting, and league history.

```bash
pip3 install -r requirements.txt
streamlit run app.py
```

Then open **http://localhost:8501** in your browser.

Your dad can access it on the same WiFi at **http://10.0.0.182:8501** (no setup needed on his end).

| Page | What's there |
|---|---|
| Draft Board | Full ranked cheat sheet — filter by position, search by name, download CSV |
| Category Intel | What actually predicts winning in this league; key draft takeaways |
| Opponent Scouting | Per-team draft tendencies — when they take SP/C/RP, recurring targets |
| League History | Year-by-year champions, standings, 10-year finish heatmap |
| Owner Records | All-time leaderboard, owner deep dive, finish trends |

---

## Repository Structure

```
FantasyBaseball/
├── app.py                         Inglis War Room (Streamlit dashboard)
├── seasons/
│   ├── 2016/ … 2025/              Historical seasons
│   │   ├── standings.csv          Final standings + season category totals
│   │   ├── matchups.csv           Weekly category W/L results
│   │   ├── rosters.csv            End-of-season rosters
│   │   └── draft_results.csv      Pick-by-pick draft order
│   └── 2026/                      Current season
│       ├── projections/
│       │   ├── steamer_batters.csv   → download from FanGraphs
│       │   └── steamer_pitchers.csv  → download from FanGraphs
│       ├── draft_results.csv         → fill in after draft night (Mar 24)
│       └── matchups.csv              → updated weekly during season
│
├── analysis/
│   ├── category_weights.py        Derives category weights from history
│   ├── player_rankings.py         Ranks players via weighted z-scores
│   └── draft_analysis.py          Builds opponent draft tendency profiles
│
├── scripts/
│   ├── fetch_espn_history.py      Pulls matchups/rosters/drafts via ESPN API
│   └── build_owner_profiles.py    Builds owners/ directory from ESPN API
│
├── owners/
│   ├── README.md                  All-time owner leaderboard
│   ├── owners.csv                 Master owner table
│   └── {owner}.md                 Per-owner profile with season history
│
├── data/
│   ├── fbb10yr.xlsx               Original 10-year standings (source of truth)
│   └── owner_history.csv          Raw ESPN owner data
│
└── output/
    ├── category_weights.json      Derived weights + correlations
    ├── draft_rankings.csv         Final ranked cheat sheet
    └── draft_profiles.csv         Per-team draft tendency summary
```

---

## Quick Start

```bash
pip3 install -r requirements.txt

# Step 1: derive category weights from league history
python3 analysis/category_weights.py

# Step 2: generate draft rankings
python3 analysis/player_rankings.py

# Step 3: build opponent draft profiles
python3 analysis/draft_analysis.py

# Step 4: launch the War Room
streamlit run app.py
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

## Category Weights (H2H matchup-derived)

Derived via Spearman correlation between per-category win% and overall matchup win%, across 60 team-seasons (2019–2025, excluding 2020).

| Category | Weight | Notes |
|---|---|---|
| TB | 11.4% | Most predictive |
| HR | 10.8% | |
| R | 10.0% | |
| RBI | 9.9% | |
| H | 8.3% | |
| W | 7.2% | |
| K | 7.0% | |
| WHIP | 6.2% | Lower = better |
| QS | 6.0% | |
| ERA | 5.7% | Lower = better |
| SB | 4.6% | |
| BB | 3.5% | |
| AVG | 3.4% | |
| L | 3.3% | Lower = better |
| HD | 2.5% | 2020+ only |
| SV | 0.2% | Weakest predictor — do not reach for closers |

---

## Roadmap

- [x] Pull ESPN history (matchups/rosters/drafts) for 2019–2025
- [x] Re-derive weights using direct H2H matchup evidence
- [x] Build opponent draft tendency profiles
- [x] Build owner directory with per-owner season history
- [x] Inglis War Room dashboard (Streamlit)
- [ ] Add 2026 Steamer projections CSVs (`seasons/2026/projections/`)
- [ ] Add ESPN ADP to surface value picks (high z-score, low ADP)
- [ ] Track 2026 draft results and weekly matchups during the season

---

## Data Notes

- `seasons/2019/standings.csv` — AVG column is corrupted in source (shows ~6.3 instead of ~0.263); excluded from AVG correlation
- ESPN API history is available from 2019 onwards; 2016–2018 standings are from the manually maintained Excel file
- CG (Complete Games) was a scoring category in 2016–2019, replaced by HD in 2020
