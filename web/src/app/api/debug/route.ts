import { espnFetch, hasEspnCreds } from "@/lib/espn";

export async function GET() {
  if (!hasEspnCreds()) {
    return Response.json({ error: "ESPN_CREDS_MISSING" }, { status: 401 });
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await espnFetch(["mMatchup", "mMatchupScore", "mStatus"]);
    const currentMatchupPeriod: number = data.status?.currentMatchupPeriod ?? 1;
    const scoringPeriodId: number = data.scoringPeriodId ?? 1;

    const schedule: any[] = data.schedule ?? [];
    const matchup = schedule.find(
      (m: any) => m.matchupPeriodId === currentMatchupPeriod
    );

    if (!matchup) {
      return Response.json({ error: "NO_MATCHUP", currentMatchupPeriod, scoringPeriodId, scheduleLength: schedule.length });
    }

    // Extract raw scoreByStat from both sides
    const homeSBS = matchup.home?.cumulativeScore?.scoreByStat ?? {};
    const awaySBS = matchup.away?.cumulativeScore?.scoreByStat ?? {};

    // Show all stat IDs and their values
    const homeStats: Record<string, any> = {};
    for (const [id, val] of Object.entries(homeSBS)) {
      homeStats[id] = val;
    }
    const awayStats: Record<string, any> = {};
    for (const [id, val] of Object.entries(awaySBS)) {
      awayStats[id] = val;
    }

    return Response.json({
      scoringPeriodId,
      currentMatchupPeriod,
      matchupPeriodId: matchup.matchupPeriodId,
      homeTeamId: matchup.home?.teamId,
      awayTeamId: matchup.away?.teamId,
      homeStatIds: Object.keys(homeStats),
      awayStatIds: Object.keys(awayStats),
      homeScoreByStat: homeStats,
      awayScoreByStat: awayStats,
      homeCumulativeWins: matchup.home?.cumulativeScore?.wins,
      homeCumulativeLosses: matchup.home?.cumulativeScore?.losses,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
