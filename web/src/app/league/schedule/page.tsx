"use client";

import { useState, useEffect, useRef } from "react";

interface MatchupWeek {
  period: number;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  myOpponentId: number | null;
  myOpponentName: string | null;
}

interface ScheduleData {
  myTeamId: number;
  currentMatchupPeriod: number;
  seasonStart: string;
  weeks: MatchupWeek[];
}

interface TeamRankInfo {
  powerRank: number;
  compositeAvgRank: number;
}

function difficultyLabel(rank: number): { label: string; color: string } {
  if (rank <= 2) return { label: "Hard", color: "text-red-600 bg-red-50 border-red-200" };
  if (rank <= 4) return { label: "Tough", color: "text-orange-600 bg-orange-50 border-orange-200" };
  if (rank <= 7) return { label: "Even", color: "text-slate-500 bg-slate-50 border-slate-200" };
  return { label: "Easy", color: "text-emerald-600 bg-emerald-50 border-emerald-200" };
}

function fmtDateRange(start: string, end: string): string {
  const s = new Date(start + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const e = new Date(end + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${s} – ${e}`;
}

function fmtDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function EspnSetupCard() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-surface px-8 py-10 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-orange-600/60">Setup Required</div>
      <div className="mt-3 text-xl font-bold text-gray-900">Connect ESPN Credentials</div>
    </div>
  );
}

export default function SchedulePage() {
  const [data, setData] = useState<ScheduleData | null>(null);
  const [teamRanks, setTeamRanks] = useState<Record<number, TeamRankInfo>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const currentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/espn/schedule").then(r => r.json()),
      fetch("/api/espn/league-stats?scope=season").then(r => r.json()).catch(() => null),
    ]).then(([schedData, leagueData]) => {
      if (schedData.error) { setError(schedData.error); return; }
      setData(schedData);
      if (leagueData?.teams) {
        const ranks: Record<number, TeamRankInfo> = {};
        for (const t of leagueData.teams) {
          ranks[t.teamId] = { powerRank: t.powerRank, compositeAvgRank: t.compositeAvgRank };
        }
        setTeamRanks(ranks);
      }
    })
    .catch(() => setError("FETCH_FAILED"))
    .finally(() => setLoading(false));
  }, []);

  // Auto-scroll to current week
  useEffect(() => {
    if (data && currentRef.current) {
      currentRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [data]);

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading schedule...</div>;
  if (error === "ESPN_CREDS_MISSING" || error === "MY_ESPN_TEAM_ID_MISSING") {
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnSetupCard /></div>;
  }
  if (error || !data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load schedule</div>
        <div className="text-[12px] text-slate-500">{error}</div>
      </div>
    );
  }

  // Split into past, current, future
  const pastWeeks = data.weeks.filter((w) => w.period < data.currentMatchupPeriod);
  const currentWeek = data.weeks.find((w) => w.isCurrent);
  const futureWeeks = data.weeks.filter((w) => w.period > data.currentMatchupPeriod);
  const totalWeeks = data.weeks.length;
  const weeksCompleted = pastWeeks.length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Season Schedule</h1>
          <span className="text-[12px] text-slate-500">
            Week {data.currentMatchupPeriod} of {totalWeeks} — {totalWeeks - weeksCompleted} weeks remaining
          </span>
        </div>
      </div>

      <div className="space-y-1">
        {data.weeks.map((week) => {
          const isPast = week.period < data.currentMatchupPeriod;
          const isCurrent = week.isCurrent;

          return (
            <div
              key={week.period}
              ref={isCurrent ? currentRef : undefined}
              className={`rounded-lg border px-4 py-3 flex items-center justify-between ${
                isCurrent
                  ? "border-orange-300 bg-orange-50"
                  : isPast
                  ? "border-border bg-surface/50 opacity-60"
                  : "border-border bg-surface"
              }`}
            >
              <div className="flex items-center gap-4">
                <span className={`text-[13px] font-bold tabular-nums w-16 ${
                  isCurrent ? "text-orange-600" : "text-slate-500"
                }`}>
                  Week {week.period}
                </span>
                <span className={`text-[12px] ${isCurrent ? "text-orange-700" : "text-slate-600"}`}>
                  {fmtDateRange(week.startDate, week.endDate)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {week.myOpponentName ? (
                  <>
                    <span className={`text-[13px] font-medium ${isCurrent ? "text-orange-700" : "text-slate-700"}`}>
                      vs {week.myOpponentName}
                    </span>
                    {week.myOpponentId && teamRanks[week.myOpponentId] && (
                      <span className={`text-[9px] font-bold border rounded px-1.5 py-0.5 ${difficultyLabel(teamRanks[week.myOpponentId].powerRank).color}`}>
                        #{teamRanks[week.myOpponentId].powerRank} {difficultyLabel(teamRanks[week.myOpponentId].powerRank).label}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[12px] text-slate-400">TBD</span>
                )}
                {isCurrent && (
                  <span className="text-[9px] font-bold uppercase text-orange-600 border border-orange-300 rounded px-1.5 py-0.5">
                    NOW
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
