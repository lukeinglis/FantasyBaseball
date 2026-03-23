// Fetches live ESPN ADP + eligible positions for 2026 MLB fantasy
// Uses ESPN's public player pool endpoint — no auth required

// ESPN FLB eligible slot ID → position label (bench/IL slots omitted)
const SLOT_NAMES: Record<number, string> = {
  0: "C",
  1: "1B",
  2: "2B",
  3: "3B",
  4: "SS",
  5: "OF",
  6: "MI",   // 2B/SS
  7: "CI",   // 1B/3B
  8: "DH",
  9: "SP",
  10: "RP",
  11: "P",
};

interface EspnPlayer {
  playerPoolEntry?: {
    averageDraftPosition?: number;
    player?: {
      fullName?: string;
      eligibleSlots?: number[];
    };
  };
}

export interface EspnPlayerData {
  adp: number | null;
  eligiblePos: string[];
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
        next: { revalidate: 300 },
      }
    );

    if (!res.ok) {
      return Response.json({ error: "ESPN returned non-OK", status: res.status }, { status: 502 });
    }

    const data = await res.json();
    const players: EspnPlayer[] = data.players ?? [];

    const result: Record<string, EspnPlayerData> = {};

    for (const p of players) {
      const name = p.playerPoolEntry?.player?.fullName;
      if (!name) continue;

      const adpRaw = p.playerPoolEntry?.averageDraftPosition;
      const slots = p.playerPoolEntry?.player?.eligibleSlots ?? [];

      const eligiblePos = slots
        .filter((id) => id in SLOT_NAMES)
        .map((id) => SLOT_NAMES[id])
        // Remove redundant combo slots if both individual positions already present
        .filter((pos, _, arr) => {
          if (pos === "MI") return !arr.includes("2B") && !arr.includes("SS");
          if (pos === "CI") return !arr.includes("1B") && !arr.includes("3B");
          if (pos === "P") return !arr.includes("SP") && !arr.includes("RP");
          if (pos === "DH") return arr.length === 1; // only show DH if it's their only slot
          return true;
        });

      result[name] = {
        adp: adpRaw != null && adpRaw > 0 ? Math.round(adpRaw * 10) / 10 : null,
        eligiblePos,
      };
    }

    return Response.json(result);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
