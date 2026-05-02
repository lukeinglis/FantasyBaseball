import { hasEspnCreds, getProTeam } from "@/lib/espn";
import { mean, stddev } from "@/lib/z-scores";
import logger from "@/lib/logger";

const LEAGUE_ID = 4739;
const SEASON = 2026;
const BASE = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/flb/seasons/${SEASON}/segments/0/leagues/${LEAGUE_ID}`;

const WEIGHTS_URL =
  "https://raw.githubusercontent.com/lukeinglis/FantasyBaseball/main/output/category_weights.json";

// ESPN position map
const POS_MAP: Record<number, string> = {
  1: "SP", 2: "C", 3: "1B", 4: "2B", 5: "3B",
  6: "SS", 7: "OF", 8: "OF", 9: "OF", 10: "DH", 11: "RP",
};

// Batting stat IDs
const BAT_STAT_IDS: Record<string, string> = {
  "0": "AB", "1": "H", "2": "AVG", "5": "HR", "8": "TB",
  "10": "BB", "20": "R", "21": "RBI", "23": "SB",
};

// Pitching stat IDs
const PIT_STAT_IDS: Record<string, string> = {
  "34": "IP", "41": "WHIP", "47": "ERA", "48": "K",
  "50": "SV", "53": "W", "54": "L", "57": "HD", "63": "QS",
};

// Categories where lower is better (invert z-score)
const INVERT_CATS = new Set(["ERA", "WHIP", "L"]);

const BAT_CATS = ["AVG", "HR", "R", "RBI", "SB", "H", "BB", "TB"];
const PIT_CATS = ["K", "QS", "W", "SV", "HD", "ERA", "WHIP", "L"];

export interface ZScorePlayer {
  name: string;
  playerId: number;
  pos: string;
  proTeam: string;
  isPitcher: boolean;
  onTeamId: number;
  seasonStats: Record<string, number>;
  zScores: Record<string, number>;
  zTotal: number;
  far: number;
}

export async function GET(req: Request) {
  const reqId = crypto.randomUUID();
  const log = logger.child({ reqId, path: new URL(req.url).pathname });
  if (!hasEspnCreds()) {
    return Response.json({ error: "ESPN_CREDS_MISSING" }, { status: 401 });
  }

  const espnS2 = process.env.ESPN_S2!;
  const swid = process.env.ESPN_SWID!;

  try {
    const t0 = Date.now();
    // Fetch all players (rostered + free agents) and category weights in parallel
    const filters = {
      players: {
        filterStatus: { value: ["FREEAGENT", "ONTEAM", "WAIVERS"] },
        sortDraftRanks: { sortPriority: 1, sortAsc: true, value: "STANDARD" },
        limit: 800,
        offset: 0,
      },
    };

    const [espnRes, weightsRes] = await Promise.all([
      fetch(`${BASE}?scoringPeriodId=0&view=kona_player_info`, {
        headers: {
          Cookie: `espn_s2=${espnS2}; SWID=${swid}`,
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0",
          "x-fantasy-filter": JSON.stringify(filters),
        },
        next: { revalidate: 300 },
      }),
      fetch(WEIGHTS_URL, { next: { revalidate: 3600 } }).catch(() => null),
    ]);

    if (!espnRes.ok) {
      return Response.json({ error: `ESPN API ${espnRes.status}` }, { status: 502 });
    }

    // Parse category weights (default to equal weights if fetch fails)
    let categoryWeights: Record<string, number> = {};
    if (weightsRes && weightsRes.ok) {
      try {
        categoryWeights = await weightsRes.json();
      } catch {
        categoryWeights = {};
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await espnRes.json();

    // Parse all players
    interface RawPlayer {
      name: string;
      playerId: number;
      pos: string;
      proTeam: string;
      isPitcher: boolean;
      onTeamId: number;
      seasonStats: Record<string, number>;
    }

    const batters: RawPlayer[] = [];
    const pitchers: RawPlayer[] = [];

    for (const entry of data.players ?? []) {
      const player = entry.player ?? {};
      const name: string = player.fullName ?? "";
      if (!name) continue;

      const defaultPosId: number = player.defaultPositionId ?? 0;
      const isPitcher = defaultPosId === 1 || defaultPosId === 11;
      const statIds = isPitcher ? PIT_STAT_IDS : BAT_STAT_IDS;

      // Extract season stats from stat block id="002026"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const statBlocks: any[] = player.stats ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const seasonBlock = statBlocks.find((s: any) => s.id === "002026");
      if (!seasonBlock?.stats) continue;

      const seasonStats: Record<string, number> = {};
      for (const [sid, val] of Object.entries(seasonBlock.stats)) {
        const cat = statIds[sid];
        if (cat) seasonStats[cat] = val as number;
      }

      const raw: RawPlayer = {
        name,
        playerId: player.id ?? 0,
        pos: POS_MAP[defaultPosId] ?? "?",
        proTeam: getProTeam(player),
        isPitcher,
        onTeamId: entry.onTeamId ?? 0,
        seasonStats,
      };

      if (isPitcher) {
        pitchers.push(raw);
      } else {
        batters.push(raw);
      }
    }

    // Filter qualified players for z-score computation
    const qualifiedBatters = batters.filter((p) => (p.seasonStats.AB ?? 0) >= 10);
    const qualifiedPitchers = pitchers.filter((p) => (p.seasonStats.IP ?? 0) >= 5);

    // Compute z-scores for a group of players on given categories
    function computeZScores(
      players: RawPlayer[],
      cats: string[],
      weights: Record<string, number>,
    ): ZScorePlayer[] {
      // Compute mean and stddev for each category
      const catStats: Record<string, { mu: number; sd: number }> = {};
      for (const cat of cats) {
        const vals = players
          .map((p) => p.seasonStats[cat])
          .filter((v) => v !== undefined && v !== null) as number[];
        const mu = mean(vals);
        const sd = stddev(vals, mu);
        catStats[cat] = { mu, sd };
      }

      return players.map((p) => {
        const zScores: Record<string, number> = {};
        let weightedSum = 0;
        let totalWeight = 0;

        for (const cat of cats) {
          const val = p.seasonStats[cat];
          if (val === undefined || val === null) {
            zScores[cat] = 0;
            continue;
          }
          const { mu, sd } = catStats[cat];
          if (sd === 0) {
            zScores[cat] = 0;
            continue;
          }
          let z = (val - mu) / sd;

          // Invert for categories where lower is better
          if (INVERT_CATS.has(cat)) {
            z = -z;
          }

          zScores[cat] = z;

          const w = weights[cat] ?? 1;
          weightedSum += z * w;
          totalWeight += w;
        }

        const zTotal = totalWeight > 0 ? weightedSum / totalWeight : 0;
        // FAR = Fantasy Above Replacement: scale zTotal to be more intuitive
        // Multiply by number of categories to get a cumulative score
        const far = zTotal * cats.length;

        return {
          name: p.name,
          playerId: p.playerId,
          pos: p.pos,
          proTeam: p.proTeam,
          isPitcher: p.isPitcher,
          onTeamId: p.onTeamId,
          seasonStats: p.seasonStats,
          zScores,
          zTotal,
          far,
        };
      });
    }

    const batterResults = computeZScores(qualifiedBatters, BAT_CATS, categoryWeights);
    const pitcherResults = computeZScores(qualifiedPitchers, PIT_CATS, categoryWeights);

    // Combine and sort by FAR descending
    const allPlayers = [...batterResults, ...pitcherResults].sort((a, b) => b.far - a.far);

    log.info({ op: "z-scores", count: allPlayers.length, durationMs: Date.now() - t0 }, "ok");
    return Response.json({
      players: allPlayers,
      count: allPlayers.length,
      categoryWeights,
      batCats: BAT_CATS,
      pitCats: PIT_CATS,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ op: "z-scores", err: msg }, "failed");
    return Response.json({ error: msg }, { status: 502 });
  }
}
