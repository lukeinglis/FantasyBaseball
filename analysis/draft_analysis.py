"""
Draft tendencies analysis for Tampa's Finest.

For each opponent (and yourself), builds a profile showing:
  - Position drafted by round
  - Category focus (which stats their roster targets)
  - Tendencies: when they take C, SP, RP, closers
  - Historical correlation: draft strategy vs finish

Run: python3 analysis/draft_analysis.py
Output: output/draft_profiles.csv, output/draft_profiles.html
"""

import pandas as pd
import json
import os
from pathlib import Path

SEASONS_DIR = Path("seasons")
OUTPUT_DIR  = Path("output")

# ── Team name aliases ──────────────────────────────────────────────────────
# Maps all historical names → canonical current name
TEAM_ALIASES = {
    # Luke Inglis — always named after current Orioles manager
    "Buck Showalter":     "Luke Inglis",
    "Brandon Hyde":       "Luke Inglis",
    "Tony Mansolino":     "Luke Inglis",

    # Sean Fitzpatrick
    "Smokin' Bases":               "Sean Fitzpatrick",

    # Ethan Wayne
    "Delray Beach Air Biscuits":   "Ethan Wayne",

    # Joel Seagraves
    "Cream City Cowtippers":       "Joel Seagraves",
    "Moooooose-Yeli Bombers":      "Joel Seagraves",
    "Moooooose-Yeti Bombers":      "Joel Seagraves",
    "Comeback Tour":               "Joel Seagraves",

    # Daniel Caron
    "Lisa dANN":                   "Daniel Caron",

    # Zack Kirstein
    "Daisy + Shay Bel-Airs":      "Zack Kirstein",
    "Shay Bel-Air GMY's":         "Zack Kirstein",
    "Bel Air GMY's":              "Zack Kirstein",
    "NY GMY's":                   "Zack Kirstein",

    # John Ballantine
    "MOArch Redbirds":             "John Ballantine",
    "Goldschmidt Happens":         "John Ballantine",

    # Tim Van Dalsum
    "The G.O.A.T":                 "Tim Van Dalsum",
    "Betts Against Us":            "Tim Van Dalsum",
    "Blue Haderade":               "Tim Van Dalsum",
    "Wander Vision":               "Tim Van Dalsum",

    # Ricky Krause & Michael Cornuta
    "Cash Betts Only":             "Ricky Krause & Michael Cornuta",

    # Roger Chaufournier & Lee Inglis — many team names over the years
    "The Houston Asstros":         "Roger Chaufournier & Lee Inglis",
    "Pfaadt Ass Trouts":           "Roger Chaufournier & Lee Inglis",
    "Soto Baggins":                "Roger Chaufournier & Lee Inglis",
    "The Basitt Hounds":           "Roger Chaufournier & Lee Inglis",
    "PeeWee Yermin":               "Roger Chaufournier & Lee Inglis",
    "A Song of Bryce and Fire":    "Roger Chaufournier & Lee Inglis",
    "A Song of  Bryce and Fire":   "Roger Chaufournier & Lee Inglis",
    "Harper Barely Know Her":      "Roger Chaufournier & Lee Inglis",
    "Triple A  Titties":           "Roger Chaufournier & Lee Inglis",
}

MY_TEAM = "Luke Inglis"

# ── Position classification from eligible_slots ───────────────────────────
def classify_position(eligible_slots: str) -> str:
    slots = set(s.strip() for s in str(eligible_slots).split(","))
    if "SP" in slots:  return "SP"
    if "RP" in slots:  return "RP"
    if "P"  in slots:  return "P"
    if "C"  in slots:  return "C"
    if "SS" in slots:  return "SS"
    if "2B" in slots:  return "2B"
    if "3B" in slots:  return "3B"
    if "1B" in slots:  return "1B"
    if "CF" in slots or "LF" in slots or "RF" in slots or "OF" in slots:
        return "OF"
    if "DH" in slots:  return "DH"
    return "UTIL"

def pitcher_type(eligible_slots: str) -> str:
    slots = set(s.strip() for s in str(eligible_slots).split(","))
    if "SP" in slots and "RP" not in slots: return "SP"
    if "RP" in slots and "SP" not in slots: return "RP"
    if "SP" in slots and "RP" in slots:     return "SP/RP"
    return "P"

# ── Load data ─────────────────────────────────────────────────────────────

def build_player_position_lookup():
    """Build player_name → primary position from all roster files."""
    lookup = {}
    for year_dir in sorted(SEASONS_DIR.iterdir()):
        path = year_dir / "rosters.csv"
        if not path.exists():
            continue
        df = pd.read_csv(path)
        for _, row in df.iterrows():
            name = row["player_name"]
            if name not in lookup and pd.notna(row.get("eligible_slots")):
                lookup[name] = {
                    "pos":      classify_position(str(row["eligible_slots"])),
                    "pit_type": pitcher_type(str(row["eligible_slots"])),
                    "slots":    str(row["eligible_slots"]),
                }
    print(f"  Player position lookup: {len(lookup)} players")
    return lookup


def load_draft_data(pos_lookup):
    frames = []
    for year_dir in sorted(SEASONS_DIR.iterdir()):
        path = year_dir / "draft_results.csv"
        if not path.exists():
            continue
        year = int(year_dir.name)
        if year > 2025:
            continue
        df = pd.read_csv(path)
        df["canonical_team"] = df["team"].map(TEAM_ALIASES)
        df["year"] = year

        # Enrich with position
        df["pos"]      = df["player_name"].map(lambda n: pos_lookup.get(n, {}).get("pos", "UNK"))
        df["pit_type"] = df["player_name"].map(lambda n: pos_lookup.get(n, {}).get("pit_type", ""))
        df["is_bat"]   = df["pos"].isin(["C","1B","2B","3B","SS","OF","DH","UTIL"])
        df["is_pit"]   = df["pos"].isin(["SP","RP","P","SP/RP"])
        df["is_sp"]    = df["pit_type"].isin(["SP","SP/RP"])
        df["is_rp"]    = df["pit_type"] == "RP"

        frames.append(df)

    df = pd.concat(frames, ignore_index=True)
    known = df[df["canonical_team"].notna()]
    print(f"  Draft rows: {len(df)} total, {len(known)} with known team alias")
    print(f"  Unrecognised teams: {sorted(df[df['canonical_team'].isna()]['team'].unique())}")
    return known


def load_standings():
    frames = []
    for year_dir in sorted(SEASONS_DIR.iterdir()):
        path = year_dir / "standings.csv"
        if not path.exists():
            continue
        df = pd.read_csv(path)
        df["year"] = int(year_dir.name)
        df["canonical_team"] = df["Team"].map(TEAM_ALIASES)

        # Normalise columns
        if "PCT" not in df.columns:
            df["PCT"] = df["W"] / (df["W"] + df["L"] + df.get("T", 0))

        frames.append(df[["year","canonical_team","RK","PCT"]].dropna(subset=["canonical_team"]))

    return pd.concat(frames, ignore_index=True)


# ── Per-team analysis ─────────────────────────────────────────────────────

ROUND_BUCKETS = {
    "Early (1-3)":  range(1, 4),
    "Mid   (4-8)":  range(4, 9),
    "Late  (9-14)": range(9, 15),
    "End (15+)":    range(15, 100),
}

def team_profile(team_name, draft_df, standings_df):
    td = draft_df[draft_df["canonical_team"] == team_name].copy()
    if len(td) == 0:
        return None

    years_active = sorted(td["year"].unique())
    seasons = len(years_active)

    # ── Round bucket breakdown ──
    bucket_rows = []
    for label, rng in ROUND_BUCKETS.items():
        bucket = td[td["round"].isin(rng)]
        if len(bucket) == 0:
            continue
        sp_pct  = bucket["is_sp"].mean()
        rp_pct  = bucket["is_rp"].mean()
        bat_pct = bucket["is_bat"].mean()
        c_pct   = (bucket["pos"] == "C").mean()
        ss_pct  = (bucket["pos"] == "SS").mean()
        of_pct  = (bucket["pos"] == "OF").mean()
        bucket_rows.append({
            "bucket": label,
            "picks":  len(bucket),
            "BAT%":   round(bat_pct * 100, 1),
            "SP%":    round(sp_pct  * 100, 1),
            "RP%":    round(rp_pct  * 100, 1),
            "C%":     round(c_pct   * 100, 1),
            "SS%":    round(ss_pct  * 100, 1),
            "OF%":    round(of_pct  * 100, 1),
        })

    # ── First pick of each type (average round) ──
    def avg_first_pick(mask):
        firsts = td[mask].groupby("year")["round"].min()
        return round(firsts.mean(), 1) if len(firsts) > 0 else "—"

    first_sp  = avg_first_pick(td["is_sp"])
    first_rp  = avg_first_pick(td["is_rp"])
    first_c   = avg_first_pick(td["pos"] == "C")
    first_ss  = avg_first_pick(td["pos"] == "SS")

    # ── Most frequently drafted players (last 3 years) ──
    recent = td[td["year"] >= 2023]
    top_players = (
        recent.groupby("player_name")
        .agg(times_drafted=("year","count"), avg_round=("round","mean"))
        .query("times_drafted >= 2")
        .sort_values(["times_drafted","avg_round"], ascending=[False,True])
        .head(10)
        .reset_index()
    )
    top_players["avg_round"] = top_players["avg_round"].round(1)

    # ── Standings history ──
    hist = standings_df[standings_df["canonical_team"] == team_name].sort_values("year")

    # ── Tendencies summary ──
    early = td[td["round"].isin(range(1, 4))]
    sp_early_pct = early["is_sp"].mean() if len(early) > 0 else 0
    bat_r1 = td[td["round"] == 1]["is_bat"].mean() if len(td[td["round"] == 1]) > 0 else 0

    tendencies = []
    if sp_early_pct >= 0.33:
        tendencies.append(f"Takes SP early ({sp_early_pct:.0%} of top-3 picks are SP)")
    if sp_early_pct < 0.15:
        tendencies.append("Avoids SP in early rounds — loads up on bats first")
    if bat_r1 == 1.0:
        tendencies.append("Always takes a batter in round 1")
    if first_c != "—" and isinstance(first_c, float) and first_c <= 5:
        tendencies.append(f"Targets catcher early (avg round {first_c})")
    if first_c != "—" and isinstance(first_c, float) and first_c >= 12:
        tendencies.append(f"Waits on catcher (avg round {first_c})")
    if first_rp != "—" and isinstance(first_rp, float) and first_rp >= 12:
        tendencies.append(f"Waits on relievers (avg round {first_rp})")

    return {
        "team":          team_name,
        "years_active":  years_active,
        "seasons":       seasons,
        "bucket_df":     pd.DataFrame(bucket_rows),
        "first_sp":      first_sp,
        "first_rp":      first_rp,
        "first_c":       first_c,
        "first_ss":      first_ss,
        "top_players":   top_players,
        "standings":     hist[["year","RK","PCT"]].to_dict("records"),
        "tendencies":    tendencies,
    }


# ── Print profiles ────────────────────────────────────────────────────────

def print_profile(p):
    marker = " ← YOU" if p["team"] == MY_TEAM else ""
    print(f"\n{'='*65}")
    print(f"  {p['team']}{marker}")
    print(f"  Years: {p['years_active']}  |  Seasons analysed: {p['seasons']}")
    print(f"{'='*65}")

    # Standings
    hist_str = "  ".join(
        f"{r['year']}:#{int(r['RK'])}" for r in p["standings"]
    )
    print(f"  Finish history: {hist_str}")

    # First pick averages
    print(f"\n  Avg round of first pick:")
    print(f"    SP: {p['first_sp']}   RP: {p['first_rp']}   "
          f"C: {p['first_c']}   SS: {p['first_ss']}")

    # Round bucket table
    print(f"\n  Draft composition by round bucket:")
    print(f"  {'Rounds':<14} {'BAT%':>6} {'SP%':>6} {'RP%':>6} "
          f"{'C%':>5} {'SS%':>5} {'OF%':>5}")
    for _, row in p["bucket_df"].iterrows():
        print(f"  {row['bucket']:<14} {row['BAT%']:>5}%  {row['SP%']:>5}%  "
              f"{row['RP%']:>5}%  {row['C%']:>4}%  {row['SS%']:>4}%  {row['OF%']:>4}%")

    # Tendencies
    if p["tendencies"]:
        print(f"\n  Key tendencies:")
        for t in p["tendencies"]:
            print(f"    • {t}")

    # Top recurring players
    if len(p["top_players"]) > 0:
        print(f"\n  Players drafted 2+ times (2023–2025):")
        for _, row in p["top_players"].iterrows():
            print(f"    {row['player_name']:<28} "
                  f"drafted {int(row['times_drafted'])}x  avg round {row['avg_round']}")


# ── Main ──────────────────────────────────────────────────────────────────

def main():
    print("=== Tampa's Finest — Draft Tendency Profiles ===\n")

    print("Building player position lookup...")
    pos_lookup = build_player_position_lookup()

    print("Loading draft data...")
    draft_df = load_draft_data(pos_lookup)

    print("Loading standings...")
    standings_df = load_standings()

    # Current 2026 teams
    current_teams = [
        "Craig Albernaz",
        "Smokin' Bases",
        "Delray Beach Air Biscuits",
        "Cream City Cowtippers",
        "Lisa dANN",
        "Daisy + Shay Bel-Airs",
        "MOArch Redbirds",
        "The G.O.A.T",
        "Cash Betts Only",
        "The Houston Asstros",
    ]

    profiles = []
    for team in current_teams:
        p = team_profile(team, draft_df, standings_df)
        if p:
            profiles.append(p)
            print_profile(p)

    # Save summary CSV
    OUTPUT_DIR.mkdir(exist_ok=True)
    summary_rows = []
    for p in profiles:
        row = {
            "team":     p["team"],
            "seasons":  p["seasons"],
            "first_sp": p["first_sp"],
            "first_rp": p["first_rp"],
            "first_c":  p["first_c"],
            "first_ss": p["first_ss"],
        }
        for r in p["standings"]:
            row[f"finish_{r['year']}"] = int(r["RK"])
        summary_rows.append(row)

    pd.DataFrame(summary_rows).to_csv(OUTPUT_DIR / "draft_profiles.csv", index=False)
    print(f"\n\nSummary saved to output/draft_profiles.csv")


if __name__ == "__main__":
    main()
