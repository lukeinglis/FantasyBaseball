// Fetches live ESPN ADP + eligible positions for 2026 MLB fantasy
// Uses ESPN's public player pool endpoint — no auth required

// defaultPositionId → primary position label
const PRIMARY_POS: Record<number, string> = {
  1: "SP",
  2: "C",
  3: "1B",
  4: "2B",
  5: "3B",
  6: "SS",
  7: "OF",
  8: "OF",
  9: "OF",
  10: "DH",
  11: "RP",
};

// eligibleSlots ID → display label (bench/IL/UTIL/NA omitted)
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
  10: "OF",  // additional OF designation (deduplicated below)
  14: "SP",
  15: "RP",
};

interface EspnPlayer {
  player?: {
    fullName?: string;
    defaultPositionId?: number;
    eligibleSlots?: number[];
    ownership?: {
      averageDraftPosition?: number;
    };
    draftRanksByRankType?: {
      ROTO?: { rank?: number };
      STANDARD?: { rank?: number };
    };
  };
}

export interface EspnPlayerData {
  adp: number | null;
  primaryPos: string | null;
  eligiblePos: string[];
  espnRank: number | null;
}

import logger from "@/lib/logger";

export async function GET(req: Request) {
  const reqId = crypto.randomUUID();
  const log = logger.child({ reqId, path: new URL(req.url).pathname });
  try {
    const t0 = Date.now();
    const res = await fetch(
      "https://lm-api-reads.fantasy.espn.com/apis/v3/games/flb/seasons/2026/segments/0/leaguedefaults/3?view=kona_player_info&scoringPeriodId=0",
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0",
          "X-Fantasy-Filter": JSON.stringify({
            players: {
              filterStatus: { value: ["FREEAGENT", "WAIVERS", "ONTEAM"] },
              limit: 500,
              sortPercOwned: { sortPriority: 1, sortAsc: false },
            },
          }),
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
      const pl = p.player;
      if (!pl?.fullName) continue;

      const adpRaw = pl.ownership?.averageDraftPosition;
      const primaryPos = PRIMARY_POS[pl.defaultPositionId ?? -1] ?? null;

      // Map eligible slots to labels, deduplicate
      const seen = new Set<string>();
      const eligiblePos: string[] = [];
      for (const slot of pl.eligibleSlots ?? []) {
        const label = SLOT_NAMES[slot];
        if (label && !seen.has(label)) {
          seen.add(label);
          eligiblePos.push(label);
        }
      }

      result[pl.fullName] = {
        adp: adpRaw != null && adpRaw > 0 ? Math.round(adpRaw * 10) / 10 : null,
        primaryPos,
        eligiblePos,
        espnRank: pl.draftRanksByRankType?.ROTO?.rank ?? null,
      };
    }

    log.info({ op: "espn-adp", durationMs: Date.now() - t0 }, "ok");
    return Response.json(result);
  } catch (err) {
    log.error({ op: "espn-adp", err: String(err) }, "failed");
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
