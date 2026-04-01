import { espnFetch, hasEspnCreds } from "@/lib/espn";

export async function GET() {
  if (!hasEspnCreds()) return Response.json({ error: "ESPN_CREDS_MISSING" }, { status: 401 });
  try {
    // Fetch roster with extended views to find PP data
    const data: any = await espnFetch(["mRoster", "mTeam", "mStatus"]);
    const myTeamId = parseInt(process.env.MY_ESPN_TEAM_ID ?? "0");
    const myTeam = (data.teams ?? []).find((t: any) => t.id === myTeamId);
    if (!myTeam) return Response.json({ error: "NO_TEAM" });

    // Find a known PP pitcher (Tanner Bibee or Casey Mize based on ESPN screenshots)
    const entries = myTeam.roster?.entries ?? [];
    const pitcher = entries.find((e: any) => {
      const name = e.playerPoolEntry?.player?.fullName ?? "";
      return name.includes("Bibee") || name.includes("Mize") || name.includes("Rogers");
    });

    if (!pitcher) return Response.json({ error: "NO_PITCHER_FOUND" });

    const player = pitcher.playerPoolEntry?.player ?? {};
    const ppe = pitcher.playerPoolEntry ?? {};

    // Dump ALL fields to find where PP data lives
    return Response.json({
      playerName: player.fullName,
      // Check for starterStatus fields
      starterStatusByProGame: player.starterStatusByProGame,
      // Check for lineup/start info
      lineupSlotId: pitcher.lineupSlotId,
      // All top-level player keys
      playerKeys: Object.keys(player).sort(),
      // All playerPoolEntry keys
      ppeKeys: Object.keys(ppe).sort(),
      // All roster entry keys
      entryKeys: Object.keys(pitcher).sort(),
      // Check for any "start" or "probable" related fields
      ownership: player.ownership,
      rankings: ppe.ratings,
      // Player's full proGamesByScoringPeriod if it exists
      proGamesByScoringPeriod: player.proGamesByScoringPeriod,
      // starterStatus
      starterStatus: player.starterStatus,
      // Check the entry's acquisitionDate and other metadata
      acquisitionDate: pitcher.acquisitionDate,
      // Look for any schedule data
      draftRanksByRankType: player.draftRanksByRankType ? "exists" : "missing",
      eligibleSlots: player.eligibleSlots,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
