export const dynamic = "force-dynamic";
import { espnFetch, hasEspnCreds, POS_MAP, SLOT_MAP, INJURY_MAP, STAT_ID_MAP, getProTeam, getMatchupDates, getCurrentMatchupPeriod } from "@/lib/espn";
import logger from "@/lib/logger";

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
  stats: Record<string, number>;  // season stats: AVG, HR, RBI, etc.
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

// Player stat IDs (raw player context — different from scoring stat IDs)
const PLAYER_STAT_MAP: Record<string, string> = {
  "1": "H", "2": "AVG", "5": "HR", "8": "TB", "20": "R",
  "21": "RBI", "10": "BB", "23": "SB", "0": "AB",
  "48": "K", "63": "QS", "53": "W", "54": "L",
  "50": "SV", "57": "HD", "47": "ERA", "41": "WHIP",
  "34": "IP",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsePlayers(entries: any[], scoringPeriodId: number): MatchupPlayer[] {
  return (entries ?? []).map((e: any) => {
    const player = e.playerPoolEntry?.player ?? {};
    const injuryStatus = player.injuryStatus ?? "ACTIVE";
    const injuryInfo = INJURY_MAP[injuryStatus] ?? { label: injuryStatus, color: "text-slate-500" };

    const isPitcher = player.defaultPositionId === 1 || player.defaultPositionId === 11;

    // Extract stats from player.stats[]
    // statSplitTypeId: 0=season, 1=last7, 2=last15, 3=last30, 5=current matchup period
    const statBlocks: any[] = player.stats ?? [];
    const stats: Record<string, number> = {};

    // Use season stats (id "002026") — most reliable and matches ESPN's display
    // Note: statSplitTypeId 5 is the current day only, not the full matchup period
    const seasonBlock = statBlocks.find((s: any) => s.id === "002026");
    const sourceBlock = seasonBlock;

    if (sourceBlock?.stats) {
      for (const [sid, val] of Object.entries(sourceBlock.stats)) {
        const cat = PLAYER_STAT_MAP[sid];
        if (!cat) continue;
        // Only include relevant stats for this player type
        const isBattingStat = ["H", "AVG", "HR", "TB", "R", "RBI", "BB", "SB", "AB"].includes(cat);
        const isPitchingStat = ["K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP", "IP"].includes(cat);
        if (isPitcher && isPitchingStat) stats[cat] = val as number;
        if (!isPitcher && isBattingStat) stats[cat] = val as number;
      }
    }

    return {
      name: player.fullName ?? "Unknown",
      pos: POS_MAP[player.defaultPositionId] ?? "?",
      slotLabel: SLOT_MAP[e.lineupSlotId] ?? "BN",
      slotId: e.lineupSlotId ?? 16,
      injuryStatus,
      injuryLabel: injuryInfo.label,
      injuryColor: injuryInfo.color,
      proTeam: getProTeam(player),
      stats,
    };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseMatchup(data: any, myTeamId: number): MatchupData | null {
  const currentMatchupPeriod = getCurrentMatchupPeriod(data);

  // Build team name lookup
  const teamNames: Record<number, string> = {};
  for (const t of data.teams ?? []) {
    teamNames[t.id] = `${t.location ?? ""} ${t.nickname ?? ""}`.trim() || t.abbrev;
  }

  // Build roster lookup by teamId
  const rosters: Record<number, MatchupPlayer[]> = {};
  for (const t of data.teams ?? []) {
    rosters[t.id] = parsePlayers(t.roster?.entries ?? [], data.scoringPeriodId ?? 1);
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

  // Helper: sanitize ESPN values that may be Infinity/NaN/strings (e.g. ERA at 0 IP)
  const cleanNumber = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    return null;
  };
  for (const [statId, statData] of Object.entries(myCumulative.scoreByStat ?? {})) {
    const cat = STAT_ID_MAP[parseInt(statId)];
    if (cat) {
      myStats[cat] = {
        score: cleanNumber((statData as any).score) ?? 0,
        result: (statData as any).result ?? null,
      };
    }
  }
  for (const [statId, statData] of Object.entries(oppCumulative.scoreByStat ?? {})) {
    const cat = STAT_ID_MAP[parseInt(statId)];
    if (cat) {
      oppStats[cat] = { score: cleanNumber((statData as any).score) ?? 0 };
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
    matchupStartDate: dates?.start ?? null,
    matchupEndDate: dates?.end ?? null,
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
    const data = await espnFetch(["mMatchup", "mMatchupScore", "mRoster", "mTeam", "mSettings", "mStatus"]);
    const matchup = parseMatchup(data, MY_TEAM_ID);
    if (!matchup) {
      return Response.json({ error: "NO_MATCHUP_FOUND" }, { status: 404 });
    }
    log.info({ op: "matchup", durationMs: Date.now() - t0 }, "ok");
    return Response.json(matchup);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ op: "matchup", err: msg }, "failed");
    return Response.json({ error: msg }, { status: 502 });
  }
}
