"use client";

import { useState, useEffect, useMemo } from "react";
import { EspnAuthRequired } from "@/components/EspnAuthRequired";
import { ALL_CATS_BY_WEIGHT, isPunt, isHighImpact, categoryTierHeaderClass, CATEGORY_WEIGHTS, categoryTier } from "@/lib/category-weights";

interface TeamCategoryStats {
  teamId: number;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  categories: Record<string, number>;
  ranks: Record<string, number>;
}

interface LeagueStatsData {
  scoringPeriodId: number;
  myTeamId: number;
  teams: TeamCategoryStats[];
}

const CATS_ORDER = ALL_CATS_BY_WEIGHT;
const LOWER_IS_BETTER = new Set(["ERA", "WHIP", "L"]);
const RATE_STATS = new Set(["AVG", "ERA", "WHIP"]);

function rankCellClasses(rank: number): string {
  if (!Number.isFinite(rank) || rank <= 0) return "bg-slate-100 text-slate-400";
  if (rank <= 2) return "bg-emerald-600 text-white";
  if (rank <= 4) return "bg-emerald-200 text-emerald-800";
  if (rank <= 6) return "bg-slate-100 text-slate-600";
  if (rank <= 8) return "bg-orange-200 text-orange-800";
  return "bg-red-600 text-white";
}

function fmtValue(cat: string, val: number | null | undefined): string {
  if (val == null || !Number.isFinite(val)) return "-";
  if (cat === "AVG") return val.toFixed(3);
  if (cat === "ERA" || cat === "WHIP") return val.toFixed(2);
  return String(Math.round(val));
}

export default function CategoryBreakdownPage() {
  const [data, setData] = useState<(LeagueStatsData & { averages?: Record<string, number> }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortCat, setSortCat] = useState<string | null>(null);
  const [scope, setScope] = useState<"season" | "week">("season");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/espn/league-stats?scope=${scope}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(() => { if (!cancelled) setError("FETCH_FAILED"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [scope]);

  const sortedTeams = useMemo(() => {
    if (!data) return [];
    const teams = [...data.teams];
    if (sortCat) {
      const lower = LOWER_IS_BETTER.has(sortCat);
      teams.sort((a, b) => {
        const aVal = a.categories[sortCat] ?? 0;
        const bVal = b.categories[sortCat] ?? 0;
        return lower ? aVal - bVal : bVal - aVal;
      });
    } else {
      teams.sort((a, b) => b.wins - a.wins || a.losses - b.losses);
    }
    return teams;
  }, [data, sortCat]);

  const myTeam = useMemo(() => {
    if (!data) return null;
    return data.teams.find((t) => t.teamId === data.myTeamId) ?? null;
  }, [data]);

  const cliffAnalysis = useMemo(() => {
    if (!data || !myTeam) return [];
    const teams = data.teams;
    return CATS_ORDER.map((cat) => {
      const lower = LOWER_IS_BETTER.has(cat);
      const sorted = [...teams].sort((a, b) => {
        const aVal = a.categories[cat] ?? 0;
        const bVal = b.categories[cat] ?? 0;
        return lower ? aVal - bVal : bVal - aVal;
      });
      const myIdx = sorted.findIndex((t) => t.teamId === data.myTeamId);
      if (myIdx < 0) return { cat, myRank: 0, gapAbove: null, gapBelow: null, teamAbove: null, teamBelow: null, weight: CATEGORY_WEIGHTS[cat] ?? 0 };
      const myVal = myTeam.categories[cat] ?? 0;
      const above = myIdx > 0 ? sorted[myIdx - 1] : null;
      const below = myIdx < sorted.length - 1 ? sorted[myIdx + 1] : null;
      const aboveVal = above ? (above.categories[cat] ?? 0) : null;
      const belowVal = below ? (below.categories[cat] ?? 0) : null;
      const gapAbove = aboveVal !== null ? Math.abs(aboveVal - myVal) : null;
      const gapBelow = belowVal !== null ? Math.abs(myVal - belowVal) : null;
      return {
        cat,
        myRank: myIdx + 1,
        gapAbove: gapAbove !== null && Number.isFinite(gapAbove) ? gapAbove : null,
        gapBelow: gapBelow !== null && Number.isFinite(gapBelow) ? gapBelow : null,
        teamAbove: above?.teamName ?? null,
        teamBelow: below?.teamName ?? null,
        weight: CATEGORY_WEIGHTS[cat] ?? 0,
      };
    });
  }, [data, myTeam]);

  const summary = useMemo(() => {
    if (!myTeam) return { dominant: [] as string[], critical: [] as string[] };
    const dominant: string[] = [];
    const critical: string[] = [];
    for (const cat of CATS_ORDER) {
      const rank = myTeam.ranks[cat] ?? 5;
      if (rank <= 2) dominant.push(cat);
      if (rank >= 9 && !isPunt(cat)) critical.push(cat);
    }
    return { dominant, critical };
  }, [myTeam]);

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading...</div>;
  if (error === "ESPN_CREDS_MISSING" || error === "MY_ESPN_TEAM_ID_MISSING") {
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnAuthRequired /></div>;
  }
  if (error || !data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load breakdown</div>
        <div className="text-[12px] text-slate-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Category Breakdown</h1>
          <div className="text-[12px] text-slate-500">
            {scope === "season" ? "Season cumulative" : `Week ${data.scoringPeriodId}`} &middot; League-wide category ranks
            {sortCat && (
              <button
                onClick={() => setSortCat(null)}
                className="ml-3 text-orange-600 hover:text-orange-700 font-semibold"
              >
                Clear sort ({sortCat}) &times;
              </button>
            )}
          </div>
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden text-[11px] font-semibold">
          <button
            onClick={() => setScope("season")}
            className={`px-3 py-1.5 transition-colors ${scope === "season" ? "bg-orange-600 text-white" : "bg-surface text-slate-600 hover:bg-slate-100"}`}
          >
            Season
          </button>
          <button
            onClick={() => setScope("week")}
            className={`px-3 py-1.5 transition-colors ${scope === "week" ? "bg-orange-600 text-white" : "bg-surface text-slate-600 hover:bg-slate-100"}`}
          >
            This Week
          </button>
        </div>
      </div>

      {/* Summary */}
      {myTeam && (summary.dominant.length > 0 || summary.critical.length > 0) && (
        <div className="mb-4 rounded-lg border border-border bg-surface px-4 py-3 text-[12px]">
          {summary.dominant.length > 0 && (
            <span>
              <span className="font-semibold text-emerald-700">Dominant (top 2):</span>{" "}
              <span className="text-emerald-600">{summary.dominant.join(", ")}</span>
            </span>
          )}
          {summary.dominant.length > 0 && summary.critical.length > 0 && (
            <span className="mx-2 text-slate-300">|</span>
          )}
          {summary.critical.length > 0 && (
            <span>
              <span className="font-semibold text-red-700">Critical (bottom 2):</span>{" "}
              <span className="text-red-600">{summary.critical.join(", ")}</span>
            </span>
          )}
        </div>
      )}

      {/* Heatmap Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-[12px]">
          <thead className="border-b border-border bg-surface text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2.5 sticky left-0 bg-surface z-10">Team</th>
              <th className="px-2 py-2.5 text-center">W-L</th>
              {CATS_ORDER.map((cat) => (
                <th
                  key={cat}
                  className={`px-1.5 py-2.5 text-center cursor-pointer hover:text-orange-600 transition-colors select-none ${
                    sortCat === cat ? "text-orange-600 font-extrabold" : categoryTierHeaderClass(cat)
                  }`}
                  onClick={() => setSortCat(sortCat === cat ? null : cat)}
                >
                  {cat}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedTeams.map((team) => {
              const isMyTeam = team.teamId === data.myTeamId;
              return (
                <tr
                  key={team.teamId}
                  className={`border-b border-border/50 ${
                    isMyTeam ? "border-l-4 border-l-orange-500 bg-orange-50" : ""
                  }`}
                >
                  <td className={`px-3 py-2 sticky left-0 z-10 whitespace-nowrap ${
                    isMyTeam ? "font-bold text-gray-900 bg-orange-50" : "text-slate-600 bg-white"
                  }`}>
                    {team.teamName}
                  </td>
                  <td className="px-2 py-2 text-center font-mono tabular-nums text-slate-500 text-[11px]">
                    {team.wins}-{team.losses}{team.ties > 0 ? `-${team.ties}` : ""}
                  </td>
                  {CATS_ORDER.map((cat) => {
                    const rank = team.ranks[cat] ?? 5;
                    const value = team.categories[cat];
                    return (
                      <td key={cat} className="px-0.5 py-1 text-center">
                        <div
                          className={`mx-auto w-14 rounded px-1 py-0.5 text-[10px] font-bold tabular-nums font-mono ${rankCellClasses(rank)}`}
                        >
                          <div>{fmtValue(cat, value)}</div>
                          <div className="text-[8px] opacity-70">#{rank}</div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          {/* League average row with differential */}
          {data.averages && (
            <tfoot className="border-t border-border bg-slate-50">
              <tr>
                <td className="px-3 py-2 sticky left-0 bg-slate-50 z-10 text-[11px] font-semibold text-slate-500">Lg Avg</td>
                <td className="px-2 py-2"></td>
                {CATS_ORDER.map((cat) => (
                  <td key={cat} className="px-0.5 py-1 text-center">
                    <div className="mx-auto w-14 text-[10px] font-mono tabular-nums text-slate-500">
                      {fmtValue(cat, data.averages?.[cat])}
                    </div>
                  </td>
                ))}
              </tr>
              {myTeam && (
                <tr>
                  <td className="px-3 py-2 sticky left-0 bg-slate-50 z-10 text-[11px] font-semibold text-orange-600">vs Avg</td>
                  <td className="px-2 py-2"></td>
                  {CATS_ORDER.map((cat) => {
                    const val = myTeam.categories[cat] ?? 0;
                    const avg = data.averages?.[cat] ?? 0;
                    const lower = LOWER_IS_BETTER.has(cat);
                    const delta = lower ? avg - val : val - avg;
                    const positive = delta > 0;
                    return (
                      <td key={cat} className="px-0.5 py-1 text-center">
                        <div className={`mx-auto w-14 text-[10px] font-bold font-mono tabular-nums ${
                          positive ? "text-emerald-600" : delta < 0 ? "text-red-600" : "text-slate-400"
                        }`}>
                          {positive ? "+" : ""}{RATE_STATS.has(cat) ? delta.toFixed(2) : delta.toFixed(1)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              )}
            </tfoot>
          )}
        </table>
      </div>

      {/* Margin to Flip */}
      {myTeam && cliffAnalysis.length > 0 && (
        <div className="mt-6">
          <h2 className="text-[14px] font-bold text-gray-900 mb-1">Margin to Flip</h2>
          <p className="text-[11px] text-slate-500 mb-3">
            How close you are to moving up or down a rank in each category. Weighted by category importance.
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {cliffAnalysis.map((c) => {
              const isRate = RATE_STATS.has(c.cat);
              const fmtGap = (g: number | null) => {
                if (g === null) return "-";
                if (isRate) return g.toFixed(3);
                return g < 10 ? g.toFixed(1) : String(Math.round(g));
              };
              const gapColor = (g: number | null, isAbove: boolean) => {
                if (g === null) return "text-slate-400";
                const threshold = isRate ? (c.cat === "AVG" ? 0.005 : 0.15) : 3;
                if (g < threshold) return isAbove ? "text-emerald-600" : "text-red-600";
                const medThreshold = isRate ? (c.cat === "AVG" ? 0.015 : 0.5) : 10;
                if (g < medThreshold) return "text-orange-600";
                return "text-slate-500";
              };
              const tier = categoryTier(c.cat);
              const bgClass = tier === "high" ? "border-amber-300 bg-amber-50/50" :
                tier === "punt" ? "border-slate-200 bg-slate-50 opacity-50" :
                "border-border bg-surface";
              return (
                <div key={c.cat} className={`rounded-lg border px-2 py-2 text-center ${bgClass}`}>
                  <div className="text-[10px] font-bold text-slate-600">{c.cat}</div>
                  <div className="text-[9px] text-slate-400">#{c.myRank}</div>
                  <div className="mt-1.5">
                    <div className="text-[8px] text-slate-400">to move up</div>
                    <div className={`text-[12px] font-bold font-mono tabular-nums ${gapColor(c.gapAbove, true)}`}>
                      {fmtGap(c.gapAbove)}
                    </div>
                    {c.teamAbove && (
                      <div className="text-[7px] text-slate-400 truncate" title={c.teamAbove}>{c.teamAbove.split(" ").pop()}</div>
                    )}
                  </div>
                  <div className="mt-1">
                    <div className="text-[8px] text-slate-400">margin held</div>
                    <div className={`text-[12px] font-bold font-mono tabular-nums ${gapColor(c.gapBelow, false)}`}>
                      {fmtGap(c.gapBelow)}
                    </div>
                    {c.teamBelow && (
                      <div className="text-[7px] text-slate-400 truncate" title={c.teamBelow}>{c.teamBelow.split(" ").pop()}</div>
                    )}
                  </div>
                  {isHighImpact(c.cat) && <div className="mt-0.5 text-[7px] text-amber-600 font-bold">KEY</div>}
                </div>
              );
            })}
          </div>

          {(() => {
            const invest = cliffAnalysis
              .filter((c) => c.gapAbove !== null && !isPunt(c.cat))
              .sort((a, b) => {
                const scoreA = (a.weight / Math.max(0.01, a.gapAbove ?? 999));
                const scoreB = (b.weight / Math.max(0.01, b.gapAbove ?? 999));
                return scoreB - scoreA;
              })
              .slice(0, 4);
            const protect = cliffAnalysis
              .filter((c) => c.gapBelow !== null && !isPunt(c.cat))
              .filter((c) => {
                const isRate = RATE_STATS.has(c.cat);
                const threshold = isRate ? (c.cat === "AVG" ? 0.01 : 0.3) : 5;
                return (c.gapBelow ?? 999) < threshold;
              })
              .sort((a, b) => (b.weight - a.weight));
            if (invest.length === 0 && protect.length === 0) return null;
            return (
              <div className="mt-3 rounded-lg border border-border bg-surface px-4 py-3 text-[11px]">
                {invest.length > 0 && (
                  <div className="mb-1">
                    <span className="font-semibold text-emerald-700">Best investment:</span>{" "}
                    <span className="text-emerald-600">
                      {invest.map((c) => `${c.cat} (${RATE_STATS.has(c.cat) ? (c.gapAbove ?? 0).toFixed(2) : Math.round(c.gapAbove ?? 0)} to move up)`).join(", ")}
                    </span>
                  </div>
                )}
                {protect.length > 0 && (
                  <div>
                    <span className="font-semibold text-red-700">Protect:</span>{" "}
                    <span className="text-red-600">
                      {protect.map((c) => `${c.cat} (${RATE_STATS.has(c.cat) ? (c.gapBelow ?? 0).toFixed(2) : Math.round(c.gapBelow ?? 0)} margin)`).join(", ")}
                    </span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
