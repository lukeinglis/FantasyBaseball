import { espnFetch, hasEspnCreds, STAT_ID_MAP } from "@/lib/espn";

export interface TeamCategoryStats {
  teamId: number;
  teamName: string;
  abbrev: string;
  wins: number;
  losses: number;
  ties: number;
  categories: Record<string, number>;   // category name → cumulative value
  ranks: Record<string, number>;        // category name → 1-10 rank
  deltas: Record<string, number>;       // category name → delta from league average (positive = better)
  battingAvgRank: number;               // mean rank across batting categories
  pitchingAvgRank: number;              // mean rank across pitching categories
  compositeAvgRank: number;             // mean rank across all 16 categories
  powerRank: number;                    // 1-10 ordinal based on compositeAvgRank
}

export interface LeagueStatsData {
  scoringPeriodId: number;
  myTeamId: number;
  teams: TeamCategoryStats[];
  averages: Record<string, number>;     // category name → league average value
}

const MY_TEAM_ID = parseInt(process.env.MY_ESPN_TEAM_ID ?? "0");
const CATS_ORDER = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG", "K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"];
const BAT_CATS = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG"];
const PIT_CATS = ["K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"];
const LOWER_IS_BETTER = new Set(["ERA", "WHIP", "L"]);

export async function GET() {
  if (!hasEspnCreds()) {
    return Response.json({ error: "ESPN_CREDS_MISSING" }, { status: 401 });
  }
  if (!MY_TEAM_ID) {
    return Response.json({ error: "MY_ESPN_TEAM_ID_MISSING" }, { status: 401 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await espnFetch(["mMatchup", "mMatchupScore", "mTeam", "mStatus"]);
    const currentMatchupPeriod = (data as any).status?.currentMatchupPeriod ?? 1;

    // Build team name lookup
    const teamMeta: Record<number, { name: string; abbrev: string; wins: number; losses: number; ties: number }> = {};
    for (const t of data.teams ?? []) {
      const record = t.record?.overall ?? {};
      teamMeta[t.id] = {
        name: `${t.location ?? ""} ${t.nickname ?? ""}`.trim() || t.abbrev,
        abbrev: t.abbrev ?? "",
        wins: record.wins ?? 0,
        losses: record.losses ?? 0,
        ties: record.ties ?? 0,
      };
    }

    // Aggregate each team's cumulative stats across all matchups played so far
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const teamStats: Record<number, Record<string, number>> = {};
    const schedule: any[] = data.schedule ?? [];

    for (const matchup of schedule) {
      // Only count completed or in-progress matchups (matchupPeriodId <= current)
      if (matchup.matchupPeriodId > currentMatchupPeriod) continue;

      for (const side of [matchup.home, matchup.away]) {
        if (!side?.teamId) continue;
        const teamId = side.teamId;
        if (!teamStats[teamId]) teamStats[teamId] = {};

        const scoreByStat = side.cumulativeScore?.scoreByStat ?? {};
        for (const [statId, statData] of Object.entries(scoreByStat)) {
          const cat = STAT_ID_MAP[parseInt(statId)];
          if (!cat) continue;
          const val = (statData as any).score ?? 0;
          // For rate stats (AVG, ERA, WHIP), we take the latest value (not sum)
          if (cat === "AVG" || cat === "ERA" || cat === "WHIP") {
            teamStats[teamId][cat] = val;
          } else {
            teamStats[teamId][cat] = (teamStats[teamId][cat] ?? 0) + val;
          }
        }
      }
    }

    // For rate stats, recalculate from the current matchup only (most recent cumulative)
    // Actually ESPN's cumulativeScore already represents the running total for that matchup
    // We need the season-wide view. Let's use the current matchup's cumulative which ESPN
    // calculates as season totals within the H2H context.
    // Re-approach: just use the current matchup period's cumulative scores which reflect season totals
    const currentTeamStats: Record<number, Record<string, number>> = {};
    for (const matchup of schedule) {
      if (matchup.matchupPeriodId !== currentMatchupPeriod) continue;
      for (const side of [matchup.home, matchup.away]) {
        if (!side?.teamId) continue;
        const teamId = side.teamId;
        currentTeamStats[teamId] = {};
        const scoreByStat = side.cumulativeScore?.scoreByStat ?? {};
        for (const [statId, statData] of Object.entries(scoreByStat)) {
          const cat = STAT_ID_MAP[parseInt(statId)];
          if (!cat) continue;
          currentTeamStats[teamId][cat] = (statData as any).score ?? 0;
        }
      }
    }

    // Rank teams per category (competition ranking: tied values share the same rank)
    const ranks: Record<number, Record<string, number>> = {};
    for (const cat of CATS_ORDER) {
      const teamIds = Object.keys(currentTeamStats).map(Number);
      const sorted = [...teamIds].sort((a, b) => {
        const aVal = currentTeamStats[a]?.[cat] ?? 0;
        const bVal = currentTeamStats[b]?.[cat] ?? 0;
        return LOWER_IS_BETTER.has(cat) ? aVal - bVal : bVal - aVal;
      });
      let i = 0;
      while (i < sorted.length) {
        const val = currentTeamStats[sorted[i]]?.[cat] ?? 0;
        let j = i;
        while (j < sorted.length && (currentTeamStats[sorted[j]]?.[cat] ?? 0) === val) j++;
        const rank = i + 1;
        for (let k = i; k < j; k++) {
          if (!ranks[sorted[k]]) ranks[sorted[k]] = {};
          ranks[sorted[k]][cat] = rank;
        }
        i = j;
      }
    }

    // Compute league averages per category
    const allTeamIds = Object.keys(currentTeamStats).map(Number);
    const teamCount = allTeamIds.length;
    const averages: Record<string, number> = {};
    for (const cat of CATS_ORDER) {
      const sum = allTeamIds.reduce((acc, tid) => acc + (currentTeamStats[tid]?.[cat] ?? 0), 0);
      averages[cat] = teamCount > 0 ? sum / teamCount : 0;
    }

    // Compute per-team deltas (positive = better than average)
    const deltas: Record<number, Record<string, number>> = {};
    for (const teamId of allTeamIds) {
      deltas[teamId] = {};
      for (const cat of CATS_ORDER) {
        const val = currentTeamStats[teamId]?.[cat] ?? 0;
        deltas[teamId][cat] = LOWER_IS_BETTER.has(cat)
          ? averages[cat] - val   // lower is better: positive delta when below average
          : val - averages[cat];  // higher is better: positive delta when above average
      }
    }

    // Compute composite rank fields per team
    const composites: Record<number, { batting: number; pitching: number; composite: number }> = {};
    for (const teamId of allTeamIds) {
      const teamRanks = ranks[teamId] ?? {};
      const batSum = BAT_CATS.reduce((acc, cat) => acc + (teamRanks[cat] ?? 5.5), 0);
      const pitSum = PIT_CATS.reduce((acc, cat) => acc + (teamRanks[cat] ?? 5.5), 0);
      const allSum = CATS_ORDER.reduce((acc, cat) => acc + (teamRanks[cat] ?? 5.5), 0);
      composites[teamId] = {
        batting: batSum / BAT_CATS.length,
        pitching: pitSum / PIT_CATS.length,
        composite: allSum / CATS_ORDER.length,
      };
    }

    // Assign power rank (competition ranking on compositeAvgRank, lowest = best)
    const powerRankOrder = [...allTeamIds].sort(
      (a, b) => composites[a].composite - composites[b].composite
    );
    const powerRanks: Record<number, number> = {};
    {
      let i = 0;
      while (i < powerRankOrder.length) {
        const val = composites[powerRankOrder[i]].composite;
        let j = i;
        while (j < powerRankOrder.length && composites[powerRankOrder[j]].composite === val) j++;
        const rank = i + 1;
        for (let k = i; k < j; k++) powerRanks[powerRankOrder[k]] = rank;
        i = j;
      }
    }

    const teams: TeamCategoryStats[] = allTeamIds.map((teamId) => ({
      teamId,
      teamName: teamMeta[teamId]?.name ?? `Team ${teamId}`,
      abbrev: teamMeta[teamId]?.abbrev ?? "",
      wins: teamMeta[teamId]?.wins ?? 0,
      losses: teamMeta[teamId]?.losses ?? 0,
      ties: teamMeta[teamId]?.ties ?? 0,
      categories: currentTeamStats[teamId] ?? {},
      ranks: ranks[teamId] ?? {},
      deltas: deltas[teamId] ?? {},
      battingAvgRank: composites[teamId]?.batting ?? 5.5,
      pitchingAvgRank: composites[teamId]?.pitching ?? 5.5,
      compositeAvgRank: composites[teamId]?.composite ?? 5.5,
      powerRank: powerRanks[teamId] ?? 10,
    }));

    // Sort by overall record (wins desc)
    teams.sort((a, b) => b.wins - a.wins || a.losses - b.losses);

    return Response.json({ scoringPeriodId: currentMatchupPeriod, myTeamId: MY_TEAM_ID, teams, averages } as LeagueStatsData);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 502 });
  }
}
