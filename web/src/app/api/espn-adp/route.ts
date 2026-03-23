// Fetches live ESPN average draft position for 2026 MLB fantasy
// Uses ESPN's public player pool endpoint — no auth required

interface EspnPlayer {
  id: number;
  playerPoolEntry?: {
    averageDraftPosition?: number;
    player?: {
      fullName?: string;
    };
  };
}

export async function GET() {
  try {
    const res = await fetch(
      "https://lm-api-reads.fantasy.espn.com/apis/v3/games/flb/seasons/2026/segments/0/leaguedefaults/3?view=kona_player_info&scoringPeriodId=0",
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0",
        },
        next: { revalidate: 300 }, // cache 5 min — ADP doesn't change by the second
      }
    );

    if (!res.ok) {
      return Response.json({ error: "ESPN returned non-OK", status: res.status }, { status: 502 });
    }

    const data = await res.json();
    const players: EspnPlayer[] = data.players ?? [];

    // Build name → ADP map, rounded to 1 decimal
    const adp: Record<string, number> = {};
    for (const p of players) {
      const name = p.playerPoolEntry?.player?.fullName;
      const pos = p.playerPoolEntry?.averageDraftPosition;
      if (name && pos != null && pos > 0) {
        adp[name] = Math.round(pos * 10) / 10;
      }
    }

    return Response.json(adp);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
