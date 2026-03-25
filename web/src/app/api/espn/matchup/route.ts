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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseMatchup(data: any, myTeamId: number): MatchupData | null {
  const scoringPeriodId: number = data.scoringPeriodId ?? 1;

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

  // Find my current matchup in the schedule
  const schedule: any[] = data.schedule ?? [];
  const myMatchup = schedule.find(
    (m: any) =>
      m.matchupPeriodId === scoringPeriodId &&
      (m.home?.teamId === myTeamId || m.away?.teamId === myTeamId)
  );

  if (!myMatchup) return null;

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
    scoringPeriodId,
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
    const data = await espnFetch(["mMatchup", "mMatchupScore", "mRoster", "mTeam"]);
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
