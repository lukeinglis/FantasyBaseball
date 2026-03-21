# Fantasy Baseball Draft Rankings
### Tampa's Finest — ESPN League (10-team H2H Each Category)

A data-driven draft ranking system built on 10 years of league history.

## How It Works

**Step 1 — Derive category weights from league history**

Rather than using generic fantasy rankings, this system learns which statistical categories actually predict winning *in this specific league*. It analyzes 10 years of standings data and computes the Spearman correlation between each category and overall win percentage.

```
python3 category_weights.py
```

Output: `output/category_weights.json`

**Step 2 — Rank players using weighted z-scores**

Pulls player projections, calculates how far above/below average each player is in each category (z-score), then weights those scores using the league-derived weights from Step 1.

```
python3 player_rankings.py
```

Output: `output/draft_rankings.csv`

## League Settings

| Setting | Value |
|---|---|
| Teams | 10 |
| Format | Head-to-Head Each Category |
| Draft | Snake, Mar 24 2026 |
| Roster | 24 players (18 starters, 6 bench, 2 IL) |

**Batting categories (8):** H, R, HR, TB, RBI, BB, SB, AVG

**Pitching categories (8):** K, QS, W, L, SV, HD, ERA, WHIP

## Category Weights (derived from 10 years of league data)

| Rank | Category | Weight | Notes |
|---|---|---|---|
| 1 | TB | 10.2% | Most predictive of winning |
| 2 | R | 9.6% | |
| 3 | K | 8.9% | |
| 4 | WHIP | 7.8% | Lower = better |
| 5 | QS | 7.7% | |
| 6 | W | 7.6% | |
| 7 | H | 7.4% | |
| 8 | RBI | 7.0% | |
| 9 | HR | 6.7% | |
| 10 | ERA | 6.1% | Lower = better |
| 11 | AVG | 5.2% | |
| 12 | BB | 5.1% | |
| 13 | SB | 4.1% | |
| 14 | HD | 4.0% | Only 6 seasons of data |
| 15 | L | 1.5% | Lower = better |
| 16 | SV | 1.1% | Weakest predictor |

## Data

- `data/fbb10yr.xlsx` — 10 years of Tampa's Finest league standings (2016–2025)
- `output/category_weights.json` — derived category weights + correlations
- `output/draft_rankings.csv` — final ranked player cheat sheet

**Note on data quality:** 2019 AVG values are corrupted in the source file and are excluded from the AVG correlation. All other years are clean.

**Note on projections:** Player rankings currently use 2025 FanGraphs stats. Re-run `player_rankings.py` after adding 2026 Steamer projection CSVs to `data/`.

## Roadmap

- [ ] Add 2026 Steamer projections (download from FanGraphs)
- [ ] Add ESPN ADP data to surface value picks (high z-score, low ADP)
- [ ] Pull weekly matchup history via ESPN API for direct H2H category analysis
- [ ] Add position-by-position rankings (best available by position)
- [ ] Add playoff-weighted category analysis

## Setup

```bash
pip3 install -r requirements.txt
python3 category_weights.py
python3 player_rankings.py
```
