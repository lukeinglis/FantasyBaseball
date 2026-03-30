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
  injuryNote?: string;
  proTeam: string;
  acquisitionType: string;
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

interface ProbableStart {
  date: string;
  pitcherName: string;
  team: string;
  opponent: string;
  gameTime: string;
  isHome: boolean;
}

interface ProbablePitchersData {
  startDate: string;
  endDate: string;
  byPitcher: Record<string, ProbableStart[]>;
  allStarts: ProbableStart[];
}

const SP_SLOT_ID = 14;
const RP_SLOT_ID = 15;
const P_SLOT_ID = 17;
const BENCH_SLOT_ID = 16;
const IL_SLOT_ID = 12;

function fmtDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function fmtShortDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
}

function EspnSetupCard() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-surface px-8 py-10 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-amber-400/60">Setup Required</div>
      <div className="mt-3 text-xl font-bold text-white">Connect ESPN Credentials</div>
      <div className="mt-3 text-[13px] text-slate-400">
        Bullpen pulls live data from your private ESPN league.
      </div>
    </div>
  );
}

export default function BullpenPage() {
  const [teams, setTeams] = useState<EspnTeam[]>([]);
  const [schedule, setSchedule] = useState<Record<string, TeamSchedule>>({});
  const [probables, setProbables] = useState<ProbablePitchersData | null>(null);
  const [myTeamId, setMyTeamId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"SP" | "RP">("SP");

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const end = new Date();
    end.setDate(end.getDate() + 6);
    const endDate = end.toISOString().slice(0, 10);

    Promise.all([
      fetch("/api/espn/roster").then((r) => r.json()),
      fetch("/api/espn/matchup").then((r) => r.json()).catch(() => ({})),
      fetch(`/api/mlb/schedule?startDate=${today}&endDate=${endDate}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/mlb/probable-pitchers?startDate=${today}&endDate=${endDate}`).then((r) => r.json()).catch(() => null),
    ]).then(([rosterData, matchupData, scheduleData, probableData]) => {
      if (rosterData.error) { setError(rosterData.error); setLoading(false); return; }
      setTeams(rosterData);
      if (matchupData.myTeamId) setMyTeamId(matchupData.myTeamId);
      if (!scheduleData.error) setSchedule(scheduleData);
      if (probableData && !probableData.error) setProbables(probableData);
    })
    .catch(() => setError("FETCH_FAILED"))
    .finally(() => setLoading(false));
  }, []);

  const myTeam = useMemo(() => {
    if (!teams.length) return null;
    if (myTeamId) return teams.find((t) => t.id === myTeamId) ?? teams[0];
    return teams[0];
  }, [teams, myTeamId]);

  const pitchers = useMemo(() => {
    if (!myTeam) return [];
    return myTeam.roster.filter((p) =>
      [SP_SLOT_ID, RP_SLOT_ID, P_SLOT_ID].includes(p.slotId) ||
      (p.slotId === BENCH_SLOT_ID && (p.pos === "SP" || p.pos === "RP")) ||
      (p.slotId === IL_SLOT_ID && (p.pos === "SP" || p.pos === "RP"))
    );
  }, [myTeam]);

  const starters = useMemo(() => pitchers.filter((p) => p.pos === "SP"), [pitchers]);
  const relievers = useMemo(() => pitchers.filter((p) => p.pos === "RP"), [pitchers]);
  const shown = view === "SP" ? starters : relievers;

  // Match ESPN pitcher names to MLB probable pitcher data
  const pitcherStarts = useMemo(() => {
    if (!probables) return new Map<string, ProbableStart[]>();
    const map = new Map<string, ProbableStart[]>();

    for (const pitcher of pitchers) {
      // Try exact name match first
      if (probables.byPitcher[pitcher.name]) {
        map.set(pitcher.name, probables.byPitcher[pitcher.name]);
        continue;
      }
      // Try case-insensitive match
      const lowerName = pitcher.name.toLowerCase();
      for (const [probName, starts] of Object.entries(probables.byPitcher)) {
        if (probName.toLowerCase() === lowerName) {
          map.set(pitcher.name, starts);
          break;
        }
      }
      // Try last name + team match for edge cases (e.g. "Lance McCullers Jr." vs "Lance McCullers")
      if (!map.has(pitcher.name)) {
        const lastName = pitcher.name.split(" ").pop()?.replace(/[.,]|Jr|Sr|III|II$/g, "").trim().toLowerCase();
        if (lastName) {
          for (const [probName, starts] of Object.entries(probables.byPitcher)) {
            const probLast = probName.split(" ").pop()?.replace(/[.,]|Jr|Sr|III|II$/g, "").trim().toLowerCase();
            if (probLast === lastName && starts.some((s) => s.team === pitcher.proTeam)) {
              map.set(pitcher.name, starts);
              break;
            }
          }
        }
      }
    }
    return map;
  }, [probables, pitchers]);

  // Group by status
  const active = useMemo(() => shown.filter((p) => p.slotId !== IL_SLOT_ID && p.slotId !== BENCH_SLOT_ID && p.injuryStatus === "ACTIVE"), [shown]);
  const dtd = useMemo(() => shown.filter((p) => p.injuryStatus === "DAY_TO_DAY" && p.slotId !== IL_SLOT_ID), [shown]);
  const benched = useMemo(() => shown.filter((p) => p.slotId === BENCH_SLOT_ID && p.injuryStatus === "ACTIVE"), [shown]);
  const injured = useMemo(() => shown.filter((p) =>
    p.slotId === IL_SLOT_ID || ["SEVEN_DAY_DL", "FIFTEEN_DAY_DL", "SIXTY_DAY_DL", "OUT"].includes(p.injuryStatus)
  ), [shown]);

  // Starts summary
  const totalStarts = useMemo(() => {
    let count = 0;
    for (const p of starters) {
      if (p.slotId === IL_SLOT_ID) continue;
      count += pitcherStarts.get(p.name)?.length ?? 0;
    }
    return count;
  }, [starters, pitcherStarts]);

  const todayStarters = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return starters.filter((p) => {
      if (p.slotId === IL_SLOT_ID) return false;
      const starts = pitcherStarts.get(p.name);
      return starts?.some((s) => s.date === today);
    });
  }, [starters, pitcherStarts]);

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading bullpen...</div>;
  if (error === "ESPN_CREDS_MISSING") {
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnSetupCard /></div>;
  }
  if (error || !myTeam) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-400">Failed to load bullpen</div>
        <div className="text-[12px] text-slate-600">{error}</div>
      </div>
    );
  }

  const PitcherCard = ({ player }: { player: RosterPlayer }) => {
    const sched = schedule[player.proTeam];
    const starts = pitcherStarts.get(player.name) ?? [];
    const hasGame = !!sched?.todayOpponent;
    const isActive = player.slotId !== IL_SLOT_ID && player.slotId !== BENCH_SLOT_ID;
    const isInjured = player.injuryStatus !== "ACTIVE";
    const today = new Date().toISOString().slice(0, 10);
    const isStartingToday = starts.some((s) => s.date === today);

    return (
      <div className={`border-b border-border/30 px-3 py-2.5 ${!isActive ? "opacity-60" : ""}`}>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {isStartingToday && (
                <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400" title="Starting today" />
              )}
              <span className={`text-[13px] font-medium ${isInjured ? "text-slate-500" : "text-slate-100"}`}>
                {player.name}
              </span>
              {isInjured && (
                <span className={`text-[10px] font-bold ${player.injuryColor}`}>{player.injuryLabel}</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-slate-600">{player.proTeam}</span>
              <span className="text-[10px] text-slate-700">{player.slotLabel}</span>
              {player.acquisitionType && player.acquisitionType !== "DRAFT" && (
                <span className="text-[9px] font-bold text-violet-400/60">
                  {player.acquisitionType === "ADD" ? "FA" : player.acquisitionType}
                </span>
              )}
            </div>
          </div>

          {/* Today's game */}
          <div className="text-right shrink-0">
            {hasGame ? (
              <div>
                <div className="text-[11px] text-slate-300">{sched!.todayOpponent}</div>
                {sched!.todayTime && <div className="text-[10px] text-slate-600">{sched!.todayTime}</div>}
              </div>
            ) : (
              <span className="text-[10px] text-slate-700">Off today</span>
            )}
          </div>

          {/* Starts this week */}
          {player.pos === "SP" && (
            <div className={`shrink-0 text-center min-w-[32px] ${
              starts.length >= 2 ? "text-emerald-400" : starts.length === 1 ? "text-amber-400" : "text-slate-700"
            }`}>
              <div className="text-[14px] font-bold tabular-nums">{starts.length}</div>
              <div className="text-[8px] uppercase">
                {starts.length === 1 ? "start" : "starts"}
              </div>
            </div>
          )}

          {/* Team games this week */}
          {sched && (
            <span className={`shrink-0 text-[10px] tabular-nums font-semibold ${
              sched.weekGames >= 5 ? "text-emerald-400" :
              sched.weekGames >= 3 ? "text-amber-400" : "text-slate-600"
            }`}>{sched.weekGames}G</span>
          )}
        </div>

        {/* Upcoming starts detail */}
        {starts.length > 0 && player.pos === "SP" && (
          <div className="mt-1.5 flex flex-wrap gap-1.5 ml-3.5">
            {starts.map((s, i) => (
              <span key={i} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] ${
                s.date === today
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                  : "bg-white/[0.03] text-slate-400 border border-border/30"
              }`}>
                <span className="font-semibold">{fmtShortDate(s.date)}</span>
                <span className="text-slate-600">{s.opponent}</span>
                {s.date === today && s.gameTime && (
                  <span className="text-slate-500">{s.gameTime}</span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  const PitcherSection = ({ label, players, borderColor = "border-border" }: {
    label: string;
    players: RosterPlayer[];
    borderColor?: string;
  }) => {
    if (players.length === 0) return null;
    const sectionStarts = players.reduce((sum, p) => sum + (pitcherStarts.get(p.name)?.length ?? 0), 0);
    return (
      <div className={`rounded-lg border ${borderColor} bg-surface`}>
        <div className={`border-b ${borderColor} px-3 py-2 flex items-center justify-between`}>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">{label}</span>
          <div className="flex items-center gap-2">
            {view === "SP" && sectionStarts > 0 && (
              <span className="text-[10px] tabular-nums text-amber-400/70">{sectionStarts} starts</span>
            )}
            <span className="text-[10px] tabular-nums text-slate-700">{players.length}</span>
          </div>
        </div>
        {players.map((p, i) => <PitcherCard key={i} player={p} />)}
      </div>
    );
  };

  // Count pitchers with games today
  const pitchersWithGames = shown.filter((p) =>
    p.slotId !== IL_SLOT_ID && schedule[p.proTeam]?.todayOpponent
  ).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-white">Bullpen</h1>
          <span className="text-[12px] text-slate-500">
            {starters.length} SP · {relievers.length} RP
          </span>
        </div>
        <div className="flex items-center gap-4">
          {view === "SP" && probables && (
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className={`text-xl font-bold tabular-nums ${totalStarts >= 6 ? "text-emerald-400" : totalStarts >= 4 ? "text-amber-400" : "text-red-400"}`}>
                  {totalStarts}
                </div>
                <div className="text-[9px] text-slate-600">STARTS THIS WK</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold tabular-nums text-emerald-400">{todayStarters.length}</div>
                <div className="text-[9px] text-slate-600">TODAY</div>
              </div>
            </div>
          )}
          {view === "RP" && (
            <div className="text-center">
              <div className="text-xl font-bold tabular-nums text-emerald-400">{pitchersWithGames}</div>
              <div className="text-[9px] text-slate-600">ACTIVE TODAY</div>
            </div>
          )}
          <div className="flex gap-0.5 rounded bg-surface p-0.5">
            {(["SP", "RP"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`rounded px-4 py-1 text-[12px] font-bold transition-colors ${
                  view === v ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
                }`}>
                {v} ({v === "SP" ? starters.length : relievers.length})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Starting pitchers today callout */}
      {view === "SP" && todayStarters.length > 0 && (
        <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/70 mb-1.5">
            Starting Today
          </div>
          <div className="flex flex-wrap gap-3">
            {todayStarters.map((p) => {
              const starts = pitcherStarts.get(p.name) ?? [];
              const todayStart = starts.find((s) => s.date === new Date().toISOString().slice(0, 10));
              return (
                <div key={p.name} className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-emerald-300">{p.name}</span>
                  {todayStart && (
                    <>
                      <span className="text-[11px] text-slate-400">{todayStart.opponent}</span>
                      {todayStart.gameTime && <span className="text-[10px] text-slate-600">{todayStart.gameTime}</span>}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pitcher lists */}
      <div className="space-y-4">
        <PitcherSection label="Active" players={active} borderColor="border-emerald-500/20" />
        <PitcherSection label="Day-to-Day" players={dtd} borderColor="border-amber-500/20" />
        <PitcherSection label="Bench" players={benched} />
        <PitcherSection label="Injured List" players={injured} borderColor="border-red-500/20" />
      </div>

      {/* No probable data notice */}
      {!probables && view === "SP" && (
        <div className="mt-3 text-[11px] text-slate-700">
          Probable pitcher data unavailable. Start counts will appear once the MLB schedule is published.
        </div>
      )}

      {/* Injury details */}
      {injured.length > 0 && (
        <div className="mt-4 rounded-lg border border-red-500/20 bg-surface">
          <div className="border-b border-red-500/20 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-red-400/70">
            Injury Notes
          </div>
          <div className="divide-y divide-border/30">
            {injured.map((p, i) => (
              <div key={i} className="flex items-start gap-3 px-3 py-2">
                <span className={`shrink-0 text-[11px] font-bold ${p.injuryColor}`}>{p.injuryLabel}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] text-slate-200">{p.name}</div>
                  {p.injuryNote && <div className="mt-0.5 text-[11px] text-slate-500">{p.injuryNote}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
