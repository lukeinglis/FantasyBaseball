"use client";

const IL_INJURY_STATUSES = new Set(["SEVEN_DAY_DL", "TEN_DAY_DL", "FIFTEEN_DAY_DL", "SIXTY_DAY_DL", "OUT"]);
function isOnIL(status: string): boolean { return IL_INJURY_STATUSES.has(status); }

import { useState, useEffect, useMemo } from "react";

interface RosterPlayer {
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

interface EspnTeam {
  id: number;
  name: string;
  abbrev: string;
  wins: number;
  losses: number;
  ties: number;
  roster: RosterPlayer[];
}

interface TeamSchedule {
  todayOpponent: string | null;
  todayTime: string | null;
  weekGames: number;
}

const MY_TEAM_ID_KEY = "espnMyTeamId";

// Slot IDs
const BATTER_SLOT_IDS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 12]);
const PITCHER_SLOT_IDS = new Set([13, 14, 15]);
const BENCH_SLOT_ID = 16;


function PlayerRow({
  player,
  schedule,
}: {
  player: RosterPlayer;
  schedule: TeamSchedule | null;
}) {
  const hasGame = !!schedule?.todayOpponent;
  const isInjured = player.injuryStatus !== "ACTIVE";

  return (
    <div className="border-b border-border px-2 py-1.5">
      <div className="flex items-center gap-2">
        <span className="w-7 shrink-0 text-[10px] font-bold text-slate-600">{player.slotLabel}</span>
        <span className={`min-w-0 w-[140px] truncate text-[12px] ${isInjured ? "text-slate-500" : "text-slate-700"}`}>
          {player.name}
        </span>
        <span className="w-6 shrink-0 text-[10px] text-slate-500">{player.pos}</span>
        <span className="w-7 shrink-0 text-[10px] text-slate-500">{player.proTeam}</span>

        {/* Today's game */}
        <div className="flex-1 min-w-0">
          {hasGame ? (
            <span className="text-[10px] text-slate-600 whitespace-nowrap">
              {schedule!.todayOpponent}
              {schedule!.todayTime && (
                <span className="ml-1 text-slate-500">{schedule!.todayTime}</span>
              )}
            </span>
          ) : (
            <span className="text-[10px] text-slate-400">Off</span>
          )}
        </div>

        {/* Games this week */}
        {schedule && (
          <span className={`shrink-0 text-[10px] tabular-nums font-semibold ${
            schedule.weekGames >= 5 ? "text-emerald-600" :
            schedule.weekGames >= 3 ? "text-orange-600" : "text-slate-600"
          }`}>{schedule.weekGames}G</span>
        )}

        {/* Acquisition badge */}
        {player.acquisitionType && player.acquisitionType !== "DRAFT" && (
          <span className="shrink-0 text-[9px] font-bold text-violet-600/60">
            {player.acquisitionType === "ADD" ? "FA" : player.acquisitionType}
          </span>
        )}

        {/* Injury */}
        {isInjured && (
          <span className={`shrink-0 text-[10px] font-bold ${player.injuryColor}`}>
            {player.injuryLabel}
          </span>
        )}
      </div>
      {/* Injury note */}
      {isInjured && player.injuryNote && (
        <div className="ml-9 mt-0.5 text-[10px] text-slate-500">{player.injuryNote}</div>
      )}
    </div>
  );
}

function EspnSetupCard() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-surface px-8 py-10 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-orange-600/60">Setup Required</div>
      <div className="mt-3 text-xl font-bold text-gray-900">Connect ESPN Credentials</div>
      <div className="mt-3 text-[13px] text-slate-500">
        The Roster view pulls live data from your private ESPN league. Add these environment variables to Vercel.
      </div>
      <div className="mt-5 rounded-lg border border-border bg-background px-4 py-4 text-left text-[12px]">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
          Vercel → Settings → Environment Variables
        </div>
        <div className="space-y-2 font-mono">
          <div><span className="text-orange-600">ESPN_S2</span> <span className="text-slate-600">=</span> <span className="text-slate-500">AE...</span></div>
          <div><span className="text-orange-600">ESPN_SWID</span> <span className="text-slate-600">=</span> <span className="text-slate-500">{"{XXXX-...}"}</span></div>
          <div><span className="text-orange-600">MY_ESPN_TEAM_ID</span> <span className="text-slate-600">=</span> <span className="text-slate-500">9</span></div>
        </div>
      </div>
    </div>
  );
}

export default function RosterPage() {
  const [teams, setTeams] = useState<EspnTeam[]>([]);
  const [schedule, setSchedule] = useState<Record<string, TeamSchedule>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/espn/roster")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); setLoading(false); return; }
        setTeams(data);

        // Fetch MLB schedule for the current week
        const today = new Date().toISOString().slice(0, 10);
        const end = new Date();
        end.setDate(end.getDate() + 6);
        const endDate = end.toISOString().slice(0, 10);
        return fetch(`/api/mlb/schedule?startDate=${today}&endDate=${endDate}`)
          .then((r) => r.json())
          .then((s) => { if (!s.error) setSchedule(s); });
      })
      .catch(() => setError("FETCH_FAILED"))
      .finally(() => setLoading(false));
  }, []);

  // Determine my team — use MY_ESPN_TEAM_ID from the matchup endpoint or first team
  const myTeam = useMemo(() => {
    if (teams.length === 0) return null;
    // Try to get MY_ESPN_TEAM_ID from matchup endpoint
    const stored = typeof window !== "undefined" ? localStorage.getItem(MY_TEAM_ID_KEY) : null;
    if (stored) {
      const found = teams.find((t) => t.id === parseInt(stored));
      if (found) return found;
    }
    // Fetch from matchup to get the ID
    return null;
  }, [teams]);

  const [resolvedTeam, setResolvedTeam] = useState<EspnTeam | null>(null);

  useEffect(() => {
    if (myTeam) {
      setResolvedTeam(myTeam);
      return;
    }
    if (teams.length === 0) return;

    // Resolve from matchup API
    fetch("/api/espn/matchup")
      .then((r) => r.json())
      .then((d) => {
        if (d.myTeamId) {
          localStorage.setItem(MY_TEAM_ID_KEY, String(d.myTeamId));
          const found = teams.find((t) => t.id === d.myTeamId);
          if (found) { setResolvedTeam(found); return; }
        }
        // Fallback to first team
        setResolvedTeam(teams[0]);
      })
      .catch(() => setResolvedTeam(teams[0]));
  }, [myTeam, teams]);

  const roster = resolvedTeam?.roster ?? [];
  const batters = useMemo(() => roster.filter((p) => BATTER_SLOT_IDS.has(p.slotId)).sort((a, b) => a.slotId - b.slotId), [roster]);
  const pitchers = useMemo(() => roster.filter((p) => PITCHER_SLOT_IDS.has(p.slotId)).sort((a, b) => a.slotId - b.slotId), [roster]);
  const bench = useMemo(() => roster.filter((p) => p.slotId === BENCH_SLOT_ID), [roster]);
  const il = useMemo(() => roster.filter((p) => isOnIL(p.injuryStatus)), [roster]);

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading roster...</div>;
  if (error === "ESPN_CREDS_MISSING") {
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnSetupCard /></div>;
  }
  if (error || !resolvedTeam) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load roster</div>
        <div className="text-[12px] text-slate-600">{error}</div>
      </div>
    );
  }

  const Section = ({ label, players, borderColor = "border-border" }: { label: string; players: RosterPlayer[]; borderColor?: string }) => (
    <div className={`rounded-lg border ${borderColor} bg-surface`}>
      <div className={`border-b ${borderColor} px-3 py-2 flex items-center justify-between`}>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">{label}</span>
        <span className="text-[10px] tabular-nums text-slate-400">{players.length}</span>
      </div>
      {players.map((p, i) => (
        <PlayerRow key={i} player={p} schedule={schedule[p.proTeam] ?? null} />
      ))}
      {players.length === 0 && (
        <div className="px-3 py-3 text-[11px] text-slate-400">-</div>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{resolvedTeam.name}</h1>
          <span className="text-[12px] tabular-nums text-slate-500">
            {resolvedTeam.wins}-{resolvedTeam.losses}{resolvedTeam.ties > 0 ? `-${resolvedTeam.ties}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {/* Roster counts */}
          <div className="flex gap-2 text-[10px]">
            <span className="rounded bg-surface px-2 py-1 border border-border">
              <span className="text-slate-500">BAT</span>{" "}
              <span className="font-bold text-slate-700">{batters.length}</span>
            </span>
            <span className="rounded bg-surface px-2 py-1 border border-border">
              <span className="text-slate-500">PIT</span>{" "}
              <span className="font-bold text-slate-700">{pitchers.length}</span>
            </span>
            <span className="rounded bg-surface px-2 py-1 border border-border">
              <span className="text-slate-500">BN</span>{" "}
              <span className="font-bold text-slate-700">{bench.length}</span>
            </span>
            {il.length > 0 && (
              <span className="rounded bg-red-50 px-2 py-1 border border-red-200">
                <span className="text-red-600">IL</span>{" "}
                <span className="font-bold text-red-600">{il.length}</span>
              </span>
            )}
          </div>
          {/* Legend */}
          <div className="text-[10px] text-slate-400">
            <span className="text-emerald-600">5G+</span>
            <span className="mx-1">/</span>
            <span className="text-orange-600">3-4G</span>
            <span className="mx-1">/</span>
            <span className="text-slate-600">&le;2G</span>
          </div>
        </div>
      </div>

      {/* Roster grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Section label="Batting" players={batters} borderColor="border-orange-300" />
        <Section label="Pitching" players={pitchers} />
        <div className="space-y-4">
          <Section label="Bench" players={bench} />
          {il.length > 0 && (
            <Section label="Injured List" players={il} borderColor="border-red-300" />
          )}
        </div>
      </div>

      {/* IL details — only show players with actual injuries */}
      {il.filter((p) => p.injuryStatus !== "ACTIVE").length > 0 && (
        <div className="mt-4 rounded-lg border border-red-300 bg-surface">
          <div className="border-b border-red-300 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-red-600/70">
            Injury Details
          </div>
          <div className="divide-y divide-border">
            {il.filter((p) => p.injuryStatus !== "ACTIVE").map((p, i) => (
              <div key={i} className="flex items-start gap-3 px-3 py-2">
                <span className={`shrink-0 text-[11px] font-bold ${p.injuryColor}`}>{p.injuryLabel}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] text-slate-700">{p.name}</div>
                  {p.injuryNote && <div className="mt-0.5 text-[11px] text-slate-500">{p.injuryNote}</div>}
                </div>
                <span className="shrink-0 text-[10px] text-slate-500">{p.proTeam}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
