export const dynamic = "force-dynamic";
import { espnFetch, hasEspnCreds, STAT_ID_MAP, buildMatchupSchedule, getCurrentMatchupPeriod } from "@/lib/espn";
import type { EspnLeagueData, EspnScoreByStat, EspnScheduleRecord } from "@/types/espn";
import logger from "@/lib/logger";

export interface WeekBatting {
  H: number;
  AB: number;
  R: number;
  HR: number;
  TB: number;
  RBI: number;
  BB: number;
  SB: number;
  AVG: number;
}

export interface WeekPitching {
  IP: number;
  H: number;
  ER: number;
  BB: number;
  K: number;
  QS: number;
  W: number;
  L: number;
  SV: number;
  HD: number;
  ERA: number;
  WHIP: number;
}

export interface WeekLog {
  week: number;
  startDate: string;
  endDate: string;
  oppName: string;
  catWins: number;
  catLosses: number;
  catTies: number;
  matchResult: "W" | "L" | "T";
  batting: WeekBatting;
  pitching: WeekPitching;
}

export interface SeasonLogData {
  myTeamId: number;
  myTeamName: string;
  currentWeek: number;
  weeks: WeekLog[];
  seasonTotals: { batting: WeekBatting; pitching: WeekPitching };
}

const MY_TEAM_ID = parseInt(process.env.MY_ESPN_TEAM_ID ?? "0");

const CATS_ORDER = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG", "K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"];

const cleanVal = (v: unknown): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return 0;
};

// Component stat IDs for rate stat reconstruction
const COMPONENT_IDS = { AB: 0, H_BAT: 1, IP: 34, H_PIT: 35, ER: 39, BB_PIT: 38 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractWeekStats(side: any): { batting: WeekBatting; pitching: WeekPitching } {
  const scoreByStat = side?.cumulativeScore?.scoreByStat ?? {};

  const getScore = (id: number): number => {
    const entry = scoreByStat[String(id)];
    if (!entry) return 0;
    return cleanVal(typeof entry === "object" ? (entry as EspnScoreByStat).score : entry);
  };

  const batH = getScore(COMPONENT_IDS.H_BAT);
  const batAB = getScore(COMPONENT_IDS.AB);
  const batting: WeekBatting = {
    H: batH,
    AB: batAB,
    R: getScore(20),
    HR: getScore(5),
    TB: getScore(8),
    RBI: getScore(21),
    BB: getScore(10),
    SB: getScore(23),
    AVG: batAB > 0 ? batH / batAB : 0,
  };

  const pitIP = getScore(COMPONENT_IDS.IP);
  const pitH = getScore(COMPONENT_IDS.H_PIT);
  const pitER = getScore(COMPONENT_IDS.ER);
  const pitBB = getScore(COMPONENT_IDS.BB_PIT);
  const pitching: WeekPitching = {
    IP: pitIP,
    H: pitH,
    ER: pitER,
    BB: pitBB,
    K: getScore(48),
    QS: getScore(63),
    W: getScore(53),
    L: getScore(54),
    SV: getScore(57),
    HD: getScore(60),
    ERA: pitIP > 0 ? (pitER / pitIP) * 9 : 0,
    WHIP: pitIP > 0 ? (pitBB + pitH) / pitIP : 0,
  };

  return { batting, pitching };
}

export async function GET(req: Request) {
  const reqId = crypto.randomUUID();
  const log = logger.child({ reqId, path: new URL(req.url).pathname });

  if (!hasEspnCreds()) {
    return Response.json({ error: "ESPN_CREDS_MISSING" }, { status: 401 });
  }
  if (!MY_TEAM_ID) {
    return Response.json({ error: "MY_ESPN_TEAM_ID_MISSING" }, { status: 401 });
  }

  try {
    const t0 = Date.now();
    const data = await espnFetch(["mMatchup", "mMatchupScore", "mTeam", "mSettings", "mStatus"]) as EspnLeagueData;
    const currentWeek = getCurrentMatchupPeriod(data);
    const matchupCount = data.settings?.scheduleSettings?.matchupPeriodCount ?? 21;
    const matchupDates = buildMatchupSchedule(matchupCount);

    const teamNames: Record<number, string> = {};
    for (const t of data.teams ?? []) {
      teamNames[t.id] = `${t.location ?? ""} ${t.nickname ?? ""}`.trim() || (t.abbrev ?? "");
    }

    const schedule: EspnScheduleRecord[] = data.schedule ?? [];

    // Accumulators for season totals
    const seasonBatRaw = { H: 0, AB: 0, R: 0, HR: 0, TB: 0, RBI: 0, BB: 0, SB: 0 };
    const seasonPitRaw = { IP: 0, H: 0, ER: 0, BB: 0, K: 0, QS: 0, W: 0, L: 0, SV: 0, HD: 0 };

    const weeks: WeekLog[] = [];

    for (let week = 1; week <= currentWeek; week++) {
      const myMatchup = schedule.find(
        (m) =>
          m.matchupPeriodId === week &&
          (m.home?.teamId === MY_TEAM_ID || m.away?.teamId === MY_TEAM_ID)
      );

      if (!myMatchup) continue;

      const iAmHome = myMatchup.home?.teamId === MY_TEAM_ID;
      const mySide = iAmHome ? myMatchup.home : myMatchup.away;
      const oppSide = iAmHome ? myMatchup.away : myMatchup.home;
      const oppTeamId = oppSide?.teamId ?? 0;

      const stats = extractWeekStats(mySide);

      // Count category wins/losses
      const myCumulative = mySide?.cumulativeScore ?? {};
      const oppCumulative = oppSide?.cumulativeScore ?? {};
      const myScoreByStat = (myCumulative as { scoreByStat?: Record<string, EspnScoreByStat> }).scoreByStat ?? {};
      let catWins = 0;
      let catLosses = 0;
      let catTies = 0;

      for (const cat of CATS_ORDER) {
        const statId = Object.entries(STAT_ID_MAP).find(([, c]) => c === cat)?.[0];
        if (!statId) continue;
        const myData = myScoreByStat[statId];
        if (myData?.result === "WIN") catWins++;
        else if (myData?.result === "LOSS") catLosses++;
        else if (myData?.result === "TIE") catTies++;
      }

      const matchResult: "W" | "L" | "T" = catWins > catLosses ? "W" : catLosses > catWins ? "L" : "T";

      // Accumulate season totals
      seasonBatRaw.H += stats.batting.H;
      seasonBatRaw.AB += stats.batting.AB;
      seasonBatRaw.R += stats.batting.R;
      seasonBatRaw.HR += stats.batting.HR;
      seasonBatRaw.TB += stats.batting.TB;
      seasonBatRaw.RBI += stats.batting.RBI;
      seasonBatRaw.BB += stats.batting.BB;
      seasonBatRaw.SB += stats.batting.SB;
      seasonPitRaw.IP += stats.pitching.IP;
      seasonPitRaw.H += stats.pitching.H;
      seasonPitRaw.ER += stats.pitching.ER;
      seasonPitRaw.BB += stats.pitching.BB;
      seasonPitRaw.K += stats.pitching.K;
      seasonPitRaw.QS += stats.pitching.QS;
      seasonPitRaw.W += stats.pitching.W;
      seasonPitRaw.L += stats.pitching.L;
      seasonPitRaw.SV += stats.pitching.SV;
      seasonPitRaw.HD += stats.pitching.HD;

      const dateRange = matchupDates[week - 1];
      weeks.push({
        week,
        startDate: dateRange?.start ?? "",
        endDate: dateRange?.end ?? "",
        oppName: teamNames[oppTeamId] ?? `Team ${oppTeamId}`,
        catWins,
        catLosses,
        catTies,
        matchResult,
        batting: stats.batting,
        pitching: stats.pitching,
      });
    }

    const seasonTotals = {
      batting: {
        ...seasonBatRaw,
        AVG: seasonBatRaw.AB > 0 ? seasonBatRaw.H / seasonBatRaw.AB : 0,
      },
      pitching: {
        ...seasonPitRaw,
        ERA: seasonPitRaw.IP > 0 ? (seasonPitRaw.ER / seasonPitRaw.IP) * 9 : 0,
        WHIP: seasonPitRaw.IP > 0 ? (seasonPitRaw.BB + seasonPitRaw.H) / seasonPitRaw.IP : 0,
      },
    };

    log.info({ op: "season-log", weeks: weeks.length, durationMs: Date.now() - t0 }, "ok");
    return Response.json({
      myTeamId: MY_TEAM_ID,
      myTeamName: teamNames[MY_TEAM_ID] ?? `Team ${MY_TEAM_ID}`,
      currentWeek,
      weeks,
      seasonTotals,
    } as SeasonLogData);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ op: "season-log", err: msg }, "failed");
    return Response.json({ error: msg }, { status: 502 });
  }
}
