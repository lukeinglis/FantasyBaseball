export const dynamic = "force-dynamic";
import { espnFetch, hasEspnCreds, STAT_ID_MAP } from "@/lib/espn";
import type { EspnLeagueData, EspnScoreByStat, EspnScheduleRecord } from "@/types/espn";
import logger from "@/lib/logger";

export interface ScoreboardCatResult {
  cat: string;
  homeValue: number;
  awayValue: number;
  result: "HOME" | "AWAY" | "TIE";
}

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
  categories: ScoreboardCatResult[];
}

export interface ScoreboardData {
  currentMatchupPeriod: number;
  myTeamId: number;
  matchups: ScoreboardMatchup[];
}

const MY_TEAM_ID = parseInt(process.env.MY_ESPN_TEAM_ID ?? "0");
const CATS_ORDER = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG", "K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"];

export async function GET(req: Request) {
  const reqId = crypto.randomUUID();
  const log = logger.child({ reqId, path: new URL(req.url).pathname });
  if (!hasEspnCreds()) {
    return Response.json({ error: "ESPN_CREDS_MISSING" }, { status: 401 });
  }
  try {
    const t0 = Date.now();
    const data = await espnFetch(["mMatchup", "mMatchupScore", "mTeam", "mStatus"]) as EspnLeagueData;
    const currentMatchupPeriod = data.status?.currentMatchupPeriod ?? 1;

    const teamNames: Record<number, string> = {};
    for (const t of data.teams ?? []) {
      teamNames[t.id] = `${t.location ?? ""} ${t.nickname ?? ""}`.trim() || (t.abbrev ?? "");
    }

    const schedule: EspnScheduleRecord[] = data.schedule ?? [];
    const currentMatchups = schedule.filter((m) => m.matchupPeriodId === currentMatchupPeriod);

    const cleanScore = (v: unknown): number => {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      return 0;
    };

    const matchups: ScoreboardMatchup[] = currentMatchups.map((m) => {
      const homeStats = m.home?.cumulativeScore?.scoreByStat ?? {};
      const awayStats = m.away?.cumulativeScore?.scoreByStat ?? {};
      let homeW = 0, homeL = 0, homeT = 0;
      const categories: ScoreboardCatResult[] = [];

      for (const cat of CATS_ORDER) {
        const statId = Object.entries(STAT_ID_MAP).find(([, c]) => c === cat)?.[0];
        if (!statId) continue;
        const homeData = homeStats[statId] as EspnScoreByStat | undefined;
        const awayData = awayStats[statId] as EspnScoreByStat | undefined;
        const homeValue = cleanScore(homeData?.score);
        const awayValue = cleanScore(awayData?.score);
        const result = homeData?.result;
        if (result === "WIN") homeW++;
        else if (result === "LOSS") homeL++;
        else if (result === "TIE") homeT++;

        categories.push({
          cat,
          homeValue,
          awayValue,
          result: result === "WIN" ? "HOME" : result === "LOSS" ? "AWAY" : "TIE",
        });
      }

      return {
        matchupPeriodId: m.matchupPeriodId ?? 0,
        homeTeamId: m.home?.teamId ?? 0,
        homeTeamName: teamNames[m.home?.teamId ?? 0] ?? "?",
        homeWins: homeW,
        homeLosses: homeL,
        homeTies: homeT,
        awayTeamId: m.away?.teamId ?? 0,
        awayTeamName: teamNames[m.away?.teamId ?? 0] ?? "?",
        awayWins: homeL,
        awayLosses: homeW,
        awayTies: homeT,
        categories,
      };
    });

    log.info({ op: "scoreboard", durationMs: Date.now() - t0 }, "ok");
    return Response.json({ currentMatchupPeriod, myTeamId: MY_TEAM_ID, matchups } as ScoreboardData);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ op: "scoreboard", err: msg }, "failed");
    return Response.json({ error: msg }, { status: 502 });
  }
}
