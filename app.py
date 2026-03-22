"""
Inglis War Room — Tampa's Finest Fantasy Baseball Dashboard
Run: streamlit run app.py
"""

import json
import subprocess
import pandas as pd
import streamlit as st
import plotly.express as px
import plotly.graph_objects as go
from pathlib import Path

# ── Page config ──────────────────────────────────────────────────────────────

st.set_page_config(
    page_title="Inglis War Room",
    page_icon="⚾",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Session state init ────────────────────────────────────────────────────────

if "drafted" not in st.session_state:
    st.session_state.drafted = []          # ordered list of all drafted player names
if "my_picks" not in st.session_state:
    st.session_state.my_picks = []         # player names I drafted (in order)
if "my_roster" not in st.session_state:
    st.session_state.my_roster = {}        # slot -> player name

DRAFT_SESSION_FILE = Path("output/draft_session.json")

def save_draft_session():
    DRAFT_SESSION_FILE.parent.mkdir(exist_ok=True)
    with open(DRAFT_SESSION_FILE, "w") as f:
        json.dump({
            "drafted":   st.session_state.drafted,
            "my_picks":  st.session_state.my_picks,
            "my_roster": st.session_state.my_roster,
        }, f)

def load_draft_session():
    if DRAFT_SESSION_FILE.exists():
        with open(DRAFT_SESSION_FILE) as f:
            data = json.load(f)
        st.session_state.drafted   = data.get("drafted", [])
        st.session_state.my_picks  = data.get("my_picks", [])
        st.session_state.my_roster = data.get("my_roster", {})

# Auto-load on first run
if "session_loaded" not in st.session_state:
    load_draft_session()
    st.session_state.session_loaded = True

# ── Roster config ────────────────────────────────────────────────────────────

# Tampa's Finest roster slots
LINEUP_SLOTS = ["C", "1B", "2B", "3B", "SS", "OF1", "OF2", "OF3", "UTIL",
                "SP1", "SP2", "SP3", "SP4", "SP5", "RP1", "RP2", "P1", "P2"]
BENCH_SLOTS  = ["BN1", "BN2", "BN3", "BN4", "BN5", "BN6"]
ALL_SLOTS    = LINEUP_SLOTS + BENCH_SLOTS

# Which positions can fill which slots
SLOT_ELIGIBILITY = {
    "C":    ["C"],
    "1B":   ["1B"],
    "2B":   ["2B"],
    "3B":   ["3B"],
    "SS":   ["SS"],
    "OF1":  ["OF"], "OF2": ["OF"], "OF3": ["OF"],
    "UTIL": ["C","1B","2B","3B","SS","OF","DH"],
    "SP1":  ["SP"], "SP2": ["SP"], "SP3": ["SP"], "SP4": ["SP"], "SP5": ["SP"],
    "RP1":  ["RP"], "RP2": ["RP"],
    "P1":   ["SP","RP"], "P2": ["SP","RP"],
    "BN1":  ["C","1B","2B","3B","SS","OF","DH","SP","RP"],
    "BN2":  ["C","1B","2B","3B","SS","OF","DH","SP","RP"],
    "BN3":  ["C","1B","2B","3B","SS","OF","DH","SP","RP"],
    "BN4":  ["C","1B","2B","3B","SS","OF","DH","SP","RP"],
    "BN5":  ["C","1B","2B","3B","SS","OF","DH","SP","RP"],
    "BN6":  ["C","1B","2B","3B","SS","OF","DH","SP","RP"],
}

BATTING_CATS  = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG"]
PITCHING_CATS = ["K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"]
RATE_CATS     = {"AVG", "ERA", "WHIP"}   # averaged, not summed

# ── Data loading ──────────────────────────────────────────────────────────────

@st.cache_data
def load_rankings():
    p = Path("output/draft_rankings.csv")
    if not p.exists():
        return None
    df = pd.read_csv(p)
    # The index was saved as 'Unnamed: 0'; rename to Overall_Rank (1-based)
    if "Unnamed: 0" in df.columns:
        df = df.rename(columns={"Unnamed: 0": "Overall_Rank"})
        df["Overall_Rank"] = df["Overall_Rank"] + 1   # convert 0-based to 1-based
    elif "Overall_Rank" not in df.columns:
        df.insert(0, "Overall_Rank", range(1, len(df) + 1))
    df["Type"] = df["Type"].fillna("BAT")
    # Merge finer position from ADP file
    adp_path = Path("seasons/2026/adp/espn_adp.csv")
    if adp_path.exists():
        adp = pd.read_csv(adp_path)[["Name", "Pos"]]
        df = df.merge(adp, on="Name", how="left", suffixes=("_old", ""))
        if "Pos_old" in df.columns:
            df["Pos"] = df["Pos"].fillna(df["Pos_old"])
            df.drop(columns=["Pos_old"], inplace=True)
    return df

@st.cache_data
def load_weights():
    p = Path("output/category_weights.json")
    if not p.exists():
        return None
    with open(p) as f:
        return json.load(f)

@st.cache_data
def load_owners():
    p = Path("owners/owners.csv")
    if not p.exists():
        return None
    return pd.read_csv(p)

@st.cache_data
def load_standings_all():
    frames = []
    for year_dir in sorted(Path("seasons").iterdir()):
        p = year_dir / "standings.csv"
        if not p.exists():
            continue
        df = pd.read_csv(p)
        df["year"] = int(year_dir.name)
        frames.append(df)
    return pd.concat(frames, ignore_index=True) if frames else None

@st.cache_data
def load_draft_profiles():
    p = Path("output/draft_profiles.csv")
    return pd.read_csv(p) if p.exists() else None

@st.cache_data
def load_all_drafts():
    frames = []
    for year_dir in sorted(Path("seasons").iterdir()):
        p = year_dir / "draft_results.csv"
        if not p.exists():
            continue
        df = pd.read_csv(p)
        df["year"] = int(year_dir.name)
        frames.append(df)
    return pd.concat(frames, ignore_index=True) if frames else None

@st.cache_data
def load_proj_batters():
    p = Path("seasons/2026/projections/espn_batters.csv")
    return pd.read_csv(p) if p.exists() else None

@st.cache_data
def load_proj_pitchers():
    p = Path("seasons/2026/projections/espn_pitchers.csv")
    return pd.read_csv(p) if p.exists() else None

# ── Sidebar ───────────────────────────────────────────────────────────────────

st.sidebar.title("⚾ Inglis War Room")
st.sidebar.caption("Tampa's Finest · ESPN League · 2026 Draft")
st.sidebar.markdown("---")

page = st.sidebar.radio(
    "Navigate",
    ["Draft Board", "My Team", "Position Scarcity",
     "Category Intel", "Opponent Scouting", "League History", "Owner Records"],
    index=0,
)

st.sidebar.markdown("---")

# ── Draft status badge ──
n_drafted = len(st.session_state.drafted)
n_mine    = len(st.session_state.my_picks)
st.sidebar.markdown(f"### 📋 Draft Status")
st.sidebar.markdown(f"**{n_drafted}** players off the board  |  **{n_mine}** my picks")

if n_drafted > 0:
    round_num = (n_drafted // 10) + 1
    pick_in_round = (n_drafted % 10) + 1
    st.sidebar.caption(f"Approx round {round_num}, pick {pick_in_round}")

# Undo last pick
col_a, col_b = st.sidebar.columns(2)
with col_a:
    if st.button("↩ Undo last", use_container_width=True) and st.session_state.drafted:
        last = st.session_state.drafted[-1]
        st.session_state.drafted.pop()
        if last in st.session_state.my_picks:
            st.session_state.my_picks.remove(last)
        save_draft_session()
        st.rerun()
with col_b:
    if st.button("🗑 Reset draft", use_container_width=True):
        st.session_state.drafted  = []
        st.session_state.my_picks = []
        st.session_state.my_roster = {}
        save_draft_session()
        st.rerun()

st.sidebar.markdown("---")

# ── Update button ──
st.sidebar.markdown("### 🔄 Refresh Data")
espn_s2   = st.sidebar.text_input("ESPN_S2", type="password",
                                   help="Paste your espn_s2 cookie to refresh projections")
espn_swid = st.sidebar.text_input("ESPN_SWID",
                                   help="Paste your SWID cookie (with curly braces)")

if st.sidebar.button("Update Rankings", use_container_width=True):
    if not espn_s2 or not espn_swid:
        st.sidebar.error("Enter ESPN_S2 and ESPN_SWID first.")
    else:
        with st.sidebar:
            with st.spinner("Fetching ESPN 2026 projections..."):
                env = {"ESPN_S2": espn_s2, "ESPN_SWID": espn_swid}
                import os
                full_env = {**os.environ, **env}
                r1 = subprocess.run(
                    ["python3", "scripts/fetch_espn_projections.py"],
                    capture_output=True, text=True, env=full_env
                )
            if r1.returncode != 0:
                st.error(f"Projection fetch failed:\n{r1.stderr[-500:]}")
            else:
                with st.spinner("Re-running rankings..."):
                    r2 = subprocess.run(
                        ["python3", "analysis/player_rankings.py"],
                        capture_output=True, text=True
                    )
                if r2.returncode != 0:
                    st.error(f"Rankings failed:\n{r2.stderr[-500:]}")
                else:
                    st.cache_data.clear()
                    st.success("Rankings updated!")
                    st.rerun()


# ════════════════════════════════════════════════════════════════════════════
# PAGE 1 — DRAFT BOARD
# ════════════════════════════════════════════════════════════════════════════

if page == "Draft Board":
    st.title("⚾ Draft Board")
    st.caption("ESPN 2026 projected stats · league-specific category weights · click a player to draft them")

    rankings = load_rankings()
    if rankings is None:
        st.error("Run `python3 analysis/player_rankings.py` first.")
        st.stop()

    drafted_set = set(st.session_state.drafted)

    # ── Filters ──
    col_f1, col_f2, col_f3, col_f4 = st.columns([2, 2, 2, 3])
    with col_f1:
        player_type = st.radio("Type", ["All", "Batters", "Pitchers"], horizontal=True)
    with col_f2:
        show_avail = st.toggle("Available only", value=True)
    with col_f3:
        pos_options = sorted(rankings["Pos"].dropna().unique())
        selected_pos = st.multiselect("Position", pos_options)
    with col_f4:
        search = st.text_input("🔍 Search player", "")

    df = rankings.copy()
    df["drafted"] = df["Name"].isin(drafted_set)

    if player_type == "Batters":
        df = df[df["Type"] == "BAT"]
    elif player_type == "Pitchers":
        df = df[df["Type"] == "PIT"]
    if selected_pos:
        df = df[df["Pos"].isin(selected_pos)]
    if search:
        df = df[df["Name"].str.contains(search, case=False, na=False)]
    if show_avail:
        df = df[~df["drafted"]]

    # ── Top 5 value callout ──
    avail = rankings[~rankings["Name"].isin(drafted_set)]
    top5 = avail.head(5)
    cols = st.columns(5)
    for i, (_, row) in enumerate(top5.iterrows()):
        with cols[i]:
            pos_label = row.get("Pos", row["Type"])
            st.metric(
                f"#{int(row.get('Overall_Rank', i+1))} {row['Name']}",
                f"{row['Team']} · {pos_label}",
                f"z={row['z_total']:.2f}"
            )

    st.markdown("---")

    # ── Draft action row ──
    col_d1, col_d2, col_d3 = st.columns([3, 2, 2])
    with col_d1:
        draft_name = st.text_input("Draft a player (type name)", key="draft_input",
                                    placeholder="e.g. Aaron Judge")
    with col_d2:
        is_my_pick = st.checkbox("This is MY pick", value=True)
    with col_d3:
        st.write("")
        st.write("")
        if st.button("✅ Confirm Pick", use_container_width=True):
            if draft_name.strip():
                # fuzzy match
                matches = rankings[rankings["Name"].str.contains(draft_name.strip(), case=False, na=False)]
                if len(matches) == 0:
                    st.warning(f"No player found matching '{draft_name}'")
                elif len(matches) > 1 and draft_name.strip() not in matches["Name"].values:
                    st.warning(f"Multiple matches: {', '.join(matches['Name'].head(5))}")
                else:
                    name = matches.iloc[0]["Name"]
                    if name not in drafted_set:
                        st.session_state.drafted.append(name)
                        if is_my_pick:
                            st.session_state.my_picks.append(name)
                        save_draft_session()
                        drafted_set.add(name)
                        st.success(f"Drafted: {name}" + (" (your pick)" if is_my_pick else ""))
                        st.rerun()
                    else:
                        st.info(f"{name} already drafted.")

    # ── Main table ──
    has_espn = "espn_rank" in df.columns
    bat_cols = ["Name", "Team", "Pos", "z_total", "H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG"]
    pit_cols = ["Name", "Team", "Pos", "z_total", "K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"]
    all_cols = ["Name", "Team", "Pos", "Type", "z_total"]

    if has_espn:
        rank_cols = ["Overall_Rank", "espn_rank"]
    else:
        rank_cols = ["Overall_Rank"]

    if player_type == "Batters":
        show_cols = rank_cols + bat_cols
    elif player_type == "Pitchers":
        show_cols = rank_cols + pit_cols
    else:
        show_cols = rank_cols + all_cols

    show_cols = [c for c in show_cols if c in df.columns]
    display_df = df[show_cols + (["drafted"] if "drafted" in df.columns and not show_avail else [])].copy()
    display_df = display_df.reset_index(drop=True)

    if has_espn:
        display_df["Diff"] = display_df["Overall_Rank"] - display_df["espn_rank"]
        display_df = display_df.rename(columns={
            "Overall_Rank": "WR#", "espn_rank": "ESPN#"
        })

    def colour_z(val):
        if not isinstance(val, (int, float)): return ""
        if val >= 1.0:   return "background-color: #1a472a; color: white"
        if val >= 0.5:   return "background-color: #2d6a4f; color: white"
        if val >= 0.0:   return "background-color: #40916c; color: white"
        if val >= -0.3:  return "background-color: #74c69d"
        return "background-color: #d8f3dc"

    def colour_diff(val):
        if not isinstance(val, (int, float)): return ""
        if val <= -20:  return "background-color: #1a472a; color: white"
        if val <= -5:   return "background-color: #40916c; color: white"
        if val >= 20:   return "background-color: #9d0208; color: white"
        if val >= 5:    return "background-color: #e85d04; color: white"
        return ""

    styled = display_df.style.map(colour_z, subset=["z_total"] if "z_total" in display_df.columns else [])
    if "Diff" in display_df.columns:
        styled = styled.map(colour_diff, subset=["Diff"])

    st.dataframe(styled, use_container_width=True, height=620)
    avail_count = len(rankings[~rankings["Name"].isin(drafted_set)])
    st.caption(f"{len(df)} shown · {avail_count} available · {n_drafted} drafted total")

    # ── Value vs ESPN scatter ──
    if has_espn:
        st.markdown("---")
        st.subheader("Our Rank vs ESPN Rank")
        scatter_df = rankings[rankings.get("espn_rank", pd.Series([999]*len(rankings))) < 500].copy() \
            if "espn_rank" in rankings.columns else pd.DataFrame()
        if not scatter_df.empty:
            scatter_df = scatter_df[~scatter_df["Name"].isin(drafted_set)]
            scatter_df["gap"] = scatter_df["Overall_Rank"] - scatter_df["espn_rank"]
            scatter_df["label"] = scatter_df.apply(
                lambda r: r["Name"] if abs(r["gap"]) >= 20 else "", axis=1)
            max_r = min(scatter_df[["Overall_Rank","espn_rank"]].max().max(), 300)
            fig = go.Figure()
            fig.add_trace(go.Scatter(x=[1,max_r], y=[1,max_r], mode="lines",
                                     line=dict(dash="dash", color="grey"), showlegend=False))
            fig.add_trace(go.Scatter(
                x=scatter_df["espn_rank"], y=scatter_df["Overall_Rank"],
                mode="markers+text", text=scatter_df["label"],
                textposition="top center", textfont=dict(size=9),
                marker=dict(color=scatter_df["gap"],
                            colorscale=[[0,"#1a472a"],[0.5,"#aaa"],[1,"#9d0208"]],
                            size=7, showscale=True,
                            colorbar=dict(title="We rank<br>higher ← → ESPN")),
                hovertemplate="<b>%{text}</b><br>ESPN: #%{x}<br>War Room: #%{y}<extra></extra>"
            ))
            fig.update_layout(xaxis_title="ESPN Rank", yaxis_title="War Room Rank",
                              height=420, margin=dict(t=10))
            fig.update_yaxes(autorange="reversed")
            fig.update_xaxes(autorange="reversed")
            st.plotly_chart(fig, use_container_width=True)

    csv = df.to_csv(index=False).encode()
    st.download_button("Download CSV", csv, "war_room_rankings.csv", "text/csv")


# ════════════════════════════════════════════════════════════════════════════
# PAGE 2 — MY TEAM
# ════════════════════════════════════════════════════════════════════════════

elif page == "My Team":
    st.title("🏟️ My Team")
    st.caption("Build your roster from your picks · projected stats update as you add players")

    rankings = load_rankings()
    proj_bat = load_proj_batters()
    proj_pit = load_proj_pitchers()

    if rankings is None:
        st.error("Run rankings first.")
        st.stop()

    my_picks = st.session_state.my_picks
    my_roster = st.session_state.my_roster

    if not my_picks:
        st.info("No picks recorded yet. Use the **Draft Board** to mark your picks.")
        st.stop()

    # ── Roster graphic ──────────────────────────────────────────────────────
    st.subheader("Roster Slots")
    st.caption("Assign your picks to roster spots. Unassigned picks sit in the player pool below.")

    # Get position for each of my picks
    def get_pos(name):
        row = rankings[rankings["Name"] == name]
        if not row.empty:
            return str(row.iloc[0].get("Pos", "?"))
        return "?"

    pick_pos = {p: get_pos(p) for p in my_picks}

    # Already assigned players
    assigned = set(my_roster.values())
    unassigned = [p for p in my_picks if p not in assigned]

    # ── Batting lineup ──
    st.markdown("##### Batting Lineup")
    bat_slot_order = ["C", "1B", "2B", "3B", "SS", "OF1", "OF2", "OF3", "UTIL"]
    bat_cols = st.columns(len(bat_slot_order))

    for i, slot in enumerate(bat_slot_order):
        with bat_cols[i]:
            eligible_pos = SLOT_ELIGIBILITY[slot]
            eligible_picks = ["— empty —"] + [
                p for p in my_picks
                if pick_pos.get(p, "?") in eligible_pos or slot.startswith("BN")
            ]
            current = my_roster.get(slot, "— empty —")
            if current not in eligible_picks:
                eligible_picks.insert(1, current)
            idx = eligible_picks.index(current) if current in eligible_picks else 0

            label_color = "🟢" if current != "— empty —" else "⬜"
            chosen = st.selectbox(
                f"{label_color} {slot}",
                eligible_picks, index=idx, key=f"slot_{slot}"
            )
            if chosen != my_roster.get(slot):
                if chosen == "— empty —":
                    my_roster.pop(slot, None)
                else:
                    my_roster[slot] = chosen
                st.session_state.my_roster = my_roster
                save_draft_session()
                st.rerun()

    # ── Pitching lineup ──
    st.markdown("##### Pitching Staff")
    pit_slot_order = ["SP1", "SP2", "SP3", "SP4", "SP5", "RP1", "RP2", "P1", "P2"]
    pit_cols = st.columns(len(pit_slot_order))

    for i, slot in enumerate(pit_slot_order):
        with pit_cols[i]:
            eligible_pos = SLOT_ELIGIBILITY[slot]
            eligible_picks = ["— empty —"] + [
                p for p in my_picks
                if pick_pos.get(p, "?") in eligible_pos
            ]
            current = my_roster.get(slot, "— empty —")
            if current not in eligible_picks:
                eligible_picks.insert(1, current)
            idx = eligible_picks.index(current) if current in eligible_picks else 0

            label_color = "🔵" if current != "— empty —" else "⬜"
            chosen = st.selectbox(
                f"{label_color} {slot}",
                eligible_picks, index=idx, key=f"slot_{slot}"
            )
            if chosen != my_roster.get(slot):
                if chosen == "— empty —":
                    my_roster.pop(slot, None)
                else:
                    my_roster[slot] = chosen
                st.session_state.my_roster = my_roster
                save_draft_session()
                st.rerun()

    # ── Bench ──
    st.markdown("##### Bench")
    bench_cols = st.columns(6)
    for i, slot in enumerate(BENCH_SLOTS):
        with bench_cols[i]:
            all_picks_opt = ["— empty —"] + my_picks
            current = my_roster.get(slot, "— empty —")
            if current not in all_picks_opt:
                all_picks_opt.insert(1, current)
            idx = all_picks_opt.index(current) if current in all_picks_opt else 0
            chosen = st.selectbox(f"⬛ {slot}", all_picks_opt, index=idx, key=f"slot_{slot}")
            if chosen != my_roster.get(slot):
                if chosen == "— empty —":
                    my_roster.pop(slot, None)
                else:
                    my_roster[slot] = chosen
                st.session_state.my_roster = my_roster
                save_draft_session()
                st.rerun()

    # ── Unassigned picks ──
    assigned = set(my_roster.values())
    unassigned = [p for p in my_picks if p not in assigned]
    if unassigned:
        st.markdown(f"**Unassigned picks ({len(unassigned)}):** " + ", ".join(unassigned))

    st.markdown("---")

    # ── Projected stat totals ────────────────────────────────────────────────
    st.subheader("Projected Stats")

    rostered_players = list(set(my_roster.values()))

    if not rostered_players:
        st.info("Assign players to roster slots above to see projected totals.")
    else:
        # Split by batter/pitcher
        rostered_bat = []
        rostered_pit = []
        for name in rostered_players:
            row = rankings[rankings["Name"] == name]
            if not row.empty:
                t = row.iloc[0].get("Type", "BAT")
                if t == "BAT":
                    rostered_bat.append(name)
                else:
                    rostered_pit.append(name)

        col_b, col_p = st.columns(2)

        with col_b:
            st.markdown("**Batting**")
            if proj_bat is not None and rostered_bat:
                bat_sub = proj_bat[proj_bat["Name"].isin(rostered_bat)]
                totals_bat = {}
                for cat in BATTING_CATS:
                    if cat not in bat_sub.columns:
                        continue
                    if cat == "AVG":
                        # weighted by H/AB would be ideal but proj_bat has AVG directly
                        totals_bat[cat] = round(bat_sub[cat].mean(), 3)
                    else:
                        totals_bat[cat] = round(bat_sub[cat].sum(), 1)
                tdf = pd.DataFrame([totals_bat])
                st.dataframe(tdf, use_container_width=True, hide_index=True)

                # Individual batter rows
                show_bat = bat_sub[["Name", "Team"] + [c for c in BATTING_CATS if c in bat_sub.columns]]
                st.dataframe(show_bat.sort_values("HR", ascending=False).reset_index(drop=True),
                             use_container_width=True)
            else:
                st.info("No batters rostered yet.")

        with col_p:
            st.markdown("**Pitching**")
            if proj_pit is not None and rostered_pit:
                pit_sub = proj_pit[proj_pit["Name"].isin(rostered_pit)]
                totals_pit = {}
                for cat in PITCHING_CATS:
                    if cat not in pit_sub.columns:
                        continue
                    if cat in {"ERA", "WHIP"}:
                        totals_pit[cat] = round(pit_sub[cat].mean(), 2)
                    else:
                        totals_pit[cat] = round(pit_sub[cat].sum(), 1)
                tdf = pd.DataFrame([totals_pit])
                st.dataframe(tdf, use_container_width=True, hide_index=True)

                show_pit = pit_sub[["Name", "Team"] + [c for c in PITCHING_CATS if c in pit_sub.columns]]
                st.dataframe(show_pit.sort_values("K", ascending=False).reset_index(drop=True),
                             use_container_width=True)
            else:
                st.info("No pitchers rostered yet.")


# ════════════════════════════════════════════════════════════════════════════
# PAGE 3 — POSITION SCARCITY
# ════════════════════════════════════════════════════════════════════════════

elif page == "Position Scarcity":
    st.title("📉 Position Scarcity")
    st.caption("How many quality players remain at each position as the draft progresses")

    rankings = load_rankings()
    if rankings is None:
        st.error("Run rankings first.")
        st.stop()

    drafted_set = set(st.session_state.drafted)

    # ── Config ──
    NUM_TEAMS    = 10
    TIERS = {
        "Elite":   range(1, 4),    # top 3
        "Great":   range(4, 9),    # 4-8
        "Solid":   range(9, 16),   # 9-15
        "Depth":   range(16, 30),  # 16-30
    }

    # Map broad positions
    def broad_pos(pos):
        if str(pos) in ["SP"]:  return "SP"
        if str(pos) in ["RP"]:  return "RP"
        if str(pos) == "C":     return "C"
        if str(pos) == "SS":    return "SS"
        if str(pos) == "2B":    return "2B"
        if str(pos) == "3B":    return "3B"
        if str(pos) == "1B":    return "1B"
        if str(pos) in ["OF","CF","LF","RF"]: return "OF"
        if str(pos) in ["DH","UTIL"]: return "DH/UTIL"
        return None

    positions_of_interest = ["C", "1B", "2B", "3B", "SS", "OF", "SP", "RP"]

    # Build per-position ranked lists
    df = rankings.copy()
    df["broad"] = df["Pos"].apply(broad_pos)
    df = df.dropna(subset=["broad"])

    avail_df  = df[~df["Name"].isin(drafted_set)]
    all_df    = df.copy()

    st.markdown(f"**{len(drafted_set)} players drafted** — {len(rankings) - len(drafted_set)} remaining in pool")
    st.markdown("---")

    # ── Scarcity overview grid ──
    cols = st.columns(4)
    col_idx = 0

    scarcity_data = []

    for pos in positions_of_interest:
        pos_all   = all_df[all_df["broad"] == pos].reset_index(drop=True)
        pos_avail = avail_df[avail_df["broad"] == pos].reset_index(drop=True)

        total_draftable = len(pos_all[pos_all["z_total"] > -0.5])
        avail_elite = len(pos_avail[pos_avail["z_total"] >= 0.5])
        avail_solid = len(pos_avail[pos_avail["z_total"] >= 0.0])
        taken       = len(pos_all) - len(pos_avail)

        # Scarcity score: how depleted is the elite tier?
        elite_total = len(pos_all[pos_all["z_total"] >= 0.5])
        scarcity_pct = (elite_total - avail_elite) / max(elite_total, 1) * 100

        if scarcity_pct >= 75: urgency = "🔴 CRITICAL"
        elif scarcity_pct >= 50: urgency = "🟠 DEPLETING"
        elif scarcity_pct >= 25: urgency = "🟡 WATCH"
        else: urgency = "🟢 OK"

        scarcity_data.append({
            "Position": pos, "urgency": urgency,
            "Elite avail": avail_elite, "Solid avail": avail_solid,
            "Taken": taken, "scarcity_pct": scarcity_pct,
        })

        with cols[col_idx % 4]:
            st.metric(
                label=f"{urgency} {pos}",
                value=f"{avail_elite} elite left",
                delta=f"{avail_solid} solid · {taken} taken",
                delta_color="off"
            )
        col_idx += 1

    st.markdown("---")

    # ── Scarcity bar chart ──
    sdf = pd.DataFrame(scarcity_data).sort_values("scarcity_pct", ascending=False)
    fig = px.bar(sdf, x="Position", y="scarcity_pct",
                 color="scarcity_pct",
                 color_continuous_scale=[[0,"#2d6a4f"],[0.5,"#f4a261"],[1,"#9d0208"]],
                 labels={"scarcity_pct": "% Elite Tier Drafted"},
                 title="Position Depletion (% of elite tier already taken)")
    fig.update_layout(height=320, margin=dict(t=40), showlegend=False,
                      coloraxis_showscale=False)
    fig.update_yaxes(range=[0, 100])
    st.plotly_chart(fig, use_container_width=True)

    st.markdown("---")

    # ── Per-position depth tables ──
    sel_pos = st.selectbox("Drill into a position", positions_of_interest)
    pos_data = avail_df[avail_df["broad"] == sel_pos].copy()
    pos_data = pos_data.sort_values("z_total", ascending=False).reset_index(drop=True)
    pos_data.index += 1

    # Add tier labels
    def tier_label(z):
        if z >= 0.8: return "⭐ Elite"
        if z >= 0.4: return "✅ Great"
        if z >= 0.0: return "👍 Solid"
        return "📦 Depth"

    pos_data["Tier"] = pos_data["z_total"].apply(tier_label)

    bat_stat_cols = [c for c in ["H","R","HR","TB","RBI","BB","SB","AVG"] if c in pos_data.columns]
    pit_stat_cols = [c for c in ["K","QS","W","L","SV","HD","ERA","WHIP"] if c in pos_data.columns]
    stat_cols = bat_stat_cols if bat_stat_cols else pit_stat_cols

    show_cols = ["Tier", "Name", "Team", "z_total"] + stat_cols
    show_cols = [c for c in show_cols if c in pos_data.columns]

    # Add ADP column if available
    if "espn_rank" in pos_data.columns:
        show_cols = ["Tier", "Name", "Team", "z_total", "espn_rank"] + stat_cols
        show_cols = [c for c in show_cols if c in pos_data.columns]

    st.subheader(f"Available {sel_pos}s ({len(pos_data)} remaining)")

    def colour_tier(val):
        if "Elite" in str(val):  return "background-color: #1a472a; color: white"
        if "Great" in str(val):  return "background-color: #2d6a4f; color: white"
        if "Solid" in str(val):  return "background-color: #40916c; color: white"
        return ""

    styled_pos = pos_data[show_cols].style.map(colour_tier, subset=["Tier"])
    st.dataframe(styled_pos, use_container_width=True, height=480)

    # How many per team should be targeting this position
    n_slots_per_team = {"C":1,"1B":1,"2B":1,"3B":1,"SS":1,"OF":4,"SP":7,"RP":4}
    slots = n_slots_per_team.get(sel_pos, 2)
    demand = NUM_TEAMS * slots
    supply = len(pos_data[pos_data["z_total"] >= 0.0])
    st.caption(f"Estimated demand: {NUM_TEAMS} teams × ~{slots} {sel_pos} slots = {demand} needed · "
               f"{supply} solid-or-better available → "
               f"{'⚠️ shortage likely' if supply < demand else '✅ enough supply'}")


# ════════════════════════════════════════════════════════════════════════════
# PAGE 4 — CATEGORY INTEL
# ════════════════════════════════════════════════════════════════════════════

elif page == "Category Intel":
    st.title("📊 Category Intel")
    st.caption("What actually predicts winning in Tampa's Finest")

    weights_data = load_weights()
    if weights_data is None:
        st.error("Run `python3 analysis/category_weights.py` first.")
        st.stop()

    weights  = weights_data["weights"]
    corrs    = weights_data["raw_correlations"]
    neg_cats = weights_data.get("negative_categories", [])

    wdf = pd.DataFrame([
        {"Category": k, "Weight": v * 100, "Lower=Better": k in neg_cats}
        for k, v in sorted(weights.items(), key=lambda x: -x[1])
    ])

    col1, col2 = st.columns([2, 1])
    with col1:
        fig = px.bar(wdf, x="Weight", y="Category", orientation="h",
                     color="Lower=Better",
                     color_discrete_map={True: "#e63946", False: "#2d6a4f"},
                     labels={"Weight": "Weight (%)", "Lower=Better": "Lower = Better"},
                     title="Category Weights (H2H matchup-derived)")
        fig.update_layout(height=500, yaxis={"categoryorder": "total ascending"}, margin=dict(t=40))
        st.plotly_chart(fig, use_container_width=True)
    with col2:
        st.markdown("### Weight Summary")
        for _, row in wdf.iterrows():
            arrow = "↓" if row["Lower=Better"] else ""
            st.write(f"**{row['Category']}{arrow}** — {row['Weight']:.1f}%")

    st.markdown("---")
    st.subheader("Key Draft Takeaways")
    top3    = wdf.head(3)["Category"].tolist()
    bottom3 = wdf.tail(3)["Category"].tolist()
    col1, col2, col3 = st.columns(3)
    with col1:
        st.success(f"**Target heavily:** {', '.join(top3)}\n\nMost predictive — prioritise players who dominate here.")
    with col2:
        st.warning(f"**Closers are a trap:** SV = {weights.get('SV',0)*100:.1f}%\n\nDon't reach for closers early.")
    with col3:
        st.info(f"**Deprioritise:** {', '.join(bottom3)}\n\nLeast predictive — fill late or stream.")

    st.markdown("---")
    cdf = pd.DataFrame([
        {"Category": k, "Correlation": v, "Weight (%)": weights.get(k, 0) * 100,
         "Type": "Pitching" if k in ["K","QS","W","L","SV","HD","ERA","WHIP"] else "Batting"}
        for k, v in corrs.items()
    ])
    fig2 = px.scatter(cdf, x="Correlation", y="Weight (%)", text="Category",
                      color="Type", size=[10]*len(cdf),
                      color_discrete_map={"Batting": "#2d6a4f", "Pitching": "#1d3557"})
    fig2.update_traces(textposition="top center")
    fig2.update_layout(height=400, margin=dict(t=20))
    st.plotly_chart(fig2, use_container_width=True)
    st.caption(f"Method: {weights_data.get('method','?')} · "
               f"Sample: {list(weights_data.get('sample_sizes',{}).values())[0] if weights_data.get('sample_sizes') else '?'} team-seasons")


# ════════════════════════════════════════════════════════════════════════════
# PAGE 5 — OPPONENT SCOUTING
# ════════════════════════════════════════════════════════════════════════════

elif page == "Opponent Scouting":
    st.title("🔍 Opponent Scouting")
    st.caption("Draft tendency profiles built from ESPN pick history (2019–2025)")

    profiles = load_draft_profiles()
    drafts   = load_all_drafts()
    if profiles is None or drafts is None:
        st.error("Run `python3 analysis/draft_analysis.py` first.")
        st.stop()

    MY_TEAM = "Luke Inglis"
    TEAM_ALIASES = {
        "Buck Showalter":"Luke Inglis","Brandon Hyde":"Luke Inglis","Tony Mansolino":"Luke Inglis",
        "Smokin' Bases":"Sean Fitzpatrick",
        "Delray Beach Air Biscuits":"Ethan Wayne",
        "Cream City Cowtippers":"Joel Seagraves","Moooooose-Yeli Bombers":"Joel Seagraves",
        "Moooooose-Yeti Bombers":"Joel Seagraves","Comeback Tour":"Joel Seagraves",
        "Lisa dANN":"Daniel Caron",
        "Daisy + Shay Bel-Airs":"Zack Kirstein","Shay Bel-Air GMY's":"Zack Kirstein",
        "Bel Air GMY's":"Zack Kirstein","NY GMY's":"Zack Kirstein",
        "MOArch Redbirds":"John Ballantine","Goldschmidt Happens":"John Ballantine",
        "The G.O.A.T":"Tim Van Dalsum","Betts Against Us":"Tim Van Dalsum",
        "Blue Haderade":"Tim Van Dalsum","Wander Vision":"Tim Van Dalsum",
        "Cash Betts Only":"Ricky Krause & Michael Cornuta",
        "The Houston Asstros":"Roger Chaufournier & Lee Inglis",
        "Pfaadt Ass Trouts":"Roger Chaufournier & Lee Inglis",
        "Soto Baggins":"Roger Chaufournier & Lee Inglis",
        "The Basitt Hounds":"Roger Chaufournier & Lee Inglis",
        "PeeWee Yermin":"Roger Chaufournier & Lee Inglis",
        "A Song of Bryce and Fire":"Roger Chaufournier & Lee Inglis",
        "A Song of  Bryce and Fire":"Roger Chaufournier & Lee Inglis",
        "Harper Barely Know Her":"Roger Chaufournier & Lee Inglis",
        "Triple A  Titties":"Roger Chaufournier & Lee Inglis",
    }
    drafts["canonical_team"] = drafts["team"].map(TEAM_ALIASES)

    teams = sorted(profiles["team"].unique())
    my_idx = teams.index(MY_TEAM) if MY_TEAM in teams else 0
    selected_team = st.selectbox("Select team", teams, index=my_idx)
    is_me = selected_team == MY_TEAM

    st.markdown("---")
    prof = profiles[profiles["team"] == selected_team].iloc[0]
    td   = drafts[drafts["canonical_team"] == selected_team]

    st.subheader(f"**{selected_team}**" + (" ← You" if is_me else ""))

    col1, col2, col3, col4 = st.columns(4)
    with col1: st.metric("Avg round: first SP", prof["first_sp"])
    with col2: st.metric("Avg round: first RP", prof["first_rp"])
    with col3: st.metric("Avg round: first C",  prof["first_c"])
    with col4: st.metric("Avg round: first SS", prof["first_ss"])

    st.markdown("---")
    finish_cols = [c for c in profiles.columns if c.startswith("finish_")]
    hist = prof[finish_cols].T.reset_index()
    hist.columns = ["Year", "Finish"]
    hist["Year"] = hist["Year"].str.replace("finish_", "").astype(int)
    hist = hist.dropna()

    col1, col2 = st.columns([1, 2])
    with col1:
        st.markdown("**Finish history**")
        for _, row in hist.iterrows():
            medal = "🥇" if row["Finish"]==1 else ("🥈" if row["Finish"]==2 else ("🥉" if row["Finish"]==3 else ""))
            st.write(f"{int(row['Year'])}: **#{int(row['Finish'])}** {medal}")
    with col2:
        fig = px.line(hist, x="Year", y="Finish", markers=True, title="Season Finish (lower = better)")
        fig.update_yaxes(autorange="reversed", range=[10.5, 0.5], dtick=1)
        fig.update_layout(height=280, margin=dict(t=40))
        st.plotly_chart(fig, use_container_width=True)

    st.markdown("---")
    st.subheader("Draft Composition by Round Bucket")
    ROUND_BUCKETS = {
        "Early (1-3)": range(1,4), "Mid (4-8)": range(4,9),
        "Late (9-14)": range(9,15), "End (15+)": range(15,100),
    }

    def classify_position(slots_str):
        slots = set(s.strip() for s in str(slots_str).split(","))
        for pos in ["SP","RP","P","C","SS","2B","3B","1B"]:
            if pos in slots: return pos
        if any(x in slots for x in ["CF","LF","RF","OF"]): return "OF"
        if "DH" in slots: return "DH"
        return "UTIL"

    roster_lookup = {}
    for year_dir in sorted(Path("seasons").iterdir()):
        rp = year_dir / "rosters.csv"
        if not rp.exists(): continue
        rdf = pd.read_csv(rp)
        for _, row in rdf.iterrows():
            name = row["player_name"]
            if name not in roster_lookup and pd.notna(row.get("eligible_slots")):
                roster_lookup[name] = classify_position(str(row["eligible_slots"]))

    td2 = td.copy()
    td2["pos"]    = td2["player_name"].map(lambda n: roster_lookup.get(n, "UNK"))
    td2["is_sp"]  = td2["pos"] == "SP"
    td2["is_rp"]  = td2["pos"] == "RP"
    td2["is_bat"] = td2["pos"].isin(["C","1B","2B","3B","SS","OF","DH","UTIL"])

    bucket_rows = []
    for label, rng in ROUND_BUCKETS.items():
        b = td2[td2["round"].isin(rng)]
        if not len(b): continue
        bucket_rows.append({
            "Round Bucket": label, "Picks": len(b),
            "BAT%": round(b["is_bat"].mean()*100,1),
            "SP%":  round(b["is_sp"].mean()*100,1),
            "RP%":  round(b["is_rp"].mean()*100,1),
            "C%":   round((b["pos"]=="C").mean()*100,1),
            "SS%":  round((b["pos"]=="SS").mean()*100,1),
            "OF%":  round((b["pos"]=="OF").mean()*100,1),
        })
    if bucket_rows:
        bdf = pd.DataFrame(bucket_rows)
        melt = bdf.melt(id_vars=["Round Bucket","Picks"], var_name="Type", value_name="Pct")
        fig = px.bar(melt[melt["Type"].isin(["BAT%","SP%","RP%"])],
                     x="Round Bucket", y="Pct", color="Type", barmode="group",
                     color_discrete_map={"BAT%":"#2d6a4f","SP%":"#1d3557","RP%":"#e63946"})
        fig.update_layout(height=300, margin=dict(t=20))
        st.plotly_chart(fig, use_container_width=True)
        st.dataframe(bdf, use_container_width=True)

    st.markdown("---")
    st.subheader("Players Drafted 2+ Times (2023–2025)")
    recent = td2[td2["year"] >= 2023]
    top_players = (
        recent.groupby("player_name")
        .agg(times_drafted=("year","count"), avg_round=("round","mean"))
        .query("times_drafted >= 2")
        .sort_values(["times_drafted","avg_round"], ascending=[False,True])
        .head(10).reset_index()
    )
    top_players["avg_round"] = top_players["avg_round"].round(1)
    if len(top_players) > 0:
        st.dataframe(top_players.rename(columns={
            "player_name":"Player","times_drafted":"Times Drafted","avg_round":"Avg Round"
        }), use_container_width=True)
    else:
        st.info("No players drafted 2+ times in the last 3 seasons.")


# ════════════════════════════════════════════════════════════════════════════
# PAGE 6 — LEAGUE HISTORY
# ════════════════════════════════════════════════════════════════════════════

elif page == "League History":
    st.title("📜 League History")
    st.caption("Tampa's Finest — 2015 through 2025")

    standings_all = load_standings_all()
    if standings_all is None:
        st.error("No standings data found.")
        st.stop()

    TEAM_ALIASES = {
        "Buck Showalter":"Luke Inglis","Brandon Hyde":"Luke Inglis","Tony Mansolino":"Luke Inglis",
        "Smokin' Bases":"Sean Fitzpatrick","Delray Beach Air Biscuits":"Ethan Wayne",
        "Cream City Cowtippers":"Joel Seagraves","Moooooose-Yeti Bombers":"Joel Seagraves",
        "Comeback Tour":"Joel Seagraves","Lisa dANN":"Daniel Caron",
        "Daisy + Shay Bel-Airs":"Zack Kirstein","Shay Bel-Air GMY's":"Zack Kirstein",
        "Bel Air GMY's":"Zack Kirstein","NY GMY's":"Zack Kirstein",
        "MOArch Redbirds":"John Ballantine","Goldschmidt Happens":"John Ballantine",
        "The G.O.A.T":"Tim Van Dalsum","Betts Against Us":"Tim Van Dalsum",
        "Blue Haderade":"Tim Van Dalsum","Wander Vision":"Tim Van Dalsum",
        "Cash Betts Only":"Ricky Krause & Michael Cornuta",
        "The Houston Asstros":"Roger Chaufournier & Lee Inglis",
        "Pfaadt Ass Trouts":"Roger Chaufournier & Lee Inglis",
        "Soto Baggins":"Roger Chaufournier & Lee Inglis",
        "The Basitt Hounds":"Roger Chaufournier & Lee Inglis",
        "PeeWee Yermin":"Roger Chaufournier & Lee Inglis",
        "A Song of Bryce and Fire":"Roger Chaufournier & Lee Inglis",
        "A Song of  Bryce and Fire":"Roger Chaufournier & Lee Inglis",
        "Harper Barely Know Her":"Roger Chaufournier & Lee Inglis",
        "Triple A  Titties":"Roger Chaufournier & Lee Inglis",
    }
    standings_all["canonical"] = standings_all["Team"].map(lambda t: TEAM_ALIASES.get(t, t))

    st.subheader("Champions")
    champs = standings_all[standings_all["RK"]==1][["year","canonical","Team"]].sort_values("year")
    champ_cols = st.columns(len(champs))
    for i, (_, row) in enumerate(champs.iterrows()):
        with champ_cols[i]:
            st.metric(str(int(row["year"])), row["canonical"].split(" ")[0],
                      row["Team"] if row["Team"] != row["canonical"] else "")

    st.markdown("---")
    years = sorted(standings_all["year"].unique(), reverse=True)
    sel_year = st.selectbox("Season", years)
    year_df = standings_all[standings_all["year"]==sel_year].sort_values("RK")
    st.subheader(f"{sel_year} Final Standings")
    display_cols = ["RK","Team","W","L","T","PCT"]
    cat_avail = [c for c in ["H","R","HR","TB","RBI","BB","SB","AVG","K","QS","SV","HD","ERA","WHIP"]
                 if c in year_df.columns]
    st.dataframe(year_df[display_cols+cat_avail].reset_index(drop=True), use_container_width=True)

    st.markdown("---")
    st.subheader("Finish History — All Teams")
    pivot = standings_all.pivot_table(index="canonical", columns="year", values="RK", aggfunc="min")
    pivot = pivot.sort_values(by=list(pivot.columns), na_position="last")
    fig = px.imshow(pivot, color_continuous_scale=[[0,"#1a472a"],[0.5,"#95d5b2"],[1,"#fff"]],
                    text_auto=True, aspect="auto", labels={"color":"Finish"})
    fig.update_layout(height=420, margin=dict(t=20))
    fig.update_coloraxes(reversescale=True)
    st.plotly_chart(fig, use_container_width=True)
    st.caption("Darker = better finish. White = no data.")


# ════════════════════════════════════════════════════════════════════════════
# PAGE 7 — OWNER RECORDS
# ════════════════════════════════════════════════════════════════════════════

elif page == "Owner Records":
    st.title("👤 Owner Records")
    owners_df = load_owners()
    if owners_df is None:
        st.error("Run `python3 scripts/build_owner_profiles.py` first.")
        st.stop()

    summary = (
        owners_df.groupby("owner")
        .agg(Seasons=("year","count"), Avg_Finish=("standing","mean"),
             Best_Finish=("standing","min"), Wins=("wins","sum"),
             Losses=("losses","sum"), Latest_Team=("team_name","last"))
        .reset_index().rename(columns={"owner":"Owner"})
    )
    summary["Avg_Finish"] = summary["Avg_Finish"].round(1)
    summary["Win%"] = (summary["Wins"] / (summary["Wins"] + summary["Losses"])).round(3)
    summary["Championships"] = (
        owners_df[owners_df["standing"]==1].groupby("owner")["year"].count()
        .reindex(summary["Owner"]).fillna(0).astype(int).values
    )
    summary = summary.sort_values("Avg_Finish")
    st.dataframe(summary[["Owner","Latest_Team","Seasons","Avg_Finish","Best_Finish","Win%","Championships"]],
                 use_container_width=True)

    st.markdown("---")
    st.subheader("Owner Deep Dive")
    selected_owner = st.selectbox("Select owner", summary["Owner"].tolist())
    odf = owners_df[owners_df["owner"]==selected_owner].sort_values("year")

    col1, col2, col3, col4 = st.columns(4)
    with col1: st.metric("Seasons", len(odf))
    with col2: st.metric("Avg Finish", f"#{odf['standing'].mean():.1f}")
    with col3: st.metric("Best Finish", f"#{int(odf['standing'].min())}")
    with col4: st.metric("Championships", int((odf["standing"]==1).sum()))

    fig = px.bar(odf, x="year", y="standing", text="team_name",
                 labels={"standing":"Final Finish","year":"Year"},
                 title=f"{selected_owner} — Season Finishes",
                 color="standing", color_continuous_scale=[[0,"#1a472a"],[1,"#d8f3dc"]])
    fig.update_yaxes(autorange="reversed", range=[10.5,0.5], dtick=1)
    fig.update_traces(textposition="outside")
    fig.update_layout(height=350, margin=dict(t=40), showlegend=False, coloraxis_showscale=False)
    st.plotly_chart(fig, use_container_width=True)

    st.dataframe(odf[["year","team_name","standing","wins","losses","ties"]].rename(columns={
        "year":"Year","team_name":"Team","standing":"Finish","wins":"W","losses":"L","ties":"T"
    }), use_container_width=True)

    st.markdown("---")
    st.subheader("All Owners — Finish Trends")
    fig2 = px.line(owners_df, x="year", y="standing", color="owner", markers=True,
                   labels={"standing":"Finish","year":"Year","owner":"Owner"})
    fig2.update_yaxes(autorange="reversed", range=[10.5,0.5], dtick=1)
    fig2.update_layout(height=450, margin=dict(t=20))
    st.plotly_chart(fig2, use_container_width=True)
