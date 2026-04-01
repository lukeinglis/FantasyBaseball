import { espnFetch, hasEspnCreds, POS_MAP, getProTeam, getMatchupDates, getCurrentMatchupPeriod } from "@/lib/espn";

export async function GET() {
  if (!hasEspnCreds()) return Response.json({ error: "ESPN_CREDS_MISSING" }, { status: 401 });
  const myTeamId = parseInt(process.env.MY_ESPN_TEAM_ID ?? "0");
  try {
    const data: any = await espnFetch(["mRoster", "mTeam", "mStatus", "mSettings"]);
    const currentPeriod = getCurrentMatchupPeriod(data);
    const dates = getMatchupDates(data, currentPeriod);

    // Also fetch MLB schedule to map game IDs to dates
    const schedUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${dates?.start ?? "2026-03-25"}&endDate=${dates?.end ?? "2026-04-05"}&gameType=R`;
    const schedRes = await fetch(schedUrl, { next: { revalidate: 900 } });
    const schedData = await schedRes.json();

    // Build gameId → date map
    const gameIdToDate: Record<string, string> = {};
    for (const dateObj of schedData.dates ?? []) {
      for (const game of dateObj.games ?? []) {
        gameIdToDate[String(game.gamePk)] = dateObj.date;
      }
    }

    const myTeam = (data.teams ?? []).find((t: any) => t.id === myTeamId);
    if (!myTeam) return Response.json({ error: "NO_TEAM" });

    // Check one pitcher's PP game IDs against the schedule
    const samplePitcher = myTeam.roster?.entries?.find((e: any) => {
      const p = e.playerPoolEntry?.player;
      return p?.fullName?.includes("Rogers");
    });
    const player = samplePitcher?.playerPoolEntry?.player ?? {};
    const ppMap = player.starterStatusByProGame ?? {};

    const ppWithDates: Record<string, { status: string; date: string | null }> = {};
    for (const [gameId, status] of Object.entries(ppMap)) {
      ppWithDates[gameId] = { status: status as string, date: gameIdToDate[gameId] ?? null };
    }

    return Response.json({
      currentPeriod,
      matchupDates: dates,
      playerName: player.fullName,
      ppWithDates,
      totalGamesInSchedule: Object.keys(gameIdToDate).length,
      sampleGameIds: Object.keys(gameIdToDate).slice(0, 5),
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
