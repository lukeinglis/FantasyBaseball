import { espnFetch, hasEspnCreds, POS_MAP, getProTeam } from "@/lib/espn";

// Returns matchup period dates and roster data for current + next week
// so the frontend can cross-reference with probable pitchers

export interface StartsTeam {
  teamId: number;
  teamName: string;
  pitchers: { name: string; pos: string; proTeam: string; onIL: boolean }[];
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
const SEASON_START = new Date("2026-03-25T00:00:00");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMatchupDates(data: any, period: number): { start: string; end: string } | null {
  const matchupPeriods: any = data.settings?.scheduleSettings?.matchupPeriods ?? {};
  const days: number[] = matchupPeriods[String(period)] ?? [];
  if (days.length === 0) return null;

  const firstDay = Math.min(...days);
  const lastDay = Math.max(...days);

  const start = new Date(SEASON_START);
  start.setDate(start.getDate() + firstDay - 1);
  const end = new Date(SEASON_START);
  end.setDate(end.getDate() + lastDay - 1);

  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

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
    const currentMatchupPeriod: number = data.status?.currentMatchupPeriod ?? 1;

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
        pitchers.push({
          name: pName,
          pos: POS_MAP[posId] ?? "?",
          proTeam: getProTeam(player),
          onIL: isIL,
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
