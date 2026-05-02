// MLB Stats API — batter vs pitcher career stats
// Takes batter and pitcher names, looks up IDs, returns career matchup stats
import logger from "@/lib/logger";
import type { MlbPerson, MlbBvpSplit, BvpTotals } from "@/types/espn";

export interface BvpStats {
  batter: string;
  pitcher: string;
  atBats: number;
  hits: number;
  homeRuns: number;
  strikeOuts: number;
  baseOnBalls: number;
  avg: string;
  ops: string;
  rbi: number;
  summary: string;  // e.g. "3-for-12, 1 HR"
}

// Cache player ID lookups in memory to avoid repeated searches
const playerIdCache = new Map<string, number | null>();

async function lookupPlayerId(name: string): Promise<number | null> {
  const cached = playerIdCache.get(name);
  if (cached !== undefined) return cached;

  try {
    // Use MLB people search endpoint
    const encoded = encodeURIComponent(name);
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/people/search?names=${encoded}&sportId=1`,
      { next: { revalidate: 86400 } } // cache for 24 hours
    );
    if (!res.ok) { playerIdCache.set(name, null); return null; }

    const data = await res.json();
    const people = data.people ?? [];

    // Try exact match first, then partial
    const exact = people.find((p: MlbPerson) => p.fullName === name);
    const match = exact ?? people[0];

    const id = match?.id ?? null;
    playerIdCache.set(name, id);
    return id;
  } catch {
    playerIdCache.set(name, null);
    return null;
  }
}

async function fetchBvp(batterId: number, pitcherId: number): Promise<BvpTotals | null> {
  try {
    const url = `https://statsapi.mlb.com/api/v1/people/${batterId}/stats?stats=vsPlayer&opposingPlayerId=${pitcherId}&group=hitting`;
    const res = await fetch(url, { next: { revalidate: 3600 } }); // cache 1 hour
    if (!res.ok) return null;

    const data = await res.json();
    const splits = data.stats?.[0]?.splits ?? [];
    if (splits.length === 0) return null;

    // Aggregate all career stats vs this pitcher
    const totals = splits.reduce(
      (acc: BvpTotals, s: MlbBvpSplit) => {
        const stat = s.stat ?? {};
        acc.atBats += stat.atBats ?? 0;
        acc.hits += stat.hits ?? 0;
        acc.homeRuns += stat.homeRuns ?? 0;
        acc.strikeOuts += stat.strikeOuts ?? 0;
        acc.baseOnBalls += stat.baseOnBalls ?? 0;
        acc.rbi += stat.rbi ?? 0;
        return acc;
      },
      { atBats: 0, hits: 0, homeRuns: 0, strikeOuts: 0, baseOnBalls: 0, rbi: 0 }
    );

    return totals;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const reqId = crypto.randomUUID();
  const log = logger.child({ reqId, path: new URL(req.url).pathname });
  const { searchParams } = new URL(req.url);
  const matchups = searchParams.get("matchups"); // JSON array of { batter, pitcher } pairs

  if (!matchups) {
    return Response.json({ error: "Missing matchups parameter" }, { status: 400 });
  }

  try {
    const t0 = Date.now();
    const pairs: { batter: string; pitcher: string }[] = JSON.parse(matchups);
    if (!Array.isArray(pairs) || pairs.length === 0) {
      return Response.json({ error: "Invalid matchups" }, { status: 400 });
    }

    // Limit to prevent abuse
    const limited = pairs.slice(0, 15);

    // Look up all player IDs in parallel
    const lookups = await Promise.all(
      limited.flatMap((p) => [lookupPlayerId(p.batter), lookupPlayerId(p.pitcher)])
    );

    // Fetch BvP stats for each pair
    const results: Record<string, BvpStats | null> = {};

    await Promise.all(
      limited.map(async (pair, i) => {
        const batterId = lookups[i * 2];
        const pitcherId = lookups[i * 2 + 1];
        const key = `${pair.batter}__${pair.pitcher}`;

        if (!batterId || !pitcherId) {
          results[key] = null;
          return;
        }

        const stats = await fetchBvp(batterId, pitcherId);
        if (!stats || stats.atBats === 0) {
          results[key] = null;
          return;
        }

        const avg = stats.atBats > 0 ? (stats.hits / stats.atBats).toFixed(3) : ".000";
        const obp = (stats.atBats + stats.baseOnBalls) > 0
          ? ((stats.hits + stats.baseOnBalls) / (stats.atBats + stats.baseOnBalls)).toFixed(3)
          : ".000";

        // Build summary string
        let summary = `${stats.hits}-for-${stats.atBats}`;
        if (stats.homeRuns > 0) summary += `, ${stats.homeRuns} HR`;
        if (stats.strikeOuts > 0) summary += `, ${stats.strikeOuts} K`;

        results[key] = {
          batter: pair.batter,
          pitcher: pair.pitcher,
          atBats: stats.atBats,
          hits: stats.hits,
          homeRuns: stats.homeRuns,
          strikeOuts: stats.strikeOuts,
          baseOnBalls: stats.baseOnBalls,
          avg,
          ops: obp, // simplified — full OPS would need SLG
          rbi: stats.rbi,
          summary,
        };
      })
    );

    log.info({ op: "bvp", count: results.length, durationMs: Date.now() - t0 }, "ok");
    return Response.json(results);
  } catch (err) {
    log.error({ op: "bvp", err: String(err) }, "failed");
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
