import { espnFetch, hasEspnCreds, STAT_ID_MAP } from "@/lib/espn";

export interface ScoreboardMatchup {
  matchupPeriodId: number;
  homeTeamId: number;
  homeTeamName: string;
  homeWins: number;
  homeLosses: number;
  homeTies: number;
  awayTeamId: number;
  awayTeamName: string;
  awayWins: number;
  awayLosses: number;
  awayTies: number;
}

export interface ScoreboardData {
  currentMatchupPeriod: number;
  myTeamId: number;
  matchups: ScoreboardMatchup[];
}

const MY_TEAM_ID = parseInt(process.env.MY_ESPN_TEAM_ID ?? "0");
const CATS_ORDER = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG", "K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"];

export async function GET() {
  if (!hasEspnCreds()) {
    return Response.json({ error: "ESPN_CREDS_MISSING" }, { status: 401 });
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await espnFetch(["mMatchup", "mMatchupScore", "mTeam", "mStatus"]);
    const currentMatchupPeriod: number = data.status?.currentMatchupPeriod ?? 1;

    const teamNames: Record<number, string> = {};
    for (const t of data.teams ?? []) {
      teamNames[t.id] = `${t.location ?? ""} ${t.nickname ?? ""}`.trim() || t.abbrev;
    }

    const schedule: any[] = data.schedule ?? [];
    const currentMatchups = schedule.filter((m: any) => m.matchupPeriodId === currentMatchupPeriod);

    const matchups: ScoreboardMatchup[] = currentMatchups.map((m: any) => {
      // Count W/L/T from ESPN's result fields on home side
      const homeStats = m.home?.cumulativeScore?.scoreByStat ?? {};
      let homeW = 0, homeL = 0, homeT = 0;
      for (const [statId, statData] of Object.entries(homeStats)) {
        const cat = STAT_ID_MAP[parseInt(statId)];
        if (!cat || !CATS_ORDER.includes(cat)) continue;
        const result = (statData as any).result;
        if (result === "WIN") homeW++;
        else if (result === "LOSS") homeL++;
        else if (result === "TIE") homeT++;
      }

      return {
        matchupPeriodId: m.matchupPeriodId,
        homeTeamId: m.home?.teamId ?? 0,
        homeTeamName: teamNames[m.home?.teamId] ?? "?",
        homeWins: homeW,
        homeLosses: homeL,
        homeTies: homeT,
        awayTeamId: m.away?.teamId ?? 0,
        awayTeamName: teamNames[m.away?.teamId] ?? "?",
        awayWins: homeL,  // away wins = home losses
        awayLosses: homeW,
        awayTies: homeT,
      };
    });

    return Response.json({ currentMatchupPeriod, myTeamId: MY_TEAM_ID, matchups } as ScoreboardData);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 502 });
  }
}
