"""
Fetch ESPN 2026 projected stats for all players in the player pool.

Stats live in player.stats[] where id='102026' (statSourceId=1, statSplitTypeId=0).

Outputs:
  seasons/2026/projections/espn_batters.csv
  seasons/2026/projections/espn_pitchers.csv

Usage:
  ESPN_S2="..." ESPN_SWID="..." python3 scripts/fetch_espn_projections.py
"""

import os
import json
import argparse
import pandas as pd
from pathlib import Path

LEAGUE_ID = 4739
YEAR      = 2026
OUT_DIR   = Path("seasons/2026/projections")

# ── Confirmed ESPN stat ID → category name ─────────────────────────────────
# Verified from ESPN projected data (id='102026')
BATTING_STAT_MAP = {
    "1":  "H",    # Hits          (Judge: 170, Ohtani: 171, Alonso: 156)
    "2":  "AVG",  # Batting Avg   (Judge: 0.309, Ohtani: 0.287)
    "5":  "HR",   # Home Runs     (Judge: 53, Ohtani: 50)
    "8":  "TB",   # Total Bases   (Judge: 362, Ohtani: 363)
    "10": "BB",   # Walks         (Judge: 126, Ohtani: 97, Alonso: 59)
    "20": "R",    # Runs          (Judge: 133, Ohtani: 131)
    "21": "RBI",  # RBI           (Judge: 126, Ohtani: 109)
    "23": "SB",   # Stolen Bases  (Judge: 11, Ohtani: 23)
}

PITCHING_STAT_MAP = {
    "41": "WHIP",  # WHIP          (Skenes: 1.0, Helsley: 1.26)
    "47": "ERA",   # ERA           (Skenes: 2.61, Helsley: 3.79)
    "48": "K",     # Strikeouts    (Skenes: 220, Helsley: 69)
    "50": "SV",    # Saves         (Skenes: 2, Helsley: 4)
    "53": "W",     # Wins          (Skenes: 16, Holmes: 11)
    "54": "L",     # Losses        (Skenes: 5, Holmes: 7)
    "57": "HD",    # Holds         (Helsley: 28)
    "63": "QS",    # Quality Starts(Skenes: 27, Holmes: 18, Helsley: 0)
}

ESPN_TEAM_MAP = {
    1:"BAL", 2:"BOS", 3:"LAA", 4:"CWS", 5:"CLE", 6:"DET", 7:"KC", 8:"MIL",
    9:"MIN", 10:"NYY", 11:"OAK", 12:"SEA", 13:"TEX", 14:"TOR", 15:"ATL",
    16:"CHC", 17:"CIN", 18:"HOU", 19:"LAD", 20:"WSH", 21:"NYM", 22:"PHI",
    23:"PIT", 24:"STL", 25:"SD", 26:"SF", 27:"COL", 28:"MIA", 29:"ARI",
    30:"TB", 0:"FA",
}


def get_credentials():
    s2   = os.environ.get("ESPN_S2")
    swid = os.environ.get("ESPN_SWID")
    if not s2 or not swid:
        print("Set ESPN_S2 and ESPN_SWID environment variables.")
        return None, None
    return s2, swid


def connect(espn_s2, swid):
    from espn_api.baseball import League
    league = League(league_id=LEAGUE_ID, year=YEAR, espn_s2=espn_s2, swid=swid)
    print(f"Connected: {league.settings.name} {YEAR}")
    return league


def get_proj_2026(player_entry):
    """Extract id='102026' stat block from player.stats[]."""
    for s in player_entry.get("stats", []):
        if s.get("id") == "102026":
            return s.get("stats", {})
    return {}


def fetch_batch(league, offset=0, limit=300):
    filters = {
        "players": {
            "filterStatus": {"value": ["FREEAGENT", "ONTEAM", "WAIVERS"]},
            "sortDraftRanks": {"sortPriority": 1, "sortAsc": True, "value": "STANDARD"},
            "limit": limit,
            "offset": offset,
        }
    }
    resp = league.espn_request.league_get(
        params={"scoringPeriodId": 0, "view": "kona_player_info"},
        headers={"x-fantasy-filter": json.dumps(filters)}
    )
    players = resp.get("players", [])
    print(f"  offset={offset}: {len(players)} players")
    return players


def fetch_all(league, max_players=900):
    all_entries = []
    for offset in range(0, max_players, 300):
        batch = fetch_batch(league, offset=offset)
        if not batch:
            break
        all_entries.extend(batch)
        if len(batch) < 300:
            break
    print(f"Total: {len(all_entries)} players fetched")
    return all_entries


def build_dataframes(all_entries):
    batters  = []
    pitchers = []
    two_way  = []

    for pe in all_entries:
        player = pe.get("player", {})
        name      = player.get("fullName", "")
        player_id = player.get("id", 0)
        pro_team  = player.get("proTeamId", 0)
        slots     = set(player.get("eligibleSlots", []))

        proj = get_proj_2026(player)
        if not proj or not name:
            continue

        team_abbr = ESPN_TEAM_MAP.get(int(pro_team) if pro_team else 0, "FA")
        base = {"Name": name, "Team": team_abbr, "espn_id": player_id}

        # Classify by which stats are present in projection
        has_hitting  = "1" in proj or "5" in proj   # H or HR
        has_pitching = "47" in proj or "48" in proj  # ERA or K

        if has_hitting:
            row = {**base}
            for sid, cat in BATTING_STAT_MAP.items():
                row[cat] = proj.get(sid, 0) or 0
            batters.append(row)

        if has_pitching:
            row = {**base}
            for sid, cat in PITCHING_STAT_MAP.items():
                row[cat] = proj.get(sid, 0) or 0
            pitchers.append(row)

        if has_hitting and has_pitching:
            two_way.append(name)

    if two_way:
        print(f"Two-way players: {two_way}")

    return pd.DataFrame(batters), pd.DataFrame(pitchers)


def validate(df_bat, df_pit):
    print("\n=== VALIDATION ===")
    bat_cols = ["Name", "Team", "H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG"]
    pit_cols = ["Name", "Team", "K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"]

    for name in ["Aaron Judge", "Shohei Ohtani", "Juan Soto", "Bobby Witt Jr.", "Ronald Acuna Jr."]:
        row = df_bat[df_bat["Name"] == name]
        if not row.empty:
            print(row[bat_cols].to_string(index=False))

    print()
    for name in ["Paul Skenes", "Tarik Skubal", "Ryan Helsley", "Emmanuel Clase", "Clay Holmes"]:
        row = df_pit[df_pit["Name"] == name]
        if not row.empty:
            print(row[pit_cols].to_string(index=False))


def save(df_bat, df_pit):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    bat_path = OUT_DIR / "espn_batters.csv"
    pit_path = OUT_DIR / "espn_pitchers.csv"
    df_bat.to_csv(bat_path, index=False)
    df_pit.to_csv(pit_path, index=False)
    print(f"\nSaved {len(df_bat)} batters → {bat_path}")
    print(f"Saved {len(df_pit)} pitchers → {pit_path}")


def main():
    s2, swid = get_credentials()
    if not s2:
        return

    league = connect(s2, swid)

    print("\nFetching 2026 projected stats...")
    all_entries = fetch_all(league, max_players=900)

    print("\nBuilding dataframes...")
    df_bat, df_pit = build_dataframes(all_entries)

    validate(df_bat, df_pit)
    save(df_bat, df_pit)

    print("\nNext: python3 analysis/player_rankings.py")


if __name__ == "__main__":
    main()
