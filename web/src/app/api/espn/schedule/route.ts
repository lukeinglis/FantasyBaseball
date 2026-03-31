import { espnFetch, hasEspnCreds, getCurrentMatchupPeriod, buildMatchupSchedule, SEASON_START } from "@/lib/espn";

// Returns the full season schedule with matchup periods, dates, and opponents

export interface MatchupWeek {
  period: number;           // matchup period number (1-21)
  startDate: string;        // ISO date
  endDate: string;          // ISO date
  isCurrent: boolean;
  myOpponentId: number | null;
  myOpponentName: string | null;
}

export interface ScheduleData {
  myTeamId: number;
  currentMatchupPeriod: number;
  seasonStart: string;       // first day of season
  weeks: MatchupWeek[];
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
    const data: any = await espnFetch(["mSettings", "mStatus", "mMatchup", "mTeam"]);
    const currentMatchupPeriod = getCurrentMatchupPeriod(data);
    const matchupCount: number = data.settings?.scheduleSettings?.matchupPeriodCount ?? 21;

    // Build team name lookup
    const teamNames: Record<number, string> = {};
    for (const t of data.teams ?? []) {
      teamNames[t.id] = `${t.location ?? ""} ${t.nickname ?? ""}`.trim() || t.abbrev;
    }

    // Build schedule for my team — opponent per matchup period
    const schedule: any[] = data.schedule ?? [];
    const myMatchups: Record<number, { oppId: number }> = {};
    for (const m of schedule) {
      const isHome = m.home?.teamId === MY_TEAM_ID;
      const isAway = m.away?.teamId === MY_TEAM_ID;
      if (!isHome && !isAway) continue;
      const oppId = isHome ? m.away?.teamId : m.home?.teamId;
      myMatchups[m.matchupPeriodId] = { oppId };
    }

    // Build weeks with correct date ranges
    const dateSchedule = buildMatchupSchedule(matchupCount);
    const weeks: MatchupWeek[] = dateSchedule.map((dates, i) => {
      const period = i + 1;
      const matchup = myMatchups[period];
      return {
        period,
        startDate: dates.start,
        endDate: dates.end,
        isCurrent: period === currentMatchupPeriod,
        myOpponentId: matchup?.oppId ?? null,
        myOpponentName: matchup?.oppId ? (teamNames[matchup.oppId] ?? null) : null,
      };
    });

    return Response.json({
      myTeamId: MY_TEAM_ID,
      currentMatchupPeriod,
      seasonStart: SEASON_START.toISOString().slice(0, 10),
      weeks,
    } as ScheduleData);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 502 });
  }
}
