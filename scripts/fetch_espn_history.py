"""
Fetch historical ESPN Fantasy Baseball data for Tampa's Finest (leagueId=4739).

Pulls for each season:
  - matchups.csv     : weekly category-level W/L results
  - rosters.csv      : end-of-season team rosters
  - draft_results.csv: pick-by-pick draft order

Requirements:
  pip install espn-api

Authentication:
  The league is private so you need two cookies from your ESPN login session.
  1. Open https://www.espn.com in Chrome/Safari and log in
  2. Open Developer Tools -> Application -> Cookies -> espn.com
  3. Copy the values for:
       espn_s2   (long string starting with AE...)
       SWID      (string in curly braces like {XXXXXXXX-XXXX-...})
  4. Either pass them as arguments or set environment variables:
       export ESPN_S2="AE..."
       export ESPN_SWID="{XXXX...}"

Usage:
  python3 scripts/fetch_espn_history.py                        # all years
  python3 scripts/fetch_espn_history.py --years 2024 2025      # specific years
  python3 scripts/fetch_espn_history.py --espn-s2 "AE..." --swid "{XX...}"
"""

import os
import argparse
import pandas as pd
from pathlib import Path

LEAGUE_ID = 4739
# ESPN API availability varies by season. 2019+ is reliable; 2015-2018 may
# return partial data (draft/rosters often available, matchups less so).
# load_league() will catch failures gracefully per year.
AVAILABLE_YEARS = list(range(2015, 2027))

BATTING_CATS  = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG"]
PITCHING_CATS = ["K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"]
ALL_CATS      = BATTING_CATS + PITCHING_CATS

# ESPN API stat key -> our category name
ESPN_CAT_MAP = {
    "H": "H", "R": "R", "HR": "HR", "TB": "TB",
    "RBI": "RBI", "B_BB": "BB", "SB": "SB", "AVG": "AVG",
    "K": "K", "QS": "QS", "W": "W", "L": "L",
    "SV": "SV", "HLD": "HD", "ERA": "ERA", "WHIP": "WHIP",
}


def get_credentials(args):
    espn_s2 = args.espn_s2 or os.environ.get("ESPN_S2")
    swid    = args.swid    or os.environ.get("ESPN_SWID")
    if not espn_s2 or not swid:
        print(
            "\nMissing ESPN credentials.\n"
            "Set environment variables ESPN_S2 and ESPN_SWID, or pass them as args.\n"
            "See the top of this script for instructions on finding your cookies."
        )
        return None, None
    return espn_s2, swid


def load_league(year, espn_s2, swid):
    try:
        from espn_api.baseball import League
        league = League(
            league_id=LEAGUE_ID,
            year=year,
            espn_s2=espn_s2,
            swid=swid,
        )
        print(f"  Connected: {league.settings.name} {year} ({len(league.teams)} teams)")
        return league
    except Exception as e:
        print(f"  Could not load {year}: {e}")
        return None


# ---------------------------------------------------------------------------
# Matchups
# ---------------------------------------------------------------------------

def fetch_matchups(league, year):
    """
    Pull week-by-week category W/L results.
    Returns a DataFrame with one row per team per week.

    ESPN API provides per-category results in home_stats/away_stats:
      { 'H': {'value': 30.0, 'result': 'WIN'}, 'K': {'value': 63.0, 'result': 'LOSS'}, ... }
    """
    rows = []
    n_weeks = league.settings.reg_season_count

    def result_to_int(r):
        """WIN=1, TIE=0, LOSS=-1, None=None"""
        if r == "WIN":   return 1
        if r == "LOSS":  return -1
        if r == "TIE":   return 0
        return None

    def build_row(team, opp, stats, cats_won, cats_lost, cats_tied, week):
        row = {
            "year":      year,
            "week":      week,
            "team":      team.team_name,
            "opponent":  opp.team_name,
            "cats_won":  cats_won,
            "cats_lost": cats_lost,
            "cats_tied": cats_tied,
        }
        for espn_key, our_cat in ESPN_CAT_MAP.items():
            if espn_key in stats:
                row[f"{our_cat}_value"]  = stats[espn_key].get("value")
                row[f"{our_cat}_result"] = result_to_int(stats[espn_key].get("result"))
            else:
                row[f"{our_cat}_value"]  = None
                row[f"{our_cat}_result"] = None
        return row

    for week in range(1, n_weeks + 1):
        try:
            box_scores = league.box_scores(week)
        except Exception as e:
            print(f"    Week {week}: {e}")
            continue

        for m in box_scores:
            if not hasattr(m, 'home_stats') or not hasattr(m, 'away_stats'):
                continue
            if m.home_team == 0 or m.away_team == 0:
                continue
            rows.append(build_row(
                m.home_team, m.away_team, m.home_stats,
                m.home_wins, m.home_losses, m.home_ties, week
            ))
            rows.append(build_row(
                m.away_team, m.home_team, m.away_stats,
                m.away_wins, m.away_losses, m.away_ties, week
            ))

    df = pd.DataFrame(rows)
    print(f"    {len(df)} team-week rows ({n_weeks} weeks)")
    return df


# ---------------------------------------------------------------------------
# Rosters
# ---------------------------------------------------------------------------

def fetch_rosters(league, year):
    """Pull final rosters for each team."""
    rows = []
    for team in league.teams:
        for player in team.roster:
            rows.append({
                "year":           year,
                "team":           team.team_name,
                "player_name":    player.name,
                "position":       player.position,
                "eligible_slots": ",".join(str(s) for s in player.eligibleSlots) if hasattr(player, 'eligibleSlots') else "",
                "pro_team":       player.proTeam if hasattr(player, 'proTeam') else "",
            })
    df = pd.DataFrame(rows)
    print(f"    {len(df)} roster entries across {len(league.teams)} teams")
    return df


# ---------------------------------------------------------------------------
# Draft
# ---------------------------------------------------------------------------

def fetch_draft(league, year):
    """Pull draft results."""
    rows = []
    try:
        draft = league.draft
        for pick in draft:
            rows.append({
                "year":        year,
                "round":       pick.round_num,
                "pick":        pick.round_pick,
                "overall":     pick.bid_amount if hasattr(pick, 'bid_amount') else None,
                "team":        pick.team.team_name if pick.team else "",
                "player_name": pick.playerName,
                "keeper":      pick.keeper_status if hasattr(pick, 'keeper_status') else False,
            })
    except Exception as e:
        print(f"    Draft data unavailable: {e}")
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    print(f"    {len(df)} draft picks")
    return df


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def process_year(year, espn_s2, swid, force=False):
    out_dir = Path(f"seasons/{year}")
    out_dir.mkdir(parents=True, exist_ok=True)

    matchups_path = out_dir / "matchups.csv"
    rosters_path  = out_dir / "rosters.csv"
    draft_path    = out_dir / "draft_results.csv"

    already_have = all(p.exists() for p in [matchups_path, rosters_path, draft_path])
    if already_have and not force:
        print(f"  {year}: all files present, skipping (use --force to re-fetch)")
        return

    league = load_league(year, espn_s2, swid)
    if not league:
        return

    print(f"  Fetching matchups...")
    df_matchups = fetch_matchups(league, year)
    if not df_matchups.empty:
        df_matchups.to_csv(matchups_path, index=False)

    print(f"  Fetching rosters...")
    df_rosters = fetch_rosters(league, year)
    if not df_rosters.empty:
        df_rosters.to_csv(rosters_path, index=False)

    print(f"  Fetching draft...")
    df_draft = fetch_draft(league, year)
    if not df_draft.empty:
        df_draft.to_csv(draft_path, index=False)

    print(f"  {year}: done\n")


def main():
    parser = argparse.ArgumentParser(description="Fetch ESPN Fantasy Baseball history")
    parser.add_argument("--years",    nargs="+", type=int, default=AVAILABLE_YEARS,
                        help="Years to fetch (default: all available)")
    parser.add_argument("--espn-s2",  type=str, default=None, help="espn_s2 cookie value")
    parser.add_argument("--swid",     type=str, default=None, help="SWID cookie value")
    parser.add_argument("--force",    action="store_true",    help="Re-fetch even if files exist")
    args = parser.parse_args()

    espn_s2, swid = get_credentials(args)
    if not espn_s2:
        return

    print(f"\nFetching ESPN data for league {LEAGUE_ID}")
    print(f"Years: {args.years}\n")

    for year in sorted(args.years):
        if year not in AVAILABLE_YEARS:
            print(f"  {year}: not in available range {AVAILABLE_YEARS}, skipping")
            continue
        print(f"--- {year} ---")
        process_year(year, espn_s2, swid, force=args.force)

    print("\nAll done. Files written to seasons/YYYY/")
    print("\nNext steps:")
    print("  python3 analysis/category_weights.py   (re-run with richer matchup data)")
    print("  python3 analysis/player_rankings.py    (re-run rankings)")


if __name__ == "__main__":
    main()
