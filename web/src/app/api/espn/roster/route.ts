export const dynamic = "force-dynamic";
import { espnFetch, hasEspnCreds, SLOT_MAP, POS_MAP, INJURY_MAP, getProTeam } from "@/lib/espn";
import type { EspnLeagueData, EspnRosterEntry } from "@/types/espn";
import logger from "@/lib/logger";

export interface RosterPlayer {
  name: string;
  pos: string;
  slotLabel: string;
  slotId: number;
  injuryStatus: string;
  injuryLabel: string;
  injuryColor: string;
  injuryNote?: string;
  proTeam: string;
  acquisitionType: string;
}

export interface EspnTeam {
  id: number;
  name: string;
  abbrev: string;
  wins: number;
  losses: number;
  ties: number;
  roster: RosterPlayer[];
}

function parseTeams(data: EspnLeagueData): EspnTeam[] {
  const teams: EspnTeam[] = [];
  for (const t of data.teams ?? []) {
    const record = t.record?.overall;
    const entries: EspnRosterEntry[] = t.roster?.entries ?? [];

    const roster: RosterPlayer[] = entries.map((e) => {
      const player = e.playerPoolEntry?.player;
      const injuryStatus: string = player?.injuryStatus ?? "ACTIVE";
      const injuryInfo = INJURY_MAP[injuryStatus] ?? { label: injuryStatus, color: "text-slate-500" };
      return {
        name: player?.fullName ?? "Unknown",
        pos: POS_MAP[player?.defaultPositionId ?? 0] ?? "?",
        slotLabel: SLOT_MAP[e.lineupSlotId ?? 0] ?? "BN",
        slotId: e.lineupSlotId ?? 16,
        injuryStatus,
        injuryLabel: injuryInfo.label,
        injuryColor: injuryInfo.color,
        injuryNote: player?.injuryStatusNote ?? undefined,
        proTeam: getProTeam(player ?? {}),
        acquisitionType: e.playerPoolEntry?.acquisitionType ?? "",
      };
    });

    teams.push({
      id: t.id,
      name: `${t.location ?? ""} ${t.nickname ?? ""}`.trim() || (t.abbrev ?? ""),
      abbrev: t.abbrev ?? "",
      wins: record?.wins ?? 0,
      losses: record?.losses ?? 0,
      ties: record?.ties ?? 0,
      roster,
    });
  }
  return teams;
}

export async function GET(req: Request) {
  const reqId = crypto.randomUUID();
  const log = logger.child({ reqId, path: new URL(req.url).pathname });
  if (!hasEspnCreds()) {
    return Response.json({ error: "ESPN_CREDS_MISSING" }, { status: 401 });
  }
  try {
    const t0 = Date.now();
    const data = await espnFetch(["mRoster", "mTeam"]) as EspnLeagueData;
    const teams = parseTeams(data);
    log.info({ op: "roster", durationMs: Date.now() - t0 }, "ok");
    return Response.json(teams);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ op: "roster", err: msg }, "failed");
    return Response.json({ error: msg }, { status: 502 });
  }
}
