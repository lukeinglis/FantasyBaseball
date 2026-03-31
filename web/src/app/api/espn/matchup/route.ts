import { espnFetch, hasEspnCreds, POS_MAP, SLOT_MAP, INJURY_MAP, STAT_ID_MAP } from "@/lib/espn";

export interface MatchupCatResult {
  cat: string;
  myValue: number | null;
  oppValue: number | null;
  result: "WIN" | "LOSS" | "TIE" | "PENDING";
}

export interface MatchupPlayer {
  name: string;
  pos: string;
  slotLabel: string;
  slotId: number;
  injuryStatus: string;
  injuryLabel: string;
  injuryColor: string;
  proTeam: string;
}

export interface MatchupData {
  scoringPeriodId: number;       // matchup period (week number)
  matchupStartDate: string | null;
  matchupEndDate: string | null;
  myTeamId: number;
  myTeamName: string;
  oppTeamId: number;
  oppTeamName: string;
  myWins: number;
  myLosses: number;
  myTies: number;
  oppWins: number;
  oppLosses: number;
  oppTies: number;
  categories: MatchupCatResult[];
  myRoster: MatchupPlayer[];
  oppRoster: MatchupPlayer[];
}

const MY_TEAM_ID = parseInt(process.env.MY_ESPN_TEAM_ID ?? "0");
const CATS_ORDER = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG", "K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsePlayers(entries: any[]): MatchupPlayer[] {
  return (entries ?? []).map((e: any) => {
    const player = e.playerPoolEntry?.player ?? {};
    const injuryStatus = player.injuryStatus ?? "ACTIVE";
    const injuryInfo = INJURY_MAP[injuryStatus] ?? { label: injuryStatus, color: "text-slate-500" };
    return {
      name: player.fullName ?? "Unknown",
      pos: POS_MAP[player.defaultPositionId] ?? "?",
      slotLabel: SLOT_MAP[e.lineupSlotId] ?? "BN",
      slotId: e.lineupSlotId ?? 16,
      injuryStatus,
      injuryLabel: injuryInfo.label,
      injuryColor: injuryInfo.color,
      proTeam: player.proTeamAbbrev ?? "",
    };
  });
}

/**
 * Derive matchup start/end dates from the season start and matchup period day mapping.
 * ESPN's scheduleSettings.matchupPeriods maps matchup period → array of scoring period day numbers.
 * Each scoring period = 1 day. We calculate dates by adding (day - 1) to the season start date.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMatchupDates(data: any, matchupPeriod: number): { start: string | null; end: string | null } {
  const matchupPeriods: any = data.settings?.scheduleSettings?.matchupPeriods ?? {};
  const periodDays: number[] = matchupPeriods[String(matchupPeriod)] ?? [];
  if (periodDays.length === 0) return { start: null, end: null };

  // ESPN season start: derive from the league's first scoring period
  // The activatedDate is when the league was activated, but the actual season start
  // is better derived from the schedule. MLB 2026 season starts ~March 25.
  // We use a known reference: scoring period 1 = first day of the MLB season.
  // ESPN's seasonId=2026 with firstScoringPeriod=1 starts on Opening Day.
  // We can calculate from status.activatedDate or use a hardcoded season start.

  // Try to get season start from the first matchup's scheduled date
  // Fallback: use a known 2026 season start date
  const SEASON_START = new Date("2026-03-25T00:00:00");

  const firstDay = Math.min(...periodDays);
  const lastDay = Math.max(...periodDays);

  const startDate = new Date(SEASON_START);
  startDate.setDate(startDate.getDate() + firstDay - 1);

  const endDate = new Date(SEASON_START);
  endDate.setDate(endDate.getDate() + lastDay - 1);

  return {
    start: startDate.toISOString().slice(0, 10),
    end: endDate.toISOString().slice(0, 10),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseMatchup(data: any, myTeamId: number): MatchupData | null {
  // Get current matchup period (week number) from league status
  const currentMatchupPeriod: number = data.status?.currentMatchupPeriod ?? 1;

  // Build team name lookup
  const teamNames: Record<number, string> = {};
  for (const t of data.teams ?? []) {
    teamNames[t.id] = `${t.location ?? ""} ${t.nickname ?? ""}`.trim() || t.abbrev;
  }

  // Build roster lookup by teamId
  const rosters: Record<number, MatchupPlayer[]> = {};
  for (const t of data.teams ?? []) {
    rosters[t.id] = parsePlayers(t.roster?.entries ?? []);
  }

  // Find my matchup for the current period
  const schedule: any[] = data.schedule ?? [];
  const myMatchup = schedule.find(
    (m: any) =>
      m.matchupPeriodId === currentMatchupPeriod &&
      (m.home?.teamId === myTeamId || m.away?.teamId === myTeamId)
  );
  if (!myMatchup) return null;

  // Get matchup dates
  const dates = getMatchupDates(data, currentMatchupPeriod);

  const iAmHome = myMatchup.home?.teamId === myTeamId;
  const mySide = iAmHome ? myMatchup.home : myMatchup.away;
  const oppSide = iAmHome ? myMatchup.away : myMatchup.home;
  const oppTeamId: number = oppSide?.teamId;

  const myCumulative = mySide?.cumulativeScore ?? {};
  const oppCumulative = oppSide?.cumulativeScore ?? {};

  // Parse per-category scores using ESPN's provided result field
  const myStats: Record<string, { score: number; result: string | null }> = {};
  const oppStats: Record<string, { score: number }> = {};

  for (const [statId, statData] of Object.entries(myCumulative.scoreByStat ?? {})) {
    const cat = STAT_ID_MAP[parseInt(statId)];
    if (cat) {
      myStats[cat] = {
        score: (statData as any).score ?? 0,
        result: (statData as any).result ?? null,
      };
    }
  }
  for (const [statId, statData] of Object.entries(oppCumulative.scoreByStat ?? {})) {
    const cat = STAT_ID_MAP[parseInt(statId)];
    if (cat) {
      oppStats[cat] = { score: (statData as any).score ?? 0 };
    }
  }

  // Build categories using ESPN's result field directly
  const categories: MatchupCatResult[] = CATS_ORDER.map((cat) => {
    const mine = myStats[cat];
    const opp = oppStats[cat];
    let result: MatchupCatResult["result"] = "PENDING";

    if (mine?.result === "WIN") result = "WIN";
    else if (mine?.result === "LOSS") result = "LOSS";
    else if (mine?.result === "TIE") result = "TIE";

    return {
      cat,
      myValue: mine?.score ?? null,
      oppValue: opp?.score ?? null,
      result,
    };
  });

  return {
    scoringPeriodId: currentMatchupPeriod,
    matchupStartDate: dates.start,
    matchupEndDate: dates.end,
    myTeamId,
    myTeamName: teamNames[myTeamId] ?? `Team ${myTeamId}`,
    oppTeamId,
    oppTeamName: teamNames[oppTeamId] ?? `Team ${oppTeamId}`,
    myWins: categories.filter((c) => c.result === "WIN").length,
    myLosses: categories.filter((c) => c.result === "LOSS").length,
    myTies: categories.filter((c) => c.result === "TIE").length,
    oppWins: categories.filter((c) => c.result === "LOSS").length,
    oppLosses: categories.filter((c) => c.result === "WIN").length,
    oppTies: categories.filter((c) => c.result === "TIE").length,
    categories,
    myRoster: rosters[myTeamId] ?? [],
    oppRoster: rosters[oppTeamId] ?? [],
  };
}

export async function GET() {
  if (!hasEspnCreds()) {
    return Response.json({ error: "ESPN_CREDS_MISSING" }, { status: 401 });
  }
  if (!MY_TEAM_ID) {
    return Response.json({ error: "MY_ESPN_TEAM_ID_MISSING" }, { status: 401 });
  }
  try {
    const data = await espnFetch(["mMatchup", "mMatchupScore", "mRoster", "mTeam", "mSettings", "mStatus"]);
    const matchup = parseMatchup(data, MY_TEAM_ID);
    if (!matchup) {
      return Response.json({ error: "NO_MATCHUP_FOUND" }, { status: 404 });
    }
    return Response.json(matchup);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 502 });
  }
}
