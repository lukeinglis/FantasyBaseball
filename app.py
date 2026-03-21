"""
Inglis War Room — Tampa's Finest Fantasy Baseball Dashboard
Run: streamlit run app.py
"""

import json
import pandas as pd
import streamlit as st
import plotly.express as px
import plotly.graph_objects as go
from pathlib import Path

# ── Page config ─────────────────────────────────────────────────────────────

st.set_page_config(
    page_title="Inglis War Room",
    page_icon="⚾",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Data loading (cached) ────────────────────────────────────────────────────

@st.cache_data
def load_rankings():
    p = Path("output/draft_rankings.csv")
    if not p.exists():
        return None
    df = pd.read_csv(p)
    df["Type"] = df["Type"].fillna("BAT")
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
        year = int(year_dir.name)
        df = pd.read_csv(p)
        df["year"] = year
        frames.append(df)
    if not frames:
        return None
    return pd.concat(frames, ignore_index=True)

@st.cache_data
def load_draft_profiles():
    p = Path("output/draft_profiles.csv")
    if not p.exists():
        return None
    return pd.read_csv(p)

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
    if not frames:
        return None
    return pd.concat(frames, ignore_index=True)

@st.cache_data
def load_matchups_all():
    frames = []
    for year_dir in sorted(Path("seasons").iterdir()):
        p = year_dir / "matchups.csv"
        if not p.exists():
            continue
        df = pd.read_csv(p)
        frames.append(df)
    if not frames:
        return None
    return pd.concat(frames, ignore_index=True)

# ── Sidebar nav ──────────────────────────────────────────────────────────────

st.sidebar.title("⚾ Inglis War Room")
st.sidebar.caption("Tampa's Finest · ESPN League")
st.sidebar.markdown("---")

page = st.sidebar.radio(
    "Navigate",
    ["Draft Board", "Category Intel", "Opponent Scouting", "League History", "Owner Records"],
    index=0,
)

# ════════════════════════════════════════════════════════════════════════════
# PAGE 1 — DRAFT BOARD
# ════════════════════════════════════════════════════════════════════════════

if page == "Draft Board":
    st.title("⚾ Draft Board")
    st.caption("Rankings derived from 2025 actuals + league-specific category weights")

    rankings = load_rankings()
    if rankings is None:
        st.error("Run `python3 analysis/player_rankings.py` first to generate draft_rankings.csv")
        st.stop()

    # ── Sidebar filters ──
    st.sidebar.markdown("### Filters")
    player_type = st.sidebar.radio("Player type", ["All", "Batters", "Pitchers"])
    pos_options = sorted(rankings["Pos"].dropna().unique())
    selected_pos = st.sidebar.multiselect("Position", pos_options, default=[])
    search = st.sidebar.text_input("Search player", "")

    df = rankings.copy()
    if player_type == "Batters":
        df = df[df["Type"] == "BAT"]
    elif player_type == "Pitchers":
        df = df[df["Type"] == "PIT"]
    if selected_pos:
        df = df[df["Pos"].isin(selected_pos)]
    if search:
        df = df[df["Name"].str.contains(search, case=False, na=False)]

    # ── Top 5 callout row ──
    if player_type != "Pitchers":
        top5_bat = rankings[rankings["Type"] == "BAT"].head(5)
        cols = st.columns(5)
        for i, (_, row) in enumerate(top5_bat.iterrows()):
            with cols[i]:
                st.metric(f"#{int(row['Overall_Rank'])} {row['Name']}", row['Team'],
                          f"z={row['z_total']:.3f}")

    st.markdown("---")

    # ── Main table ──
    bat_cols  = ["Overall_Rank", "Name", "Team", "Pos", "z_total",
                 "H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG"]
    pit_cols  = ["Overall_Rank", "Name", "Team", "Pos", "z_total",
                 "K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"]
    show_cols = bat_cols if player_type == "Batters" else (pit_cols if player_type == "Pitchers" else
                ["Overall_Rank", "Name", "Team", "Pos", "Type", "z_total"])

    show_cols = [c for c in show_cols if c in df.columns]
    display_df = df[show_cols].reset_index(drop=True)

    # Colour z_total column
    def colour_z(val):
        if not isinstance(val, (int, float)):
            return ""
        if val >= 1.0:
            return "background-color: #1a472a; color: white"
        elif val >= 0.5:
            return "background-color: #2d6a4f; color: white"
        elif val >= 0.0:
            return "background-color: #40916c; color: white"
        elif val >= -0.3:
            return "background-color: #74c69d"
        else:
            return "background-color: #d8f3dc"

    styled = display_df.style.applymap(colour_z, subset=["z_total"])
    st.dataframe(styled, use_container_width=True, height=650)

    st.caption(f"Showing {len(df)} players · Green shading = higher z-score (better value)")

    # ── Download ──
    csv = df.to_csv(index=False).encode()
    st.download_button("Download filtered rankings (CSV)", csv, "war_room_rankings.csv", "text/csv")

    # ── z-score scatter ──
    st.markdown("---")
    st.subheader("Value Distribution")
    fig = px.histogram(rankings, x="z_total", color="Type",
                       nbins=50, barmode="overlay",
                       color_discrete_map={"BAT": "#2d6a4f", "PIT": "#1d3557"},
                       labels={"z_total": "Composite Z-Score", "count": "Players"})
    fig.update_layout(height=300, margin=dict(t=20))
    st.plotly_chart(fig, use_container_width=True)


# ════════════════════════════════════════════════════════════════════════════
# PAGE 2 — CATEGORY INTEL
# ════════════════════════════════════════════════════════════════════════════

elif page == "Category Intel":
    st.title("📊 Category Intel")
    st.caption("What actually predicts winning in Tampa's Finest")

    weights_data = load_weights()
    if weights_data is None:
        st.error("Run `python3 analysis/category_weights.py` first.")
        st.stop()

    weights = weights_data["weights"]
    corrs   = weights_data["raw_correlations"]
    neg_cats = weights_data.get("negative_categories", [])

    # ── Weight bar chart ──
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
        fig.update_layout(height=500, yaxis={"categoryorder": "total ascending"},
                          margin=dict(t=40))
        st.plotly_chart(fig, use_container_width=True)

    with col2:
        st.markdown("### Weight Summary")
        for _, row in wdf.iterrows():
            arrow = "↓" if row["Lower=Better"] else ""
            st.write(f"**{row['Category']}{arrow}** — {row['Weight']:.1f}%")

    # ── Key takeaways ──
    st.markdown("---")
    st.subheader("Key Draft Takeaways")

    top3 = wdf.head(3)["Category"].tolist()
    bottom3 = wdf.tail(3)["Category"].tolist()

    col1, col2, col3 = st.columns(3)
    with col1:
        st.success(f"**Target heavily:** {', '.join(top3)}\n\nThese are the most predictive categories — prioritise players who dominate here.")
    with col2:
        st.warning(f"**Closers are a trap:** SV weight = {weights.get('SV', 0)*100:.1f}%\n\nDo NOT reach for closers early. Saves barely move the needle.")
    with col3:
        st.info(f"**Deprioritise:** {', '.join(bottom3)}\n\nLeast predictive — fill these late or stream.")

    # ── Correlation vs weight scatter ──
    st.markdown("---")
    st.subheader("Raw Correlation vs Weight")
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

    # ── Method note ──
    st.caption(f"Method: {weights_data.get('method', 'unknown')} · "
               f"Sample: {list(weights_data.get('sample_sizes', {}).values())[0] if weights_data.get('sample_sizes') else '?'} team-seasons")


# ════════════════════════════════════════════════════════════════════════════
# PAGE 3 — OPPONENT SCOUTING
# ════════════════════════════════════════════════════════════════════════════

elif page == "Opponent Scouting":
    st.title("🔍 Opponent Scouting")
    st.caption("Draft tendency profiles built from ESPN pick history (2019–2025)")

    profiles = load_draft_profiles()
    drafts   = load_all_drafts()

    if profiles is None or drafts is None:
        st.error("Run `python3 analysis/draft_analysis.py` first.")
        st.stop()

    MY_TEAM = "Craig Albernaz"

    TEAM_ALIASES = {
        "Buck Showalter": "Craig Albernaz",
        "Brandon Hyde": "Craig Albernaz",
        "Tony Mansolino": "Craig Albernaz",
        "Craig Albernaz": "Craig Albernaz",
        "Smokin' Bases": "Smokin' Bases",
        "Delray Beach Air Biscuits": "Delray Beach Air Biscuits",
        "Cream City Cowtippers": "Cream City Cowtippers",
        "Lisa dANN": "Lisa dANN",
        "Daisy + Shay Bel-Airs": "Daisy + Shay Bel-Airs",
        "Shay Bel-Air GMY's": "Daisy + Shay Bel-Airs",
        "MOArch Redbirds": "MOArch Redbirds",
        "The G.O.A.T": "The G.O.A.T",
        "Cash Betts Only": "Cash Betts Only",
        "The Houston Asstros": "The Houston Asstros",
        "Pfaadt Ass Trouts": "The Houston Asstros",
    }

    drafts["canonical_team"] = drafts["team"].map(TEAM_ALIASES)

    teams = sorted(profiles["team"].unique())
    my_idx = teams.index(MY_TEAM) if MY_TEAM in teams else 0
    selected_team = st.selectbox("Select team", teams, index=my_idx)
    is_me = selected_team == MY_TEAM

    st.markdown("---")

    prof = profiles[profiles["team"] == selected_team].iloc[0]
    td   = drafts[drafts["canonical_team"] == selected_team]

    label = f"**{selected_team}**" + (" ← You" if is_me else "")
    st.subheader(label)

    # ── First pick averages ──
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Avg round: first SP", prof["first_sp"])
    with col2:
        st.metric("Avg round: first RP", prof["first_rp"])
    with col3:
        st.metric("Avg round: first C", prof["first_c"])
    with col4:
        st.metric("Avg round: first SS", prof["first_ss"])

    st.markdown("---")

    # ── Finish history ──
    finish_cols = [c for c in profiles.columns if c.startswith("finish_")]
    hist = prof[finish_cols].T.reset_index()
    hist.columns = ["Year", "Finish"]
    hist["Year"] = hist["Year"].str.replace("finish_", "").astype(int)
    hist = hist.dropna()

    col1, col2 = st.columns([1, 2])
    with col1:
        st.markdown("**Finish history**")
        for _, row in hist.iterrows():
            medal = "🥇" if row["Finish"] == 1 else ("🥈" if row["Finish"] == 2 else ("🥉" if row["Finish"] == 3 else ""))
            st.write(f"{int(row['Year'])}: **#{int(row['Finish'])}** {medal}")
    with col2:
        fig = px.line(hist, x="Year", y="Finish",
                      markers=True, title="Season Finish (lower = better)")
        fig.update_yaxes(autorange="reversed", range=[10.5, 0.5], dtick=1)
        fig.update_layout(height=280, margin=dict(t=40))
        st.plotly_chart(fig, use_container_width=True)

    st.markdown("---")

    # ── Round-by-round position breakdown ──
    st.subheader("Draft Composition by Round Bucket")

    ROUND_BUCKETS = {
        "Early (1-3)":  range(1, 4),
        "Mid   (4-8)":  range(4, 9),
        "Late  (9-14)": range(9, 15),
        "End (15+)":    range(15, 100),
    }

    def classify_position(eligible_slots):
        slots = set(s.strip() for s in str(eligible_slots).split(","))
        if "SP" in slots: return "SP"
        if "RP" in slots: return "RP"
        if "P"  in slots: return "P"
        if "C"  in slots: return "C"
        if "SS" in slots: return "SS"
        if "2B" in slots: return "2B"
        if "3B" in slots: return "3B"
        if "1B" in slots: return "1B"
        if any(x in slots for x in ["CF","LF","RF","OF"]): return "OF"
        if "DH" in slots: return "DH"
        return "UTIL"

    # Try to get position info from rosters
    roster_lookup = {}
    for year_dir in sorted(Path("seasons").iterdir()):
        rp = year_dir / "rosters.csv"
        if not rp.exists():
            continue
        rdf = pd.read_csv(rp)
        for _, row in rdf.iterrows():
            name = row["player_name"]
            if name not in roster_lookup and pd.notna(row.get("eligible_slots")):
                roster_lookup[name] = classify_position(str(row["eligible_slots"]))

    td2 = td.copy()
    td2["pos"] = td2["player_name"].map(lambda n: roster_lookup.get(n, "UNK"))
    td2["is_sp"]  = td2["pos"] == "SP"
    td2["is_rp"]  = td2["pos"] == "RP"
    td2["is_bat"] = td2["pos"].isin(["C","1B","2B","3B","SS","OF","DH","UTIL"])

    bucket_rows = []
    for label, rng in ROUND_BUCKETS.items():
        b = td2[td2["round"].isin(rng)]
        if len(b) == 0:
            continue
        bucket_rows.append({
            "Round Bucket": label,
            "Picks": len(b),
            "BAT%": round(b["is_bat"].mean() * 100, 1),
            "SP%":  round(b["is_sp"].mean()  * 100, 1),
            "RP%":  round(b["is_rp"].mean()  * 100, 1),
            "C%":   round((b["pos"] == "C").mean() * 100, 1),
            "SS%":  round((b["pos"] == "SS").mean() * 100, 1),
            "OF%":  round((b["pos"] == "OF").mean() * 100, 1),
        })

    if bucket_rows:
        bdf = pd.DataFrame(bucket_rows)
        melt = bdf.melt(id_vars=["Round Bucket","Picks"], var_name="Type", value_name="Pct")
        fig = px.bar(melt[melt["Type"].isin(["BAT%","SP%","RP%"])],
                     x="Round Bucket", y="Pct", color="Type", barmode="group",
                     color_discrete_map={"BAT%": "#2d6a4f", "SP%": "#1d3557", "RP%": "#e63946"})
        fig.update_layout(height=300, margin=dict(t=20))
        st.plotly_chart(fig, use_container_width=True)
        st.dataframe(bdf, use_container_width=True)

    # ── Recurring targets ──
    st.markdown("---")
    st.subheader("Players Drafted 2+ Times (2023–2025)")
    recent = td2[td2["year"] >= 2023]
    top_players = (
        recent.groupby("player_name")
        .agg(times_drafted=("year", "count"), avg_round=("round", "mean"))
        .query("times_drafted >= 2")
        .sort_values(["times_drafted", "avg_round"], ascending=[False, True])
        .head(10)
        .reset_index()
    )
    top_players["avg_round"] = top_players["avg_round"].round(1)
    if len(top_players) > 0:
        st.dataframe(top_players.rename(columns={
            "player_name": "Player", "times_drafted": "Times Drafted", "avg_round": "Avg Round"
        }), use_container_width=True)
    else:
        st.info("No players drafted 2+ times in the last 3 seasons.")


# ════════════════════════════════════════════════════════════════════════════
# PAGE 4 — LEAGUE HISTORY
# ════════════════════════════════════════════════════════════════════════════

elif page == "League History":
    st.title("📜 League History")
    st.caption("Tampa's Finest — 2016 through 2025")

    standings_all = load_standings_all()
    if standings_all is None:
        st.error("No standings data found in seasons/.")
        st.stop()

    TEAM_ALIASES = {
        "Buck Showalter": "Craig Albernaz",
        "Brandon Hyde": "Craig Albernaz",
        "Tony Mansolino": "Craig Albernaz",
        "Shay Bel-Air GMY's": "Daisy + Shay Bel-Airs",
        "Pfaadt Ass Trouts": "The Houston Asstros",
    }
    standings_all["canonical"] = standings_all["Team"].map(
        lambda t: TEAM_ALIASES.get(t, t)
    )

    # ── Champions timeline ──
    st.subheader("Champions")
    champs = standings_all[standings_all["RK"] == 1][["year", "canonical", "Team"]]\
        .sort_values("year")
    champ_cols = st.columns(len(champs))
    for i, (_, row) in enumerate(champs.iterrows()):
        with champ_cols[i]:
            st.metric(str(int(row["year"])), row["canonical"].split(" ")[0],
                      row["Team"] if row["Team"] != row["canonical"] else "")

    st.markdown("---")

    # ── Year selector ──
    years = sorted(standings_all["year"].unique(), reverse=True)
    sel_year = st.selectbox("Season", years)
    year_df = standings_all[standings_all["year"] == sel_year].sort_values("RK")

    st.subheader(f"{sel_year} Final Standings")
    display_cols = ["RK", "Team", "W", "L", "T", "PCT"]
    cat_cols_available = [c for c in ["H","R","HR","TB","RBI","BB","SB","AVG","K","QS","SV","HD","ERA","WHIP"]
                          if c in year_df.columns]
    st.dataframe(year_df[display_cols + cat_cols_available].reset_index(drop=True),
                 use_container_width=True)

    # ── Historical finish heatmap ──
    st.markdown("---")
    st.subheader("Finish History — All Teams")
    pivot = standings_all.pivot_table(index="canonical", columns="year", values="RK", aggfunc="min")
    pivot = pivot.sort_values(by=list(pivot.columns), na_position="last")

    fig = px.imshow(pivot,
                    color_continuous_scale=[[0, "#1a472a"], [0.5, "#95d5b2"], [1, "#fff"]],
                    text_auto=True,
                    aspect="auto",
                    labels={"color": "Finish"})
    fig.update_layout(height=420, margin=dict(t=20),
                      coloraxis_colorbar=dict(title="Finish"))
    fig.update_coloraxes(reversescale=True)
    st.plotly_chart(fig, use_container_width=True)
    st.caption("Darker = better finish. White = no data that year.")


# ════════════════════════════════════════════════════════════════════════════
# PAGE 5 — OWNER RECORDS
# ════════════════════════════════════════════════════════════════════════════

elif page == "Owner Records":
    st.title("👤 Owner Records")
    st.caption("All-time owner statistics")

    owners_df = load_owners()
    if owners_df is None:
        st.error("Run `python3 scripts/build_owner_profiles.py` first.")
        st.stop()

    # ── Summary table ──
    summary = (
        owners_df.groupby("owner")
        .agg(
            Seasons=("year", "count"),
            Avg_Finish=("standing", "mean"),
            Best_Finish=("standing", "min"),
            Wins=("wins", "sum"),
            Losses=("losses", "sum"),
            Latest_Team=("team_name", "last"),
        )
        .reset_index()
        .rename(columns={"owner": "Owner"})
    )
    summary["Avg_Finish"] = summary["Avg_Finish"].round(1)
    summary["Win%"] = (summary["Wins"] / (summary["Wins"] + summary["Losses"])).round(3)
    summary["Championships"] = (
        owners_df[owners_df["standing"] == 1]
        .groupby("owner")["year"].count()
        .reindex(summary["Owner"])
        .fillna(0)
        .astype(int)
        .values
    )
    summary = summary.sort_values("Avg_Finish")

    st.dataframe(
        summary[["Owner", "Latest_Team", "Seasons", "Avg_Finish", "Best_Finish", "Win%", "Championships"]],
        use_container_width=True,
    )

    # ── Owner deep dive ──
    st.markdown("---")
    st.subheader("Owner Deep Dive")
    owner_list = summary["Owner"].tolist()
    selected_owner = st.selectbox("Select owner", owner_list)

    odf = owners_df[owners_df["owner"] == selected_owner].sort_values("year")

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Seasons", len(odf))
    with col2:
        st.metric("Avg Finish", f"#{odf['standing'].mean():.1f}")
    with col3:
        st.metric("Best Finish", f"#{int(odf['standing'].min())}")
    with col4:
        champ_count = int((odf["standing"] == 1).sum())
        st.metric("Championships", champ_count)

    # Season-by-season
    fig = px.bar(odf, x="year", y="standing",
                 text="team_name",
                 labels={"standing": "Final Finish", "year": "Year"},
                 title=f"{selected_owner} — Season Finishes",
                 color="standing",
                 color_continuous_scale=[[0, "#1a472a"], [1, "#d8f3dc"]])
    fig.update_yaxes(autorange="reversed", range=[10.5, 0.5], dtick=1)
    fig.update_traces(textposition="outside")
    fig.update_layout(height=350, margin=dict(t=40), showlegend=False,
                      coloraxis_showscale=False)
    st.plotly_chart(fig, use_container_width=True)

    st.dataframe(
        odf[["year", "team_name", "standing", "wins", "losses", "ties"]].rename(columns={
            "year": "Year", "team_name": "Team", "standing": "Finish",
            "wins": "W", "losses": "L", "ties": "T"
        }),
        use_container_width=True,
    )

    # ── All owners finish chart ──
    st.markdown("---")
    st.subheader("All Owners — Finish Trends")
    fig2 = px.line(
        owners_df, x="year", y="standing", color="owner",
        markers=True, labels={"standing": "Finish", "year": "Year", "owner": "Owner"},
    )
    fig2.update_yaxes(autorange="reversed", range=[10.5, 0.5], dtick=1)
    fig2.update_layout(height=450, margin=dict(t=20))
    st.plotly_chart(fig2, use_container_width=True)
