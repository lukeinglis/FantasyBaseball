import { espnFetch, hasEspnCreds } from "@/lib/espn";

export async function GET() {
  if (!hasEspnCreds()) return Response.json({ error: "ESPN_CREDS_MISSING" }, { status: 401 });
  try {
    const data: any = await espnFetch(["mMatchup", "mStatus", "mSettings"]);
    const schedule: any[] = data.schedule ?? [];

    // Get unique matchup periods and their properties
    const periods: Record<number, any> = {};
    for (const m of schedule) {
      const mp = m.matchupPeriodId;
      if (!periods[mp]) {
        periods[mp] = {
          matchupPeriodId: mp,
          // Check for any date fields
          keys: Object.keys(m),
          matchupType: m.matchupType,
          playoffTierType: m.playoffTierType,
        };
      }
    }

    // Also look for matchup period schedule in settings
    const ss = data.settings?.scheduleSettings ?? {};

    // Try to find date information in the schedule settings
    return Response.json({
      scoringPeriodId: data.scoringPeriodId,
      currentMatchupPeriod: data.status?.currentMatchupPeriod,
      finalScoringPeriod: data.status?.finalScoringPeriod,
      // All unique matchup periods from the schedule
      matchupPeriodSample: periods,
      // First schedule entry - ALL keys
      firstScheduleEntryKeys: schedule.length > 0 ? Object.keys(schedule[0]) : [],
      firstScheduleEntry: schedule.length > 0 ? {
        ...schedule[0],
        home: { teamId: schedule[0].home?.teamId },
        away: { teamId: schedule[0].away?.teamId },
      } : null,
      // Schedule settings
      matchupPeriodCount: ss.matchupPeriodCount,
      matchupPeriodLength: ss.matchupPeriodLength,
      periodTypeId: ss.periodTypeId,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
