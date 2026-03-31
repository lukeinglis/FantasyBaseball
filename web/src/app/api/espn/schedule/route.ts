import { espnFetch, hasEspnCreds } from "@/lib/espn";

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
    const currentMatchupPeriod: number = data.status?.currentMatchupPeriod ?? 1;
    const matchupPeriods: Record<string, number[]> = data.settings?.scheduleSettings?.matchupPeriods ?? {};

    // Build team name lookup
    const teamNames: Record<number, string> = {};
    for (const t of data.teams ?? []) {
      teamNames[t.id] = `${t.location ?? ""} ${t.nickname ?? ""}`.trim() || t.abbrev;
    }

    // Determine season start date
    // Use the first scoring period's day number (1) mapped to a real date
    // ESPN's activatedDate is the league activation, not necessarily season start
    // We derive from the schedule: find the earliest game date
    // For now, use the known 2026 MLB season start
    const SEASON_START = new Date("2026-03-25T00:00:00");

    function dayToDate(dayNum: number): string {
      const d = new Date(SEASON_START);
      d.setDate(d.getDate() + dayNum - 1);
      return d.toISOString().slice(0, 10);
    }

    // Build schedule for my team
    const schedule: any[] = data.schedule ?? [];
    const myMatchups: Record<number, { oppId: number }> = {};
    for (const m of schedule) {
      const isHome = m.home?.teamId === MY_TEAM_ID;
      const isAway = m.away?.teamId === MY_TEAM_ID;
      if (!isHome && !isAway) continue;
      const oppId = isHome ? m.away?.teamId : m.home?.teamId;
      myMatchups[m.matchupPeriodId] = { oppId };
    }

    // Build weeks array
    const weeks: MatchupWeek[] = [];
    const periodKeys = Object.keys(matchupPeriods)
      .map(Number)
      .sort((a, b) => a - b);

    for (const period of periodKeys) {
      const days = matchupPeriods[String(period)] ?? [];
      if (days.length === 0) continue;

      const firstDay = Math.min(...days);
      const lastDay = Math.max(...days);
      const startDate = dayToDate(firstDay);
      const endDate = dayToDate(lastDay);
      const matchup = myMatchups[period];

      weeks.push({
        period,
        startDate,
        endDate,
        isCurrent: period === currentMatchupPeriod,
        myOpponentId: matchup?.oppId ?? null,
        myOpponentName: matchup?.oppId ? (teamNames[matchup.oppId] ?? null) : null,
      });
    }

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
