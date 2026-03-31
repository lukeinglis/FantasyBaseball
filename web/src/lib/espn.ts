// ESPN private league API client
// Requires ESPN_S2 and ESPN_SWID environment variables (Vercel env vars)

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

  const res = await fetch(url, {
    headers: {
      Cookie: `espn_s2=${espnS2}; SWID=${swid}`,
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
    },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`ESPN API ${res.status}`);
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

export function getProTeam(player: any): string {
  if (player.proTeamId && PRO_TEAM_MAP[player.proTeamId]) {
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

/** Get start/end dates for a matchup period from ESPN settings data.
 * ESPN's matchupPeriods maps period → [firstScoringPeriodDay].
 * End date = day before the next period starts (or finalScoringPeriod for last). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMatchupDates(data: any, matchupPeriod: number): { start: string; end: string } | null {
  const matchupPeriods: Record<string, number[]> = data.settings?.scheduleSettings?.matchupPeriods ?? {};
  const days: number[] = matchupPeriods[String(matchupPeriod)] ?? [];
  if (days.length === 0) return null;

  const startDay = Math.min(...days);

  // If the array has multiple days, use min/max
  if (days.length > 1) {
    return { start: dayToDate(startDay), end: dayToDate(Math.max(...days)) };
  }

  // Single-entry array: find end date from next period's start or final scoring period
  const nextDays: number[] = matchupPeriods[String(matchupPeriod + 1)] ?? [];
  let endDay: number;

  if (nextDays.length > 0) {
    endDay = Math.min(...nextDays) - 1; // day before next period starts
  } else {
    // Last matchup period — use finalScoringPeriod from status
    endDay = data.status?.finalScoringPeriod ?? (startDay + 6);
  }

  return { start: dayToDate(startDay), end: dayToDate(endDay) };
}

/** Get the current matchup period number from ESPN data */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCurrentMatchupPeriod(data: any): number {
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
