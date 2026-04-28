"use client";

import { useState, useEffect, useMemo } from "react";

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

const CATS_ORDER = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG", "K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"];
const LOWER_IS_BETTER = new Set(["ERA", "WHIP", "L"]);

function rankCellClasses(rank: number): string {
  if (rank <= 2) return "bg-emerald-600 text-white";
  if (rank <= 4) return "bg-emerald-200 text-emerald-800";
  if (rank <= 6) return "bg-slate-100 text-slate-600";
  if (rank <= 8) return "bg-orange-200 text-orange-800";
  return "bg-red-600 text-white";
}

function fmtValue(cat: string, val: number | null | undefined): string {
  if (val === null || val === undefined) return "-";
  if (cat === "AVG") return val.toFixed(3);
  if (cat === "ERA" || cat === "WHIP") return val.toFixed(2);
  return String(Math.round(val));
}

function EspnSetupCard() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-surface px-8 py-10 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-orange-600/60">Setup Required</div>
      <div className="mt-3 text-xl font-bold text-gray-900">Connect ESPN Credentials</div>
      <div className="mt-3 text-[13px] text-slate-500">
        Category Breakdown pulls live data from your private ESPN league.
      </div>
    </div>
  );
}

export default function CategoryBreakdownPage() {
  const [data, setData] = useState<LeagueStatsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortCat, setSortCat] = useState<string | null>(null);
  const [scope, setScope] = useState<"season" | "week">("season");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/espn/league-stats?scope=${scope}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(() => setError("FETCH_FAILED"))
      .finally(() => setLoading(false));
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

  const summary = useMemo(() => {
    if (!myTeam) return { dominant: [] as string[], critical: [] as string[] };
    const dominant: string[] = [];
    const critical: string[] = [];
    for (const cat of CATS_ORDER) {
      const rank = myTeam.ranks[cat] ?? 5;
      if (rank <= 2) dominant.push(cat);
      if (rank >= 9) critical.push(cat);
    }
    return { dominant, critical };
  }, [myTeam]);

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading...</div>;
  if (error === "ESPN_CREDS_MISSING" || error === "MY_ESPN_TEAM_ID_MISSING") {
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnSetupCard /></div>;
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
                    sortCat === cat ? "text-orange-600 font-extrabold" : ""
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
                    const showValue = sortCat === cat;
                    return (
                      <td key={cat} className="px-0.5 py-1 text-center">
                        <div
                          className={`mx-auto w-9 rounded px-1 py-0.5 text-[11px] font-bold tabular-nums font-mono ${rankCellClasses(rank)}`}
                        >
                          {showValue ? fmtValue(cat, value) : `#${rank}`}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
