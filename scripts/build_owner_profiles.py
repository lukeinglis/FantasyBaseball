"""
Pull owner history from ESPN API and build the owners/ directory.

Creates:
  data/owner_history.csv       — raw row-per-owner-per-year data
  owners/owners.csv            — cleaned master owner table
  owners/{owner_slug}.md       — one profile file per owner

Usage:
  ESPN_S2="..." ESPN_SWID="..." python3 scripts/build_owner_profiles.py
"""

import os
import csv
import warnings
import pandas as pd
from pathlib import Path

warnings.filterwarnings("ignore")

LEAGUE_ID    = 4739
YEARS        = [2015, 2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025]
DATA_PATH    = Path("data/owner_history.csv")
OWNERS_DIR   = Path("owners")

# ESPN IDs for known co-owned teams — treat as single owner entry
# Key = canonical owner name, value = list of ESPN owner IDs that belong to them
CO_OWNER_MAP = {
    # Luke's team — co-owned with Lee Inglis (2015-2016) then Bob Inglis (2017+)
    "Luke Inglis": [
        "{E2C37AED-2B8C-4150-A45D-092D08BE8FE6}",  # luke inglis
        "{48B9EEF2-716E-4CBC-AE39-EC9618EE4937}",  # Bob Inglis (co-owner 2017+)
        "{A0CA0D72-6943-4600-8A0D-7269438600BE}",  # Lee Inglis (co-owner 2015-2016, old account)
    ],
    # Daisy + Shay Bel-Airs — Zack appears under two ESPN accounts
    "Zack Kirstein": [
        "{64116DDD-4476-4EE6-B5CC-9D453A1934CF}",  # Zack Kirstein
        "{DFA92E9D-84A3-4821-9A8C-C43863A5D05C}",  # Zachary Kirstein (same person)
    ],
    # Triple A Titties / Harper Barely Know Her / Houston Asstros — Roger & Lee Inglis
    "Roger Chaufournier & Lee Inglis": [
        "{34CAE905-05E9-4AFF-91F4-13B94780A45D}",  # Roger Chaufournier
        "{A1A33C57-82E7-412C-A258-97550E482B42}",  # Lee Inglis (new account, 2017+)
    ],
    # Cash Betts Only — co-owned by Ricky & Michael
    "Ricky Krause & Michael Cornuta": [
        "{3BDE9FB9-A909-486E-ADDF-497D779580AA}",  # Ricky Krause
        "{A83D2A95-5A0C-4DF3-A446-58FE425A5032}",  # Michael Cornuta
    ],
    # Joel S / Joel Seagraves — ESPN truncated the display name in later years
    "Joel Seagraves": [
        "{F09D4C18-7DA2-479A-9D4C-187DA2979A57}",  # Joel S / Joel Seagraves
    ],
}

# Build reverse map: ESPN ID → canonical name
ID_TO_CANONICAL = {}
for canonical, ids in CO_OWNER_MAP.items():
    for eid in ids:
        ID_TO_CANONICAL[eid] = canonical


def fetch_raw(espn_s2, swid):
    from espn_api.baseball import League
    rows = []
    for year in YEARS:
        league = League(league_id=LEAGUE_ID, year=year,
                        espn_s2=espn_s2, swid=swid)
        print(f"  {year}: {len(league.teams)} teams")
        for team in league.teams:
            for owner in team.owners:
                rows.append({
                    "year":         year,
                    "owner_id":     owner.get("id", ""),
                    "first_name":   owner.get("firstName", ""),
                    "last_name":    owner.get("lastName", ""),
                    "display_name": owner.get("displayName", ""),
                    "team_name":    team.team_name,
                    "team_abbrev":  team.team_abbrev,
                    "standing":     team.final_standing,
                    "wins":         team.wins,
                    "losses":       team.losses,
                    "ties":         team.ties,
                })
    return rows


def build_canonical(rows):
    """Collapse co-owners and duplicate accounts into single canonical rows."""
    seen = set()   # (year, canonical_name)
    clean = []
    for row in rows:
        canonical = ID_TO_CANONICAL.get(
            row["owner_id"],
            f"{row['first_name']} {row['last_name']}".strip()
        )
        key = (row["year"], canonical)
        if key in seen:
            continue
        seen.add(key)
        clean.append({**row, "owner": canonical})
    return clean


def slug(name):
    return name.lower().replace(" ", "_").replace("&", "and").replace("'", "")


def write_owner_md(owner_name, df_owner):
    seasons = df_owner.sort_values("year")
    total   = len(seasons)
    avg_fin = seasons["standing"].mean()
    best    = int(seasons["standing"].min())
    champs  = seasons[seasons["standing"] == 1]

    lines = [
        f"# {owner_name}",
        "",
        f"**Seasons in league:** {total}  ",
        f"**Avg finish:** #{avg_fin:.1f}  ",
        f"**Best finish:** #{best}  ",
        f"**Championships:** {len(champs)}",
        "",
        "## Season History",
        "",
        "| Year | Team Name | Finish | W | L | T |",
        "|---|---|---|---|---|---|",
    ]
    for _, row in seasons.iterrows():
        lines.append(
            f"| {int(row['year'])} | {row['team_name']} | "
            f"#{int(row['standing'])} | {int(row['wins'])} | "
            f"{int(row['losses'])} | {int(row['ties'])} |"
        )

    if len(champs) > 0:
        lines += ["", "## Championships", ""]
        for _, row in champs.iterrows():
            lines.append(f"- **{int(row['year'])}** — {row['team_name']}")

    out = OWNERS_DIR / f"{slug(owner_name)}.md"
    out.write_text("\n".join(lines) + "\n")
    return out


def write_master_csv(clean_rows):
    df = pd.DataFrame(clean_rows)
    out = OWNERS_DIR / "owners.csv"
    df[["year","owner","team_name","standing","wins","losses","ties"]]\
        .sort_values(["owner","year"])\
        .to_csv(out, index=False)
    print(f"  owners/owners.csv: {len(df)} rows")
    return df


def write_owners_readme(df):
    # One row per owner: current team, seasons, avg finish, best finish
    summary = (
        df.groupby("owner")
        .agg(
            seasons=("year", "count"),
            avg_finish=("standing", "mean"),
            best_finish=("standing", "min"),
            latest_team=("team_name", "last"),
            latest_year=("year", "max"),
        )
        .reset_index()
        .sort_values("avg_finish")
    )

    lines = [
        "# Tampa's Finest — Owner Directory",
        "",
        "All-time owner history pulled from ESPN Fantasy API.",
        "",
        "| Owner | Current Team | Seasons | Avg Finish | Best |",
        "|---|---|---|---|---|",
    ]
    for _, row in summary.iterrows():
        lines.append(
            f"| [{row['owner']}]({slug(row['owner'])}.md) "
            f"| {row['latest_team']} "
            f"| {int(row['seasons'])} "
            f"| #{row['avg_finish']:.1f} "
            f"| #{int(row['best_finish'])} |"
        )

    lines += [
        "",
        "## Notes",
        "- Co-owned teams (e.g. Daisy + Shay Bel-Airs, Cash Betts Only) are listed under a combined owner name",
        "- 2020 season data unavailable via ESPN API (COVID-shortened season)",
        "- 2016–2018 seasons predate ESPN API availability",
    ]

    (OWNERS_DIR / "README.md").write_text("\n".join(lines) + "\n")


def main():
    espn_s2 = os.environ.get("ESPN_S2")
    swid    = os.environ.get("ESPN_SWID")

    if not espn_s2 or not swid:
        print("Set ESPN_S2 and ESPN_SWID environment variables.")
        return

    print("Fetching owner data from ESPN...")
    rows = fetch_raw(espn_s2, swid)

    print("Collapsing co-owners and duplicate accounts...")
    clean = build_canonical(rows)

    # Save raw
    DATA_PATH.parent.mkdir(exist_ok=True)
    with open(DATA_PATH, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=rows[0].keys())
        w.writeheader()
        w.writerows(rows)
    print(f"  data/owner_history.csv: {len(rows)} raw rows")

    OWNERS_DIR.mkdir(exist_ok=True)
    df = write_master_csv(clean)

    print("Writing per-owner profile files...")
    for owner_name, grp in df.groupby("owner"):
        path = write_owner_md(owner_name, grp)
        print(f"  {path}")

    write_owners_readme(df)
    print("  owners/README.md")
    print("\nDone.")


if __name__ == "__main__":
    main()
