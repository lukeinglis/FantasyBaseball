export const dynamic = "force-dynamic";
import { hasEspnCreds, STAT_ID_MAP, getProTeam } from "@/lib/espn";

// Fetch current season stats for all rostered players
// Uses ESPN's kona_player_info view with season stats

const LEAGUE_ID = 4739;
const SEASON = 2026;
const BASE = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/flb/seasons/${SEASON}/segments/0/leagues/${LEAGUE_ID}`;

// ESPN stat IDs for player-level stats (different from scoring stat IDs)
// These are the raw stat IDs used in player.stats[].stats
const PLAYER_BATTING_STATS: Record<string, string> = {
  "1": "H", "2": "AVG", "5": "HR", "8": "TB",
  "20": "R", "21": "RBI", "10": "BB", "23": "SB",
  "0": "AB", "6": "2B", "4": "3B",
};

const PLAYER_PITCHING_STATS: Record<string, string> = {
  "48": "K", "63": "QS", "53": "W", "54": "L",
  "57": "HD", "50": "SV", "47": "ERA", "41": "WHIP",
  "34": "IP", "45": "GS", "39": "ER",
};

export interface PlayerStats {
  name: string;
  playerId: number;
  pos: string;
  proTeam: string;
  seasonStats: Record<string, number>;   // category → value (full season)
  last7Stats: Record<string, number>;    // category → value (last 7 days)
  last15Stats: Record<string, number>;   // category → value (last 15 days)
  last30Stats: Record<string, number>;   // category → value (last 30 days)
}

export async function GET(req: Request) {
  if (!hasEspnCreds()) {
    return Response.json({ error: "ESPN_CREDS_MISSING" }, { status: 401 });
  }

  const espnS2 = process.env.ESPN_S2!;
  const swid = process.env.ESPN_SWID!;

  // Only fetch rostered players
  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status") ?? "ONTEAM";

  try {
    const filters = {
      players: {
        filterStatus: { value: statusFilter === "ALL" ? ["FREEAGENT", "ONTEAM", "WAIVERS"] : ["ONTEAM"] },
        sortDraftRanks: { sortPriority: 1, sortAsc: true, value: "STANDARD" },
        limit: 500,
        offset: 0,
      },
    };

    const url = `${BASE}?scoringPeriodId=0&view=kona_player_info`;
    const res = await fetch(url, {
      headers: {
        Cookie: `espn_s2=${espnS2}; SWID=${swid}`,
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
        "x-fantasy-filter": JSON.stringify(filters),
      },
      next: { revalidate: 300 }, // 5 min cache
    });

    if (!res.ok) {
      return Response.json({ error: `ESPN API ${res.status}` }, { status: 502 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    const players: PlayerStats[] = [];

    // ESPN position ID map
    const posMap: Record<number, string> = {
      1: "SP", 2: "C", 3: "1B", 4: "2B", 5: "3B",
      6: "SS", 7: "OF", 8: "OF", 9: "OF", 10: "DH", 11: "RP",
    };

    // ESPN proTeam ID → abbreviation
    const proTeamMap: Record<number, string> = {
      1: "ATL", 2: "BAL", 3: "BOS", 4: "CHC", 5: "CWS",
      6: "CIN", 7: "CLE", 8: "COL", 9: "DET", 10: "HOU",
      11: "KC", 12: "LAA", 13: "LAD", 14: "MIA", 15: "MIL",
      16: "MIN", 17: "NYM", 18: "NYY", 19: "OAK", 20: "PHI",
      21: "PIT", 22: "SD", 23: "SEA", 24: "SF", 25: "STL",
      26: "TB", 27: "TEX", 28: "TOR", 29: "WSH", 30: "ARI",
    };

    for (const entry of data.players ?? []) {
      const player = entry.player ?? {};
      const name: string = player.fullName ?? "";
      if (!name) continue;

      const isPitcher = player.defaultPositionId === 1 || player.defaultPositionId === 11;
      const statMap = isPitcher ? { ...PLAYER_BATTING_STATS, ...PLAYER_PITCHING_STATS } : PLAYER_BATTING_STATS;

      // Parse stats from different time periods
      // ESPN stat blocks: id format is "XXYYYY" where XX = source type, YYYY = year
      // "002026" = actual 2026 season stats
      // "012026" = last 7 days
      // "022026" = last 15 days
      // "032026" = last 30 days
      const statBlocks: any[] = player.stats ?? [];

      function parseStatBlock(targetId: string): Record<string, number> {
        const result: Record<string, number> = {};
        const block = statBlocks.find((s: any) => s.id === targetId);
        if (!block?.stats) return result;
        for (const [sid, val] of Object.entries(block.stats)) {
          const cat = statMap[sid];
          if (cat) result[cat] = val as number;
        }
        return result;
      }

      const seasonStats = parseStatBlock("002026");
      const last7Stats = parseStatBlock("012026");
      const last15Stats = parseStatBlock("022026");
      const last30Stats = parseStatBlock("032026");

      // Only include players that have some stats
      if (Object.keys(seasonStats).length === 0 && Object.keys(last7Stats).length === 0) continue;

      players.push({
        name,
        playerId: player.id ?? 0,
        pos: posMap[player.defaultPositionId] ?? "?",
        proTeam: getProTeam(player),
        seasonStats,
        last7Stats,
        last15Stats,
        last30Stats,
      });
    }

    return Response.json({ players, count: players.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 502 });
  }
}
