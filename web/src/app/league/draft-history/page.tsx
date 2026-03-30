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

// Luke's team names by year — update as needed
const MY_TEAMS = new Set(["Buck Showalter", "Brandon Hyde", "Tony Mansolino"]);
const AVAILABLE_YEARS = [2019, 2021, 2022, 2023, 2024, 2025, 2026];

export default function DraftHistoryPage() {
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [roundFilter, setRoundFilter] = useState<number | "all">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/draft-results")
      .then((r) => r.json())
      .then((data: DraftPick[]) => {
        setPicks(data);
        // Default to most recent available year
        const years = [...new Set(data.map((p) => p.year))].sort((a, b) => b - a);
        if (years.length > 0) setSelectedYear(years[0]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const yearsWithData = useMemo(() => {
    const dataYears = new Set(picks.map((p) => p.year));
    return AVAILABLE_YEARS.filter((y) => dataYears.has(y)).sort((a, b) => b - a);
  }, [picks]);

  const yearPicks = useMemo(
    () => picks.filter((p) => p.year === selectedYear),
    [picks, selectedYear]
  );

  const teams = useMemo(() => [...new Set(yearPicks.map((p) => p.team))].sort(), [yearPicks]);
  const rounds = useMemo(
    () => [...new Set(yearPicks.map((p) => p.round))].sort((a, b) => a - b),
    [yearPicks]
  );

  const filtered = useMemo(() => {
    let list = yearPicks;
    if (teamFilter !== "all") list = list.filter((p) => p.team === teamFilter);
    if (roundFilter !== "all") list = list.filter((p) => p.round === roundFilter);
    if (search) list = list.filter((p) => p.playerName.toLowerCase().includes(search.toLowerCase()));
    return list.sort((a, b) => a.round !== b.round ? a.round - b.round : a.pick - b.pick);
  }, [yearPicks, teamFilter, roundFilter, search]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-500">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Draft History</h1>
          <div className="mt-1 text-[12px] text-slate-500">
            {yearPicks.length} picks · {teams.length} teams
            {yearPicks.some((p) => p.keeper) && ` · ${yearPicks.filter((p) => p.keeper).length} keepers`}
          </div>
        </div>

        {/* Year selector */}
        <div className="flex gap-1">
          {yearsWithData.map((y) => (
            <button
              key={y}
              onClick={() => { setSelectedYear(y); setTeamFilter("all"); setRoundFilter("all"); setSearch(""); }}
              className={`rounded px-2.5 py-1 text-[12px] font-semibold tabular-nums transition-colors ${
                selectedYear === y
                  ? "bg-white/10 text-white"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {y}
            </button>
          ))}
          {AVAILABLE_YEARS.filter((y) => !yearsWithData.includes(y)).map((y) => (
            <button key={y} disabled
              className="cursor-not-allowed rounded px-2.5 py-1 text-[12px] tabular-nums text-slate-700">
              {y}
            </button>
          ))}
        </div>
      </div>

      {yearPicks.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface px-6 py-12 text-center">
          <div className="text-slate-500">No draft data for {selectedYear}</div>
          {selectedYear === 2026 && (
            <div className="mt-2 text-[12px] text-slate-600">
              Run <code className="text-slate-400">python3 scripts/fetch_espn_history.py</code> and commit the results.
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search player..."
              className="rounded border border-border bg-surface px-2.5 py-1 text-[12px] text-white placeholder:text-slate-600 focus:outline-none"
            />
            <div className="flex items-center gap-2 text-[12px]">
              <span className="text-slate-500">Team:</span>
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="rounded border border-border bg-surface px-2 py-1 text-[12px] text-white focus:outline-none"
              >
                <option value="all">All</option>
                {teams.map((t) => <option key={t} value={t}>{t}</option>)}
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
                {rounds.map((r) => <option key={r} value={r}>Round {r}</option>)}
              </select>
            </div>
            {(teamFilter !== "all" || roundFilter !== "all" || search) && (
              <button
                onClick={() => { setTeamFilter("all"); setRoundFilter("all"); setSearch(""); }}
                className="text-[11px] text-slate-600 hover:text-slate-400"
              >
                Clear
              </button>
            )}
            <span className="ml-auto text-[11px] tabular-nums text-slate-600">{filtered.length} picks</span>
          </div>

          <div className="overflow-auto rounded-lg border border-border">
            <table className="w-full text-left text-[13px]">
              <thead className="sticky top-0 border-b border-border bg-surface text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Rd</th>
                  <th className="px-2 py-2.5">Pk</th>
                  <th className="px-3 py-2.5">Team</th>
                  <th className="px-3 py-2.5">Player</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => {
                  const isMe = MY_TEAMS.has(p.team);
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
        </>
      )}
    </div>
  );
}
