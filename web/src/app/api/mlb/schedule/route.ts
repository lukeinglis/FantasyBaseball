// MLB Stats API — public, no auth required
// Returns today's games per team with opponent, time, probable pitcher, venue

export interface TeamSchedule {
  todayOpponent: string | null;       // e.g. "@NYY" or "vs LAD"
  todayTime: string | null;           // e.g. "7:05 PM"
  todayProbable: string | null;       // opponent's probable starter name
  todayVenue: string | null;          // e.g. "Yankee Stadium"
  weekGames: number;                  // total games in the requested window
  isHome: boolean | null;
}

// MLB → ESPN team abbreviation mapping
const TEAM_MAP: Record<string, string> = {
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
  ATH: "OAK", OAK: "OAK",  // Athletics rebranded
};

function normalize(abbrev: string): string {
  return TEAM_MAP[abbrev] ?? abbrev;
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

function addDays(date: Date, n: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate") ?? new Date().toISOString().slice(0, 10);
  const endDate = searchParams.get("endDate") ?? addDays(new Date(startDate), 13);
  const today = new Date().toISOString().slice(0, 10);

  try {
    const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${startDate}&endDate=${endDate}&gameType=R&hydrate=probablePitcher,team,venue`;
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) return Response.json({ error: "MLB_API_FAILED" }, { status: 502 });

    const data = await res.json();
    const schedule: Record<string, TeamSchedule> = {};

    for (const dateObj of data.dates ?? []) {
      const isToday = dateObj.date === today;
      for (const game of dateObj.games ?? []) {
        const awayRaw: string = game.teams?.away?.team?.abbreviation ?? "";
        const homeRaw: string = game.teams?.home?.team?.abbreviation ?? "";
        const away = normalize(awayRaw);
        const home = normalize(homeRaw);
        const time = isToday ? toET(game.gameDate ?? "") : null;
        const venue: string = game.venue?.name ?? null;

        // Probable pitchers
        const awayProbable: string = game.teams?.away?.probablePitcher?.fullName ?? null;
        const homeProbable: string = game.teams?.home?.probablePitcher?.fullName ?? null;

        for (const [teamAbbr, isHome] of [[away, false], [home, true]] as [string, boolean][]) {
          if (!teamAbbr) continue;
          if (!schedule[teamAbbr]) {
            schedule[teamAbbr] = { todayOpponent: null, todayTime: null, todayProbable: null, todayVenue: null, weekGames: 0, isHome: null };
          }
          schedule[teamAbbr].weekGames += 1;
          if (isToday && time) {
            const opp = isHome ? away : home;
            schedule[teamAbbr].todayOpponent = (isHome ? "vs " : "@") + opp;
            schedule[teamAbbr].todayTime = time;
            schedule[teamAbbr].isHome = isHome;
            schedule[teamAbbr].todayVenue = venue;
            // Opponent's probable starter (the pitcher your batters face)
            schedule[teamAbbr].todayProbable = isHome ? awayProbable : homeProbable;
          }
        }
      }
    }

    return Response.json(schedule);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
