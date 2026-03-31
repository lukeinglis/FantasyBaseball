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
const P_SLOT_ID = 13;
const BENCH_SLOT_ID = 16;


function fmtDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function fmtShortDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
}

function EspnSetupCard() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-surface px-8 py-10 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-orange-600/60">Setup Required</div>
      <div className="mt-3 text-xl font-bold text-gray-900">Connect ESPN Credentials</div>
      <div className="mt-3 text-[13px] text-slate-500">
        Bullpen pulls live data from your private ESPN league.
      </div>
    </div>
  );
}

interface NextWeekData {
  nextDates: { start: string; end: string } | null;
  rosteredPitchers: string[];
}

function fmtDateLabel(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function fmtDateRange(start: string, end: string): string {
  const s = new Date(start + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const e = new Date(end + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${s} – ${e}`;
}

// Per-day schedule for the grid
interface DaySchedule {
  [team: string]: { opponent: string; time: string };
}

export default function BullpenPage() {
  const [teams, setTeams] = useState<EspnTeam[]>([]);
  const [schedule, setSchedule] = useState<Record<string, TeamSchedule>>({});
  const [probables, setProbables] = useState<ProbablePitchersData | null>(null);
  const [matchupProbables, setMatchupProbables] = useState<ProbablePitchersData | null>(null);
  const [nextProbables, setNextProbables] = useState<ProbablePitchersData | null>(null);
  const [nextWeekData, setNextWeekData] = useState<NextWeekData | null>(null);
  const [matchupDates, setMatchupDates] = useState<{ start: string; end: string } | null>(null);
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
      fetch("/api/espn/starts").then((r) => r.json()).catch(() => null),
    ]).then(([rosterData, matchupData, scheduleData, probableData, startsData]) => {
      if (rosterData.error) { setError(rosterData.error); setLoading(false); return; }
      setTeams(rosterData);
      if (matchupData.myTeamId) setMyTeamId(matchupData.myTeamId);
      if (!scheduleData.error) setSchedule(scheduleData);
      if (probableData && !probableData.error) setProbables(probableData);

      // Fetch probable pitchers for the full matchup period
      const mStart = matchupData.matchupStartDate;
      const mEnd = matchupData.matchupEndDate;
      if (mStart && mEnd) {
        setMatchupDates({ start: mStart, end: mEnd });
        fetch(`/api/mlb/probable-pitchers?startDate=${mStart}&endDate=${mEnd}`)
          .then((r) => r.json())
          .then((mp) => { if (mp && !mp.error) setMatchupProbables(mp); })
          .catch(() => {});
      }

      // Fetch next week's probable pitchers
      if (startsData && startsData.nextDates) {
        setNextWeekData({ nextDates: startsData.nextDates, rosteredPitchers: startsData.rosteredPitchers });
        fetch(`/api/mlb/probable-pitchers?startDate=${startsData.nextDates.start}&endDate=${startsData.nextDates.end}`)
          .then((r) => r.json())
          .then((np) => { if (np && !np.error) setNextProbables(np); })
          .catch(() => {});
      }
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
      (isOnIL(p.injuryStatus) && (p.pos === "SP" || p.pos === "RP"))
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
  const active = useMemo(() => shown.filter((p) => !isOnIL(p.injuryStatus) && p.slotId !== BENCH_SLOT_ID && p.injuryStatus === "ACTIVE"), [shown]);
  const dtd = useMemo(() => shown.filter((p) => p.injuryStatus === "DAY_TO_DAY" && !isOnIL(p.injuryStatus)), [shown]);
  const benched = useMemo(() => shown.filter((p) => p.slotId === BENCH_SLOT_ID && p.injuryStatus === "ACTIVE"), [shown]);
  const injured = useMemo(() => shown.filter((p) =>
    isOnIL(p.injuryStatus) || ["SEVEN_DAY_DL", "FIFTEEN_DAY_DL", "SIXTY_DAY_DL", "OUT"].includes(p.injuryStatus)
  ), [shown]);

  // Starts summary
  const totalStarts = useMemo(() => {
    let count = 0;
    for (const p of starters) {
      if (isOnIL(p.injuryStatus)) continue;
      count += pitcherStarts.get(p.name)?.length ?? 0;
    }
    return count;
  }, [starters, pitcherStarts]);

  const todayStarters = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return starters.filter((p) => {
      if (isOnIL(p.injuryStatus)) return false;
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
        <div className="text-red-600">Failed to load bullpen</div>
        <div className="text-[12px] text-slate-600">{error}</div>
      </div>
    );
  }

  const PitcherCard = ({ player }: { player: RosterPlayer }) => {
    const sched = schedule[player.proTeam];
    const starts = pitcherStarts.get(player.name) ?? [];
    const hasGame = !!sched?.todayOpponent;
    const isActive = !isOnIL(player.injuryStatus) && player.slotId !== BENCH_SLOT_ID;
    const isInjured = player.injuryStatus !== "ACTIVE";
    const today = new Date().toISOString().slice(0, 10);
    const isStartingToday = starts.some((s) => s.date === today);

    return (
      <div className={`border-b border-border px-3 py-2.5 ${!isActive ? "opacity-60" : ""}`}>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {isStartingToday && (
                <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400" title="Starting today" />
              )}
              <span className={`text-[13px] font-medium ${isInjured ? "text-slate-500" : "text-slate-800"}`}>
                {player.name}
              </span>
              {isInjured && (
                <span className={`text-[10px] font-bold ${player.injuryColor}`}>{player.injuryLabel}</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-slate-600">{player.proTeam}</span>
              <span className="text-[10px] text-slate-400">{player.slotLabel}</span>
              {player.acquisitionType && player.acquisitionType !== "DRAFT" && (
                <span className="text-[9px] font-bold text-violet-600/60">
                  {player.acquisitionType === "ADD" ? "FA" : player.acquisitionType}
                </span>
              )}
            </div>
          </div>

          {/* Today's game */}
          <div className="text-right shrink-0">
            {hasGame ? (
              <div>
                <div className="text-[11px] text-slate-600">{sched!.todayOpponent}</div>
                {sched!.todayTime && <div className="text-[10px] text-slate-600">{sched!.todayTime}</div>}
              </div>
            ) : (
              <span className="text-[10px] text-slate-400">Off today</span>
            )}
          </div>

          {/* Starts this week */}
          {player.pos === "SP" && (
            <div className={`shrink-0 text-center min-w-[32px] ${
              starts.length >= 2 ? "text-emerald-600" : starts.length === 1 ? "text-orange-600" : "text-slate-400"
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
              sched.weekGames >= 5 ? "text-emerald-600" :
              sched.weekGames >= 3 ? "text-orange-600" : "text-slate-600"
            }`}>{sched.weekGames}G</span>
          )}
        </div>

        {/* Upcoming starts detail */}
        {starts.length > 0 && player.pos === "SP" && (
          <div className="mt-1.5 flex flex-wrap gap-1.5 ml-3.5">
            {starts.map((s, i) => (
              <span key={i} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] ${
                s.date === today
                  ? "bg-emerald-100 text-emerald-600 border border-emerald-300"
                  : "bg-black/[0.03] text-slate-500 border border-border"
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
              <span className="text-[10px] tabular-nums text-orange-600/70">{sectionStarts} starts</span>
            )}
            <span className="text-[10px] tabular-nums text-slate-400">{players.length}</span>
          </div>
        </div>
        {players.map((p, i) => <PitcherCard key={i} player={p} />)}
      </div>
    );
  };

  // Count pitchers with games today
  const pitchersWithGames = shown.filter((p) =>
    !isOnIL(p.injuryStatus) && schedule[p.proTeam]?.todayOpponent
  ).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Bullpen</h1>
          <span className="text-[12px] text-slate-500">
            {starters.length} SP · {relievers.length} RP
          </span>
        </div>
        <div className="flex items-center gap-4">
          {view === "SP" && probables && (
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className={`text-xl font-bold tabular-nums ${totalStarts >= 6 ? "text-emerald-600" : totalStarts >= 4 ? "text-orange-600" : "text-red-600"}`}>
                  {totalStarts}
                </div>
                <div className="text-[9px] text-slate-600">STARTS THIS WK</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold tabular-nums text-emerald-600">{todayStarters.length}</div>
                <div className="text-[9px] text-slate-600">TODAY</div>
              </div>
            </div>
          )}
          {view === "RP" && (
            <div className="text-center">
              <div className="text-xl font-bold tabular-nums text-emerald-600">{pitchersWithGames}</div>
              <div className="text-[9px] text-slate-600">ACTIVE TODAY</div>
            </div>
          )}
          <div className="flex gap-0.5 rounded bg-surface p-0.5">
            {(["SP", "RP"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`rounded px-4 py-1 text-[12px] font-bold transition-colors ${
                  view === v ? "bg-black/10 text-gray-900" : "text-slate-500 hover:text-slate-700"
                }`}>
                {v} ({v === "SP" ? starters.length : relievers.length})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Starting pitchers today callout */}
      {view === "SP" && todayStarters.length > 0 && (
        <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600/70 mb-1.5">
            Starting Today
          </div>
          <div className="flex flex-wrap gap-3">
            {todayStarters.map((p) => {
              const starts = pitcherStarts.get(p.name) ?? [];
              const todayStart = starts.find((s) => s.date === new Date().toISOString().slice(0, 10));
              return (
                <div key={p.name} className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-emerald-600">{p.name}</span>
                  {todayStart && (
                    <>
                      <span className="text-[11px] text-slate-500">{todayStart.opponent}</span>
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
        <PitcherSection label="Active" players={active} borderColor="border-emerald-300" />
        <PitcherSection label="Day-to-Day" players={dtd} borderColor="border-orange-300" />
        <PitcherSection label="Bench" players={benched} />
        <PitcherSection label="Injured List" players={injured} borderColor="border-red-300" />
      </div>

      {/* No probable data notice */}
      {!probables && view === "SP" && (
        <div className="mt-3 text-[11px] text-slate-400">
          Probable pitcher data unavailable. Start counts will appear once the MLB schedule is published.
        </div>
      )}

      {/* Injury details */}
      {injured.length > 0 && (
        <div className="mt-4 rounded-lg border border-red-300 bg-surface">
          <div className="border-b border-red-300 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-red-600/70">
            Injury Notes
          </div>
          <div className="divide-y divide-border">
            {injured.map((p, i) => (
              <div key={i} className="flex items-start gap-3 px-3 py-2">
                <span className={`shrink-0 text-[11px] font-bold ${p.injuryColor}`}>{p.injuryLabel}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] text-slate-700">{p.name}</div>
                  {p.injuryNote && <div className="mt-0.5 text-[11px] text-slate-500">{p.injuryNote}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pitcher Schedule Grid */}
      <PitcherScheduleGrid
        pitchers={starters}
        matchupProbables={matchupProbables}
        nextProbables={nextProbables}
        matchupDates={matchupDates}
        nextDates={nextWeekData?.nextDates ?? null}
      />

      {/* Next Week Starts — streaming targets */}
      <NextWeekStarts
        nextProbables={nextProbables}
        nextWeekData={nextWeekData}
        myPitchers={starters}
        pitcherStarts={pitcherStarts}
      />
    </div>
  );
}

// --- Pitcher Schedule Grid ---

function PitcherScheduleGrid({
  pitchers,
  matchupProbables,
  nextProbables,
  matchupDates,
  nextDates,
}: {
  pitchers: RosterPlayer[];
  matchupProbables: ProbablePitchersData | null;
  nextProbables: ProbablePitchersData | null;
  matchupDates: { start: string; end: string } | null;
  nextDates: { start: string; end: string } | null;
}) {
  // Generate dates for both periods
  function getDates(range: { start: string; end: string } | null): string[] {
    if (!range) return [];
    const result: string[] = [];
    const current = new Date(range.start + "T12:00:00");
    const end = new Date(range.end + "T12:00:00");
    while (current <= end) {
      result.push(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
    }
    return result;
  }

  const currentDates = useMemo(() => getDates(matchupDates), [matchupDates]);
  const nextWeekDates = useMemo(() => getDates(nextDates), [nextDates]);

  // Combine all probables from both periods
  const allProbables = useMemo(() => {
    const combined: ProbablePitchersData = {
      startDate: matchupProbables?.startDate ?? "",
      endDate: nextProbables?.endDate ?? matchupProbables?.endDate ?? "",
      byPitcher: { ...(matchupProbables?.byPitcher ?? {}) },
      allStarts: [...(matchupProbables?.allStarts ?? []), ...(nextProbables?.allStarts ?? [])],
    };
    // Merge next week's byPitcher
    if (nextProbables) {
      for (const [name, starts] of Object.entries(nextProbables.byPitcher)) {
        if (combined.byPitcher[name]) {
          combined.byPitcher[name] = [...combined.byPitcher[name], ...starts];
        } else {
          combined.byPitcher[name] = starts;
        }
      }
    }
    return combined;
  }, [matchupProbables, nextProbables]);

  // Build pitcher schedule from combined data
  const pitcherSchedule = useMemo(() => {
    const result = new Map<string, Map<string, ProbableStart>>();
    for (const pitcher of pitchers) {
      const starts = findPitcherStarts(pitcher.name, pitcher.proTeam, allProbables);
      if (starts.length > 0) {
        const dateMap = new Map<string, ProbableStart>();
        for (const s of starts) dateMap.set(s.date, s);
        result.set(pitcher.name, dateMap);
      }
    }
    return result;
  }, [pitchers, allProbables]);

  // Team games per day
  const teamGames = useMemo(() => {
    const result = new Map<string, Map<string, string>>();
    for (const start of allProbables.allStarts) {
      if (!result.has(start.team)) result.set(start.team, new Map());
      result.get(start.team)!.set(start.date, start.opponent);
    }
    return result;
  }, [allProbables]);

  const today = new Date().toISOString().slice(0, 10);
  const allDates = [...currentDates, ...nextWeekDates];
  const nextWeekStart = nextWeekDates[0] ?? null;

  if (allDates.length === 0 || pitchers.length === 0) return null;

  const activeSPs = pitchers.filter((p) => p.pos === "SP" && !isOnIL(p.injuryStatus));

  return (
    <div className="mt-6">
      <div className="mb-2">
        <h2 className="text-[14px] font-bold text-gray-900">Pitching Schedule</h2>
        <span className="text-[11px] text-slate-500">
          {matchupDates && fmtDateRange(matchupDates.start, matchupDates.end)}
          {nextDates && ` + ${fmtDateRange(nextDates.start, nextDates.end)}`}
        </span>
      </div>

      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-slate-500 sticky left-0 bg-surface min-w-[130px] z-10">
                Pitcher
              </th>
              {allDates.map((d, idx) => {
                const isToday = d === today;
                const isNextWeekBorder = d === nextWeekStart;
                const dayLabel = new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
                const dateLabel = new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
                const isNextWeek = nextWeekDates.includes(d);
                return (
                  <th key={d} className={`px-1 py-1.5 text-center min-w-[48px] ${
                    isToday ? "bg-orange-50" : isNextWeek ? "bg-blue-50/50" : ""
                  } ${isNextWeekBorder ? "border-l-2 border-orange-300" : ""}`}>
                    <div className={`text-[9px] font-bold ${
                      isToday ? "text-orange-600" : isNextWeek ? "text-blue-600" : "text-slate-400"
                    }`}>{dayLabel}</div>
                    <div className={`text-[8px] ${
                      isToday ? "text-orange-500" : isNextWeek ? "text-blue-500" : "text-slate-400"
                    }`}>{dateLabel}</div>
                  </th>
                );
              })}
              <th className="px-1 py-1.5 text-center text-[9px] font-semibold text-slate-500 min-w-[24px]">
                This
              </th>
              {nextWeekDates.length > 0 && (
                <th className="px-1 py-1.5 text-center text-[9px] font-semibold text-blue-500 min-w-[24px]">
                  Next
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {activeSPs.map((pitcher, i) => {
              const startDates = pitcherSchedule.get(pitcher.name);
              const thisWeekStarts = currentDates.filter((d) => startDates?.has(d)).length;
              const nextWeekStartCount = nextWeekDates.filter((d) => startDates?.has(d)).length;
              const teamDays = teamGames.get(pitcher.proTeam);

              return (
                <tr key={i} className={`border-b border-border last:border-b-0 ${i % 2 === 0 ? "" : "bg-surface/50"}`}>
                  <td className="px-2 py-1.5 sticky left-0 bg-inherit z-10">
                    <div className="text-[11px] font-medium text-slate-700">{pitcher.name}</div>
                    <div className="text-[9px] text-slate-400">{pitcher.proTeam}</div>
                  </td>
                  {allDates.map((d) => {
                    const isToday = d === today;
                    const isNextWeekBorder = d === nextWeekStart;
                    const isNextWeek = nextWeekDates.includes(d);
                    const start = startDates?.get(d);
                    const opponent = start?.opponent ?? teamDays?.get(d);
                    const isPast = d < today;

                    return (
                      <td key={d} className={`px-1 py-1.5 text-center ${
                        isToday ? "bg-orange-50" : isNextWeek ? "bg-blue-50/30" : ""
                      } ${isPast ? "opacity-40" : ""} ${isNextWeekBorder ? "border-l-2 border-orange-300" : ""}`}>
                        {start ? (
                          <div>
                            <span className="inline-block text-[8px] font-bold text-white bg-emerald-600 rounded px-1 py-0.5">
                              PP
                            </span>
                            <div className="text-[7px] text-slate-500 mt-0.5">{start.opponent}</div>
                          </div>
                        ) : opponent ? (
                          <span className="text-[8px] text-slate-400">{opponent}</span>
                        ) : (
                          <span className="text-[8px] text-slate-300">-</span>
                        )}
                      </td>
                    );
                  })}
                  <td className={`px-1 py-1.5 text-center font-bold tabular-nums ${
                    thisWeekStarts >= 2 ? "text-emerald-600" : thisWeekStarts === 1 ? "text-slate-600" : "text-slate-400"
                  }`}>
                    {thisWeekStarts}
                  </td>
                  {nextWeekDates.length > 0 && (
                    <td className={`px-1 py-1.5 text-center font-bold tabular-nums ${
                      nextWeekStartCount >= 2 ? "text-blue-600" : nextWeekStartCount === 1 ? "text-slate-600" : "text-slate-400"
                    }`}>
                      {nextWeekStartCount}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-1.5 flex items-center gap-3 text-[9px] text-slate-400">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-2 bg-emerald-600 rounded" /> PP = Probable Pitcher
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-2 bg-orange-100 border border-orange-200 rounded" /> Today
        </span>
        {nextWeekDates.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-2 bg-blue-50 border border-blue-200 rounded" /> Next matchup
          </span>
        )}
      </div>
    </div>
  );
}

// --- Next Week Starts Section ---

function NextWeekStarts({
  nextProbables,
  nextWeekData,
  myPitchers,
  pitcherStarts,
}: {
  nextProbables: ProbablePitchersData | null;
  nextWeekData: NextWeekData | null;
  myPitchers: RosterPlayer[];
  pitcherStarts: Map<string, ProbableStart[]>;
}) {
  // Find next-week starts for my SPs
  const myNextStarts = useMemo(() => {
    if (!nextProbables) return [];
    return myPitchers
      .filter((p) => p.pos === "SP")
      .map((p) => {
        const starts = findPitcherStarts(p.name, p.proTeam, nextProbables);
        return { name: p.name, proTeam: p.proTeam, starts, count: starts.length };
      })
      .sort((a, b) => b.count - a.count);
  }, [nextProbables, myPitchers]);

  // Free agent double starters
  const rosteredSet = useMemo(() => new Set(nextWeekData?.rosteredPitchers ?? []), [nextWeekData]);
  const faDoubleStarters = useMemo(() => {
    if (!nextProbables) return [];
    return Object.entries(nextProbables.byPitcher)
      .filter(([, starts]) => starts.length >= 2)
      .filter(([name]) => !rosteredSet.has(name))
      .map(([name, starts]) => ({ name, starts, team: starts[0]?.team ?? "" }))
      .sort((a, b) => b.starts.length - a.starts.length);
  }, [nextProbables, rosteredSet]);

  const myNextTotal = myNextStarts.reduce((s, p) => s + p.count, 0);
  const nextDates = nextWeekData?.nextDates;

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-bold text-gray-900">Next Week Starts</h2>
          {nextDates && (
            <span className="text-[11px] text-slate-500">{fmtDateRange(nextDates.start, nextDates.end)}</span>
          )}
        </div>
        {myNextTotal > 0 && (
          <span className="text-[14px] font-bold tabular-nums text-slate-700">{myNextTotal} starts</span>
        )}
      </div>

      {/* My SPs next week */}
      {myNextStarts.length > 0 && (
        <div className="mb-4 rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">My Starters</span>
          </div>
          {myNextStarts.map((p, i) => (
            <div key={i} className="border-b border-border px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[12px] font-medium ${p.count >= 2 ? "text-emerald-700" : "text-slate-700"}`}>
                    {p.name}
                  </span>
                  <span className="text-[10px] text-slate-500">{p.proTeam}</span>
                </div>
                <span className={`text-[13px] font-bold tabular-nums ${
                  p.count >= 2 ? "text-emerald-600" : p.count === 1 ? "text-slate-600" : "text-slate-400"
                }`}>{p.count}</span>
              </div>
              {p.starts.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.starts.map((s, j) => (
                    <span key={j} className="text-[9px] rounded px-1.5 py-0.5 bg-surface border border-border text-slate-600">
                      {fmtDateLabel(s.date)} {s.opponent}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Free Agent Double Starters */}
      <div className="rounded-lg border border-emerald-300 bg-surface">
        <div className="border-b border-emerald-300 px-3 py-2 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
              Streaming Targets
            </span>
            <span className="ml-2 text-[10px] text-slate-500">Free agent SPs with 2+ starts next week</span>
          </div>
          <span className="text-[13px] font-bold tabular-nums text-emerald-600">{faDoubleStarters.length}</span>
        </div>
        {faDoubleStarters.length > 0 ? (
          faDoubleStarters.map((fa, i) => (
            <div key={i} className="border-b border-border px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-emerald-700">{fa.name}</span>
                  <span className="text-[10px] text-slate-500">{fa.team}</span>
                </div>
                <span className="text-[13px] font-bold tabular-nums text-emerald-600">{fa.starts.length}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {fa.starts.map((s, j) => (
                  <span key={j} className="text-[9px] rounded px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700">
                    {fmtDateLabel(s.date)} {s.opponent}
                  </span>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="px-3 py-4 text-[11px] text-slate-500 text-center">
            {!nextProbables
              ? "Next week's probable pitchers not yet announced."
              : "No unrostered double starters found."}
          </div>
        )}
      </div>
    </div>
  );
}

// Name matching helper for probable pitchers
function findPitcherStarts(name: string, proTeam: string, probables: ProbablePitchersData): ProbableStart[] {
  if (probables.byPitcher[name]) return probables.byPitcher[name];
  const lower = name.toLowerCase();
  for (const [pName, starts] of Object.entries(probables.byPitcher)) {
    if (pName.toLowerCase() === lower) return starts;
  }
  const lastName = name.split(" ").pop()?.replace(/[.,]|Jr|Sr|III|II$/g, "").trim().toLowerCase();
  if (lastName) {
    for (const [pName, starts] of Object.entries(probables.byPitcher)) {
      const pLast = pName.split(" ").pop()?.replace(/[.,]|Jr|Sr|III|II$/g, "").trim().toLowerCase();
      if (pLast === lastName && starts.some((s) => s.team === proTeam)) return starts;
    }
  }
  return [];
}
