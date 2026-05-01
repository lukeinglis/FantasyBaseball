"use client";

import { useState, useEffect, useRef } from "react";
import { mean, stddev } from "@/lib/z-scores";

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

const CATS = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG", "K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"] as const;
const LOWER_IS_BETTER_CATS = new Set(["ERA", "WHIP", "L"]);

export function buildZScoreMap(
  teams: Array<{ teamId: number; categories: Record<string, number> }>,
  averages: Record<string, number>,
): Record<number, Record<string, number>> {
  const zMap: Record<number, Record<string, number>> = {};
  for (const cat of CATS) {
    const vals = teams.map((t) => t.categories[cat] ?? 0);
    const mu = averages[cat] ?? mean(vals);
    const sd = stddev(vals, mu);
    for (const team of teams) {
      if (!zMap[team.teamId]) zMap[team.teamId] = {};
      const raw = ((team.categories[cat] ?? 0) - mu) / sd;
      zMap[team.teamId][cat] = LOWER_IS_BETTER_CATS.has(cat) ? -raw : raw;
    }
  }
  return zMap;
}

export function computeMatchupStrength(
  myZ: Record<string, number>,
  oppZ: Record<string, number>,
): { score: number; topCategories: string[] } {
  const diffs = CATS.map((cat) => ({
    cat,
    diff: (oppZ[cat] ?? 0) - (myZ[cat] ?? 0),
  }));
  const score = mean(diffs.map((d) => d.diff));
  const topCategories = [...diffs]
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 2)
    .map((d) => d.cat);
  return { score, topCategories };
}

function strengthStyle(score: number): { label: string; color: string } {
  if (score < -0.3) return { label: "Favorable", color: "text-emerald-600 bg-emerald-50 border-emerald-200" };
  if (score > 0.3) return { label: "Tough", color: "text-red-600 bg-red-50 border-red-200" };
  return { label: "Even", color: "text-yellow-600 bg-yellow-50 border-yellow-200" };
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
  const [zScoreMap, setZScoreMap] = useState<Record<number, Record<string, number>>>({});
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
        if (leagueData.averages) {
          setZScoreMap(buildZScoreMap(leagueData.teams, leagueData.averages));
        }
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

          const myZ = zScoreMap[data.myTeamId];
          const oppZ = week.myOpponentId != null ? zScoreMap[week.myOpponentId] : undefined;
          const strength = myZ && oppZ ? computeMatchupStrength(myZ, oppZ) : null;
          const style = strength ? strengthStyle(strength.score) : null;

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
                    {strength && style && (
                      <span
                        title={`Top factors: ${strength.topCategories.join(", ")}`}
                        className={`text-[9px] font-bold border rounded px-1.5 py-0.5 cursor-help ${style.color}`}
                      >
                        {style.label}
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
