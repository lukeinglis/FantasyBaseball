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
}

export interface LeagueStatsData {
  scoringPeriodId: number;
  myTeamId: number;
  teams: TeamCategoryStats[];
}

const MY_TEAM_ID = parseInt(process.env.MY_ESPN_TEAM_ID ?? "0");
const CATS_ORDER = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG", "K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"];
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
    const currentMatchupPeriod: number = data.status?.currentMatchupPeriod ?? 1;

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

    // Rank teams per category
    const ranks: Record<number, Record<string, number>> = {};
    for (const cat of CATS_ORDER) {
      const teamIds = Object.keys(currentTeamStats).map(Number);
      const sorted = [...teamIds].sort((a, b) => {
        const aVal = currentTeamStats[a]?.[cat] ?? 0;
        const bVal = currentTeamStats[b]?.[cat] ?? 0;
        return LOWER_IS_BETTER.has(cat) ? aVal - bVal : bVal - aVal;
      });
      sorted.forEach((teamId, i) => {
        if (!ranks[teamId]) ranks[teamId] = {};
        ranks[teamId][cat] = i + 1;
      });
    }

    const teams: TeamCategoryStats[] = Object.keys(currentTeamStats).map(Number).map((teamId) => ({
      teamId,
      teamName: teamMeta[teamId]?.name ?? `Team ${teamId}`,
      abbrev: teamMeta[teamId]?.abbrev ?? "",
      wins: teamMeta[teamId]?.wins ?? 0,
      losses: teamMeta[teamId]?.losses ?? 0,
      ties: teamMeta[teamId]?.ties ?? 0,
      categories: currentTeamStats[teamId] ?? {},
      ranks: ranks[teamId] ?? {},
    }));

    // Sort by overall record (wins desc)
    teams.sort((a, b) => b.wins - a.wins || a.losses - b.losses);

    return Response.json({ scoringPeriodId: currentMatchupPeriod, myTeamId: MY_TEAM_ID, teams } as LeagueStatsData);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 502 });
  }
}
