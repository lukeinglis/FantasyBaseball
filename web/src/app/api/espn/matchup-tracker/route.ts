export const dynamic = "force-dynamic";
import { espnFetch, hasEspnCreds, STAT_ID_MAP, getMatchupDates, getCurrentMatchupPeriod, SEASON_START, dayToDate } from "@/lib/espn";
import type { EspnLeagueData, EspnScoreByStat, EspnScheduleRecord } from "@/types/espn";
import logger from "@/lib/logger";
import { ALL_CATS_BY_WEIGHT } from "@/lib/category-weights";

export interface DailyPoints {
  date: string;
  dayLabel: string;
  myPts: number;
  oppPts: number;
}

export interface TeamRawStats {
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

export interface TeamPitchingRaw {
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

export interface CatResult {
  cat: string;
  myValue: number;
  oppValue: number;
  result: "WIN" | "LOSS" | "TIE" | "PENDING";
}

export interface MatchupTrackerData {
  week: number;
  startDate: string;
  endDate: string;
  daysElapsed: number;
  totalDays: number;
  myTeam: { id: number; name: string };
  oppTeam: { id: number; name: string };
  batting: { my: TeamRawStats; opp: TeamRawStats };
  pitching: { my: TeamPitchingRaw; opp: TeamPitchingRaw };
  dailyPoints: DailyPoints[];
  catResults: CatResult[];
}

const MY_TEAM_ID = parseInt(process.env.MY_ESPN_TEAM_ID ?? "0");

const CATS_ORDER = ALL_CATS_BY_WEIGHT;

const cleanVal = (v: unknown): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return 0;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractRawStats(side: any): { batting: TeamRawStats; pitching: TeamPitchingRaw } {
  const scoreByStat = side?.cumulativeScore?.scoreByStat ?? {};
  const valuesByStat = side?.cumulativeScore?.valuesByStat ?? {};

  // Try scoreByStat first, fall back to valuesByStat
  const getStat = (id: number): number => {
    const fromScore = scoreByStat[String(id)];
    if (fromScore != null) {
      const val = typeof fromScore === "object" ? (fromScore as EspnScoreByStat).score : fromScore;
      return cleanVal(val);
    }
    return cleanVal(valuesByStat[String(id)]);
  };

  const batH = getStat(1);
  const batAB = getStat(0);
  const batting: TeamRawStats = {
    H: batH,
    AB: batAB,
    R: getStat(20),
    HR: getStat(5),
    TB: getStat(8),
    RBI: getStat(21),
    BB: getStat(10),
    SB: getStat(23),
    AVG: batAB > 0 ? batH / batAB : 0,
  };

  const pitIP = getStat(34);
  const pitH = getStat(35);
  const pitER = getStat(39);
  const pitBB = getStat(38);
  const pitching: TeamPitchingRaw = {
    IP: pitIP,
    H: pitH,
    ER: pitER,
    BB: pitBB,
    K: getStat(48),
    QS: getStat(63),
    W: getStat(53),
    L: getStat(54),
    SV: getStat(57),
    HD: getStat(60),
    ERA: pitIP > 0 ? (pitER / pitIP) * 9 : 0,
    WHIP: pitIP > 0 ? (pitBB + pitH) / pitIP : 0,
  };

  return { batting, pitching };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractDailyPoints(side: any, startDate: string, endDate: string): DailyPoints[] {
  // pointsByScoringPeriod maps scoringPeriodId (day number) to total fantasy points
  const pbs = side?.pointsByScoringPeriod ?? {};
  const days: DailyPoints[] = [];

  const start = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");
  const seasonStart = new Date(SEASON_START);

  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const diffDays = Math.round((d.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24));
    const scoringPeriod = diffDays + 1;
    const dateStr = d.toISOString().slice(0, 10);
    const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" });

    days.push({
      date: dateStr,
      dayLabel,
      myPts: cleanVal(pbs[String(scoringPeriod)]),
      oppPts: 0,
    });
  }

  return days;
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
    const currentMatchupPeriod = getCurrentMatchupPeriod(data);
    const dates = getMatchupDates(data, currentMatchupPeriod);

    if (!dates) {
      return Response.json({ error: "NO_MATCHUP_DATES" }, { status: 404 });
    }

    // Team name lookup
    const teamNames: Record<number, string> = {};
    for (const t of data.teams ?? []) {
      teamNames[t.id] = `${t.location ?? ""} ${t.nickname ?? ""}`.trim() || (t.abbrev ?? "");
    }

    // Find my matchup
    const schedule: EspnScheduleRecord[] = data.schedule ?? [];
    const myMatchup = schedule.find(
      (m) =>
        m.matchupPeriodId === currentMatchupPeriod &&
        (m.home?.teamId === MY_TEAM_ID || m.away?.teamId === MY_TEAM_ID)
    );

    if (!myMatchup) {
      return Response.json({ error: "NO_MATCHUP_FOUND" }, { status: 404 });
    }

    const iAmHome = myMatchup.home?.teamId === MY_TEAM_ID;
    const mySide = iAmHome ? myMatchup.home : myMatchup.away;
    const oppSide = iAmHome ? myMatchup.away : myMatchup.home;
    const oppTeamId = oppSide?.teamId ?? 0;

    // Extract raw stats
    const myStats = extractRawStats(mySide);
    const oppStats = extractRawStats(oppSide);

    // Extract daily points
    const myDailyRaw = extractDailyPoints(mySide, dates.start, dates.end);
    const oppDailyRaw = extractDailyPoints(oppSide, dates.start, dates.end);

    const dailyPoints: DailyPoints[] = myDailyRaw.map((d, i) => ({
      ...d,
      oppPts: oppDailyRaw[i]?.myPts ?? 0,
    }));

    // Category results
    const myCumulative = mySide?.cumulativeScore ?? {};
    const catResults: CatResult[] = CATS_ORDER.map((cat) => {
      const statId = Object.entries(STAT_ID_MAP).find(([, c]) => c === cat)?.[0];
      if (!statId) return { cat, myValue: 0, oppValue: 0, result: "PENDING" as const };

      const myData = ((myCumulative as { scoreByStat?: Record<string, EspnScoreByStat> }).scoreByStat ?? {})[statId];
      const oppCumulative = oppSide?.cumulativeScore ?? {};
      const oppData = ((oppCumulative as { scoreByStat?: Record<string, EspnScoreByStat> }).scoreByStat ?? {})[statId];

      const myValue = cleanVal(myData?.score);
      const oppValue = cleanVal(oppData?.score);
      let result: CatResult["result"] = "PENDING";
      if (myData?.result === "WIN") result = "WIN";
      else if (myData?.result === "LOSS") result = "LOSS";
      else if (myData?.result === "TIE") result = "TIE";

      return { cat, myValue, oppValue, result };
    });

    // Days elapsed
    const today = new Date();
    const startD = new Date(dates.start + "T12:00:00");
    const endD = new Date(dates.end + "T12:00:00");
    const totalDays = Math.round((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const daysElapsed = Math.max(0, Math.min(totalDays, Math.round((today.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1));

    const result: MatchupTrackerData = {
      week: currentMatchupPeriod,
      startDate: dates.start,
      endDate: dates.end,
      daysElapsed,
      totalDays,
      myTeam: { id: MY_TEAM_ID, name: teamNames[MY_TEAM_ID] ?? `Team ${MY_TEAM_ID}` },
      oppTeam: { id: oppTeamId, name: teamNames[oppTeamId] ?? `Team ${oppTeamId}` },
      batting: { my: myStats.batting, opp: oppStats.batting },
      pitching: { my: myStats.pitching, opp: oppStats.pitching },
      dailyPoints,
      catResults,
    };

    log.info({ op: "matchup-tracker", durationMs: Date.now() - t0 }, "ok");
    return Response.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ op: "matchup-tracker", err: msg }, "failed");
    return Response.json({ error: msg }, { status: 502 });
  }
}
