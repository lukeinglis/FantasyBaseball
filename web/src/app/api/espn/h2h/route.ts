export const dynamic = "force-dynamic";
import { espnFetch, hasEspnCreds, STAT_ID_MAP } from "@/lib/espn";

export interface H2HMatchup {
  week: number;
  oppTeamId: number;
  oppTeamName: string;
  myWins: number;
  myLosses: number;
  myTies: number;
  categories: Record<string, { myValue: number; oppValue: number; result: "WIN" | "LOSS" | "TIE" }>;
}

export interface AllPlayWeek {
  week: number;
  wins: number;
  losses: number;
  ties: number;
}

export interface H2HData {
  myTeamId: number;
  myTeamName: string;
  scoringPeriodId: number;
  matchups: H2HMatchup[];
  opponents: Record<number, {
    teamName: string;
    totalWins: number;
    totalLosses: number;
    totalTies: number;
    catWins: Record<string, number>;
    catLosses: Record<string, number>;
    matchupsPlayed: number;
  }>;
  allPlay: {
    totalWins: number;
    totalLosses: number;
    totalTies: number;
    weeks: AllPlayWeek[];
  };
}

const LOWER_IS_BETTER = new Set(["ERA", "WHIP", "L"]);

const MY_TEAM_ID = parseInt(process.env.MY_ESPN_TEAM_ID ?? "0");
const CATS_ORDER = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG", "K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"];

export async function GET() {
  if (!hasEspnCreds()) {
    return Response.json({ error: "ESPN_CREDS_MISSING" }, { status: 401 });
  }
  if (!MY_TEAM_ID) {
    return Response.json({ error: "MY_ESPN_TEAM_ID_MISSING" }, { status: 401 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await espnFetch(["mMatchup", "mMatchupScore", "mTeam", "mStatus"]);

    // Determine current matchup period (week number)
    // scoringPeriodId is DAILY, matchupPeriodId is WEEKLY in ESPN baseball
    const currentMatchupPeriod = (data as any).status?.currentMatchupPeriod ?? 1;

    // Build team name lookup
    const teamNames: Record<number, string> = {};
    for (const t of data.teams ?? []) {
      teamNames[t.id] = `${t.location ?? ""} ${t.nickname ?? ""}`.trim() || t.abbrev;
    }

    const matchups: H2HMatchup[] = [];
    const opponents: H2HData["opponents"] = {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schedule: any[] = data.schedule ?? [];

    for (const m of schedule) {
      // Only look at my matchups that have scores
      const iAmHome = m.home?.teamId === MY_TEAM_ID;
      const iAmAway = m.away?.teamId === MY_TEAM_ID;
      if (!iAmHome && !iAmAway) continue;

      const mySide = iAmHome ? m.home : m.away;
      const oppSide = iAmHome ? m.away : m.home;
      const oppTeamId: number = oppSide?.teamId;
      if (!oppTeamId) continue;

      const myCumulative = mySide?.cumulativeScore ?? {};
      const oppCumulative = oppSide?.cumulativeScore ?? {};

      // Skip future matchups (beyond current matchup period) with no scores
      if (!myCumulative.scoreByStat && m.matchupPeriodId > currentMatchupPeriod) continue;

      const categories: H2HMatchup["categories"] = {};
      let myWins = 0, myLosses = 0, myTies = 0;

      // Build value lookups with ESPN's result field
      const myStatData: Record<string, { score: number; result: string | null }> = {};
      const oppStatData: Record<string, { score: number }> = {};
      for (const [statId, statData] of Object.entries(myCumulative.scoreByStat ?? {})) {
        const cat = STAT_ID_MAP[parseInt(statId)];
        if (cat) myStatData[cat] = { score: (statData as any).score ?? 0, result: (statData as any).result ?? null };
      }
      for (const [statId, statData] of Object.entries(oppCumulative.scoreByStat ?? {})) {
        const cat = STAT_ID_MAP[parseInt(statId)];
        if (cat) oppStatData[cat] = { score: (statData as any).score ?? 0 };
      }

      for (const cat of CATS_ORDER) {
        const mine = myStatData[cat];
        const opp = oppStatData[cat];
        let result: "WIN" | "LOSS" | "TIE" = "TIE";

        if (mine?.result === "WIN") result = "WIN";
        else if (mine?.result === "LOSS") result = "LOSS";

        categories[cat] = { myValue: mine?.score ?? 0, oppValue: opp?.score ?? 0, result };
        if (result === "WIN") myWins++;
        else if (result === "LOSS") myLosses++;
        else myTies++;
      }

      matchups.push({
        week: m.matchupPeriodId,
        oppTeamId,
        oppTeamName: teamNames[oppTeamId] ?? `Team ${oppTeamId}`,
        myWins,
        myLosses,
        myTies,
        categories,
      });

      // Aggregate by opponent
      if (!opponents[oppTeamId]) {
        opponents[oppTeamId] = {
          teamName: teamNames[oppTeamId] ?? `Team ${oppTeamId}`,
          totalWins: 0,
          totalLosses: 0,
          totalTies: 0,
          catWins: {},
          catLosses: {},
          matchupsPlayed: 0,
        };
      }
      const opp = opponents[oppTeamId];
      opp.matchupsPlayed++;
      opp.totalWins += myWins;
      opp.totalLosses += myLosses;
      opp.totalTies += myTies;
      for (const cat of CATS_ORDER) {
        if (categories[cat]?.result === "WIN") {
          opp.catWins[cat] = (opp.catWins[cat] ?? 0) + 1;
        } else if (categories[cat]?.result === "LOSS") {
          opp.catLosses[cat] = (opp.catLosses[cat] ?? 0) + 1;
        }
      }
    }

    // Sort matchups by week
    matchups.sort((a, b) => a.week - b.week);

    // All-Play: simulate matchups vs every team for every completed week
    const allPlayWeeks: AllPlayWeek[] = [];
    let allPlayTotalW = 0, allPlayTotalL = 0, allPlayTotalT = 0;

    const cleanScore = (v: unknown): number => {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      return 0;
    };

    for (let week = 1; week <= currentMatchupPeriod; week++) {
      // Build each team's stats for this week
      const weekTeamStats: Record<number, Record<string, number>> = {};
      for (const m of schedule) {
        if (m.matchupPeriodId !== week) continue;
        for (const side of [m.home, m.away]) {
          if (!side?.teamId) continue;
          weekTeamStats[side.teamId] = {};
          const scoreByStat = side.cumulativeScore?.scoreByStat ?? {};
          for (const [statId, statData] of Object.entries(scoreByStat)) {
            const cat = STAT_ID_MAP[parseInt(statId)];
            if (!cat) continue;
            weekTeamStats[side.teamId][cat] = cleanScore((statData as any).score);
          }
        }
      }

      const myStats = weekTeamStats[MY_TEAM_ID];
      if (!myStats) continue;

      let weekW = 0, weekL = 0, weekT = 0;
      for (const [teamIdStr, oppStats] of Object.entries(weekTeamStats)) {
        const teamId = parseInt(teamIdStr);
        if (teamId === MY_TEAM_ID) continue;

        let w = 0, l = 0, t = 0;
        for (const cat of CATS_ORDER) {
          const myVal = myStats[cat] ?? 0;
          const oppVal = oppStats[cat] ?? 0;
          const lower = LOWER_IS_BETTER.has(cat);
          if (myVal === oppVal) t++;
          else if (lower ? myVal < oppVal : myVal > oppVal) w++;
          else l++;
        }
        if (w > l) weekW++;
        else if (l > w) weekL++;
        else weekT++;
      }

      allPlayWeeks.push({ week, wins: weekW, losses: weekL, ties: weekT });
      allPlayTotalW += weekW;
      allPlayTotalL += weekL;
      allPlayTotalT += weekT;
    }

    const result: H2HData = {
      myTeamId: MY_TEAM_ID,
      myTeamName: teamNames[MY_TEAM_ID] ?? `Team ${MY_TEAM_ID}`,
      scoringPeriodId: currentMatchupPeriod,
      matchups,
      opponents,
      allPlay: {
        totalWins: allPlayTotalW,
        totalLosses: allPlayTotalL,
        totalTies: allPlayTotalT,
        weeks: allPlayWeeks,
      },
    };

    return Response.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 502 });
  }
}
