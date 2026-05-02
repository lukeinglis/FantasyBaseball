// ESPN private league API client
// Requires ESPN_S2 and ESPN_SWID environment variables (Vercel env vars)
import logger from "@/lib/logger";
import type { EspnLeagueData } from "@/types/espn";

const LEAGUE_ID = 4739;
const SEASON = 2026;
const BASE = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/flb/seasons/${SEASON}/segments/0/leagues/${LEAGUE_ID}`;

export function hasEspnCreds(): boolean {
  return !!(process.env.ESPN_S2 && process.env.ESPN_SWID);
}

export async function espnFetch(views: string[], extra: string = ""): Promise<unknown> {
  const espnS2 = process.env.ESPN_S2;
  const swid = process.env.ESPN_SWID;
  if (!espnS2 || !swid) throw new Error("ESPN_CREDS_MISSING");

  const viewParams = views.map((v) => `view=${v}`).join("&");
  const url = `${BASE}?${viewParams}${extra}`;

  const t0 = Date.now();
  const res = await fetch(url, {
    headers: {
      Cookie: `espn_s2=${espnS2}; SWID=${swid}`,
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
    },
    cache: "no-store",
  });
  const durationMs = Date.now() - t0;

  if (!res.ok) {
    logger.error({ op: "espn_fetch", views, status: res.status, durationMs }, "ESPN API error");
    throw new Error(`ESPN API ${res.status}`);
  }
  logger.info({ op: "espn_fetch", views, durationMs }, "ESPN fetch ok");
  return res.json();
}

// Lineup slot ID → label
// Verified from league settings lineupSlotCounts (debug endpoint 2026-03-31)
export const SLOT_MAP: Record<number, string> = {
  0: "C", 1: "1B", 2: "2B", 3: "3B", 4: "SS",
  5: "OF", 6: "OF", 7: "OF",
  8: "UTIL", 12: "UTIL",      // slot 12 = UTIL in this league
  13: "P", 14: "SP", 15: "RP",
  16: "BN", 17: "IL",          // slot 17 = IL (not 12)
};

// ESPN default position ID → position label
export const POS_MAP: Record<number, string> = {
  1: "SP", 2: "C", 3: "1B", 4: "2B", 5: "3B",
  6: "SS", 7: "OF", 8: "OF", 9: "OF", 10: "DH", 11: "RP",
};

// ESPN scoring stat ID → our category name
// Verified from raw ESPN matchup API scoreByStat (debug endpoint 2026-03-30)
export const STAT_ID_MAP: Record<number, string> = {
  // Batting
  1: "H", 20: "R", 5: "HR", 8: "TB",
  21: "RBI", 10: "BB", 23: "SB", 2: "AVG",
  // Pitching
  48: "K", 63: "QS", 53: "W", 54: "L",
  57: "SV", 60: "HD", 47: "ERA", 41: "WHIP",
};

// ESPN proTeamId → team abbreviation
export const PRO_TEAM_MAP: Record<number, string> = {
  0: "FA", 1: "ATL", 2: "BAL", 3: "BOS", 4: "CHC", 5: "CWS",
  6: "CIN", 7: "CLE", 8: "COL", 9: "DET", 10: "HOU",
  11: "KC", 12: "LAA", 13: "LAD", 14: "MIA", 15: "MIL",
  16: "MIN", 17: "NYM", 18: "NYY", 19: "OAK", 20: "PHI",
  21: "PIT", 22: "SD", 23: "SEA", 24: "SF", 25: "STL",
  26: "TB", 27: "TEX", 28: "TOR", 29: "WSH", 30: "ARI",
};

export function getProTeam(player: { proTeamId?: number; proTeamAbbrev?: string }): string {
  if (player.proTeamId != null && PRO_TEAM_MAP[player.proTeamId]) {
    return PRO_TEAM_MAP[player.proTeamId];
  }
  return player.proTeamAbbrev ?? "";
}

// IL-eligible injury statuses (player is on injured list)
export const IL_STATUSES = new Set([
  "SEVEN_DAY_DL", "TEN_DAY_DL", "FIFTEEN_DAY_DL", "SIXTY_DAY_DL", "OUT",
]);

export function isOnIL(injuryStatus: string): boolean {
  return IL_STATUSES.has(injuryStatus);
}

// --- Schedule / Date utilities ---

// MLB 2026 season start (scoring period 1 = this date)
export const SEASON_START = new Date("2026-03-25T00:00:00");

/** Convert a scoring period day number to an ISO date string */
export function dayToDate(dayNum: number): string {
  const d = new Date(SEASON_START);
  d.setDate(d.getDate() + dayNum - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Build matchup period date ranges.
 * ESPN H2H baseball: first matchup runs from season start through first Sunday,
 * then weekly Monday-Sunday after that.
 */
export function buildMatchupSchedule(matchupCount: number): { start: string; end: string }[] {
  const schedule: { start: string; end: string }[] = [];

  // First matchup: season start → second Sunday (ESPN pattern for mid-week starts)
  // Mar 25 (Wed) → skip Mar 29 (1st Sun) → Apr 5 (2nd Sun) = 12 days
  const firstStart = new Date(SEASON_START);
  const firstEnd = new Date(SEASON_START);
  const dow = firstStart.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysToFirstSunday = dow === 0 ? 7 : (7 - dow);
  firstEnd.setDate(firstEnd.getDate() + daysToFirstSunday + 7);

  schedule.push({
    start: firstStart.toISOString().slice(0, 10),
    end: firstEnd.toISOString().slice(0, 10),
  });

  // Subsequent matchups: Monday-Sunday (7 days each)
  let nextStart = new Date(firstEnd);
  nextStart.setDate(nextStart.getDate() + 1);

  for (let i = 1; i < matchupCount; i++) {
    const weekEnd = new Date(nextStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    schedule.push({
      start: nextStart.toISOString().slice(0, 10),
      end: weekEnd.toISOString().slice(0, 10),
    });
    nextStart = new Date(weekEnd);
    nextStart.setDate(nextStart.getDate() + 1);
  }

  return schedule;
}

/** Get start/end dates for a specific matchup period */
export function getMatchupDates(data: EspnLeagueData, matchupPeriod: number): { start: string; end: string } | null {
  const count: number = data.settings?.scheduleSettings?.matchupPeriodCount ?? 21;
  const schedule = buildMatchupSchedule(count);
  const idx = matchupPeriod - 1;
  return idx >= 0 && idx < schedule.length ? schedule[idx] : null;
}

/** Get the current matchup period number from ESPN data */
export function getCurrentMatchupPeriod(data: EspnLeagueData): number {
  return data.status?.currentMatchupPeriod ?? 1;
}

// Injury status labels
export const INJURY_MAP: Record<string, { label: string; color: string }> = {
  ACTIVE:          { label: "Active",       color: "text-emerald-600" },
  DAY_TO_DAY:      { label: "Day-to-Day",   color: "text-orange-600" },
  SEVEN_DAY_DL:    { label: "7-Day IL",     color: "text-orange-600" },
  TEN_DAY_DL:      { label: "10-Day IL",    color: "text-orange-600" },
  FIFTEEN_DAY_DL:  { label: "15-Day IL",    color: "text-red-600" },
  SIXTY_DAY_DL:    { label: "60-Day IL",    color: "text-red-700" },
  OUT:             { label: "Out",          color: "text-red-600" },
  SUSPENSION:      { label: "Suspended",    color: "text-purple-600" },
  PATERNITY:       { label: "Paternity",    color: "text-blue-600" },
  BEREAVEMENT:     { label: "Bereavement",  color: "text-blue-600" },
};
