"use client";

import { useState, useEffect, useMemo } from "react";

interface DraftPick {
  year: number;
  round: number;
  pick: number;
  overall: number;
  team: string;
  playerName: string;
  keeper: boolean;
}

// Update this each year with your ESPN team name for that season
const MY_TEAM = "Tony Mansolino"; // 2025; update once 2026 team name is known

export default function DraftResultsPage() {
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [roundFilter, setRoundFilter] = useState<number | "all">("all");

  useEffect(() => {
    fetch("/api/draft-results")
      .then((r) => r.json())
      .then((data: DraftPick[]) => {
        // Show only 2026
        setPicks(data.filter((p) => p.year === 2026));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const teams = useMemo(() => [...new Set(picks.map((p) => p.team))].sort(), [picks]);
  const rounds = useMemo(() => [...new Set(picks.map((p) => p.round))].sort((a, b) => a - b), [picks]);

  const filtered = useMemo(() => {
    let list = picks;
    if (teamFilter !== "all") list = list.filter((p) => p.team === teamFilter);
    if (roundFilter !== "all") list = list.filter((p) => p.round === roundFilter);
    return list.sort((a, b) => a.round !== b.round ? a.round - b.round : a.pick - b.pick);
  }, [picks, teamFilter, roundFilter]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        Loading...
      </div>
    );
  }

  if (picks.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="text-[13px] font-semibold uppercase tracking-widest text-orange-500/60">
          2026 Draft Results
        </div>
        <div className="mt-4 text-2xl font-bold text-white">No data yet</div>
        <div className="mt-3 text-[14px] text-slate-500">
          Run the ESPN data fetch script to populate 2026 draft results:
        </div>
        <pre className="mt-4 rounded-lg border border-border bg-surface px-4 py-3 text-left text-[12px] text-slate-300">
          cd /path/to/FantasyBaseball{"\n"}
          python3 scripts/fetch_espn_history.py{"\n"}
          # Then commit seasons/2026/draft_results.csv
        </pre>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">2026 Draft Results</h1>
          <div className="mt-1 text-[12px] text-slate-500">
            {picks.length} picks · {teams.length} teams · {rounds.length} rounds
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-[12px]">
          <span className="text-slate-500">Team:</span>
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="rounded border border-border bg-surface px-2 py-1 text-[12px] text-white focus:outline-none"
          >
            <option value="all">All</option>
            {teams.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 text-[12px]">
          <span className="text-slate-500">Round:</span>
          <select
            value={roundFilter}
            onChange={(e) => setRoundFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="rounded border border-border bg-surface px-2 py-1 text-[12px] text-white focus:outline-none"
          >
            <option value="all">All</option>
            {rounds.map((r) => (
              <option key={r} value={r}>Round {r}</option>
            ))}
          </select>
        </div>
        {(teamFilter !== "all" || roundFilter !== "all") && (
          <button
            onClick={() => { setTeamFilter("all"); setRoundFilter("all"); }}
            className="text-[11px] text-slate-600 hover:text-slate-400"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-lg border border-border">
        <table className="w-full text-left text-[13px]">
          <thead className="sticky top-0 border-b border-border bg-surface text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2.5">Rd</th>
              <th className="px-2 py-2.5">Pk</th>
              <th className="px-3 py-2.5">Team</th>
              <th className="px-3 py-2.5">Player</th>
              <th className="px-3 py-2.5">Type</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => {
              const isMe = p.team === MY_TEAM;
              return (
                <tr
                  key={i}
                  className={`border-b border-border/50 transition-colors ${
                    isMe ? "bg-orange-600/5" : i % 2 === 0 ? "" : "bg-white/[0.01]"
                  } hover:bg-white/[0.03]`}
                >
                  <td className="px-3 py-1.5 font-mono text-slate-500">{p.round}</td>
                  <td className="px-2 py-1.5 font-mono text-slate-600">{p.pick}</td>
                  <td className={`px-3 py-1.5 ${isMe ? "font-semibold text-orange-500" : "text-slate-300"}`}>
                    {p.team}
                  </td>
                  <td className="px-3 py-1.5 font-medium text-slate-100">{p.playerName}</td>
                  <td className="px-3 py-1.5">
                    {p.keeper && (
                      <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-400">
                        KEEPER
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
