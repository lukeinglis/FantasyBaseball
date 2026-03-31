import { espnFetch, hasEspnCreds } from "@/lib/espn";

const MY_TEAM_ID = parseInt(process.env.MY_ESPN_TEAM_ID ?? "0");

export async function GET() {
  if (!hasEspnCreds()) {
    return Response.json({ error: "ESPN_CREDS_MISSING" }, { status: 401 });
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await espnFetch(["mMatchup", "mMatchupScore", "mStatus", "mSettings"]);
    const currentMatchupPeriod: number = data.status?.currentMatchupPeriod ?? 1;
    const scoringPeriodId: number = data.scoringPeriodId ?? 1;

    const schedule: any[] = data.schedule ?? [];

    // Find my matchup
    const myMatchup = schedule.find(
      (m: any) =>
        m.matchupPeriodId === currentMatchupPeriod &&
        (m.home?.teamId === MY_TEAM_ID || m.away?.teamId === MY_TEAM_ID)
    );

    if (!myMatchup) {
      return Response.json({
        error: "NO_MATCHUP",
        currentMatchupPeriod,
        scoringPeriodId,
        MY_TEAM_ID,
        allMatchupPeriods: schedule.map((m: any) => m.matchupPeriodId),
      });
    }

    const iAmHome = myMatchup.home?.teamId === MY_TEAM_ID;
    const mySide = iAmHome ? myMatchup.home : myMatchup.away;
    const oppSide = iAmHome ? myMatchup.away : myMatchup.home;

    // Dump ALL scoreByStat entries with full structure
    const myScoreByStat: Record<string, unknown> = {};
    for (const [id, val] of Object.entries(mySide?.cumulativeScore?.scoreByStat ?? {})) {
      myScoreByStat[id] = val;
    }
    const oppScoreByStat: Record<string, unknown> = {};
    for (const [id, val] of Object.entries(oppSide?.cumulativeScore?.scoreByStat ?? {})) {
      oppScoreByStat[id] = val;
    }

    // Check settings for matchup periods / schedule settings
    const matchupPeriods = data.settings?.scheduleSettings?.matchupPeriods ?? {};
    const scoringPeriods = data.settings?.scoringPeriods ?? [];

    return Response.json({
      scoringPeriodId,
      currentMatchupPeriod,
      iAmHome,
      myTeamId: mySide?.teamId,
      oppTeamId: oppSide?.teamId,
      myCumulativeWins: mySide?.cumulativeScore?.wins,
      myCumulativeLosses: mySide?.cumulativeScore?.losses,
      myCumulativeTies: mySide?.cumulativeScore?.ties,
      myStatIds: Object.keys(myScoreByStat).sort((a, b) => parseInt(a) - parseInt(b)),
      oppStatIds: Object.keys(oppScoreByStat).sort((a, b) => parseInt(a) - parseInt(b)),
      myScoreByStat,
      oppScoreByStat,
      matchupPeriodKeys: Object.keys(matchupPeriods),
      currentPeriodDays: matchupPeriods[String(currentMatchupPeriod)],
      scoringPeriodsCount: scoringPeriods.length,
      firstScoringPeriod: scoringPeriods[0],
      statusKeys: Object.keys(data.status ?? {}),
      fullStatus: data.status,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
