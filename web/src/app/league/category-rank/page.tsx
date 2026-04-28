"use client";

import { useState, useEffect, useMemo } from "react";

interface TeamCategoryStats {
  teamId: number;
  teamName: string;
  abbrev: string;
  wins: number;
  losses: number;
  ties: number;
  categories: Record<string, number>;
  ranks: Record<string, number>;
  deltas: Record<string, number>;
  battingAvgRank: number;
  pitchingAvgRank: number;
  compositeAvgRank: number;
  powerRank: number;
}

interface LeagueStatsData {
  scoringPeriodId: number;
  myTeamId: number;
  teams: TeamCategoryStats[];
  averages: Record<string, number>;
}

const BAT_CATS = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG"];
const PIT_CATS = ["K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"];
const LOWER_IS_BETTER = new Set(["ERA", "WHIP", "L"]);

function rankColor(rank: number): string {
  if (rank <= 2) return "text-emerald-600 font-bold";
  if (rank <= 4) return "text-emerald-600/70";
  if (rank <= 6) return "text-slate-600";
  if (rank <= 8) return "text-orange-600";
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

function fmtValue(cat: string, val: number | undefined): string {
  if (val === undefined) return "-";
  if (cat === "AVG") return val.toFixed(3);
  if (cat === "ERA" || cat === "WHIP") return val.toFixed(2);
  return String(Math.round(val));
}

function fmtDelta(cat: string, delta: number | undefined): string {
  if (delta === undefined) return "";
  if (cat === "AVG") return (delta >= 0 ? "+" : "") + delta.toFixed(3);
  if (cat === "ERA" || cat === "WHIP") return (delta >= 0 ? "+" : "") + delta.toFixed(2);
  return (delta >= 0 ? "+" : "") + delta.toFixed(1);
}

function deltaColor(delta: number | undefined): string {
  if (delta === undefined || delta === 0) return "text-slate-400";
  return delta > 0 ? "text-emerald-600" : "text-red-500";
}

function EspnSetupCard() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-surface px-8 py-10 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-orange-600/60">Setup Required</div>
      <div className="mt-3 text-xl font-bold text-gray-900">Connect ESPN Credentials</div>
      <div className="mt-3 text-[13px] text-slate-500">
        Category Rank pulls live data from your private ESPN league. Add environment variables to Vercel.
      </div>
      <div className="mt-5 rounded-lg border border-border bg-background px-4 py-4 text-left text-[12px]">
        <div className="space-y-2 font-mono">
          <div><span className="text-orange-600">ESPN_S2</span> · <span className="text-orange-600">ESPN_SWID</span> · <span className="text-orange-600">MY_ESPN_TEAM_ID</span></div>
        </div>
      </div>
    </div>
  );
}

export default function CategoryRankPage() {
  const [data, setData] = useState<LeagueStatsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"my-ranks" | "leaderboard">("my-ranks");
  const [scope, setScope] = useState<"season" | "week">("season");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/espn/league-stats?scope=${scope}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); setLoading(false); return; }
        setData(d);
      })
      .catch(() => setError("FETCH_FAILED"))
      .finally(() => setLoading(false));
  }, [scope]);

  const myTeam = useMemo(
    () => data?.teams.find((t) => t.teamId === data.myTeamId) ?? null,
    [data]
  );

  const avgRank = useMemo(() => {
    if (!myTeam) return 0;
    const allRanks = Object.values(myTeam.ranks);
    return allRanks.length ? allRanks.reduce((a, b) => a + b, 0) / allRanks.length : 0;
  }, [myTeam]);

  const strengths = useMemo(() => {
    if (!myTeam) return [];
    return [...BAT_CATS, ...PIT_CATS]
      .filter((cat) => (myTeam.ranks[cat] ?? 10) <= 3)
      .sort((a, b) => (myTeam.ranks[a] ?? 10) - (myTeam.ranks[b] ?? 10));
  }, [myTeam]);

  const weaknesses = useMemo(() => {
    if (!myTeam) return [];
    return [...BAT_CATS, ...PIT_CATS]
      .filter((cat) => (myTeam.ranks[cat] ?? 0) >= 8)
      .sort((a, b) => (myTeam.ranks[b] ?? 0) - (myTeam.ranks[a] ?? 0));
  }, [myTeam]);

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading category rankings...</div>;
  if (error === "ESPN_CREDS_MISSING" || error === "MY_ESPN_TEAM_ID_MISSING") {
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnSetupCard /></div>;
  }
  if (error || !data || !myTeam) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load category rankings</div>
        <div className="text-[12px] text-slate-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Category Rankings</h1>
          <span className="text-[12px] text-slate-500">
            {scope === "season" ? "Season cumulative" : `Week ${data.scoringPeriodId}`} &middot; Where you rank 1-10 in each category
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className={`text-2xl font-bold tabular-nums ${avgRank <= 4 ? "text-emerald-600" : avgRank <= 6 ? "text-orange-600" : "text-red-600"}`}>
              {avgRank.toFixed(1)}
            </div>
            <div className="text-[10px] text-slate-600">AVG RANK</div>
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden text-[11px] font-semibold">
            <button onClick={() => setScope("season")}
              className={`px-3 py-1.5 transition-colors ${scope === "season" ? "bg-orange-600 text-white" : "bg-surface text-slate-600 hover:bg-slate-100"}`}>
              Season
            </button>
            <button onClick={() => setScope("week")}
              className={`px-3 py-1.5 transition-colors ${scope === "week" ? "bg-orange-600 text-white" : "bg-surface text-slate-600 hover:bg-slate-100"}`}>
              This Week
            </button>
          </div>
          <div className="flex gap-0.5 rounded bg-surface p-0.5">
            {(["my-ranks", "leaderboard"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`rounded px-3 py-1 text-[11px] font-bold transition-colors ${
                  view === v ? "bg-black/10 text-gray-900" : "text-slate-500 hover:text-slate-700"
                }`}>
                {v === "my-ranks" ? "My Ranks" : "Leaderboard"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "my-ranks" ? (
        <>
          {/* Category cards — my rankings */}
          {[
            { label: "Batting", cats: BAT_CATS },
            { label: "Pitching", cats: PIT_CATS },
          ].map(({ label, cats }) => (
            <div key={label} className="mb-6">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                {cats.map((cat) => {
                  const rank = myTeam.ranks[cat] ?? 0;
                  const val = myTeam.categories[cat];
                  const delta = myTeam.deltas?.[cat];
                  return (
                    <div key={cat} className={`rounded-lg border px-3 py-3 text-center ${rankBg(rank)}`}>
                      <div className="text-[10px] font-bold text-slate-500">{cat}</div>
                      <div className={`mt-1 text-[22px] font-bold tabular-nums ${rankColor(rank)}`}>
                        {rank > 0 ? `#${rank}` : "-"}
                      </div>
                      <div className="mt-0.5 text-[11px] font-mono text-slate-500">
                        {fmtValue(cat, val)}
                      </div>
                      {delta !== undefined && (
                        <div className={`mt-0.5 text-[10px] font-mono tabular-nums ${deltaColor(delta)}`}>
                          {fmtDelta(cat, delta)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Strengths & Weaknesses */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-emerald-300 bg-surface p-4">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-600/70">
                Strengths (Top 3)
              </div>
              {strengths.length > 0 ? (
                <div className="space-y-1">
                  {strengths.map((cat) => (
                    <div key={cat} className="flex items-center justify-between">
                      <span className="text-[13px] text-slate-400">{cat}</span>
                      <span className="font-mono text-[13px] text-emerald-600">#{myTeam.ranks[cat]}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[12px] text-slate-600">No categories in top 3</div>
              )}
            </div>
            <div className="rounded-lg border border-red-300 bg-surface p-4">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-red-600/70">
                Weaknesses (Bottom 3)
              </div>
              {weaknesses.length > 0 ? (
                <div className="space-y-1">
                  {weaknesses.map((cat) => (
                    <div key={cat} className="flex items-center justify-between">
                      <span className="text-[13px] text-slate-400">{cat}</span>
                      <span className="font-mono text-[13px] text-red-600">#{myTeam.ranks[cat]}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[12px] text-slate-600">No categories in bottom 3</div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Leaderboard view — all teams, all categories */
        <>
          {[
            { label: "Batting", cats: BAT_CATS },
            { label: "Pitching", cats: PIT_CATS },
          ].map(({ label, cats }) => (
            <div key={label} className="mb-6">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-[12px]">
                  <thead className="border-b border-border bg-surface text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5 sticky left-0 bg-surface">Team</th>
                      <th className="px-2 py-2.5 text-center w-10">W-L</th>
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
                          <td className={`px-3 py-2 sticky left-0 ${isMe ? "text-orange-600 font-semibold bg-orange-50" : "text-slate-400 bg-background"}`}>
                            {team.teamName}
                          </td>
                          <td className="px-2 py-2 text-center text-slate-500 tabular-nums">
                            {team.wins}-{team.losses}
                          </td>
                          {cats.map((cat) => {
                            const rank = team.ranks[cat] ?? 0;
                            const val = team.categories[cat];
                            const delta = team.deltas?.[cat];
                            return (
                              <td key={cat} className="px-2 py-2 text-right">
                                <div className={`font-mono tabular-nums ${rankColor(rank)}`}>
                                  {fmtValue(cat, val)}
                                </div>
                                <div className={`text-[9px] ${rankColor(rank)}`}>#{rank}</div>
                                {delta !== undefined && (
                                  <div className={`text-[9px] font-mono tabular-nums ${deltaColor(delta)}`}>
                                    {fmtDelta(cat, delta)}
                                  </div>
                                )}
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
        </>
      )}
    </div>
  );
}
