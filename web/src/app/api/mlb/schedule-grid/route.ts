// MLB Stats API — per-day schedule grid
// Returns opponent for each team on each day in the date range
import logger from "@/lib/logger";

const TEAM_MAP: Record<string, string> = {
  AZ: "ARI", ARI: "ARI", WSH: "WSH", WAS: "WSH",
  CWS: "CWS", CHW: "CWS", CHC: "CHC",
  TB: "TB", TBR: "TB", KC: "KC", KCR: "KC",
  SD: "SD", SDP: "SD", SF: "SF", SFG: "SF",
  STL: "STL", LAA: "LAA", LAD: "LAD",
  NYY: "NYY", NYM: "NYM", ATH: "OAK", OAK: "OAK",
};

function normalize(abbrev: string): string {
  return TEAM_MAP[abbrev] ?? abbrev;
}

// date → team → opponent string
export type ScheduleGrid = Record<string, Record<string, string>>;

export async function GET(req: Request) {
  const reqId = crypto.randomUUID();
  const log = logger.child({ reqId, path: new URL(req.url).pathname });
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!startDate || !endDate) {
    return Response.json({ error: "startDate and endDate required" }, { status: 400 });
  }

  try {
    const t0 = Date.now();
    const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${startDate}&endDate=${endDate}&gameType=R&hydrate=team`;
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) return Response.json({ error: "MLB_API_FAILED" }, { status: 502 });

    const data = await res.json();
    const grid: ScheduleGrid = {};

    for (const dateObj of data.dates ?? []) {
      const date: string = dateObj.date;
      if (!grid[date]) grid[date] = {};

      for (const game of dateObj.games ?? []) {
        const awayRaw: string = game.teams?.away?.team?.abbreviation ?? "";
        const homeRaw: string = game.teams?.home?.team?.abbreviation ?? "";
        const away = normalize(awayRaw);
        const home = normalize(homeRaw);

        if (away) grid[date][away] = "@" + home;
        if (home) grid[date][home] = "vs " + away;
      }
    }

    log.info({ op: "schedule-grid", durationMs: Date.now() - t0 }, "ok");
    return Response.json(grid);
  } catch (err) {
    log.error({ op: "schedule-grid", err: String(err) }, "failed");
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
