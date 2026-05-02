export const dynamic = "force-dynamic";
import { espnFetch, hasEspnCreds, STAT_ID_MAP } from "@/lib/espn";
import type { EspnLeagueData, EspnScoreByStat, EspnScheduleRecord } from "@/types/espn";
import logger from "@/lib/logger";

export interface TeamCategoryStats {
  teamId: number;
  teamName: string;
  abbrev: string;
  wins: number;
  losses: number;
  ties: number;
  categories: Record<string, number>;
  ranks: Record<string, number>;
  deltas: Record<string, number>;
  rankDeltas: Record<string, number>;
  battingAvgRank: number;
  pitchingAvgRank: number;
  compositeAvgRank: number;
  powerRank: number;
}

export interface LeagueStatsData {
  scope: "week" | "season";
  scoringPeriodId: number;
  myTeamId: number;
  teams: TeamCategoryStats[];
  averages: Record<string, number>;
}

const MY_TEAM_ID = parseInt(process.env.MY_ESPN_TEAM_ID ?? "0");
const CATS_ORDER = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG", "K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"];
const BAT_CATS = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG"];
const PIT_CATS = ["K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"];
const LOWER_IS_BETTER = new Set(["ERA", "WHIP", "L"]);
const RATE_STATS = new Set(["AVG", "ERA", "WHIP"]);

// Component stat IDs needed to reconstruct rate stats across weeks
// These are present in ESPN's scoreByStat alongside the scored categories
const COMPONENT_IDS = { AB: 0, H_BAT: 1, IP: 34, H_PIT: 35, ER: 39, BB_PIT: 38 };

const cleanScore = (v: unknown): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return 0;
};

function buildTeamStatsForWeek(
  schedule: EspnScheduleRecord[],
  matchupPeriodId: number,
): Record<number, Record<string, number>> {
  const stats: Record<number, Record<string, number>> = {};
  for (const matchup of schedule) {
    if (matchup.matchupPeriodId !== matchupPeriodId) continue;
    for (const side of [matchup.home, matchup.away]) {
      if (!side?.teamId) continue;
      stats[side.teamId] = {};
      const scoreByStat = side.cumulativeScore?.scoreByStat ?? {};
      for (const [statId, statData] of Object.entries(scoreByStat)) {
        const cat = STAT_ID_MAP[parseInt(statId)];
        if (!cat) continue;
        stats[side.teamId][cat] = cleanScore((statData as EspnScoreByStat).score);
      }
    }
  }
  return stats;
}

function buildSeasonStats(
  schedule: EspnScheduleRecord[],
  currentMatchupPeriod: number,
): Record<number, Record<string, number>> {
  // Accumulate ALL stat IDs (including unmapped components) across every completed week
  const rawById: Record<number, Record<number, number>> = {};
  for (const matchup of schedule) {
    if ((matchup.matchupPeriodId ?? 0) > currentMatchupPeriod) continue;
    for (const side of [matchup.home, matchup.away]) {
      if (!side?.teamId) continue;
      const teamId = side.teamId;
      if (!rawById[teamId]) rawById[teamId] = {};
      const scoreByStat = side.cumulativeScore?.scoreByStat ?? {};
      for (const [statId, statData] of Object.entries(scoreByStat)) {
        const id = parseInt(statId);
        const val = cleanScore((statData as EspnScoreByStat).score);
        rawById[teamId][id] = (rawById[teamId][id] ?? 0) + val;
      }
    }
  }

  // Convert to category names, reconstructing rate stats from components
  const stats: Record<number, Record<string, number>> = {};
  for (const [teamIdStr, raw] of Object.entries(rawById)) {
    const teamId = parseInt(teamIdStr);
    stats[teamId] = {};
    for (const [statIdStr, cat] of Object.entries(STAT_ID_MAP)) {
      const id = parseInt(statIdStr);
      if (cat === "AVG") {
        const h = raw[COMPONENT_IDS.H_BAT] ?? 0;
        const ab = raw[COMPONENT_IDS.AB] ?? 0;
        stats[teamId][cat] = ab > 0 ? h / ab : 0;
      } else if (cat === "ERA") {
        const er = raw[COMPONENT_IDS.ER] ?? 0;
        const ip = raw[COMPONENT_IDS.IP] ?? 0;
        stats[teamId][cat] = ip > 0 ? (er / ip) * 9 : 0;
      } else if (cat === "WHIP") {
        const bb = raw[COMPONENT_IDS.BB_PIT] ?? 0;
        const h = raw[COMPONENT_IDS.H_PIT] ?? 0;
        const ip = raw[COMPONENT_IDS.IP] ?? 0;
        stats[teamId][cat] = ip > 0 ? (bb + h) / ip : 0;
      } else {
        stats[teamId][cat] = raw[id] ?? 0;
      }
    }
  }
  return stats;
}

function rankTeams(
  teamStats: Record<number, Record<string, number>>,
): {
  ranks: Record<number, Record<string, number>>;
  averages: Record<string, number>;
  deltas: Record<number, Record<string, number>>;
  composites: Record<number, { batting: number; pitching: number; composite: number }>;
  powerRanks: Record<number, number>;
} {
  const allTeamIds = Object.keys(teamStats).map(Number);
  const teamCount = allTeamIds.length;

  // Rank per category (competition ranking)
  const ranks: Record<number, Record<string, number>> = {};
  for (const cat of CATS_ORDER) {
    const sorted = [...allTeamIds].sort((a, b) => {
      const aVal = teamStats[a]?.[cat] ?? 0;
      const bVal = teamStats[b]?.[cat] ?? 0;
      return LOWER_IS_BETTER.has(cat) ? aVal - bVal : bVal - aVal;
    });
    let i = 0;
    while (i < sorted.length) {
      const val = teamStats[sorted[i]]?.[cat] ?? 0;
      let j = i;
      while (j < sorted.length && (teamStats[sorted[j]]?.[cat] ?? 0) === val) j++;
      const rank = i + 1;
      for (let k = i; k < j; k++) {
        if (!ranks[sorted[k]]) ranks[sorted[k]] = {};
        ranks[sorted[k]][cat] = rank;
      }
      i = j;
    }
  }

  // League averages
  const averages: Record<string, number> = {};
  for (const cat of CATS_ORDER) {
    const sum = allTeamIds.reduce((acc, tid) => acc + (teamStats[tid]?.[cat] ?? 0), 0);
    averages[cat] = teamCount > 0 ? sum / teamCount : 0;
  }

  // Deltas (positive = better than average)
  const deltas: Record<number, Record<string, number>> = {};
  for (const teamId of allTeamIds) {
    deltas[teamId] = {};
    for (const cat of CATS_ORDER) {
      const val = teamStats[teamId]?.[cat] ?? 0;
      deltas[teamId][cat] = LOWER_IS_BETTER.has(cat)
        ? averages[cat] - val
        : val - averages[cat];
    }
  }

  // Composite ranks
  const composites: Record<number, { batting: number; pitching: number; composite: number }> = {};
  for (const teamId of allTeamIds) {
    const tr = ranks[teamId] ?? {};
    const batSum = BAT_CATS.reduce((acc, cat) => acc + (tr[cat] ?? 5.5), 0);
    const pitSum = PIT_CATS.reduce((acc, cat) => acc + (tr[cat] ?? 5.5), 0);
    const allSum = CATS_ORDER.reduce((acc, cat) => acc + (tr[cat] ?? 5.5), 0);
    composites[teamId] = {
      batting: batSum / BAT_CATS.length,
      pitching: pitSum / PIT_CATS.length,
      composite: allSum / CATS_ORDER.length,
    };
  }

  // Power rank (competition ranking on composite)
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

  return { ranks, averages, deltas, composites, powerRanks };
}

export async function GET(request: Request) {
  const reqId = crypto.randomUUID();
  const log = logger.child({ reqId, path: new URL(request.url).pathname });
  const { searchParams } = new URL(request.url);
  const scope = (searchParams.get("scope") ?? "week") as "week" | "season";

  if (!hasEspnCreds()) {
    return Response.json({ error: "ESPN_CREDS_MISSING" }, { status: 401 });
  }
  if (!MY_TEAM_ID) {
    return Response.json({ error: "MY_ESPN_TEAM_ID_MISSING" }, { status: 401 });
  }

  try {
    const t0 = Date.now();
    const data = await espnFetch(["mMatchup", "mMatchupScore", "mTeam", "mStatus"]) as EspnLeagueData;
    const currentMatchupPeriod = data.status?.currentMatchupPeriod ?? 1;
    const schedule: EspnScheduleRecord[] = data.schedule ?? [];

    // Build team name lookup
    const teamMeta: Record<number, { name: string; abbrev: string; wins: number; losses: number; ties: number }> = {};
    for (const t of data.teams ?? []) {
      const record = t.record?.overall ?? {};
      teamMeta[t.id] = {
        name: `${t.location ?? ""} ${t.nickname ?? ""}`.trim() || (t.abbrev ?? ""),
        abbrev: t.abbrev ?? "",
        wins: record.wins ?? 0,
        losses: record.losses ?? 0,
        ties: record.ties ?? 0,
      };
    }

    const teamStats = scope === "season"
      ? buildSeasonStats(schedule, currentMatchupPeriod)
      : buildTeamStatsForWeek(schedule, currentMatchupPeriod);

    const { ranks, averages, deltas, composites, powerRanks } = rankTeams(teamStats);
    const allTeamIds = Object.keys(teamStats).map(Number);

    // Compute prior-period ranks for week-over-week rank deltas
    const priorPeriod = currentMatchupPeriod - 1;
    const rankDeltas: Record<number, Record<string, number>> = {};
    if (priorPeriod >= 1) {
      const priorStats = scope === "season"
        ? buildSeasonStats(schedule, priorPeriod)
        : buildTeamStatsForWeek(schedule, priorPeriod);
      if (Object.keys(priorStats).length > 0) {
        const priorResult = rankTeams(priorStats);
        for (const teamId of allTeamIds) {
          rankDeltas[teamId] = {};
          for (const cat of CATS_ORDER) {
            const prevRank = priorResult.ranks[teamId]?.[cat];
            const currRank = ranks[teamId]?.[cat];
            if (prevRank != null && currRank != null) {
              rankDeltas[teamId][cat] = prevRank - currRank;
            }
          }
        }
      }
    }

    const teams: TeamCategoryStats[] = allTeamIds.map((teamId) => ({
      teamId,
      teamName: teamMeta[teamId]?.name ?? `Team ${teamId}`,
      abbrev: teamMeta[teamId]?.abbrev ?? "",
      wins: teamMeta[teamId]?.wins ?? 0,
      losses: teamMeta[teamId]?.losses ?? 0,
      ties: teamMeta[teamId]?.ties ?? 0,
      categories: teamStats[teamId] ?? {},
      ranks: ranks[teamId] ?? {},
      deltas: deltas[teamId] ?? {},
      rankDeltas: rankDeltas[teamId] ?? {},
      battingAvgRank: composites[teamId]?.batting ?? 5.5,
      pitchingAvgRank: composites[teamId]?.pitching ?? 5.5,
      compositeAvgRank: composites[teamId]?.composite ?? 5.5,
      powerRank: powerRanks[teamId] ?? 10,
    }));

    teams.sort((a, b) => b.wins - a.wins || a.losses - b.losses);

    log.info({ op: "league-stats", scope, durationMs: Date.now() - t0 }, "ok");
    return Response.json({ scope, scoringPeriodId: currentMatchupPeriod, myTeamId: MY_TEAM_ID, teams, averages } as LeagueStatsData);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ op: "league-stats", err: msg }, "failed");
    return Response.json({ error: msg }, { status: 502 });
  }
}
