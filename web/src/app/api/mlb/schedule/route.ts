// MLB Stats API — public, no auth required
// Returns today's games and per-team game count for a date range

export interface TeamSchedule {
  todayOpponent: string | null;   // e.g. "@NYY" or "vs LAD"
  todayTime: string | null;       // e.g. "7:05 PM"
  weekGames: number;              // total games in the requested window
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
    const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${startDate}&endDate=${endDate}&gameType=R&hydrate=team`;
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) return Response.json({ error: "MLB_API_FAILED" }, { status: 502 });

    const data = await res.json();
    const schedule: Record<string, TeamSchedule> = {};

    for (const dateObj of data.dates ?? []) {
      const isToday = dateObj.date === today;
      for (const game of dateObj.games ?? []) {
        const away: string = game.teams?.away?.team?.abbreviation ?? "";
        const home: string = game.teams?.home?.team?.abbreviation ?? "";
        const time = isToday ? toET(game.gameDate ?? "") : null;

        for (const [teamAbbr, isHome] of [[away, false], [home, true]] as [string, boolean][]) {
          if (!teamAbbr) continue;
          if (!schedule[teamAbbr]) {
            schedule[teamAbbr] = { todayOpponent: null, todayTime: null, weekGames: 0 };
          }
          schedule[teamAbbr].weekGames += 1;
          if (isToday && time) {
            const opp = isHome ? away : home;
            schedule[teamAbbr].todayOpponent = (isHome ? "vs " : "@") + opp;
            schedule[teamAbbr].todayTime = time;
          }
        }
      }
    }

    return Response.json(schedule);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
