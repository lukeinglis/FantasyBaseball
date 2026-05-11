"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { DataFreshness } from "@/components/DataFreshness";
import { EspnAuthRequired } from "@/components/EspnAuthRequired";


interface MatchupPlayer {
  name: string;
  pos: string;
  slotLabel: string;
  slotId: number;
  injuryStatus: string;
  injuryLabel: string;
  injuryColor: string;
  proTeam: string;
  stats: Record<string, number>;
}

interface MatchupData {
  scoringPeriodId: number;
  matchupStartDate: string | null;
  matchupEndDate: string | null;
  myTeamId: number;
  myTeamName: string;
  oppTeamId: number;
  oppTeamName: string;
  myRoster: MatchupPlayer[];
  oppRoster: MatchupPlayer[];
}

// Schedule grid: date -> team -> opponent string
type ScheduleGrid = Record<string, Record<string, string>>;

const IL_STATUSES = new Set(["SEVEN_DAY_DL", "TEN_DAY_DL", "FIFTEEN_DAY_DL", "SIXTY_DAY_DL", "OUT"]);

const BATTER_SLOT_IDS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 12]);
const BENCH_SLOT_ID = 16;

// Slot display order for batters
const SLOT_ORDER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 12, 16];
const SLOT_LABELS: Record<number, string> = {
  0: "C", 1: "1B", 2: "2B", 3: "3B", 4: "SS",
  5: "OF", 6: "OF", 7: "OF", 8: "UTIL", 12: "UTIL", 16: "BN",
};

function getDaysInRange(start: string, end: string): string[] {
  const days: string[] = [];
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function dayLabel(date: string): string {
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
}

function dayNum(date: string): string {
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", { day: "numeric" });
}

function isToday(date: string): boolean {
  return date === new Date().toISOString().slice(0, 10);
}

function RosterGrid({ teamName, roster, days, grid, isMine }: {
  teamName: string;
  roster: MatchupPlayer[];
  days: string[];
  grid: ScheduleGrid;
  isMine: boolean;
}) {
  // Sort roster: active batters by slot, then bench
  const batters = roster
    .filter((p) => BATTER_SLOT_IDS.has(p.slotId) || p.slotId === BENCH_SLOT_ID)
    .filter((p) => !IL_STATUSES.has(p.injuryStatus) || p.slotId !== BENCH_SLOT_ID)
    .sort((a, b) => {
      const aIdx = SLOT_ORDER.indexOf(a.slotId);
      const bIdx = SLOT_ORDER.indexOf(b.slotId);
      return (aIdx >= 0 ? aIdx : 99) - (bIdx >= 0 ? bIdx : 99);
    });

  // Count player-games per day
  const playerGamesPerDay: Record<string, number> = {};
  let totalPlayerGames = 0;
  for (const day of days) {
    let count = 0;
    for (const p of batters) {
      if (IL_STATUSES.has(p.injuryStatus)) continue;
      const teamSched = grid[day]?.[p.proTeam];
      if (teamSched) count++;
    }
    playerGamesPerDay[day] = count;
    totalPlayerGames += count;
  }

  const borderColor = isMine ? "border-orange-300" : "border-border";
  const headerColor = isMine ? "text-orange-600" : "text-slate-600";

  return (
    <div className={`rounded-lg border ${borderColor} bg-surface overflow-x-auto flex-1 min-w-0`}>
      <div className={`border-b ${borderColor} px-3 py-2 flex items-center justify-between`}>
        <span className={`text-[12px] font-semibold ${headerColor}`}>{teamName}</span>
        <span className="text-[10px] text-slate-400 tabular-nums">{totalPlayerGames} player-games</span>
      </div>
      <table className="w-full text-[10px]">
        <thead>
          <tr className="border-b border-border bg-black/[0.02]">
            <th className="px-2 py-1 text-left font-semibold text-slate-500 w-6">Pos</th>
            <th className="px-2 py-1 text-left font-semibold text-slate-500 w-28">Player</th>
            <th className="px-1 py-1 text-left font-semibold text-slate-500 w-8">Tm</th>
            {days.map((day) => (
              <th key={day} className={`px-1 py-1 text-center font-semibold w-12 ${
                isToday(day) ? "bg-orange-50 text-orange-600" : "text-slate-500"
              }`}>
                <div>{dayLabel(day)}</div>
                <div className="text-[8px] font-normal">{dayNum(day)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {batters.map((p, i) => {
            const isIL = IL_STATUSES.has(p.injuryStatus);
            const isBench = p.slotId === BENCH_SLOT_ID;
            return (
              <tr key={i} className={`border-b border-border ${isBench ? "bg-black/[0.02]" : ""} ${isIL ? "opacity-40" : ""}`}>
                <td className="px-2 py-1 font-bold text-slate-500">{SLOT_LABELS[p.slotId] ?? p.slotLabel}</td>
                <td className="px-2 py-1 truncate max-w-[110px]">
                  <span className="text-slate-700">{p.name}</span>
                  {isIL && (
                    <span className={`ml-1 text-[8px] font-bold ${p.injuryColor}`}>{p.injuryLabel}</span>
                  )}
                </td>
                <td className="px-1 py-1 text-slate-500">{p.proTeam}</td>
                {days.map((day) => {
                  const opp = grid[day]?.[p.proTeam];
                  const hasGame = !!opp;
                  return (
                    <td key={day} className={`px-1 py-1 text-center font-mono tabular-nums ${
                      isToday(day) ? "bg-orange-50/50" : ""
                    } ${
                      isIL ? "text-red-400" :
                      hasGame ? "text-emerald-700 bg-emerald-50/50" :
                      "text-slate-300"
                    }`}>
                      {isIL ? "IL" : hasGame ? opp : "—"}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {/* Player-games row */}
          <tr className="bg-black/[0.04] font-bold">
            <td colSpan={3} className="px-2 py-1 text-[9px] text-slate-500 uppercase">Active</td>
            {days.map((day) => (
              <td key={day} className={`px-1 py-1 text-center tabular-nums ${
                isToday(day) ? "bg-orange-50" : ""
              } text-slate-600`}>
                {playerGamesPerDay[day]}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function RosterSchedulePage() {
  const [matchup, setMatchup] = useState<MatchupData | null>(null);
  const [grid, setGrid] = useState<ScheduleGrid>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch("/api/espn/matchup")
      .then((r) => r.json())
      .then((d: MatchupData & { error?: string }) => {
        if (d.error) { setError(d.error); return; }
        setMatchup(d);

        const startDate = d.matchupStartDate ?? new Date().toISOString().slice(0, 10);
        const endDate = d.matchupEndDate ?? (() => {
          const e = new Date(); e.setDate(e.getDate() + 7); return e.toISOString().slice(0, 10);
        })();
        return fetch(`/api/mlb/schedule-grid?startDate=${startDate}&endDate=${endDate}`)
          .then((r) => r.json())
          .then((g) => {
            if (!g.error) setGrid(g);
          });
      })
      .catch(() => setError("FETCH_FAILED"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/espn/matchup")
      .then((r) => r.json())
      .then((d: MatchupData & { error?: string }) => {
        if (d.error) { setError(d.error); return; }
        setMatchup(d);

        const startDate = d.matchupStartDate ?? new Date().toISOString().slice(0, 10);
        const endDate = d.matchupEndDate ?? (() => {
          const e = new Date(); e.setDate(e.getDate() + 7); return e.toISOString().slice(0, 10);
        })();
        return fetch(`/api/mlb/schedule-grid?startDate=${startDate}&endDate=${endDate}`)
          .then((r) => r.json())
          .then((g) => {
            if (!g.error) setGrid(g);
          });
      })
      .catch(() => setError("FETCH_FAILED"))
      .finally(() => setLoading(false));
  }, []);

  const days = useMemo(() => {
    if (!matchup?.matchupStartDate || !matchup?.matchupEndDate) return [];
    return getDaysInRange(matchup.matchupStartDate, matchup.matchupEndDate);
  }, [matchup]);

  // Compute advantage days (where opponent has more active players)
  const advantageDays = useMemo(() => {
    if (!matchup || days.length === 0) return {};
    const result: Record<string, "us" | "them" | "even"> = {};
    for (const day of days) {
      let myActive = 0;
      let oppActive = 0;
      for (const p of matchup.myRoster) {
        if (IL_STATUSES.has(p.injuryStatus)) continue;
        if (!BATTER_SLOT_IDS.has(p.slotId) && p.slotId !== BENCH_SLOT_ID) continue;
        if (grid[day]?.[p.proTeam]) myActive++;
      }
      for (const p of matchup.oppRoster) {
        if (IL_STATUSES.has(p.injuryStatus)) continue;
        if (!BATTER_SLOT_IDS.has(p.slotId) && p.slotId !== BENCH_SLOT_ID) continue;
        if (grid[day]?.[p.proTeam]) oppActive++;
      }
      result[day] = myActive > oppActive ? "us" : oppActive > myActive ? "them" : "even";
    }
    return result;
  }, [matchup, days, grid]);

  const fmtDateRange = (start: string, end: string): string => {
    const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${fmt(start)} to ${fmt(end)}`;
  };

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading roster schedule...</div>;
  if (error === "ESPN_CREDS_MISSING" || error === "MY_ESPN_TEAM_ID_MISSING") {
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnAuthRequired /></div>;
  }
  if (error || !matchup) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load roster schedule</div>
        <div className="text-[12px] text-slate-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-600">
            Week {matchup.scoringPeriodId} Roster Schedule
          </span>
          <DataFreshness onRefresh={fetchData} loading={loading} />
        </div>
        {matchup.matchupStartDate && matchup.matchupEndDate && (
          <div className="mt-1 text-[11px] text-slate-400">
            {fmtDateRange(matchup.matchupStartDate, matchup.matchupEndDate)}
          </div>
        )}
      </div>

      {/* Advantage indicator */}
      {days.length > 0 && (
        <div className="mb-4 rounded-lg border border-border bg-surface px-4 py-2">
          <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Daily Advantage</div>
          <div className="flex gap-1">
            {days.map((day) => {
              const adv = advantageDays[day];
              return (
                <div key={day} className={`flex-1 text-center rounded py-1 ${
                  isToday(day) ? "ring-1 ring-orange-400" : ""
                } ${
                  adv === "us" ? "bg-emerald-100 text-emerald-700" :
                  adv === "them" ? "bg-red-100 text-red-700" :
                  "bg-slate-100 text-slate-500"
                }`}>
                  <div className="text-[9px] font-bold">{dayLabel(day)}</div>
                  <div className="text-[8px]">
                    {adv === "us" ? "+" : adv === "them" ? "-" : "="}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex gap-3 text-[8px] text-slate-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-200" /> More active players</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-200" /> Opponent advantage</span>
          </div>
        </div>
      )}

      {/* Side-by-side roster grids */}
      <div className="flex gap-4 flex-col lg:flex-row">
        <RosterGrid
          teamName={matchup.myTeamName}
          roster={matchup.myRoster}
          days={days}
          grid={grid}
          isMine={true}
        />
        <RosterGrid
          teamName={matchup.oppTeamName}
          roster={matchup.oppRoster}
          days={days}
          grid={grid}
          isMine={false}
        />
      </div>
    </div>
  );
}
