export const dynamic = "force-dynamic";
import { espnFetch, hasEspnCreds } from "@/lib/espn";
import type { EspnLeagueData } from "@/types/espn";
import logger from "@/lib/logger";

export interface StandingsTeam {
  teamId: number;
  teamName: string;
  abbrev: string;
  wins: number;
  losses: number;
  ties: number;
  pct: number;
  gamesBack: number;
  streak: string;         // "W3", "L1", etc.
  rank: number;
  playoffSeed: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface StandingsData {
  currentMatchupPeriod: number;
  totalMatchupPeriods: number;
  myTeamId: number;
  teams: StandingsTeam[];
}

const MY_TEAM_ID = parseInt(process.env.MY_ESPN_TEAM_ID ?? "0");

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
    const data = await espnFetch(["mTeam", "mStatus", "mSettings", "mMatchup", "mMatchupScore"]) as EspnLeagueData;
    const currentMatchupPeriod = data.status?.currentMatchupPeriod ?? 1;
    const totalMatchupPeriods: number = data.settings?.scheduleSettings?.matchupPeriodCount ?? 21;

    // Build standings from team records
    const teams: StandingsTeam[] = [];
    for (const t of data.teams ?? []) {
      const record = t.record?.overall ?? {};
      const wins = record.wins ?? 0;
      const losses = record.losses ?? 0;
      const ties = record.ties ?? 0;
      const total = wins + losses + ties;
      const pct = total > 0 ? wins / total : 0;

      // Calculate streak from recent results
      const streakType = record.streakType ?? "";
      const streakLength = record.streakLength ?? 0;
      const streak = streakType && streakLength ? `${streakType === "WIN" ? "W" : streakType === "LOSS" ? "L" : "T"}${streakLength}` : "-";

      teams.push({
        teamId: t.id,
        teamName: `${t.location ?? ""} ${t.nickname ?? ""}`.trim() || (t.abbrev ?? ""),
        abbrev: t.abbrev ?? "",
        wins,
        losses,
        ties,
        pct,
        gamesBack: 0, // calculated below
        streak,
        rank: t.rankCalculatedFinal ?? t.playoffSeed ?? 0,
        playoffSeed: t.playoffSeed ?? 0,
        pointsFor: record.pointsFor ?? 0,
        pointsAgainst: record.pointsAgainst ?? 0,
      });
    }

    // Sort by wins (desc), then losses (asc), then ties (desc)
    teams.sort((a, b) => {
      if (a.wins !== b.wins) return b.wins - a.wins;
      if (a.losses !== b.losses) return a.losses - b.losses;
      return b.ties - a.ties;
    });

    // Calculate games back from leader
    if (teams.length > 0) {
      const leader = teams[0];
      for (const t of teams) {
        // Games back = ((leader wins - team wins) + (team losses - leader losses)) / 2
        t.gamesBack = ((leader.wins - t.wins) + (t.losses - leader.losses)) / 2;
      }
    }

    // Assign ranks
    teams.forEach((t, i) => { if (!t.rank) t.rank = i + 1; });

    log.info({ op: "standings", durationMs: Date.now() - t0 }, "ok");
    return Response.json({
      currentMatchupPeriod,
      totalMatchupPeriods,
      myTeamId: MY_TEAM_ID,
      teams,
    } as StandingsData);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ op: "standings", err: msg }, "failed");
    return Response.json({ error: msg }, { status: 502 });
  }
}
