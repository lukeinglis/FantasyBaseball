import { espnFetch, hasEspnCreds, POS_MAP, getProTeam, getMatchupDates, getCurrentMatchupPeriod } from "@/lib/espn";

// Returns matchup period dates and roster data for current + next week
// so the frontend can cross-reference with probable pitchers

export interface StartsTeam {
  teamId: number;
  teamName: string;
  pitchers: { name: string; pos: string; proTeam: string; onIL: boolean; ppCount: number }[];
}

export interface StartsData {
  myTeamId: number;
  currentMatchupPeriod: number;
  currentDates: { start: string; end: string } | null;
  nextDates: { start: string; end: string } | null;
  teams: StartsTeam[];
  // All rostered pitcher names (for identifying free agents)
  rosteredPitchers: Set<string> | string[];
}

const MY_TEAM_ID = parseInt(process.env.MY_ESPN_TEAM_ID ?? "0");

export async function GET() {
  if (!hasEspnCreds()) {
    return Response.json({ error: "ESPN_CREDS_MISSING" }, { status: 401 });
  }
  if (!MY_TEAM_ID) {
    return Response.json({ error: "MY_ESPN_TEAM_ID_MISSING" }, { status: 401 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await espnFetch(["mRoster", "mTeam", "mStatus", "mSettings"]);
    const currentMatchupPeriod = getCurrentMatchupPeriod(data);

    const currentDates = getMatchupDates(data, currentMatchupPeriod);
    const nextDates = getMatchupDates(data, currentMatchupPeriod + 1);

    const teams: StartsTeam[] = [];
    const allRosteredPitchers: string[] = [];

    for (const t of data.teams ?? []) {
      const name = `${t.location ?? ""} ${t.nickname ?? ""}`.trim() || t.abbrev;
      const pitchers: StartsTeam["pitchers"] = [];

      for (const e of t.roster?.entries ?? []) {
        const player = e.playerPoolEntry?.player ?? {};
        const posId = player.defaultPositionId;
        // SP (1) or RP (11)
        if (posId !== 1 && posId !== 11) continue;

        const pName = player.fullName ?? "";
        const isIL = e.lineupSlotId === 12;

        // Count ESPN's projected starts from starterStatusByProGame
        const ppMap: Record<string, string> = player.starterStatusByProGame ?? {};
        const ppCount = Object.values(ppMap).filter((s) => s === "PROBABLE").length;

        pitchers.push({
          name: pName,
          pos: POS_MAP[posId] ?? "?",
          proTeam: getProTeam(player),
          onIL: isIL,
          ppCount, // ESPN's projected starts count
        });
        allRosteredPitchers.push(pName);
      }

      teams.push({ teamId: t.id, teamName: name, pitchers });
    }

    return Response.json({
      myTeamId: MY_TEAM_ID,
      currentMatchupPeriod,
      currentDates,
      nextDates,
      teams,
      rosteredPitchers: allRosteredPitchers,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 502 });
  }
}
