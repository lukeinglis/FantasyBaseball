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
  scoringPeriodId: number;
  matchupStartDate: string | null;  // ISO date e.g. "2026-03-27"
  matchupEndDate: string | null;    // ISO date e.g. "2026-04-06"
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
    const injuryInfo = INJURY_MAP[injuryStatus] ?? { label: injuryStatus, color: "text-slate-400" };
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

function toIsoDate(ms: number | null | undefined): string | null {
  if (!ms) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseMatchup(data: any, myTeamId: number): MatchupData | null {
  const scoringPeriodId: number = data.scoringPeriodId ?? 1;

  // In ESPN Fantasy Baseball, scoringPeriodId is a DAILY counter (day of season),
  // while matchupPeriodId is a WEEKLY counter (week of season).
  // We need to find which matchupPeriodId contains the current scoringPeriodId.

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

  // Find my current matchup: look for the matchup whose matchupPeriodId
  // corresponds to the current scoring period. The ESPN schedule stores
  // matchups with matchupPeriodId (week number). We find the active matchup
  // by checking which week we're in based on the schedule's scoring period mapping.
  const schedule: any[] = data.schedule ?? [];

  // Strategy: find all my matchups sorted by matchupPeriodId, then pick the one
  // whose matchupPeriodId is current. ESPN provides a status.currentMatchupPeriod
  // or we can derive it from the schedule scoring periods.
  const myMatchups = schedule
    .filter((m: any) => m.home?.teamId === myTeamId || m.away?.teamId === myTeamId)
    .sort((a: any, b: any) => (a.matchupPeriodId ?? 0) - (b.matchupPeriodId ?? 0));

  // Try to find current matchup period from league status
  let currentMatchupPeriod: number | null = data.status?.currentMatchupPeriod ?? null;

  // Fallback: use the schedule's matchup period mapping
  // Each matchup in the schedule has a matchupPeriodId. ESPN also stores
  // which scoring periods map to which matchup period in settings.
  if (!currentMatchupPeriod) {
    const matchupPeriods: any[] = data.settings?.scheduleSettings?.matchupPeriods ?? {};
    // matchupPeriods is { "1": [1,2,3,4,5,6,7], "2": [8,9,...], ... }
    for (const [mpId, scoringPeriods] of Object.entries(matchupPeriods)) {
      if (Array.isArray(scoringPeriods) && scoringPeriods.includes(scoringPeriodId)) {
        currentMatchupPeriod = parseInt(mpId);
        break;
      }
    }
  }

  // Final fallback: find the highest matchupPeriodId that has scoring data
  if (!currentMatchupPeriod) {
    for (const m of myMatchups) {
      const side = m.home?.teamId === myTeamId ? m.home : m.away;
      const hasScores = side?.cumulativeScore?.scoreByStat &&
        Object.keys(side.cumulativeScore.scoreByStat).length > 0;
      if (hasScores) currentMatchupPeriod = m.matchupPeriodId;
    }
    // If still nothing (no scores yet), use the first matchup
    if (!currentMatchupPeriod && myMatchups.length > 0) {
      currentMatchupPeriod = myMatchups[0].matchupPeriodId;
    }
  }

  const myMatchup = myMatchups.find((m: any) => m.matchupPeriodId === currentMatchupPeriod);
  if (!myMatchup) return null;

  // Pull matchup period dates from settings
  let matchupStartDate: string | null = null;
  let matchupEndDate: string | null = null;
  const matchupPeriods: any = data.settings?.scheduleSettings?.matchupPeriods ?? {};
  const periodDays: number[] = matchupPeriods[String(currentMatchupPeriod)] ?? [];
  if (periodDays.length > 0) {
    // Try to get dates from settings scoringPeriods
    const settingsPeriods: any[] = data.settings?.scoringPeriods ?? [];
    const firstDay = settingsPeriods.find((p: any) => p.id === periodDays[0]);
    const lastDay = settingsPeriods.find((p: any) => p.id === periodDays[periodDays.length - 1]);
    if (firstDay) matchupStartDate = toIsoDate(firstDay.startDate);
    if (lastDay) matchupEndDate = toIsoDate(lastDay.endDate ?? lastDay.startDate);
  }

  const iAmHome = myMatchup.home?.teamId === myTeamId;
  const mySide = iAmHome ? myMatchup.home : myMatchup.away;
  const oppSide = iAmHome ? myMatchup.away : myMatchup.home;
  const oppTeamId: number = oppSide?.teamId;

  const myCumulative = mySide?.cumulativeScore ?? {};
  const oppCumulative = oppSide?.cumulativeScore ?? {};

  // Parse per-category scores
  const myStatScores: Record<string, { score: number; result: string }> = {};
  const oppStatScores: Record<string, { score: number; result: string }> = {};

  for (const [statId, statData] of Object.entries(myCumulative.scoreByStat ?? {})) {
    const cat = STAT_ID_MAP[parseInt(statId)];
    if (cat) myStatScores[cat] = { score: (statData as any).score ?? 0, result: (statData as any).result ?? "PENDING" };
  }
  for (const [statId, statData] of Object.entries(oppCumulative.scoreByStat ?? {})) {
    const cat = STAT_ID_MAP[parseInt(statId)];
    if (cat) oppStatScores[cat] = { score: (statData as any).score ?? 0, result: (statData as any).result ?? "PENDING" };
  }

  const categories: MatchupCatResult[] = CATS_ORDER.map((cat) => {
    const mine = myStatScores[cat];
    const opp = oppStatScores[cat];
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
    scoringPeriodId: currentMatchupPeriod ?? scoringPeriodId,
    matchupStartDate,
    matchupEndDate,
    myTeamId,
    myTeamName: teamNames[myTeamId] ?? `Team ${myTeamId}`,
    oppTeamId,
    oppTeamName: teamNames[oppTeamId] ?? `Team ${oppTeamId}`,
    myWins: myCumulative.wins ?? 0,
    myLosses: myCumulative.losses ?? 0,
    myTies: myCumulative.ties ?? 0,
    oppWins: oppCumulative.wins ?? 0,
    oppLosses: oppCumulative.losses ?? 0,
    oppTies: oppCumulative.ties ?? 0,
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
