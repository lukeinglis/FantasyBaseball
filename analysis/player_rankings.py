"""
Step 2: Generate draft rankings using 2026 Steamer projections + league-derived category weights.

Approach:
- Fetch 2026 Steamer projections via pybaseball
- Calculate z-scores for each category vs. the draftable player pool
- Apply category weights from category_weights.py
- Adjust for position scarcity
- Output ranked CSV cheat sheet
"""

import pandas as pd
import numpy as np
import json
import os
import warnings
warnings.filterwarnings("ignore")

try:
    from pybaseball import (
        batting_stats,
        pitching_stats,
        batting_stats_range,
        pitching_stats_range,
    )
    PYBASEBALL_AVAILABLE = True
except ImportError:
    PYBASEBALL_AVAILABLE = False
    print("pybaseball not installed — run: pip3 install pybaseball")

WEIGHTS_PATH      = "output/category_weights.json"
PROJECTIONS_DIR   = "seasons/2026/projections"
OUTPUT_CSV        = "output/draft_rankings.csv"
OUTPUT_HTML       = "output/draft_rankings.html"

# Roster config: Tampa's Finest
# 10 teams, 24 roster spots (18 starters: C,1B,2B,3B,SS,OF×3,UTIL,SP×5,RP×2,P×2 + 6 bench)
NUM_TEAMS = 10
BATTERS_PER_TEAM = 9      # C,1B,2B,3B,SS,OF×3,UTIL
PITCHERS_PER_TEAM = 9     # SP×5,RP×2,P×2
BENCH_PER_TEAM = 6

# Pool size for z-score baseline (how many players are "draftable")
BATTER_POOL = NUM_TEAMS * (BATTERS_PER_TEAM + 3)   # ~120 batters
PITCHER_POOL = NUM_TEAMS * (PITCHERS_PER_TEAM + 3)  # ~120 pitchers

# League categories
BATTING_CATS = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG"]
PITCHING_CATS = ["K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"]
NEGATIVE_CATS = {"L", "ERA", "WHIP"}

# FanGraphs column name mappings (Steamer projection columns)
BATTER_COL_MAP = {
    "H": "H",
    "R": "R",
    "HR": "HR",
    "TB": "TB",   # may need to calculate: 1B + 2*2B + 3*3B + 4*HR
    "RBI": "RBI",
    "BB": "BB",
    "SB": "SB",
    "AVG": "AVG",
}

PITCHER_COL_MAP = {
    "K": "SO",    # strikeouts
    "W": "W",
    "L": "L",
    "SV": "SV",
    "HD": "HLD",  # holds
    "ERA": "ERA",
    "WHIP": "WHIP",
}


def load_weights():
    with open(WEIGHTS_PATH) as f:
        data = json.load(f)
    return data["weights"]


def fetch_projections():
    """
    Load 2026 Steamer projections.

    Priority:
      1. seasons/2026/projections/steamer_batters.csv   (manually downloaded from FanGraphs)
      2. seasons/2026/projections/steamer_pitchers.csv
      3. pybaseball live fetch (falls back to 2025 actuals if 2026 not yet available)

    To get Steamer 2026 CSVs from FanGraphs:
      https://www.fangraphs.com/projections.aspx?pos=all&stats=bat&type=steamer
      -> Export Data button -> save as seasons/2026/projections/steamer_batters.csv
      https://www.fangraphs.com/projections.aspx?pos=all&stats=pit&type=steamer
      -> Export Data button -> save as seasons/2026/projections/steamer_pitchers.csv
    """
    import os
    batter_csv  = os.path.join(PROJECTIONS_DIR, "steamer_batters.csv")
    pitcher_csv = os.path.join(PROJECTIONS_DIR, "steamer_pitchers.csv")

    if os.path.exists(batter_csv) and os.path.exists(pitcher_csv):
        print("Loading 2026 Steamer projections from local CSV files...")
        batters  = pd.read_csv(batter_csv)
        pitchers = pd.read_csv(pitcher_csv)
        print(f"  {len(batters)} batters, {len(pitchers)} pitchers (Steamer 2026)")
        return batters, pitchers, 2026

    print("Local Steamer CSVs not found — fetching via pybaseball...")
    print(f"  (Add CSVs to {PROJECTIONS_DIR}/ for true 2026 projections)")

    try:
        batters  = batting_stats(2026, qual=10, ind=1)
        pitchers = pitching_stats(2026, qual=1, ind=1)
        year_used = 2026
    except Exception as e:
        print(f"  2026 not available ({e}), using 2025 actuals...")
        try:
            batters  = batting_stats(2025, qual=50, ind=1)
            pitchers = pitching_stats(2025, qual=10, ind=1)
            year_used = 2025
        except Exception as e2:
            print(f"  Failed: {e2}")
            return None, None, None

    # Cache to disk so future runs are instant
    os.makedirs(PROJECTIONS_DIR, exist_ok=True)
    batters.to_csv(batter_csv, index=False)
    pitchers.to_csv(pitcher_csv, index=False)
    print(f"  Cached to {PROJECTIONS_DIR}/")

    print(f"  {len(batters)} batters, {len(pitchers)} pitchers ({year_used})")
    return batters, pitchers, year_used


def calculate_tb(df):
    """Calculate Total Bases if not present."""
    if "TB" not in df.columns:
        singles = df["H"] - df.get("2B", 0) - df.get("3B", 0) - df.get("HR", 0)
        df["TB"] = singles + 2 * df.get("2B", 0) + 3 * df.get("3B", 0) + 4 * df["HR"]
    return df


def calculate_qs(df):
    """Estimate Quality Starts if not in projections (roughly 50-55% of GS for avg SPs)."""
    if "QS" not in df.columns and "GS" in df.columns:
        df["QS"] = (df["GS"] * 0.52).round(1)
    elif "QS" not in df.columns:
        df["QS"] = 0
    return df


def calculate_whip(df):
    """Calculate WHIP from BB+H and IP if not present."""
    if "WHIP" not in df.columns and "IP" in df.columns:
        df["WHIP"] = ((df.get("BB", 0) + df.get("H", 0)) / df["IP"]).round(3)
    return df


def zscore(series, negative=False):
    """
    Calculate z-scores. For negative categories (lower=better),
    we flip the sign so that a better ERA gives a positive z-score.
    """
    mean = series.mean()
    std = series.std()
    if std == 0:
        return pd.Series(0, index=series.index)
    z = (series - mean) / std
    return -z if negative else z


def rank_batters(batters, weights):
    print("\nRanking batters...")
    df = batters.copy()
    df = calculate_tb(df)

    # Rename SO to K if needed
    if "SO" in df.columns and "K" not in df.columns:
        df["K"] = df["SO"]

    available = [c for c in BATTING_CATS if c in df.columns]
    missing = [c for c in BATTING_CATS if c not in df.columns]
    if missing:
        print(f"  Missing batting columns: {missing}")

    # Sort by a rough value (R+RBI+HR+SB) to define the draftable pool
    df["rough_val"] = (
        df.get("R", 0) + df.get("RBI", 0) + df.get("HR", 0) * 2 + df.get("SB", 0)
    )
    df = df.sort_values("rough_val", ascending=False).head(BATTER_POOL).copy()

    # Calculate z-scores within the draftable pool
    df["z_total"] = 0.0
    for cat in available:
        w = weights.get(cat, 0)
        if w == 0:
            continue
        neg = cat in NEGATIVE_CATS
        z = zscore(df[cat], negative=neg)
        df[f"z_{cat}"] = z.round(3)
        df["z_total"] += w * z

    df["z_total"] = df["z_total"].round(3)
    df["rank"] = df["z_total"].rank(ascending=False).astype(int)
    return df.sort_values("z_total", ascending=False)


def rank_pitchers(pitchers, weights):
    print("Ranking pitchers...")
    df = pitchers.copy()
    df = calculate_qs(df)
    df = calculate_whip(df)

    if "SO" in df.columns and "K" not in df.columns:
        df["K"] = df["SO"]
    if "HLD" in df.columns and "HD" not in df.columns:
        df["HD"] = df["HLD"]
    if "SHO" in df.columns and "HD" not in df.columns:
        df["HD"] = 0

    available = [c for c in PITCHING_CATS if c in df.columns]
    missing = [c for c in PITCHING_CATS if c not in df.columns]
    if missing:
        print(f"  Missing pitching columns: {missing}")

    # Sort by rough value (K + SV + W) to define pool
    df["rough_val"] = (
        df.get("K", 0) * 0.5 + df.get("SV", 0) * 3 + df.get("W", 0) * 2
    )
    df = df.sort_values("rough_val", ascending=False).head(PITCHER_POOL).copy()

    df["z_total"] = 0.0
    for cat in available:
        w = weights.get(cat, 0)
        if w == 0:
            continue
        neg = cat in NEGATIVE_CATS
        z = zscore(df[cat], negative=neg)
        df[f"z_{cat}"] = z.round(3)
        df["z_total"] += w * z

    df["z_total"] = df["z_total"].round(3)
    df["rank"] = df["z_total"].rank(ascending=False).astype(int)
    return df.sort_values("z_total", ascending=False)


def combine_and_output(batters_ranked, pitchers_ranked):
    print("\nGenerating output...")

    # Select key columns for batters
    b_cols = ["Name", "Team", "z_total"]
    b_z_cols = [f"z_{c}" for c in BATTING_CATS if f"z_{c}" in batters_ranked.columns]
    b_stat_cols = [c for c in BATTING_CATS if c in batters_ranked.columns]
    batters_out = batters_ranked[b_cols + b_z_cols + b_stat_cols].copy()
    batters_out["Type"] = "BAT"

    # Select key columns for pitchers
    p_cols = ["Name", "Team", "z_total"]
    p_z_cols = [f"z_{c}" for c in PITCHING_CATS if f"z_{c}" in pitchers_ranked.columns]
    p_stat_cols = [c for c in PITCHING_CATS if c in pitchers_ranked.columns]
    pitchers_out = pitchers_ranked[p_cols + p_z_cols + p_stat_cols].copy()
    pitchers_out["Type"] = "PIT"

    # Add position eligibility placeholder
    batters_out["Pos"] = "BAT"
    pitchers_out["Pos"] = "PIT"

    # Combined ranking
    combined = pd.concat([batters_out, pitchers_out], ignore_index=True)
    combined = combined.sort_values("z_total", ascending=False).reset_index(drop=True)
    combined.index += 1
    combined.index.name = "Overall_Rank"

    # Merge ESPN ADP if available
    adp_path = "seasons/2026/adp/espn_adp.csv"
    if os.path.exists(adp_path):
        adp = pd.read_csv(adp_path)[["Name", "espn_rank", "espn_rank_roto", "espn_auction"]]
        combined = combined.merge(adp, on="Name", how="left")
        combined["espn_rank"] = combined["espn_rank"].fillna(999).astype(int)
        n_matched = combined["espn_rank"].lt(999).sum()
        print(f"  Merged ESPN ADP: {n_matched}/{len(combined)} players matched")

    os.makedirs("output", exist_ok=True)
    combined.to_csv(OUTPUT_CSV)
    print(f"  Saved: {OUTPUT_CSV}")

    # Top 50 preview
    print("\n=== TOP 50 OVERALL DRAFT RANKINGS ===")
    preview_cols = ["Name", "Team", "Type", "z_total"]
    print(combined[preview_cols].head(50).to_string())

    # Separate batter / pitcher lists
    print("\n=== TOP 30 BATTERS ===")
    b_preview = batters_ranked[["Name", "Team", "z_total"] + b_stat_cols].head(30)
    print(b_preview.to_string(index=False))

    print("\n=== TOP 30 PITCHERS ===")
    p_preview = pitchers_ranked[["Name", "Team", "z_total"] + p_stat_cols].head(30)
    print(p_preview.to_string(index=False))

    return combined


def main():
    if not os.path.exists(WEIGHTS_PATH):
        print("Weights file not found. Run category_weights.py first.")
        return

    weights = load_weights()
    print("Category weights loaded:")
    for cat, w in weights.items():
        print(f"  {cat}: {w}")

    if not PYBASEBALL_AVAILABLE:
        print("\npybaseball not available. Install with: pip3 install pybaseball")
        return

    batters, pitchers, year = fetch_projections()
    if batters is None:
        return

    print(f"\nBatter columns: {list(batters.columns)}")
    print(f"Pitcher columns: {list(pitchers.columns)}")

    batters_ranked = rank_batters(batters, weights)
    pitchers_ranked = rank_pitchers(pitchers, weights)
    combined = combine_and_output(batters_ranked, pitchers_ranked)

    print(f"\nDone. Rankings saved to {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
