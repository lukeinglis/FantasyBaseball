import { espnFetch, hasEspnCreds } from "@/lib/espn";

export async function GET() {
  if (!hasEspnCreds()) return Response.json({ error: "ESPN_CREDS_MISSING" }, { status: 401 });
  try {
    const data: any = await espnFetch(["mSettings", "mStatus"]);
    const ss = data.settings?.scheduleSettings ?? {};
    return Response.json({
      scoringPeriodId: data.scoringPeriodId,
      currentMatchupPeriod: data.status?.currentMatchupPeriod,
      finalScoringPeriod: data.status?.finalScoringPeriod,
      firstScoringPeriod: data.status?.firstScoringPeriod,
      matchupPeriodCount: ss.matchupPeriodCount,
      matchupPeriodLength: ss.matchupPeriodLength,
      // Show first 5 matchup periods to see the pattern
      matchupPeriods_1: ss.matchupPeriods?.["1"],
      matchupPeriods_2: ss.matchupPeriods?.["2"],
      matchupPeriods_3: ss.matchupPeriods?.["3"],
      matchupPeriods_4: ss.matchupPeriods?.["4"],
      matchupPeriods_5: ss.matchupPeriods?.["5"],
      // All schedule settings keys
      scheduleSettingsKeys: Object.keys(ss),
      // Full scheduleSettings (without matchupPeriods to keep it small)
      divisions: ss.divisions,
      playoffMatchupPeriodLength: ss.playoffMatchupPeriodLength,
      playoffSeedingRule: ss.playoffSeedingRule,
      playoffSeedingRuleBy: ss.playoffSeedingRuleBy,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
