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

export interface H2HData {
  myTeamId: number;
  myTeamName: string;
  scoringPeriodId: number;
  matchups: H2HMatchup[];
  // Aggregated record vs each opponent
  opponents: Record<number, {
    teamName: string;
    totalWins: number;
    totalLosses: number;
    totalTies: number;
    catWins: Record<string, number>;
    catLosses: Record<string, number>;
    matchupsPlayed: number;
  }>;
}

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
    const currentMatchupPeriod: number = data.status?.currentMatchupPeriod ?? 1;

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

      for (const cat of CATS_ORDER) {
        const myStatEntries = myCumulative.scoreByStat ?? {};
        const oppStatEntries = oppCumulative.scoreByStat ?? {};

        // Find the stat ID for this category
        let myVal = 0, oppVal = 0, result: "WIN" | "LOSS" | "TIE" = "TIE";
        for (const [statId, statData] of Object.entries(myStatEntries)) {
          if (STAT_ID_MAP[parseInt(statId)] === cat) {
            myVal = (statData as any).score ?? 0;
            const r = (statData as any).result;
            if (r === "WIN") result = "WIN";
            else if (r === "LOSS") result = "LOSS";
            else result = "TIE";
            break;
          }
        }
        for (const [statId, statData] of Object.entries(oppStatEntries)) {
          if (STAT_ID_MAP[parseInt(statId)] === cat) {
            oppVal = (statData as any).score ?? 0;
            break;
          }
        }

        categories[cat] = { myValue: myVal, oppValue: oppVal, result };
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

    const result: H2HData = {
      myTeamId: MY_TEAM_ID,
      myTeamName: teamNames[MY_TEAM_ID] ?? `Team ${MY_TEAM_ID}`,
      scoringPeriodId: currentMatchupPeriod,
      matchups,
      opponents,
    };

    return Response.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 502 });
  }
}
