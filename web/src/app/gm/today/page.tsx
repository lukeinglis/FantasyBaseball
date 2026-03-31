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
  todayProbable: string | null;
  todayVenue: string | null;
  weekGames: number;
  isHome: boolean | null;
}

interface WeatherData {
  temp: number | null;
  condition: string | null;
  rainChance: number | null;
  icon: string;
}

const BATTER_SLOTS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 12]);
const PITCHER_SLOTS = new Set([13, 14, 15]);
const BENCH_SLOT = 16;


function weatherIcon(condition: string | null, rainChance: number | null): { icon: string; color: string; label: string } {
  if (rainChance !== null && rainChance >= 60) return { icon: "!", color: "text-red-600 bg-red-50 border-red-200", label: `${rainChance}% rain` };
  if (rainChance !== null && rainChance >= 30) return { icon: "~", color: "text-orange-600 bg-orange-50 border-orange-200", label: `${rainChance}% rain` };
  return { icon: "", color: "", label: "" };
}

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
    const endOfWeek = new Date();
    endOfWeek.setDate(endOfWeek.getDate() + 6);

    Promise.all([
      fetch("/api/espn/roster").then((r) => r.json()),
      fetch("/api/espn/matchup").then((r) => r.json()).catch(() => ({})),
      fetch(`/api/mlb/schedule?startDate=${today}&endDate=${endOfWeek.toISOString().slice(0, 10)}`).then((r) => r.json()).catch(() => ({})),
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
  const getGame = (p: RosterPlayer) => schedule[p.proTeam] ?? null;

  // Categorize all players
  const activeBatters = useMemo(() => roster.filter((p) => BATTER_SLOTS.has(p.slotId)), [roster]);
  const activePitchers = useMemo(() => roster.filter((p) => PITCHER_SLOTS.has(p.slotId)), [roster]);
  const benchPlayers = useMemo(() => roster.filter((p) => p.slotId === BENCH_SLOT), [roster]);
  const ilPlayers = useMemo(() => roster.filter((p) => isOnIL(p.injuryStatus)), [roster]);

  // Split by game status
  const allActive = useMemo(() => [...activeBatters, ...activePitchers], [activeBatters, activePitchers]);
  const playing = useMemo(() => allActive.filter((p) => getGame(p)?.todayOpponent), [allActive, schedule]);
  const off = useMemo(() => allActive.filter((p) => !getGame(p)?.todayOpponent), [allActive, schedule]);
  const benchWithGames = useMemo(() => benchPlayers.filter((p) => getGame(p)?.todayOpponent), [benchPlayers, schedule]);

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

  const GamePlayerRow = ({ player, showBenchAlert }: { player: RosterPlayer; showBenchAlert?: boolean }) => {
    const game = getGame(player);
    const hasGame = !!game?.todayOpponent;
    const isInjured = player.injuryStatus !== "ACTIVE";
    const isBatter = BATTER_SLOTS.has(player.slotId) || (player.slotId === BENCH_SLOT && !["SP", "RP"].includes(player.pos));

    return (
      <div className={`border-b border-border px-4 py-2.5 ${showBenchAlert ? "bg-orange-50" : ""}`}>
        <div className="flex items-center gap-3">
          {/* Slot + Name */}
          <span className="w-7 shrink-0 text-[10px] font-bold text-slate-500">{player.slotLabel}</span>
          <div className="min-w-0 w-[150px]">
            <span className={`text-[13px] font-medium ${isInjured ? "text-slate-400" : "text-slate-700"}`}>
              {player.name}
            </span>
            <div className="text-[10px] text-slate-500">{player.pos} · {player.proTeam}</div>
          </div>

          {/* Game details */}
          {hasGame ? (
            <div className="flex-1 flex items-center gap-4">
              {/* Opponent */}
              <div className="w-[70px] shrink-0">
                <span className="text-[13px] font-semibold text-slate-700">{game!.todayOpponent}</span>
              </div>

              {/* Time */}
              <div className="w-[65px] shrink-0">
                <span className="text-[12px] text-slate-600">{game!.todayTime}</span>
              </div>

              {/* Probable starter (opponent) — relevant for batters */}
              {isBatter && game!.todayProbable && (
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-slate-400">vs </span>
                  <span className="text-[11px] text-slate-600">{game!.todayProbable}</span>
                </div>
              )}

              {/* Venue */}
              {game!.todayVenue && (
                <span className="hidden lg:block text-[10px] text-slate-400 shrink-0">{game!.todayVenue}</span>
              )}
            </div>
          ) : (
            <div className="flex-1">
              <span className="text-[11px] text-slate-400">No game</span>
            </div>
          )}

          {/* Games this week */}
          {game && (
            <span className={`shrink-0 text-[10px] tabular-nums font-semibold ${
              game.weekGames >= 5 ? "text-emerald-600" :
              game.weekGames >= 3 ? "text-orange-600" : "text-slate-500"
            }`}>{game.weekGames}G</span>
          )}

          {/* Injury */}
          {isInjured && (
            <span className={`shrink-0 text-[10px] font-bold ${player.injuryColor}`}>{player.injuryLabel}</span>
          )}

          {/* Bench alert */}
          {showBenchAlert && hasGame && (
            <span className="shrink-0 text-[9px] font-bold text-orange-600 border border-orange-300 rounded px-1.5 py-0.5">
              BENCH
            </span>
          )}
        </div>
      </div>
    );
  };

  // Sort playing players: batters first (by slot), then pitchers
  const playingBatters = playing.filter((p) => BATTER_SLOTS.has(p.slotId)).sort((a, b) => a.slotId - b.slotId);
  const playingPitchers = playing.filter((p) => PITCHER_SLOTS.has(p.slotId)).sort((a, b) => a.slotId - b.slotId);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Today&apos;s Games</h1>
          <span className="text-[12px] text-slate-500">{today}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className={`text-2xl font-bold tabular-nums ${playing.length > 0 ? "text-emerald-600" : "text-slate-400"}`}>
              {playing.length}
            </div>
            <div className="text-[9px] text-slate-500">PLAYING</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold tabular-nums text-slate-400">{off.length}</div>
            <div className="text-[9px] text-slate-500">OFF</div>
          </div>
          {benchWithGames.length > 0 && (
            <div className="text-center">
              <div className="text-2xl font-bold tabular-nums text-orange-600">{benchWithGames.length}</div>
              <div className="text-[9px] text-orange-600">BENCHED W/ GAME</div>
            </div>
          )}
        </div>
      </div>

      {/* Column headers */}
      {playing.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-1 text-[9px] uppercase tracking-wider text-slate-400">
          <span className="w-7 shrink-0">Slot</span>
          <span className="w-[150px]">Player</span>
          <div className="flex-1 flex items-center gap-4">
            <span className="w-[70px] shrink-0">Opp</span>
            <span className="w-[65px] shrink-0">Time</span>
            <span className="flex-1">vs Pitcher</span>
          </div>
          <span className="shrink-0">Wk</span>
        </div>
      )}

      <div className="space-y-4">
        {/* Batters playing */}
        {playingBatters.length > 0 && (
          <div className="rounded-lg border border-emerald-300 bg-surface">
            <div className="border-b border-emerald-300 px-4 py-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Batters Playing</span>
              <span className="text-[10px] tabular-nums text-emerald-600">{playingBatters.length}</span>
            </div>
            {playingBatters.map((p, i) => <GamePlayerRow key={i} player={p} />)}
          </div>
        )}

        {/* Pitchers playing */}
        {playingPitchers.length > 0 && (
          <div className="rounded-lg border border-emerald-300 bg-surface">
            <div className="border-b border-emerald-300 px-4 py-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Pitchers Playing</span>
              <span className="text-[10px] tabular-nums text-emerald-600">{playingPitchers.length}</span>
            </div>
            {playingPitchers.map((p, i) => <GamePlayerRow key={i} player={p} />)}
          </div>
        )}

        {/* Bench alert: players on bench who have games */}
        {benchWithGames.length > 0 && (
          <div className="rounded-lg border border-orange-300 bg-surface">
            <div className="border-b border-orange-300 px-4 py-2 flex items-center justify-between bg-orange-50">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-600">
                Benched — Has Game Today
              </span>
              <span className="text-[10px] tabular-nums text-orange-600">{benchWithGames.length}</span>
            </div>
            {benchWithGames.map((p, i) => <GamePlayerRow key={i} player={p} showBenchAlert />)}
          </div>
        )}

        {/* Off today */}
        {off.length > 0 && (
          <div className="rounded-lg border border-border bg-surface">
            <div className="border-b border-border px-4 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Off Today ({off.length})</span>
            </div>
            {off.map((p, i) => <GamePlayerRow key={i} player={p} />)}
          </div>
        )}

        {/* IL */}
        {ilPlayers.length > 0 && (
          <div className="rounded-lg border border-red-300 bg-surface">
            <div className="border-b border-red-300 px-4 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-red-600">Injured List ({ilPlayers.length})</span>
            </div>
            {ilPlayers.map((p, i) => <GamePlayerRow key={i} player={p} />)}
          </div>
        )}

        {playing.length === 0 && off.length === 0 && (
          <div className="rounded-lg border border-border bg-surface px-6 py-10 text-center text-slate-500">
            No roster data available.
          </div>
        )}
      </div>
    </div>
  );
}
