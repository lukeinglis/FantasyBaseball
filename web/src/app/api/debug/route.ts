import { espnFetch, hasEspnCreds } from "@/lib/espn";

export async function GET() {
  if (!hasEspnCreds()) return Response.json({ error: "ESPN_CREDS_MISSING" }, { status: 401 });
  try {
    const data: any = await espnFetch(["mRoster", "mTeam", "mStatus"]);
    const myTeamId = parseInt(process.env.MY_ESPN_TEAM_ID ?? "0");
    const myTeam = (data.teams ?? []).find((t: any) => t.id === myTeamId);
    if (!myTeam) return Response.json({ error: "NO_TEAM" });

    // Get first player's stat blocks to see what IDs are available
    const firstEntry = myTeam.roster?.entries?.[0];
    const player = firstEntry?.playerPoolEntry?.player ?? {};
    const statBlocks = (player.stats ?? []).map((s: any) => ({
      id: s.id,
      appliedTotal: s.appliedTotal,
      seasonId: s.seasonId,
      statSourceId: s.statSourceId,
      statSplitTypeId: s.statSplitTypeId,
      externalId: s.externalId,
      statsKeys: Object.keys(s.stats ?? {}).slice(0, 10),
    }));

    // Also check the roster entry itself for applied stats
    const entryKeys = Object.keys(firstEntry?.playerPoolEntry ?? {});

    return Response.json({
      playerName: player.fullName,
      scoringPeriodId: data.scoringPeriodId,
      statBlockCount: statBlocks.length,
      statBlocks,
      entryKeys,
      appliedStatTotal: firstEntry?.playerPoolEntry?.appliedStatTotal,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
