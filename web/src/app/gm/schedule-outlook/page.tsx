"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { mean, stddev } from "@/lib/z-scores";
import { CATEGORY_WEIGHTS } from "@/lib/category-weights";
import { EspnAuthRequired } from "@/components/EspnAuthRequired";
import { sanitizeNum, safeDivide } from "@/lib/sanitize";

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

interface StandingsTeam {
  teamId: number;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  pct: number;
  gamesBack: number;
  rank: number;
  playoffSeed: number;
}

interface StandingsData {
  currentMatchupPeriod: number;
  totalMatchupPeriods: number;
  myTeamId: number;
  teams: StandingsTeam[];
}

interface LeagueTeam {
  teamId: number;
  teamName: string;
  categories: Record<string, number>;
  ranks: Record<string, number>;
  powerRank: number;
  compositeAvgRank: number;
}

interface LeagueStatsData {
  myTeamId: number;
  teams: LeagueTeam[];
  averages: Record<string, number>;
}

const CATS = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG", "K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"] as const;
const LOWER_IS_BETTER_CATS = new Set(["ERA", "WHIP", "L"]);
const PLAYOFF_CUTOFF = 6;

function computeMatchupDifficulty(
  myZ: Record<string, number>,
  oppZ: Record<string, number>,
): number {
  const diffs = CATS.map((cat) => ({
    diff: (oppZ[cat] ?? 0) - (myZ[cat] ?? 0),
    weight: CATEGORY_WEIGHTS[cat] ?? 0,
  }));
  const totalWeight = diffs.reduce((s, d) => s + d.weight, 0);
  if (totalWeight === 0) return 0;
  return diffs.reduce((s, d) => s + d.diff * d.weight, 0) / totalWeight;
}

function buildZScoreMap(
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
      const raw = sd > 0 ? ((team.categories[cat] ?? 0) - mu) / sd : 0;
      zMap[team.teamId][cat] = LOWER_IS_BETTER_CATS.has(cat) ? -raw : raw;
    }
  }
  return zMap;
}

function difficultyStyle(score: number): { label: string; bg: string; text: string; border: string } {
  if (score < -0.3) return { label: "Easy", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" };
  if (score < -0.1) return { label: "Favorable", bg: "bg-emerald-50/50", text: "text-emerald-600", border: "border-emerald-200/50" };
  if (score > 0.3) return { label: "Hard", bg: "bg-red-50", text: "text-red-700", border: "border-red-200" };
  if (score > 0.1) return { label: "Tough", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" };
  return { label: "Even", bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" };
}

function fmtDateRange(start: string, end: string): string {
  const s = new Date(start + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const e = new Date(end + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${s} – ${e}`;
}

export default function ScheduleOutlookPage() {
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [standings, setStandings] = useState<StandingsData | null>(null);
  const [leagueStats, setLeagueStats] = useState<LeagueStatsData | null>(null);
  const [h2hMatchups, setH2hMatchups] = useState<Record<number, { myWins: number; myLosses: number; myTies: number }>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const currentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/espn/schedule").then((r) => r.json()),
      fetch("/api/espn/standings").then((r) => r.json()).catch(() => null),
      fetch("/api/espn/league-stats?scope=season").then((r) => r.json()).catch(() => null),
      fetch("/api/espn/h2h").then((r) => r.json()).catch(() => null),
    ]).then(([schedData, standData, lsData, h2hData]) => {
      if (schedData.error) { setError(schedData.error); return; }
      setSchedule(schedData);
      if (standData && !standData.error) setStandings(standData);
      if (lsData && !lsData.error) setLeagueStats(lsData);
      if (h2hData?.matchups) {
        const byWeek: Record<number, { myWins: number; myLosses: number; myTies: number }> = {};
        for (const m of h2hData.matchups) {
          byWeek[m.week] = { myWins: m.myWins, myLosses: m.myLosses, myTies: m.myTies };
        }
        setH2hMatchups(byWeek);
      }
    })
    .catch(() => setError("FETCH_FAILED"))
    .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (schedule && currentRef.current) {
      currentRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [schedule]);

  const zScoreMap = useMemo(() => {
    if (!leagueStats?.teams || !leagueStats?.averages) return {};
    return buildZScoreMap(leagueStats.teams, leagueStats.averages);
  }, [leagueStats]);

  const teamRanks = useMemo(() => {
    if (!leagueStats?.teams) return {} as Record<number, LeagueTeam>;
    const map: Record<number, LeagueTeam> = {};
    for (const t of leagueStats.teams) map[t.teamId] = t;
    return map;
  }, [leagueStats]);

  const standingsMap = useMemo(() => {
    if (!standings?.teams) return {} as Record<number, StandingsTeam>;
    const map: Record<number, StandingsTeam> = {};
    for (const t of standings.teams) map[t.teamId] = t;
    return map;
  }, [standings]);

  const myStanding = useMemo(() => {
    if (!standings || !schedule) return null;
    return standings.teams.find((t) => t.teamId === schedule.myTeamId) ?? null;
  }, [standings, schedule]);

  const futureWeeks = useMemo(() => {
    if (!schedule) return [];
    return schedule.weeks.filter((w) => w.period >= schedule.currentMatchupPeriod);
  }, [schedule]);

  const weekDifficulties = useMemo(() => {
    if (!schedule || !leagueStats) return new Map<number, number>();
    const myZ = zScoreMap[schedule.myTeamId];
    if (!myZ) return new Map<number, number>();
    const map = new Map<number, number>();
    for (const week of schedule.weeks) {
      if (week.myOpponentId == null) continue;
      const oppZ = zScoreMap[week.myOpponentId];
      if (!oppZ) continue;
      map.set(week.period, computeMatchupDifficulty(myZ, oppZ));
    }
    return map;
  }, [schedule, leagueStats, zScoreMap]);

  const playoffMath = useMemo(() => {
    if (!myStanding || !standings || !schedule) return null;
    const totalWeeks = schedule.weeks.length;
    const weeksLeft = totalWeeks - schedule.currentMatchupPeriod + 1;
    const catsPerWeek = 16;
    const myWins = myStanding.wins;
    const myLosses = myStanding.losses;
    const myTies = myStanding.ties;

    const sorted = [...standings.teams].sort((a, b) => {
      const pctA = safeDivide(a.wins, a.wins + a.losses + a.ties);
      const pctB = safeDivide(b.wins, b.wins + b.losses + b.ties);
      return pctB - pctA;
    });

    const myRank = sorted.findIndex((t) => t.teamId === schedule.myTeamId) + 1;
    const playoffLine = sorted[PLAYOFF_CUTOFF - 1];
    const playoffWins = playoffLine ? playoffLine.wins : 0;
    const playoffGap = playoffWins - myWins;

    const winsPerWeekNeeded = weeksLeft > 0 ? Math.max(0, Math.ceil(playoffGap / weeksLeft)) : 0;
    const magicNumber = weeksLeft > 0 ? Math.max(0, playoffGap + 1) : 0;

    const positionTargets = sorted.slice(0, Math.min(6, sorted.length)).map((t, idx) => ({
      rank: idx + 1,
      teamName: t.teamName,
      wins: t.wins,
      gap: t.wins - myWins,
      winsNeeded: weeksLeft > 0 ? Math.max(0, Math.ceil((t.wins - myWins) / weeksLeft)) : 0,
    }));

    return {
      myRank,
      myWins,
      myLosses,
      myTies,
      weeksLeft,
      catsPerWeek,
      playoffGap,
      winsPerWeekNeeded,
      magicNumber,
      positionTargets,
      inPlayoffs: myRank <= PLAYOFF_CUTOFF,
    };
  }, [myStanding, standings, schedule]);

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading schedule...</div>;
  if (error === "ESPN_CREDS_MISSING" || error === "MY_ESPN_TEAM_ID_MISSING") {
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnAuthRequired /></div>;
  }
  if (error || !schedule) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load schedule</div>
        <div className="text-[12px] text-slate-500">{error}</div>
      </div>
    );
  }

  const totalWeeks = schedule.weeks.length;
  const pastWeeks = schedule.weeks.filter((w) => w.period < schedule.currentMatchupPeriod);
  const pastRecord = pastWeeks.reduce(
    (acc, w) => {
      const r = h2hMatchups[w.period];
      if (!r) return acc;
      return { w: acc.w + r.myWins, l: acc.l + r.myLosses, t: acc.t + r.myTies };
    },
    { w: 0, l: 0, t: 0 }
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-gray-900">Season Timeline</h1>
        <span className="text-[12px] text-slate-500">
          Week {schedule.currentMatchupPeriod} of {totalWeeks} · {totalWeeks - pastWeeks.length} weeks remaining
        </span>
      </div>

      {/* Playoff Math */}
      {playoffMath && (
        <div className="mb-5 rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-4 py-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Playoff Math</span>
            <span className={`text-[11px] font-bold ${playoffMath.inPlayoffs ? "text-emerald-600" : "text-red-600"}`}>
              {playoffMath.inPlayoffs ? `In playoff position (#${playoffMath.myRank})` : `Outside playoffs (#${playoffMath.myRank})`}
            </span>
          </div>
          <div className="px-4 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-[10px] text-slate-500">Current Rank</div>
                <div className={`text-2xl font-bold tabular-nums ${playoffMath.myRank <= PLAYOFF_CUTOFF ? "text-emerald-600" : "text-red-600"}`}>
                  #{playoffMath.myRank}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-slate-500">Record</div>
                <div className="text-2xl font-bold tabular-nums text-slate-700">
                  {playoffMath.myWins}-{playoffMath.myLosses}{playoffMath.myTies > 0 ? `-${playoffMath.myTies}` : ""}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-slate-500">Weeks Left</div>
                <div className="text-2xl font-bold tabular-nums text-slate-700">{playoffMath.weeksLeft}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-slate-500">Cat Wins to Playoff</div>
                <div className={`text-2xl font-bold tabular-nums ${playoffMath.playoffGap <= 0 ? "text-emerald-600" : "text-orange-600"}`}>
                  {playoffMath.playoffGap <= 0 ? "On pace" : `+${playoffMath.playoffGap}`}
                </div>
              </div>
            </div>

            {/* Position targets */}
            {playoffMath.positionTargets.length > 0 && (
              <div className="border-t border-border pt-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Wins needed per week to reach each position
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {playoffMath.positionTargets.map((t) => {
                    const isMe = t.gap === 0;
                    const isPlayoff = t.rank <= PLAYOFF_CUTOFF;
                    return (
                      <div key={t.rank} className={`rounded border p-2 text-center ${
                        isMe ? "border-orange-300 bg-orange-50" :
                        isPlayoff ? "border-emerald-200 bg-emerald-50/50" : "border-border"
                      }`}>
                        <div className="text-[9px] text-slate-500">#{t.rank}</div>
                        <div className="text-[10px] font-medium text-slate-700 truncate">{t.teamName}</div>
                        <div className={`text-[14px] font-bold tabular-nums ${
                          t.gap <= 0 ? "text-emerald-600" : t.gap <= 5 ? "text-orange-600" : "text-red-600"
                        }`}>
                          {t.gap <= 0 ? "Ahead" : `${t.winsNeeded}/wk`}
                        </div>
                        <div className="text-[9px] text-slate-400">{t.wins}W ({t.gap > 0 ? `+${t.gap}` : t.gap} gap)</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Remaining Schedule Difficulty */}
      {futureWeeks.length > 0 && (
        <div className="mb-5 rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-4 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Remaining Schedule Strength</span>
          </div>
          <div className="px-4 py-3">
            <div className="flex flex-wrap gap-1">
              {futureWeeks.map((week) => {
                const diff = weekDifficulties.get(week.period) ?? 0;
                const style = difficultyStyle(diff);
                const oppTeam = week.myOpponentId ? teamRanks[week.myOpponentId] : null;
                const oppStanding = week.myOpponentId ? standingsMap[week.myOpponentId] : null;
                return (
                  <div key={week.period}
                    className={`rounded border px-2.5 py-2 text-center min-w-[72px] ${style.bg} ${style.border} ${week.isCurrent ? "ring-2 ring-orange-400" : ""}`}
                    title={`Week ${week.period}: ${week.myOpponentName ?? "TBD"}`}
                  >
                    <div className="text-[9px] text-slate-500">Wk {week.period}</div>
                    <div className={`text-[10px] font-bold ${style.text}`}>{style.label}</div>
                    {oppTeam && (
                      <div className="text-[9px] text-slate-400">#{oppTeam.powerRank}</div>
                    )}
                    {oppStanding && (
                      <div className="text-[8px] text-slate-400 tabular-nums">
                        {oppStanding.wins}-{oppStanding.losses}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Summary */}
            {(() => {
              const easy = futureWeeks.filter((w) => (weekDifficulties.get(w.period) ?? 0) < -0.1).length;
              const hard = futureWeeks.filter((w) => (weekDifficulties.get(w.period) ?? 0) > 0.1).length;
              const even = futureWeeks.length - easy - hard;
              return (
                <div className="mt-3 flex items-center gap-4 text-[11px]">
                  <span className="text-emerald-600 font-semibold">{easy} favorable</span>
                  <span className="text-slate-500">{even} even</span>
                  <span className="text-red-600 font-semibold">{hard} tough</span>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Full Schedule Timeline */}
      <div className="space-y-1">
        {schedule.weeks.map((week) => {
          const isPast = week.period < schedule.currentMatchupPeriod;
          const isCurrent = week.isCurrent;
          const matchupResult = isPast ? h2hMatchups[week.period] : null;
          const diff = weekDifficulties.get(week.period) ?? 0;
          const style = difficultyStyle(diff);
          const oppTeam = week.myOpponentId ? teamRanks[week.myOpponentId] : null;

          return (
            <div key={week.period} ref={isCurrent ? currentRef : undefined}
              className={`rounded-lg border px-4 py-3 flex items-center justify-between ${
                isCurrent ? "border-orange-300 bg-orange-50" :
                isPast ? "border-border bg-surface/50 opacity-80" : "border-border bg-surface"
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
                    {matchupResult && (
                      <span className={`text-[12px] font-bold font-mono tabular-nums ${
                        matchupResult.myWins > matchupResult.myLosses ? "text-emerald-600" :
                        matchupResult.myLosses > matchupResult.myWins ? "text-red-600" : "text-orange-600"
                      }`}>
                        {matchupResult.myWins}-{matchupResult.myLosses}{matchupResult.myTies > 0 ? `-${matchupResult.myTies}` : ""}
                      </span>
                    )}
                    {!isPast && oppTeam && (
                      <span className="text-[9px] font-bold text-slate-400">#{oppTeam.powerRank}</span>
                    )}
                    {!isPast && (
                      <span className={`text-[9px] font-bold border rounded px-1.5 py-0.5 ${style.bg} ${style.text} ${style.border}`}>
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
