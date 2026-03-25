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
    next: { revalidate: 60 },
  });

  if (!res.ok) throw new Error(`ESPN API ${res.status}`);
  return res.json();
}

// Lineup slot ID → label
export const SLOT_MAP: Record<number, string> = {
  0: "C", 1: "1B", 2: "2B", 3: "3B", 4: "SS",
  5: "OF", 6: "OF", 7: "OF", 8: "UTIL",
  14: "SP", 15: "RP", 17: "P",
  16: "BN", 12: "IL",
};

// ESPN default position ID → position label
export const POS_MAP: Record<number, string> = {
  1: "SP", 2: "C", 3: "1B", 4: "2B", 5: "3B",
  6: "SS", 7: "OF", 8: "OF", 9: "OF", 10: "DH", 11: "RP",
};

// ESPN stat ID → our category name
export const STAT_ID_MAP: Record<number, string> = {
  1: "H", 4: "R", 5: "HR", 19: "TB",
  6: "RBI", 7: "BB", 23: "SB", 2: "AVG",
  48: "K", 53: "QS", 46: "W", 47: "L",
  57: "SV", 62: "HD", 51: "ERA", 52: "WHIP",
};

// Injury status labels
export const INJURY_MAP: Record<string, { label: string; color: string }> = {
  ACTIVE:      { label: "Active",       color: "text-emerald-400" },
  DAY_TO_DAY:  { label: "Day-to-Day",   color: "text-amber-400" },
  SEVEN_DAY_DL:  { label: "7-Day IL",   color: "text-orange-400" },
  FIFTEEN_DAY_DL:{ label: "15-Day IL",  color: "text-red-400" },
  SIXTY_DAY_DL:  { label: "60-Day IL",  color: "text-red-500" },
  OUT:         { label: "Out",          color: "text-red-400" },
  SUSPENSION:  { label: "Suspended",    color: "text-purple-400" },
};
