"use client";

import { useState, useEffect, useMemo } from "react";

interface RosterPlayer {
  name: string;
  pos: string;
  slotLabel: string;
  slotId: number;
  injuryStatus: string;
  injuryLabel: string;
  injuryColor: string;
  proTeam: string;
}

interface EspnTeam {
  id: number;
  name: string;
  roster: RosterPlayer[];
}

interface TeamSchedule {
  todayOpponent: string | null;
  todayTime: string | null;
  weekGames: number;
}

const BATTER_SLOTS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8]);
const PITCHER_SLOTS = new Set([14, 15, 17]);
const BENCH_SLOT = 16;
const IL_SLOT = 12;

function EspnSetupCard() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-surface px-8 py-10 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-orange-600/60">Setup Required</div>
      <div className="mt-3 text-xl font-bold text-gray-900">Connect ESPN Credentials</div>
    </div>
  );
}

export default function TodayPage() {
  const [teams, setTeams] = useState<EspnTeam[]>([]);
  const [schedule, setSchedule] = useState<Record<string, TeamSchedule>>({});
  const [myTeamId, setMyTeamId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    Promise.all([
      fetch("/api/espn/roster").then((r) => r.json()),
      fetch("/api/espn/matchup").then((r) => r.json()).catch(() => ({})),
      fetch(`/api/mlb/schedule?startDate=${today}&endDate=${today}`).then((r) => r.json()).catch(() => ({})),
    ]).then(([rosterData, matchupData, schedData]) => {
      if (rosterData.error) { setError(rosterData.error); return; }
      setTeams(rosterData);
      if (matchupData.myTeamId) setMyTeamId(matchupData.myTeamId);
      if (!schedData.error) setSchedule(schedData);
    })
    .catch(() => setError("FETCH_FAILED"))
    .finally(() => setLoading(false));
  }, []);

  const myTeam = useMemo(() => {
    if (!teams.length) return null;
    if (myTeamId) return teams.find((t) => t.id === myTeamId) ?? teams[0];
    return teams[0];
  }, [teams, myTeamId]);

  const roster = myTeam?.roster ?? [];

  // Categorize players
  const activeBatters = useMemo(() => roster.filter((p) => BATTER_SLOTS.has(p.slotId)), [roster]);
  const activePitchers = useMemo(() => roster.filter((p) => PITCHER_SLOTS.has(p.slotId)), [roster]);
  const benchPlayers = useMemo(() => roster.filter((p) => p.slotId === BENCH_SLOT), [roster]);
  const ilPlayers = useMemo(() => roster.filter((p) => p.slotId === IL_SLOT), [roster]);

  // Split into playing / off
  const getGame = (p: RosterPlayer) => schedule[p.proTeam] ?? null;

  const battersPlaying = useMemo(() => activeBatters.filter((p) => getGame(p)?.todayOpponent), [activeBatters, schedule]);
  const battersOff = useMemo(() => activeBatters.filter((p) => !getGame(p)?.todayOpponent), [activeBatters, schedule]);
  const pitchersPlaying = useMemo(() => activePitchers.filter((p) => getGame(p)?.todayOpponent), [activePitchers, schedule]);
  const pitchersOff = useMemo(() => activePitchers.filter((p) => !getGame(p)?.todayOpponent), [activePitchers, schedule]);
  const benchPlaying = useMemo(() => benchPlayers.filter((p) => getGame(p)?.todayOpponent), [benchPlayers, schedule]);

  const totalActive = battersPlaying.length + pitchersPlaying.length;
  const totalOff = battersOff.length + pitchersOff.length;
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading today...</div>;
  if (error === "ESPN_CREDS_MISSING") {
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnSetupCard /></div>;
  }
  if (error || !myTeam) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load</div>
        <div className="text-[12px] text-slate-500">{error}</div>
      </div>
    );
  }

  const PlayerRow = ({ player }: { player: RosterPlayer }) => {
    const game = getGame(player);
    const hasGame = !!game?.todayOpponent;
    const isInjured = player.injuryStatus !== "ACTIVE";
    return (
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="w-7 shrink-0 text-[10px] font-bold text-slate-500">{player.slotLabel}</span>
        <span className={`min-w-0 flex-1 text-[13px] ${isInjured ? "text-slate-400" : "text-slate-700"}`}>{player.name}</span>
        <span className="text-[10px] text-slate-500 w-6">{player.pos}</span>
        <span className="text-[10px] text-slate-500 w-7">{player.proTeam}</span>
        {hasGame ? (
          <div className="text-right shrink-0 w-[100px]">
            <span className="text-[12px] font-medium text-slate-700">{game!.todayOpponent}</span>
            {game!.todayTime && <span className="ml-2 text-[11px] text-slate-500">{game!.todayTime}</span>}
          </div>
        ) : (
          <span className="text-[11px] text-slate-400 w-[100px] text-right">No game</span>
        )}
        {isInjured && (
          <span className={`shrink-0 text-[10px] font-bold ${player.injuryColor}`}>{player.injuryLabel}</span>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Today&apos;s Games</h1>
          <span className="text-[12px] text-slate-500">{today}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className={`text-2xl font-bold tabular-nums ${totalActive > 0 ? "text-emerald-600" : "text-slate-400"}`}>
              {totalActive}
            </div>
            <div className="text-[9px] text-slate-500">PLAYING</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold tabular-nums text-slate-400">{totalOff}</div>
            <div className="text-[9px] text-slate-500">OFF</div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Playing today */}
        {battersPlaying.length > 0 && (
          <div className="rounded-lg border border-emerald-300 bg-surface">
            <div className="border-b border-emerald-300 px-3 py-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Batters Playing</span>
              <span className="text-[10px] tabular-nums text-emerald-600">{battersPlaying.length}</span>
            </div>
            {battersPlaying.sort((a, b) => a.slotId - b.slotId).map((p, i) => <PlayerRow key={i} player={p} />)}
          </div>
        )}

        {pitchersPlaying.length > 0 && (
          <div className="rounded-lg border border-emerald-300 bg-surface">
            <div className="border-b border-emerald-300 px-3 py-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Pitchers Playing</span>
              <span className="text-[10px] tabular-nums text-emerald-600">{pitchersPlaying.length}</span>
            </div>
            {pitchersPlaying.sort((a, b) => a.slotId - b.slotId).map((p, i) => <PlayerRow key={i} player={p} />)}
          </div>
        )}

        {/* Bench players with games — alert: you have someone benched who could play */}
        {benchPlaying.length > 0 && (
          <div className="rounded-lg border border-orange-300 bg-orange-50">
            <div className="border-b border-orange-300 px-3 py-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-600">Bench — Has Game Today</span>
              <span className="text-[10px] tabular-nums text-orange-600">{benchPlaying.length}</span>
            </div>
            {benchPlaying.map((p, i) => <PlayerRow key={i} player={p} />)}
          </div>
        )}

        {/* Off today */}
        {(battersOff.length > 0 || pitchersOff.length > 0) && (
          <div className="rounded-lg border border-border bg-surface">
            <div className="border-b border-border px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Off Today</span>
            </div>
            {[...battersOff, ...pitchersOff].map((p, i) => <PlayerRow key={i} player={p} />)}
          </div>
        )}

        {/* IL */}
        {ilPlayers.length > 0 && (
          <div className="rounded-lg border border-red-300 bg-surface">
            <div className="border-b border-red-300 px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-red-600">Injured List</span>
            </div>
            {ilPlayers.map((p, i) => <PlayerRow key={i} player={p} />)}
          </div>
        )}

        {totalActive === 0 && totalOff === 0 && (
          <div className="rounded-lg border border-border bg-surface px-6 py-10 text-center text-slate-500">
            No roster data available.
          </div>
        )}
      </div>
    </div>
  );
}
