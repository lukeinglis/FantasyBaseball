// MLB Stats API — probable pitcher schedule
// Returns scheduled starts per pitcher for a date range
// Public API, no auth required

export interface ProbableStart {
  date: string;          // "2026-03-30"
  pitcherName: string;   // "Chris Bassitt"
  pitcherId: number;     // MLB player ID
  team: string;          // "BAL"
  opponent: string;      // "@MIN" or "vs NYY"
  gameTime: string;      // "7:05 PM" (ET)
  isHome: boolean;
}

export interface ProbablePitchersData {
  startDate: string;
  endDate: string;
  // Keyed by pitcher full name for easy matching with ESPN roster
  byPitcher: Record<string, ProbableStart[]>;
  // All starts in chronological order
  allStarts: ProbableStart[];
}

// ESPN team abbreviation mapping (MLB uses slightly different abbrevs)
const MLB_TO_ESPN_TEAM: Record<string, string> = {
  AZ: "ARI", ARI: "ARI",
  WSH: "WSH", WAS: "WSH",
  CWS: "CWS", CHW: "CWS",
  CHC: "CHC",
  TB: "TB", TBR: "TB",
  KC: "KC", KCR: "KC",
  SD: "SD", SDP: "SD",
  SF: "SF", SFG: "SF",
  STL: "STL",
  LAA: "LAA",
  LAD: "LAD",
  NYY: "NYY",
  NYM: "NYM",
  ATH: "OAK", OAK: "OAK",
};

function normalizeTeam(abbrev: string): string {
  return MLB_TO_ESPN_TEAM[abbrev] ?? abbrev;
}

function toET(utcDate: string): string {
  try {
    return new Date(utcDate).toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const today = new Date().toISOString().slice(0, 10);
  const startDate = searchParams.get("startDate") ?? today;
  const defaultEnd = new Date(startDate);
  defaultEnd.setDate(defaultEnd.getDate() + 6);
  const endDate = searchParams.get("endDate") ?? defaultEnd.toISOString().slice(0, 10);

  try {
    const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${startDate}&endDate=${endDate}&gameType=R&hydrate=probablePitcher,team`;
    const res = await fetch(url, { next: { revalidate: 900 } }); // 15 min cache
    if (!res.ok) return Response.json({ error: "MLB_API_FAILED" }, { status: 502 });

    const data = await res.json();
    const byPitcher: Record<string, ProbableStart[]> = {};
    const allStarts: ProbableStart[] = [];

    for (const dateObj of data.dates ?? []) {
      const date: string = dateObj.date;
      for (const game of dateObj.games ?? []) {
        const gameTime = toET(game.gameDate ?? "");

        for (const [sideKey, isHome] of [["away", false], ["home", true]] as const) {
          const side = game.teams?.[sideKey];
          const pitcher = side?.probablePitcher;
          if (!pitcher?.fullName) continue;

          const team = normalizeTeam(side?.team?.abbreviation ?? "");
          const oppSideKey = isHome ? "away" : "home";
          const oppAbbrev = normalizeTeam(game.teams?.[oppSideKey]?.team?.abbreviation ?? "");
          const opponent = (isHome ? "vs " : "@") + oppAbbrev;

          const start: ProbableStart = {
            date,
            pitcherName: pitcher.fullName,
            pitcherId: pitcher.id,
            team,
            opponent,
            gameTime,
            isHome,
          };

          allStarts.push(start);
          if (!byPitcher[pitcher.fullName]) byPitcher[pitcher.fullName] = [];
          byPitcher[pitcher.fullName].push(start);
        }
      }
    }

    // Sort all starts chronologically
    allStarts.sort((a, b) => a.date.localeCompare(b.date));

    return Response.json({ startDate, endDate, byPitcher, allStarts } as ProbablePitchersData);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
