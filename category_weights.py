"""
Step 1: Derive category weights from 10 years of league history.

Approach:
- Load all seasons from fbb10yr.xlsx
- For each team-season, rank teams within the year for each category
- Calculate Spearman correlation between each category's rank and final PCT
- Higher correlation = that category is more predictive of winning
- Output weights to output/category_weights.json
"""

import pandas as pd
import json
from scipy.stats import spearmanr

DATA_PATH = "data/fbb10yr.xlsx"
OUTPUT_PATH = "output/category_weights.json"

# Categories present in 2020+ (HD era — matches current league)
# For older years (2016-2019) that had CG instead of HD, we include but note the gap
BATTING_CATS = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG"]
PITCHING_CATS_NEW = ["K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"]  # 2020+
PITCHING_CATS_OLD = ["K", "QS", "W", "L", "SV", "ERA", "WHIP"]        # 2016-2019

# Negative categories: lower raw value = better performance
NEGATIVE_CATS = {"L", "ERA", "WHIP"}


def load_all_seasons():
    xl = pd.ExcelFile(DATA_PATH)
    frames = []
    for year in xl.sheet_names:
        df = pd.read_excel(DATA_PATH, sheet_name=year)
        df["Year"] = int(year)

        # Flag 2019 AVG as corrupted (values like 6.3 instead of 0.263)
        if int(year) == 2019:
            df["AVG"] = None  # exclude from correlation

        frames.append(df)
    return pd.concat(frames, ignore_index=True)


def rank_within_year(df, category, ascending=False):
    """
    Rank teams within each year for a given category.
    ascending=True means lower is better (ERA, WHIP, L).
    Returns rank 1 = best, 10 = worst.
    """
    def rank_group(group):
        return group[category].rank(ascending=ascending, method="average")

    return df.groupby("Year", group_keys=False).apply(rank_group)


def compute_weights(df, categories, label=""):
    results = {}
    valid_n = {}

    for cat in categories:
        if cat not in df.columns:
            continue

        # Drop rows where category is null (e.g., HD missing in old years, 2019 AVG)
        subset = df[["PCT", cat, "Year"]].dropna()

        if len(subset) < 20:
            print(f"  Skipping {cat} — only {len(subset)} valid data points")
            continue

        ascending = cat in NEGATIVE_CATS
        cat_rank = subset.groupby("Year", group_keys=False)[cat].rank(
            ascending=ascending, method="average"
        )

        corr, pval = spearmanr(cat_rank, subset["PCT"])
        results[cat] = round(abs(corr), 4)
        valid_n[cat] = len(subset)

        direction = "(lower=better)" if ascending else "(higher=better)"
        print(f"  {cat:<6} {direction:<20}  r={corr:+.3f}  p={pval:.3f}  n={len(subset)}")

    return results, valid_n


def normalize_weights(raw_weights):
    total = sum(raw_weights.values())
    return {k: round(v / total, 4) for k, v in raw_weights.items()}


def main():
    print("Loading historical data...")
    df = load_all_seasons()
    print(f"  Total team-seasons loaded: {len(df)}")
    print(f"  Years: {sorted(df['Year'].unique())}\n")

    all_cats = BATTING_CATS + PITCHING_CATS_NEW
    # HD only exists 2020+, so it will have fewer data points — that's fine, we include it
    # since it IS a current category

    print("=== Category Correlations with Win PCT ===\n")
    print("Batting:")
    batting_raw, batting_n = compute_weights(df, BATTING_CATS)

    print("\nPitching:")
    pitching_raw, pitching_n = compute_weights(df, PITCHING_CATS_NEW)

    all_raw = {**batting_raw, **pitching_raw}
    all_n = {**batting_n, **batting_n, **pitching_n}

    print("\n=== Normalized Weights (sum to 1.0) ===")
    normalized = normalize_weights(all_raw)
    sorted_weights = dict(sorted(normalized.items(), key=lambda x: -x[1]))

    for cat, w in sorted_weights.items():
        bar = "█" * int(w * 200)
        print(f"  {cat:<6}  {w:.4f}  {bar}")

    output = {
        "weights": sorted_weights,
        "raw_correlations": all_raw,
        "sample_sizes": {k: int(v) for k, v in all_n.items()},
        "negative_categories": list(NEGATIVE_CATS),
        "notes": [
            "Weights derived from Spearman correlation between within-year category rank and PCT",
            "2019 AVG excluded due to corrupted data in source file",
            "HD only available from 2020 onwards (6 seasons)",
            "CG (Complete Games) was a category in 2016-2019 but replaced by HD — excluded from weights",
        ]
    }

    import os
    os.makedirs("output", exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nWeights saved to {OUTPUT_PATH}")
    return sorted_weights


if __name__ == "__main__":
    main()
