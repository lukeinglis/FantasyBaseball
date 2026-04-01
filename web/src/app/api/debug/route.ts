import { espnFetch, hasEspnCreds, getProTeam } from "@/lib/espn";

export async function GET() {
  if (!hasEspnCreds()) return Response.json({ error: "ESPN_CREDS_MISSING" }, { status: 401 });
  try {
    const data: any = await espnFetch(["mRoster", "mTeam", "mStatus"]);
    const myTeamId = parseInt(process.env.MY_ESPN_TEAM_ID ?? "0");

    // Count PP for all teams
    const teamPPCounts: Record<string, { name: string; pitchers: { name: string; ppCount: number; ppGames: string[] }[] }> = {};

    for (const team of data.teams ?? []) {
      const teamName = `${team.location ?? ""} ${team.nickname ?? ""}`.trim();
      const pitchers: { name: string; ppCount: number; ppGames: string[] }[] = [];

      for (const entry of team.roster?.entries ?? []) {
        const player = entry.playerPoolEntry?.player ?? {};
        const posId = player.defaultPositionId;
        if (posId !== 1 && posId !== 11) continue; // SP or RP only

        const ppMap = player.starterStatusByProGame ?? {};
        const ppGames = Object.entries(ppMap)
          .filter(([, status]) => status === "PROBABLE")
          .map(([gameId]) => gameId);

        if (ppGames.length > 0 || posId === 1) {
          pitchers.push({
            name: player.fullName ?? "?",
            ppCount: ppGames.length,
            ppGames,
          });
        }
      }

      const totalPP = pitchers.reduce((sum, p) => sum + p.ppCount, 0);
      teamPPCounts[team.id] = {
        name: `${teamName} (${totalPP} starts)`,
        pitchers: pitchers.sort((a, b) => b.ppCount - a.ppCount),
      };
    }

    return Response.json({
      myTeamId,
      teamPPCounts,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
