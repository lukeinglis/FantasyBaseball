import { espnFetch, hasEspnCreds, SLOT_MAP, POS_MAP, INJURY_MAP } from "@/lib/espn";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseTeams(data: any): EspnTeam[] {
  const teams: EspnTeam[] = [];
  for (const t of data.teams ?? []) {
    const record = t.record?.overall ?? {};
    const entries = t.roster?.entries ?? [];

    const roster: RosterPlayer[] = entries.map((e: any) => {
      const ppe = e.playerPoolEntry ?? {};
      const player = ppe.player ?? {};
      const injuryStatus: string = player.injuryStatus ?? "ACTIVE";
      const injuryInfo = INJURY_MAP[injuryStatus] ?? { label: injuryStatus, color: "text-slate-500" };
      return {
        name: player.fullName ?? "Unknown",
        pos: POS_MAP[player.defaultPositionId] ?? "?",
        slotLabel: SLOT_MAP[e.lineupSlotId] ?? "BN",
        slotId: e.lineupSlotId ?? 16,
        injuryStatus,
        injuryLabel: injuryInfo.label,
        injuryColor: injuryInfo.color,
        injuryNote: player.injuryStatusNote ?? undefined,
        proTeam: player.proTeamAbbrev ?? "",
        acquisitionType: ppe.acquisitionType ?? "",
      };
    });

    teams.push({
      id: t.id,
      name: `${t.location ?? ""} ${t.nickname ?? ""}`.trim() || t.abbrev,
      abbrev: t.abbrev ?? "",
      wins: record.wins ?? 0,
      losses: record.losses ?? 0,
      ties: record.ties ?? 0,
      roster,
    });
  }
  return teams;
}

export async function GET() {
  if (!hasEspnCreds()) {
    return Response.json({ error: "ESPN_CREDS_MISSING" }, { status: 401 });
  }
  try {
    const data = await espnFetch(["mRoster", "mTeam"]);
    const teams = parseTeams(data);
    return Response.json(teams);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 502 });
  }
}
