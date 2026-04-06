import { espnFetch, hasEspnCreds, STAT_ID_MAP } from "@/lib/espn";
import { getCategoryWeights } from "@/lib/data";

const MY_TEAM_ID = parseInt(process.env.MY_ESPN_TEAM_ID ?? "0");
const CATS_ORDER = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG", "K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"];
const BAT_CATS = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG"];
const PIT_CATS = ["K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"];
const LOWER_IS_BETTER = new Set(["ERA", "WHIP", "L"]);

interface WeekSnapshot {
  teamStats: Record<number, Record<string, number>>;
  ranks: Record<number, Record<string, number>>;
  averages: Record<string, number>;
  composites: Record<number, { batting: number; pitching: number; composite: number }>;
  powerRanks: Record<number, number>;
  rawScores: Record<number, number>;
  weightedScores: Record<number, number>;
}

function buildSnapshotForPeriod(
  schedule: any[], // eslint-disable-line @typescript-eslint/no-explicit-any
  matchupPeriodId: number,
  weights: Record<string, number>,
): WeekSnapshot {
  // Extract each team's cumulative stats for this matchup period
  const teamStats: Record<number, Record<string, number>> = {};
  for (const matchup of schedule) {
    if (matchup.matchupPeriodId !== matchupPeriodId) continue;
    for (const side of [matchup.home, matchup.away]) {
      if (!side?.teamId) continue;
      const teamId = side.teamId;
      teamStats[teamId] = {};
      const scoreByStat = side.cumulativeScore?.scoreByStat ?? {};
      for (const [statId, statData] of Object.entries(scoreByStat)) {
        const cat = STAT_ID_MAP[parseInt(statId)];
        if (!cat) continue;
        teamStats[teamId][cat] = (statData as any).score ?? 0; // eslint-disable-line @typescript-eslint/no-explicit-any
      }
    }
  }

  const teamIds = Object.keys(teamStats).map(Number);
  const teamCount = teamIds.length;

  // Rank teams per category (competition ranking: tied values share the same rank)
  const ranks: Record<number, Record<string, number>> = {};
  for (const cat of CATS_ORDER) {
    const sorted = [...teamIds].sort((a, b) => {
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
    const sum = teamIds.reduce((acc, tid) => acc + (teamStats[tid]?.[cat] ?? 0), 0);
    averages[cat] = teamCount > 0 ? sum / teamCount : 0;
  }

  // Composite rank fields
  const composites: Record<number, { batting: number; pitching: number; composite: number }> = {};
  for (const teamId of teamIds) {
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

  // Power rank (competition ranking on compositeAvgRank)
  const powerRankOrder = [...teamIds].sort(
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

  // Raw score: sum of (value - league avg) for all categories
  // This is a volume/magnitude measure matching the spreadsheet formula
  const rawScores: Record<number, number> = {};
  for (const teamId of teamIds) {
    let score = 0;
    for (const cat of CATS_ORDER) {
      score += (teamStats[teamId]?.[cat] ?? 0) - averages[cat];
    }
    rawScores[teamId] = score;
  }

  // Weighted score: sum(delta * weight) where delta is sign-adjusted vs league avg
  // Uses category importance weights for a predictive quality measure
  const weightedScores: Record<number, number> = {};
  for (const teamId of teamIds) {
    let score = 0;
    for (const cat of CATS_ORDER) {
      const val = teamStats[teamId]?.[cat] ?? 0;
      const delta = LOWER_IS_BETTER.has(cat)
        ? averages[cat] - val
        : val - averages[cat];
      score += delta * (weights[cat] ?? 0);
    }
    weightedScores[teamId] = score;
  }

  return { teamStats, ranks, averages, composites, powerRanks, rawScores, weightedScores };
}

export async function GET() {
  if (!hasEspnCreds()) {
    return Response.json({ error: "ESPN_CREDS_MISSING" }, { status: 401 });
  }
  if (!MY_TEAM_ID) {
    return Response.json({ error: "MY_ESPN_TEAM_ID_MISSING" }, { status: 401 });
  }

  try {
    const [data, categoryWeights] = await Promise.all([
      espnFetch(["mMatchup", "mMatchupScore", "mTeam", "mStatus"]) as Promise<any>, // eslint-disable-line @typescript-eslint/no-explicit-any
      getCategoryWeights(),
    ]);

    const currentMatchupPeriod = data.status?.currentMatchupPeriod ?? 1;
    const weights = categoryWeights?.weights ?? {};

    // Build team name lookup
    const teamMeta: Record<number, { name: string; abbrev: string }> = {};
    for (const t of data.teams ?? []) {
      teamMeta[t.id] = {
        name: `${t.location ?? ""} ${t.nickname ?? ""}`.trim() || t.abbrev,
        abbrev: t.abbrev ?? "",
      };
    }

    const schedule: any[] = data.schedule ?? []; // eslint-disable-line @typescript-eslint/no-explicit-any

    // Build snapshots for each completed/in-progress matchup period
    const snapshots: Record<number, WeekSnapshot> = {};
    for (let week = 1; week <= currentMatchupPeriod; week++) {
      snapshots[week] = buildSnapshotForPeriod(schedule, week, weights);
    }

    const current = snapshots[currentMatchupPeriod];
    const previous = currentMatchupPeriod > 1 ? snapshots[currentMatchupPeriod - 1] : null;

    if (!current) {
      return Response.json({ error: "No data for current matchup period" }, { status: 404 });
    }

    const teamIds = Object.keys(current.teamStats).map(Number);

    const teams = teamIds
      .map((teamId) => ({
        teamId,
        teamName: teamMeta[teamId]?.name ?? `Team ${teamId}`,
        abbrev: teamMeta[teamId]?.abbrev ?? "",
        compositeAvgRank: current.composites[teamId]?.composite ?? 5.5,
        powerRank: current.powerRanks[teamId] ?? 10,
        rawScore: current.rawScores[teamId] ?? 0,
        weightedScore: current.weightedScores[teamId] ?? 0,
        battingAvgRank: current.composites[teamId]?.batting ?? 5.5,
        pitchingAvgRank: current.composites[teamId]?.pitching ?? 5.5,
        prevWeekPowerRank: previous?.powerRanks[teamId] ?? null,
        prevWeekCompositeAvgRank: previous?.composites[teamId]?.composite ?? null,
        rankChange: previous
          ? (previous.powerRanks[teamId] ?? 10) - (current.powerRanks[teamId] ?? 10)
          : null,
        avgRankChange: previous
          ? (previous.composites[teamId]?.composite ?? 5.5) - (current.composites[teamId]?.composite ?? 5.5)
          : null,
      }))
      .sort((a, b) => a.powerRank - b.powerRank);

    return Response.json({
      currentWeek: currentMatchupPeriod,
      myTeamId: MY_TEAM_ID,
      teams,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 502 });
  }
}
