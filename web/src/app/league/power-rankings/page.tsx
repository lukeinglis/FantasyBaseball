"use client";

import React, { useState, useEffect } from "react";
import { EspnAuthRequired } from "@/components/EspnAuthRequired";
import { ALL_CATS_BY_WEIGHT } from "@/lib/category-weights";

interface WeeklyTrendPoint {
  week: number;
  powerRank: number;
  compositeAvgRank: number;
}

interface PowerRankedTeam {
  teamId: number;
  teamName: string;
  abbrev: string;
  compositeAvgRank: number;
  powerRank: number;
  rawScore: number;
  weightedScore: number;
  battingAvgRank: number;
  pitchingAvgRank: number;
  prevWeekPowerRank: number | null;
  prevWeekCompositeAvgRank: number | null;
  rankChange: number | null;
  avgRankChange: number | null;
  weeklyTrend: WeeklyTrendPoint[];
  categoryRanks: Record<string, number>;
  categoryValues: Record<string, number>;
}

interface PowerRankingsData {
  currentWeek: number;
  myTeamId: number;
  teams: PowerRankedTeam[];
}

function rankColor(rank: number, total: number = 10): string {
  const pct = rank / total;
  if (pct <= 0.2) return "text-emerald-600 font-bold";
  if (pct <= 0.4) return "text-emerald-600/70";
  if (pct <= 0.6) return "text-slate-600";
  if (pct <= 0.8) return "text-orange-600";
  return "text-red-600 font-bold";
}

function rankBg(rank: number): string {
  if (rank === 1) return "bg-emerald-100 border-emerald-300";
  if (rank <= 3) return "bg-emerald-50 border-emerald-200";
  if (rank <= 5) return "bg-surface border-border";
  if (rank <= 7) return "bg-orange-50 border-orange-200";
  if (rank <= 9) return "bg-red-50 border-red-200";
  return "bg-red-100 border-red-300";
}

function avgRankColor(avg: number): string {
  if (avg <= 3) return "text-emerald-600";
  if (avg <= 5) return "text-slate-700";
  if (avg <= 7) return "text-orange-600";
  return "text-red-600";
}

function TrendIndicator({ change }: { change: number | null }) {
  if (change === null) {
    return <span className="text-[10px] text-slate-400">NEW</span>;
  }
  if (change === 0) {
    return <span className="text-[11px] text-slate-400">=</span>;
  }
  if (change > 0) {
    return (
      <span className="text-[12px] font-bold text-emerald-600 tabular-nums">
        ▲{change}
      </span>
    );
  }
  return (
    <span className="text-[12px] font-bold text-red-500 tabular-nums">
      ▼{Math.abs(change)}
    </span>
  );
}

function Sparkline({ points }: { points: WeeklyTrendPoint[] }) {
  if (points.length < 2) return null;
  const maxRank = 10;
  const w = 80;
  const h = 24;
  const pathParts = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = ((p.powerRank - 1) / (maxRank - 1)) * h;
    return `${i === 0 ? "M" : "L"}${x},${y}`;
  });
  const lastPt = points[points.length - 1];
  const improving = points.length > 1 && lastPt.powerRank < points[points.length - 2].powerRank;
  const color = improving ? "#059669" : lastPt.powerRank <= 3 ? "#059669" : lastPt.powerRank <= 7 ? "#64748b" : "#ef4444";
  return (
    <svg width={w} height={h} className="inline-block">
      <path d={pathParts.join("")} fill="none" stroke={color} strokeWidth="1.5" />
      <circle cx={w} cy={((lastPt.powerRank - 1) / (maxRank - 1)) * h} r="2.5" fill={color} />
    </svg>
  );
}

const CATS_ORDER = ALL_CATS_BY_WEIGHT;

function catRankColor(rank: number): string {
  if (rank <= 2) return "bg-emerald-600 text-white";
  if (rank <= 4) return "bg-emerald-200 text-emerald-800";
  if (rank <= 6) return "bg-slate-100 text-slate-600";
  if (rank <= 8) return "bg-orange-200 text-orange-800";
  return "bg-red-600 text-white";
}

export default function PowerRankingsPage() {
  const [data, setData] = useState<PowerRankingsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [activeView, setActiveView] = useState<"rankings" | "categories">("rankings");

  useEffect(() => {
    fetch("/api/espn/power-rankings")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(() => setError("FETCH_FAILED"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading power rankings...</div>;
  if (error === "ESPN_CREDS_MISSING" || error === "MY_ESPN_TEAM_ID_MISSING") {
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnAuthRequired /></div>;
  }
  if (error || !data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load power rankings</div>
        <div className="text-[12px] text-slate-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Power Rankings</h1>
          <span className="text-[12px] text-slate-500">
            Season cumulative through Week {data.currentWeek} &middot; Composite ranking across all 16 categories
          </span>
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden text-[11px] font-semibold">
          <button onClick={() => setActiveView("rankings")}
            className={`px-3 py-1.5 transition-colors ${activeView === "rankings" ? "bg-orange-600 text-white" : "bg-surface text-slate-600 hover:bg-slate-100"}`}>
            Rankings
          </button>
          <button onClick={() => setActiveView("categories")}
            className={`px-3 py-1.5 transition-colors ${activeView === "categories" ? "bg-orange-600 text-white" : "bg-surface text-slate-600 hover:bg-slate-100"}`}>
            Category Breakdown
          </button>
        </div>
      </div>

      {/* Category Breakdown View */}
      {activeView === "categories" && (
        <div className="space-y-6">
          {[
            { label: "Batting", cats: CATS_ORDER.filter(c => ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG"].includes(c)) },
            { label: "Pitching", cats: CATS_ORDER.filter(c => ["K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"].includes(c)) },
          ].map(({ label, cats }) => (
            <div key={label}>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-[12px]">
                  <thead className="border-b border-border bg-surface text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5 sticky left-0 bg-surface z-10">#</th>
                      <th className="px-3 py-2.5 sticky left-8 bg-surface z-10">Team</th>
                      {cats.map((cat) => (
                        <th key={cat} className="px-2 py-2.5 text-right w-14">{cat}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.teams.map((team, i) => {
                      const isMe = team.teamId === data.myTeamId;
                      return (
                        <tr key={team.teamId}
                          className={`border-b border-border/50 ${isMe ? "bg-orange-50" : i % 2 === 0 ? "" : "bg-black/[0.02]"}`}>
                          <td className={`px-3 py-2 sticky left-0 z-10 text-[11px] font-bold ${isMe ? "bg-orange-50" : i % 2 === 0 ? "bg-background" : "bg-black/[0.02]"} ${rankColor(team.powerRank)}`}>
                            {team.powerRank}
                          </td>
                          <td className={`px-3 py-2 sticky left-8 z-10 truncate max-w-[120px] ${isMe ? "text-orange-600 font-semibold bg-orange-50" : i % 2 === 0 ? "text-slate-600 bg-background" : "text-slate-600 bg-black/[0.02]"}`}>
                            {team.teamName}
                          </td>
                          {cats.map((cat) => {
                            const rank = team.categoryRanks?.[cat] ?? 5;
                            const val = team.categoryValues?.[cat];
                            const fmtVal = val != null ? (
                              cat === "AVG" ? val.toFixed(3) :
                              cat === "ERA" || cat === "WHIP" ? val.toFixed(2) :
                              String(Math.round(val))
                            ) : "-";
                            return (
                              <td key={cat} className="px-2 py-2 text-right">
                                <div className={`font-mono tabular-nums text-[11px] ${catRankColor(rank)} rounded px-1 py-0.5 inline-block`}>
                                  #{rank}
                                </div>
                                <div className="text-[10px] font-mono tabular-nums text-slate-500 mt-0.5">
                                  {fmtVal}
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
          ))}
        </div>
      )}

      {/* Rankings table */}
      {activeView === "rankings" && <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-border bg-surface text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-3 w-10 text-center">#</th>
              <th className="px-3 py-3">Team</th>
              <th className="px-3 py-3 text-right">Avg Rank</th>
              <th className="px-3 py-3 text-right">Raw</th>
              <th className="px-3 py-3 text-right">Wtd</th>
              <th className="px-3 py-3 text-right">BAT</th>
              <th className="px-3 py-3 text-right">PIT</th>
              <th className="px-3 py-3 text-center">Chg</th>
              <th className="px-3 py-3 text-center">History</th>
            </tr>
          </thead>
          <tbody>
            {data.teams.map((team, i) => {
              const isMe = team.teamId === data.myTeamId;
              const isExpanded = expanded === team.teamId;
              return (
                <React.Fragment key={team.teamId}>
                <tr
                  className={`border-b border-border/50 cursor-pointer ${isMe ? "bg-orange-50" : i % 2 === 0 ? "" : "bg-black/[0.02]"}`}
                  onClick={() => setExpanded(isExpanded ? null : team.teamId)}
                >
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-[13px] font-bold ${rankBg(team.powerRank)} ${rankColor(team.powerRank)}`}>
                      {team.powerRank}
                    </span>
                  </td>
                  <td className={`px-3 py-3 font-medium ${isMe ? "text-orange-600" : "text-slate-700"}`}>
                    {team.teamName}
                  </td>
                  <td className={`px-3 py-3 text-right font-mono font-bold tabular-nums ${avgRankColor(team.compositeAvgRank)}`}>
                    {team.compositeAvgRank.toFixed(2)}
                  </td>
                  <td className={`px-3 py-3 text-right font-mono tabular-nums ${
                    team.rawScore > 0 ? "text-emerald-600" : team.rawScore < 0 ? "text-red-500" : "text-slate-500"
                  }`}>
                    {team.rawScore >= 0 ? "+" : ""}{team.rawScore.toFixed(1)}
                  </td>
                  <td className={`px-3 py-3 text-right font-mono tabular-nums ${
                    team.weightedScore > 0 ? "text-emerald-600" : team.weightedScore < 0 ? "text-red-500" : "text-slate-500"
                  }`}>
                    {team.weightedScore >= 0 ? "+" : ""}{team.weightedScore.toFixed(1)}
                  </td>
                  <td className={`px-3 py-3 text-right font-mono tabular-nums ${avgRankColor(team.battingAvgRank)}`}>
                    {team.battingAvgRank.toFixed(1)}
                  </td>
                  <td className={`px-3 py-3 text-right font-mono tabular-nums ${avgRankColor(team.pitchingAvgRank)}`}>
                    {team.pitchingAvgRank.toFixed(1)}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <TrendIndicator change={team.rankChange} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <Sparkline points={team.weeklyTrend ?? []} />
                  </td>
                </tr>
                {isExpanded && (
                  <tr className={isMe ? "bg-orange-50/50" : "bg-slate-50/50"}>
                    <td colSpan={9} className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {CATS_ORDER.map((cat) => {
                          const rank = team.categoryRanks?.[cat] ?? 5;
                          return (
                            <div key={cat} className={`rounded px-2 py-1 text-center text-[10px] font-bold ${catRankColor(rank)}`}>
                              {cat} #{rank}
                            </div>
                          );
                        })}
                      </div>
                      {team.weeklyTrend && team.weeklyTrend.length > 1 && (
                        <div className="mt-2 flex gap-2 text-[10px] text-slate-500">
                          {team.weeklyTrend.map((pt) => (
                            <span key={pt.week} className="tabular-nums">
                              W{pt.week}: #{pt.powerRank}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>}

      {/* Legend */}
      {activeView === "rankings" && (
        <div className="mt-4 flex flex-wrap gap-4 text-[10px] text-slate-400">
          <span><strong>Avg Rank</strong> — Mean of all 16 category ranks (lower = better)</span>
          <span><strong>Raw</strong> — Sum of stat deltas from league average</span>
          <span><strong>Wtd</strong> — Category-weighted quality score (adjusted for what wins matchups)</span>
          <span><strong>BAT/PIT</strong> — Batting and pitching avg ranks</span>
        </div>
      )}
    </div>
  );
}
