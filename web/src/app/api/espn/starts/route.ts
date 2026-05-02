export const dynamic = "force-dynamic";
import { espnFetch, hasEspnCreds, POS_MAP, getProTeam, getMatchupDates, getCurrentMatchupPeriod } from "@/lib/espn";
import type { EspnLeagueData } from "@/types/espn";
import logger from "@/lib/logger";

export interface StartsTeam {
  teamId: number;
  teamName: string;
  pitchers: { name: string; pos: string; proTeam: string; onIL: boolean; ppCount: number; ppNextCount: number }[];
}

export interface StartsData {
  myTeamId: number;
  currentMatchupPeriod: number;
  currentDates: { start: string; end: string } | null;
  nextDates: { start: string; end: string } | null;
  teams: StartsTeam[];
  rosteredPitchers: string[];
}

const MY_TEAM_ID = parseInt(process.env.MY_ESPN_TEAM_ID ?? "0");

// Fetch MLB schedule to map ESPN game IDs (gamePk) to dates
// Map ESPN game IDs to dates using ESPN's scoreboard API (NOT MLB's gamePk — different ID systems)
async function buildGameIdDateMap(startDate: string, endDate: string): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  try {
    // Iterate each day in the range and fetch ESPN scoreboard
    const start = new Date(startDate + "T12:00:00");
    const end = new Date(endDate + "T12:00:00");
    const fetches: Promise<void>[] = [];

    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      const espnDate = dateStr.replace(/-/g, ""); // "20260401"
      const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${espnDate}`;

      fetches.push(
        fetch(url, { next: { revalidate: 3600 } })
          .then((r) => r.json())
          .then((data) => {
            for (const event of data.events ?? []) {
              map[String(event.id)] = dateStr;
            }
          })
          .catch(() => {})
      );
    }

    await Promise.all(fetches);
    return map;
  } catch {
    return map;
  }
}

export async function GET(req: Request) {
  const reqId = crypto.randomUUID();
  const log = logger.child({ reqId, path: new URL(req.url).pathname });
  if (!hasEspnCreds()) {
    return Response.json({ error: "ESPN_CREDS_MISSING" }, { status: 401 });
  }
  if (!MY_TEAM_ID) {
    return Response.json({ error: "MY_ESPN_TEAM_ID_MISSING" }, { status: 401 });
  }

  try {
    const t0 = Date.now();
    const data = await espnFetch(["mRoster", "mTeam", "mStatus", "mSettings"]) as EspnLeagueData;
    const currentMatchupPeriod = getCurrentMatchupPeriod(data);
    const currentDates = getMatchupDates(data, currentMatchupPeriod);
    const nextDates = getMatchupDates(data, currentMatchupPeriod + 1);

    // Build game ID → date map for both current and next matchup periods
    const mapStart = currentDates?.start ?? new Date().toISOString().slice(0, 10);
    const mapEnd = nextDates?.end ?? (() => {
      const d = new Date(); d.setDate(d.getDate() + 21); return d.toISOString().slice(0, 10);
    })();
    const gameIdToDate = await buildGameIdDateMap(mapStart, mapEnd);

    const teams: StartsTeam[] = [];
    const allRosteredPitchers: string[] = [];

    for (const t of data.teams ?? []) {
      const name = `${t.location ?? ""} ${t.nickname ?? ""}`.trim() || (t.abbrev ?? "");
      const pitchers: StartsTeam["pitchers"] = [];

      for (const e of t.roster?.entries ?? []) {
        const player = e.playerPoolEntry?.player ?? {};
        const posId = player.defaultPositionId;
        if (posId !== 1 && posId !== 11) continue;

        const pName = player.fullName ?? "";
        const injuryStatus = player.injuryStatus ?? "ACTIVE";
        const isIL = ["SEVEN_DAY_DL", "TEN_DAY_DL", "FIFTEEN_DAY_DL", "SIXTY_DAY_DL", "OUT"].includes(injuryStatus);

        // Count PP starts filtered by matchup period dates
        const ppMap: Record<string, string> = player.starterStatusByProGame ?? {};
        let ppCount = 0;
        let ppNextCount = 0;

        for (const [gameId, status] of Object.entries(ppMap)) {
          if (status !== "PROBABLE") continue;
          const gameDate = gameIdToDate[gameId];
          if (!gameDate) continue;

          // Check if game falls in current matchup period
          if (currentDates && gameDate >= currentDates.start && gameDate <= currentDates.end) {
            ppCount++;
          }
          // Check if game falls in next matchup period
          if (nextDates && gameDate >= nextDates.start && gameDate <= nextDates.end) {
            ppNextCount++;
          }
        }

        pitchers.push({
          name: pName,
          pos: POS_MAP[posId] ?? "?",
          proTeam: getProTeam(player),
          onIL: isIL,
          ppCount,       // starts in current matchup period
          ppNextCount,   // starts in next matchup period
        });
        allRosteredPitchers.push(pName);
      }

      teams.push({ teamId: t.id, teamName: name, pitchers });
    }

    log.info({ op: "starts", durationMs: Date.now() - t0 }, "ok");
    return Response.json({
      myTeamId: MY_TEAM_ID,
      currentMatchupPeriod,
      currentDates,
      nextDates,
      teams,
      rosteredPitchers: allRosteredPitchers,
    } as StartsData);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ op: "starts", err: msg }, "failed");
    return Response.json({ error: msg }, { status: 502 });
  }
}
