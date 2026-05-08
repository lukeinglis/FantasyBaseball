"use client";

import { useState, useEffect, useMemo } from "react";
import { EspnAuthRequired } from "@/components/EspnAuthRequired";
import { sanitizeNum } from "@/lib/sanitize";
import { CATEGORY_WEIGHTS, HIGH_IMPACT_CATS, LOWER_IS_BETTER, isPunt, categoryTier } from "@/lib/category-weights";

interface MatchupCat {
  cat: string;
  myValue: number | null;
  oppValue: number | null;
  result: "WIN" | "LOSS" | "TIE" | "PENDING";
}

interface MatchupData {
  scoringPeriodId: number;
  myTeamName: string;
  oppTeamName: string;
  myWins: number;
  myLosses: number;
  myTies: number;
  categories: MatchupCat[];
  matchupStartDate: string | null;
  matchupEndDate: string | null;
  myRoster: { name: string; pos: string; injuryStatus: string }[];
}

interface LeagueTeam {
  teamId: number;
  teamName: string;
  categories: Record<string, number>;
  ranks: Record<string, number>;
  deltas: Record<string, number>;
  powerRank: number;
}

interface LeagueStatsData {
  myTeamId: number;
  teams: LeagueTeam[];
  averages: Record<string, number>;
}

interface CategoryRanking {
  cat: string;
  weight: number;
  rank: number;
  value: number;
  leaderValue: number;
  gap: number;
  tier: string;
  tierLabel: string;
  isPunt: boolean;
}

interface ActionItem {
  priority: "HIGH" | "MEDIUM" | "LOW";
  type: string;
  message: string;
}

interface DiagnosisData {
  teamName: string;
  categoryRankings: CategoryRanking[];
  actionItems: ActionItem[];
}

const ALL_CATS = ["TB", "HR", "R", "RBI", "H", "W", "K", "WHIP", "QS", "ERA", "SB", "BB", "AVG", "L", "HD", "SV"];
const IL_STATUSES = new Set(["SEVEN_DAY_DL", "TEN_DAY_DL", "FIFTEEN_DAY_DL", "SIXTY_DAY_DL", "OUT"]);

function rankColor(rank: number): string {
  if (rank <= 3) return "bg-emerald-500 text-white";
  if (rank <= 6) return "bg-yellow-400 text-yellow-900";
  return "bg-red-500 text-white";
}

function rankBorderColor(rank: number): string {
  if (rank <= 3) return "border-emerald-300";
  if (rank <= 6) return "border-yellow-300";
  return "border-red-300";
}

export default function GmDashboard() {
  const [matchup, setMatchup] = useState<MatchupData | null>(null);
  const [leagueStats, setLeagueStats] = useState<LeagueStatsData | null>(null);
  const [diagnosis, setDiagnosis] = useState<DiagnosisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/espn/matchup").then((r) => r.json()).catch(() => ({})),
      fetch("/api/espn/league-stats").then((r) => r.json()).catch(() => ({})),
      fetch("/api/analysis/roster-diagnosis").then((r) => r.json()).catch(() => ({})),
    ])
      .then(([m, ls, diag]) => {
        if (m.error) { setError(m.error); return; }
        if (!m.error) setMatchup(m);
        if (!ls.error) setLeagueStats(ls);
        if (!diag.error && diag.actionItems) setDiagnosis(diag);
      })
      .catch(() => setError("FETCH_FAILED"))
      .finally(() => setLoading(false));
  }, []);

  const myTeam = useMemo(() => {
    if (!leagueStats) return null;
    return leagueStats.teams.find((t) => t.teamId === leagueStats.myTeamId) ?? null;
  }, [leagueStats]);

  const daysLeft = useMemo(() => {
    if (!matchup?.matchupEndDate) return 0;
    const end = new Date(matchup.matchupEndDate + "T23:59:59");
    const now = new Date();
    return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }, [matchup]);

  const injuredPlayers = useMemo(() => {
    if (!matchup?.myRoster) return [];
    return matchup.myRoster.filter((p) => IL_STATUSES.has(p.injuryStatus));
  }, [matchup]);

  const categoryInsights = useMemo(() => {
    if (!matchup) return { winning: [] as MatchupCat[], losing: [] as MatchupCat[], close: [] as MatchupCat[] };
    const cats = matchup.categories;
    const winning = cats.filter((c) => c.result === "WIN");
    const losing = cats.filter((c) => c.result === "LOSS" && !isPunt(c.cat));
    const close = cats.filter((c) => {
      if (c.myValue === null || c.oppValue === null) return false;
      const gap = Math.abs(sanitizeNum(c.myValue) - sanitizeNum(c.oppValue));
      const isRate = LOWER_IS_BETTER.has(c.cat);
      const threshold = isRate ? 0.5 : (c.cat === "AVG" ? 0.005 : 3);
      return gap < threshold && gap >= 0 && !isPunt(c.cat);
    });
    return { winning, losing, close };
  }, [matchup]);

  const categoryGrid = useMemo(() => {
    if (!myTeam) return [];
    return ALL_CATS.map((cat) => ({
      cat,
      rank: sanitizeNum(myTeam.ranks[cat], 10),
      value: sanitizeNum(myTeam.categories[cat]),
      delta: sanitizeNum(myTeam.deltas[cat]),
      weight: CATEGORY_WEIGHTS[cat] ?? 0,
      tier: categoryTier(cat),
      isPunt: isPunt(cat),
    }));
  }, [myTeam]);

  const topActions = useMemo(() => {
    if (!diagnosis) return [];
    return diagnosis.actionItems
      .filter((a) => a.priority === "HIGH")
      .slice(0, 4);
  }, [diagnosis]);

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading dashboard...</div>;
  if (error === "ESPN_CREDS_MISSING" || error === "MY_ESPN_TEAM_ID_MISSING") {
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnAuthRequired /></div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-gray-900">GM Overview</h1>
        {matchup && (
          <div className="text-[12px] text-slate-500">
            Week {matchup.scoringPeriodId} · {matchup.myTeamName}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Matchup Status */}
        {matchup && (
          <div className="rounded-lg border border-border bg-surface">
            <div className="border-b border-border px-4 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Current Matchup</span>
            </div>
            <div className="px-4 py-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-[14px] font-semibold text-orange-600">{matchup.myTeamName}</span>
                  <span className="text-[13px] text-slate-400 mx-2">vs</span>
                  <span className="text-[14px] text-slate-600">{matchup.oppTeamName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[18px] font-bold tabular-nums ${
                    matchup.myWins > matchup.myLosses ? "text-emerald-600" :
                    matchup.myLosses > matchup.myWins ? "text-red-600" : "text-orange-600"
                  }`}>
                    {matchup.myWins}-{matchup.myLosses}
                    {matchup.myTies > 0 ? `-${matchup.myTies}` : ""}
                  </span>
                </div>
              </div>
              {daysLeft > 0 && (
                <div className="text-[11px] text-slate-500 mb-3">{daysLeft} days remaining</div>
              )}

              {/* Category chips */}
              <div className="flex flex-wrap gap-1">
                {matchup.categories.map((c) => (
                  <span key={c.cat} className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    c.result === "WIN" ? "bg-emerald-100 text-emerald-700" :
                    c.result === "LOSS" ? "bg-red-100 text-red-700" :
                    c.result === "TIE" ? "bg-orange-100 text-orange-700" :
                    "bg-slate-100 text-slate-500"
                  } ${isPunt(c.cat) ? "opacity-50" : ""}`}>
                    {c.cat}
                  </span>
                ))}
              </div>

              {/* Close categories */}
              {categoryInsights.close.length > 0 && (
                <div className="mt-3 text-[10px] text-orange-600 font-semibold">
                  Tight: {categoryInsights.close.map((c) => c.cat).join(", ")}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Items from Diagnosis */}
        <div className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-4 py-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Action Items</span>
            {topActions.length > 0 && (
              <a href="/gm/diagnosis" className="text-[10px] text-orange-600 hover:text-orange-700">View all</a>
            )}
          </div>
          <div className="px-4 py-3">
            {topActions.length > 0 ? (
              <div className="space-y-2">
                {topActions.map((action, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className={`shrink-0 mt-0.5 text-[9px] font-bold rounded px-1.5 py-0.5 ${
                      action.type === "DROP" ? "bg-red-100 text-red-700" :
                      action.type === "STREAM" ? "bg-blue-100 text-blue-700" :
                      action.type === "TRADE" ? "bg-purple-100 text-purple-700" :
                      action.type === "IMPROVE" ? "bg-orange-100 text-orange-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>{action.type}</span>
                    <span className="text-[12px] text-slate-700 leading-snug">{action.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {categoryInsights.losing.length > 0 && (
                  <a href="/gm/matchup" className="flex items-center gap-2 text-[12px] text-red-600 hover:text-red-700">
                    <span className="font-semibold">Losing {categoryInsights.losing.length} non-punt categories</span>
                    <span className="text-slate-400">({categoryInsights.losing.map((c) => c.cat).join(", ")})</span>
                  </a>
                )}
                {injuredPlayers.length > 0 && (
                  <a href="/gm/roster" className="flex items-center gap-2 text-[12px] text-orange-600 hover:text-orange-700">
                    <span className="font-semibold">{injuredPlayers.length} players on IL</span>
                    <span className="text-slate-400">Check roster for streaming slots</span>
                  </a>
                )}
                <a href="/gm/today" className="flex items-center gap-2 text-[12px] text-slate-600 hover:text-slate-700">
                  <span className="font-semibold">View today&apos;s games and lineup</span>
                </a>
                <a href="/gm/free-agents" className="flex items-center gap-2 text-[12px] text-slate-600 hover:text-slate-700">
                  <span className="font-semibold">Browse free agent recommendations</span>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Category Health Grid */}
        {categoryGrid.length > 0 && (
          <div className="rounded-lg border border-border bg-surface lg:col-span-2">
            <div className="border-b border-border px-4 py-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Category Health</span>
              <span className="text-[9px] text-slate-400">All 16 categories, sorted by weight</span>
            </div>
            <div className="px-4 py-4">
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {categoryGrid.map((c) => (
                  <div key={c.cat} className={`rounded-lg border p-2 text-center ${rankBorderColor(c.rank)} ${c.isPunt ? "opacity-50" : ""}`}>
                    <div className="text-[10px] font-bold text-slate-600">{c.cat}</div>
                    <div className={`mt-1 inline-flex items-center justify-center w-7 h-7 rounded-full text-[12px] font-bold ${rankColor(c.rank)}`}>
                      {c.rank}
                    </div>
                    <div className={`mt-1 text-[10px] font-semibold ${c.delta > 0 ? "text-emerald-600" : c.delta < 0 ? "text-red-600" : "text-slate-400"}`}>
                      {c.delta > 0 ? "+" : ""}{LOWER_IS_BETTER.has(c.cat)
                        ? c.delta.toFixed(c.cat === "AVG" ? 3 : 2)
                        : Math.round(c.delta)
                      }
                    </div>
                    <div className="text-[8px] text-slate-400 mt-0.5">
                      {c.tier === "high" ? "HIGH" : c.tier === "medium" ? "MED" : c.tier === "low" ? "LOW" : "PUNT"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Roster Alerts */}
        <div className="rounded-lg border border-border bg-surface lg:col-span-2">
          <div className="border-b border-border px-4 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Roster Alerts</span>
          </div>
          <div className="px-4 py-3">
            <div className="flex flex-wrap gap-4">
              {/* IL alert */}
              {injuredPlayers.length > 0 ? (
                <div className="flex-1 min-w-[200px]">
                  <div className="text-[11px] text-red-600 font-semibold mb-2">{injuredPlayers.length} on IL</div>
                  <div className="space-y-1">
                    {injuredPlayers.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px]">
                        <span className="text-red-500 text-[10px] font-bold">IL</span>
                        <span className="text-slate-700">{p.name}</span>
                        <span className="text-slate-400">{p.pos}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-emerald-600 font-semibold">All healthy</span>
                    <span className="text-[11px] text-slate-400">No players on IL</span>
                  </div>
                </div>
              )}

              {/* Quick links */}
              <div className="flex-1 min-w-[200px] space-y-1.5">
                <a href="/gm/bullpen" className="block text-[12px] text-slate-600 hover:text-slate-700 font-medium">
                  Check pitching starts this week
                </a>
                <a href="/gm/free-agents" className="block text-[12px] text-slate-600 hover:text-slate-700 font-medium">
                  Browse streaming targets
                </a>
                <a href="/gm/trade" className="block text-[12px] text-slate-600 hover:text-slate-700 font-medium">
                  Explore trade opportunities
                </a>
                <a href="/league/schedule" className="block text-[12px] text-slate-600 hover:text-slate-700 font-medium">
                  View remaining schedule
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
