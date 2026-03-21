"""
Step 1: Derive category weights from league history.

Two data sources (uses whichever is available, prefers matchups):

  1. seasons/YYYY/matchups.csv  — weekly category W/L per team (most accurate)
     Correlation: category win% per team-season vs overall win%
     Source: fetch_espn_history.py

  2. seasons/YYYY/standings.csv — season-long category totals (fallback)
     Correlation: within-year category rank vs overall PCT
     Source: split from data/fbb10yr.xlsx

Output: output/category_weights.json
"""

import os
import json
import pandas as pd
from pathlib import Path
from scipy.stats import spearmanr

SEASONS_DIR  = Path("seasons")
OUTPUT_PATH  = Path("output/category_weights.json")

BATTING_CATS  = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG"]
PITCHING_CATS = ["K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"]
ALL_CATS      = BATTING_CATS + PITCHING_CATS
NEGATIVE_CATS = {"L", "ERA", "WHIP"}


# ---------------------------------------------------------------------------
# Source 1: matchups.csv (preferred — direct H2H category evidence)
# ---------------------------------------------------------------------------

def load_matchup_data():
    """
    Load weekly category W/L results from seasons/YYYY/matchups.csv.
    Aggregate to team-season level: win% per category.
    Returns None if no matchup files are found.
    """
    frames = []
    for year_dir in sorted(SEASONS_DIR.iterdir()):
        path = year_dir / "matchups.csv"
        if not path.exists():
            continue
        try:
            df = pd.read_csv(path)
            df["year"] = int(year_dir.name)
            frames.append(df)
        except Exception as e:
            print(f"  Could not read {path}: {e}")

    if not frames:
        return None

    df = pd.concat(frames, ignore_index=True)
    print(f"  Matchup data: {len(df)} team-week rows across {df['year'].nunique()} seasons")

    # Build cat_win columns: 1 = won category, 0 = lost, None = missing
    win_cols = [f"{c}_win" for c in ALL_CATS if f"{c}_win" in df.columns]
    available_cats = [c for c in ALL_CATS if f"{c}_win" in df.columns]

    # Aggregate to team-season: cat win%, overall win%
    agg = {}
    for cat in available_cats:
        col = f"{cat}_win"
        agg[f"{cat}_winpct"] = (col, lambda x: x.dropna().mean())

    # Also need overall matchup W/L — proxy as cats_won > (total cats / 2)
    # But we may not have this directly; derive from category wins if needed
    season_rows = []
    for (year, team), grp in df.groupby(["year", "team"]):
        row = {"year": year, "team": team}
        for cat in available_cats:
            col = f"{cat}_win"
            vals = grp[col].dropna()
            row[f"{cat}_winpct"] = vals.mean() if len(vals) > 0 else None
        # Overall win% from standings if cats_won not available
        if "cats_won" in grp.columns and grp["cats_won"].notna().any():
            total_possible = len(ALL_CATS) * len(grp)
            row["overall_winpct"] = grp["cats_won"].sum() / total_possible if total_possible else None
        season_rows.append(row)

    return pd.DataFrame(season_rows), available_cats


# ---------------------------------------------------------------------------
# Source 2: standings.csv (fallback — season totals)
# ---------------------------------------------------------------------------

def load_standings_data():
    """
    Load season-long standings from seasons/YYYY/standings.csv.
    Returns pooled DataFrame with all team-seasons.
    """
    frames = []
    for year_dir in sorted(SEASONS_DIR.iterdir()):
        path = year_dir / "standings.csv"
        if not path.exists():
            continue
        try:
            year = int(year_dir.name)
            df = pd.read_csv(path)
            df["year"] = year

            # Standardise PCT column
            if "PCT" not in df.columns and "W" in df.columns and "L" in df.columns:
                total = df["W"] + df["L"] + df.get("T", 0)
                df["PCT"] = df["W"] / total

            # Flag corrupted 2019 AVG
            if year == 2019:
                df["AVG"] = None

            frames.append(df)
        except Exception as e:
            print(f"  Could not read {path}: {e}")

    if not frames:
        return None, []

    df = pd.concat(frames, ignore_index=True)
    available = [c for c in ALL_CATS if c in df.columns]
    print(f"  Standings data: {len(df)} team-seasons across {df['year'].nunique()} seasons")
    return df, available


# ---------------------------------------------------------------------------
# Correlation helpers
# ---------------------------------------------------------------------------

def correlate_matchup(df, available_cats):
    """
    Correlate per-category win% with overall win%.
    Requires 'overall_winpct' column in df.
    """
    if "overall_winpct" not in df.columns or df["overall_winpct"].isna().all():
        print("  No overall win% available in matchup data — falling back to standings")
        return None, None

    results, ns = {}, {}
    for cat in available_cats:
        col = f"{cat}_winpct"
        if col not in df.columns:
            continue
        subset = df[["overall_winpct", col, "year"]].dropna()
        if len(subset) < 15:
            continue
        corr, pval = spearmanr(subset[col], subset["overall_winpct"])
        results[cat] = round(abs(corr), 4)
        ns[cat] = len(subset)
        direction = "(lower=better)" if cat in NEGATIVE_CATS else "(higher=better)"
        print(f"  {cat:<6} {direction:<20}  r={corr:+.3f}  p={pval:.3f}  n={len(subset)}")

    return results, ns


def correlate_standings(df, available_cats):
    """
    Rank teams within each year per category, correlate rank with PCT.
    """
    results, ns = {}, {}
    for cat in available_cats:
        if cat not in df.columns:
            continue
        subset = df[["PCT", cat, "year"]].dropna()
        if len(subset) < 20:
            print(f"  Skipping {cat} — only {len(subset)} valid data points")
            continue
        ascending = cat in NEGATIVE_CATS
        cat_rank = subset.groupby("year", group_keys=False)[cat].rank(
            ascending=ascending, method="average"
        )
        corr, pval = spearmanr(cat_rank, subset["PCT"])
        results[cat] = round(abs(corr), 4)
        ns[cat] = len(subset)
        direction = "(lower=better)" if ascending else "(higher=better)"
        print(f"  {cat:<6} {direction:<20}  r={corr:+.3f}  p={pval:.3f}  n={len(subset)}")

    return results, ns


def normalize_weights(raw):
    total = sum(raw.values())
    return {k: round(v / total, 4) for k, v in raw.items()}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=== Tampa's Finest — Category Weight Analysis ===\n")

    # Try matchup data first
    matchup_result = load_matchup_data()
    method = "standings"
    raw, ns = {}, {}

    if matchup_result:
        df_matchup, avail_matchup = matchup_result
        print("\nMethod: weekly matchup category win% (direct H2H evidence)\n")
        raw, ns = correlate_matchup(df_matchup, avail_matchup)
        if raw:
            method = "matchups"

    # Fall back to standings if needed
    if not raw:
        df_standings, avail_standings = load_standings_data()
        if df_standings is None:
            print("No data found. Run scripts/fetch_espn_history.py or check seasons/ folder.")
            return
        print("\nMethod: season-long standings (within-year rank vs PCT)\n")
        raw, ns = correlate_standings(df_standings, avail_standings)

    if not raw:
        print("Could not compute any correlations.")
        return

    normalized = normalize_weights(raw)
    sorted_weights = dict(sorted(normalized.items(), key=lambda x: -x[1]))

    print("\n=== Normalized Weights (sum to 1.0) ===")
    for cat, w in sorted_weights.items():
        bar = "█" * int(w * 200)
        neg = " (lower=better)" if cat in NEGATIVE_CATS else ""
        print(f"  {cat:<6}  {w:.4f}  {bar}{neg}")

    output = {
        "weights": sorted_weights,
        "raw_correlations": raw,
        "sample_sizes": {k: int(v) for k, v in ns.items()},
        "method": method,
        "negative_categories": sorted(NEGATIVE_CATS),
        "notes": [
            f"Method: {method}",
            "2019 AVG excluded — corrupted in source file",
            "HD available from 2020 onwards only (6 seasons via standings)",
            "CG (2016-2019) replaced by HD in 2020 — excluded from weights",
            "Re-run after fetching matchup data for more accurate results",
        ]
    }

    OUTPUT_PATH.parent.mkdir(exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nWeights saved to {OUTPUT_PATH}")
    if method == "standings":
        print("\nTip: run scripts/fetch_espn_history.py to pull weekly matchup data")
        print("     then re-run this script for more accurate H2H-based weights.")

    return sorted_weights


if __name__ == "__main__":
    main()
