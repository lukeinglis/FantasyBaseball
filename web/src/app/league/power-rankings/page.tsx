"use client";

import { useState, useEffect } from "react";

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
    return <span className="text-[11px] text-slate-400">--</span>;
  }
  if (change === 0) {
    return <span className="text-[11px] text-slate-400">--</span>;
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

function EspnSetupCard() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-surface px-8 py-10 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-orange-600/60">Setup Required</div>
      <div className="mt-3 text-xl font-bold text-gray-900">Connect ESPN Credentials</div>
      <div className="mt-3 text-[13px] text-slate-500">
        Power Rankings pulls live data from your private ESPN league.
      </div>
    </div>
  );
}

export default function PowerRankingsPage() {
  const [data, setData] = useState<PowerRankingsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnSetupCard /></div>;
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
      <div className="mb-5">
        <h1 className="text-lg font-bold text-gray-900">Power Rankings</h1>
        <span className="text-[12px] text-slate-500">
          Week {data.currentWeek} — Composite ranking across all 16 categories, weighted by predictive value
        </span>
      </div>

      {/* Rankings table */}
      <div className="overflow-x-auto rounded-lg border border-border">
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
              <th className="px-3 py-3 text-center">Trend</th>
              <th className="px-3 py-3 text-center">Prev</th>
            </tr>
          </thead>
          <tbody>
            {data.teams.map((team, i) => {
              const isMe = team.teamId === data.myTeamId;
              return (
                <tr key={team.teamId}
                  className={`border-b border-border/50 ${isMe ? "bg-orange-50" : i % 2 === 0 ? "" : "bg-black/[0.02]"}`}>
                  {/* Power Rank */}
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-[13px] font-bold ${rankBg(team.powerRank)} ${rankColor(team.powerRank)}`}>
                      {team.powerRank}
                    </span>
                  </td>
                  {/* Team Name */}
                  <td className={`px-3 py-3 font-medium ${isMe ? "text-orange-600" : "text-slate-700"}`}>
                    {team.teamName}
                  </td>
                  {/* Composite Avg Rank */}
                  <td className={`px-3 py-3 text-right font-mono font-bold tabular-nums ${avgRankColor(team.compositeAvgRank)}`}>
                    {team.compositeAvgRank.toFixed(2)}
                  </td>
                  {/* Raw Score (matches spreadsheet: sum of value-avg deltas) */}
                  <td className={`px-3 py-3 text-right font-mono tabular-nums ${
                    team.rawScore > 0 ? "text-emerald-600" : team.rawScore < 0 ? "text-red-500" : "text-slate-500"
                  }`}>
                    {team.rawScore >= 0 ? "+" : ""}{team.rawScore.toFixed(1)}
                  </td>
                  {/* Weighted Score (category-importance-weighted, sign-adjusted) */}
                  <td className={`px-3 py-3 text-right font-mono tabular-nums ${
                    team.weightedScore > 0 ? "text-emerald-600" : team.weightedScore < 0 ? "text-red-500" : "text-slate-500"
                  }`}>
                    {team.weightedScore >= 0 ? "+" : ""}{team.weightedScore.toFixed(1)}
                  </td>
                  {/* Batting Avg Rank */}
                  <td className={`px-3 py-3 text-right font-mono tabular-nums ${avgRankColor(team.battingAvgRank)}`}>
                    {team.battingAvgRank.toFixed(1)}
                  </td>
                  {/* Pitching Avg Rank */}
                  <td className={`px-3 py-3 text-right font-mono tabular-nums ${avgRankColor(team.pitchingAvgRank)}`}>
                    {team.pitchingAvgRank.toFixed(1)}
                  </td>
                  {/* Trend */}
                  <td className="px-3 py-3 text-center">
                    <TrendIndicator change={team.rankChange} />
                  </td>
                  {/* Previous Week Rank */}
                  <td className="px-3 py-3 text-center text-[12px] text-slate-400 tabular-nums">
                    {team.prevWeekPowerRank !== null ? `#${team.prevWeekPowerRank}` : "--"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-[10px] text-slate-400">
        <span><strong>Avg Rank</strong> — Mean of all 16 category ranks (lower = better)</span>
        <span><strong>Raw</strong> — Sum of stat deltas from league average</span>
        <span><strong>Wtd</strong> — Category-weighted quality score (adjusted for what wins matchups)</span>
        <span><strong>BAT/PIT</strong> — Batting and pitching avg ranks</span>
      </div>
    </div>
  );
}
