import { espnFetch, hasEspnCreds, POS_MAP, getProTeam } from "@/lib/espn";

export async function GET() {
  if (!hasEspnCreds()) return Response.json({ error: "ESPN_CREDS_MISSING" }, { status: 401 });
  const myTeamId = parseInt(process.env.MY_ESPN_TEAM_ID ?? "0");
  try {
    const data: any = await espnFetch(["mRoster", "mTeam", "mStatus"]);
    const myTeam = (data.teams ?? []).find((t: any) => t.id === myTeamId);
    if (!myTeam) return Response.json({ error: "NO_TEAM" });

    // List ALL pitchers with their PP data
    const pitchers: any[] = [];
    for (const e of myTeam.roster?.entries ?? []) {
      const player = e.playerPoolEntry?.player ?? {};
      const posId = player.defaultPositionId;
      if (posId !== 1 && posId !== 11) continue;

      const ppMap = player.starterStatusByProGame ?? {};
      const ppEntries = Object.entries(ppMap);
      const probableCount = ppEntries.filter(([, s]) => s === "PROBABLE").length;

      pitchers.push({
        name: player.fullName,
        pos: POS_MAP[posId],
        proTeam: getProTeam(player),
        slotId: e.lineupSlotId,
        injuryStatus: player.injuryStatus,
        ppCount: probableCount,
        ppTotal: ppEntries.length,
        ppMap: ppMap,
        hasStarter: !!player.starterStatusByProGame,
      });
    }

    const totalPP = pitchers.reduce((s, p) => s + p.ppCount, 0);
    const spOnlyPP = pitchers.filter(p => p.pos === "SP").reduce((s, p) => s + p.ppCount, 0);

    return Response.json({
      myTeamId,
      totalPP,
      spOnlyPP,
      pitcherCount: pitchers.length,
      pitchers: pitchers.sort((a, b) => b.ppCount - a.ppCount),
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
