"use client";

import { useState, useEffect, useMemo } from "react";

interface StandingsRow {
  year: number;
  rank: number;
  team: string;
  W: number; L: number; T: number; PCT: number;
  H?: number; R?: number; HR?: number; TB?: number;
  RBI?: number; BB?: number; SB?: number; AVG?: number;
  K?: number; QS?: number; SV?: number; HD?: number;
  ERA?: number; WHIP?: number;
}

const STAT_CATS = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG", "K", "QS", "SV", "HD", "ERA", "WHIP"] as const;

export default function HistoryPage() {
  const [standings, setStandings] = useState<StandingsRow[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/standings")
      .then((r) => r.json())
      .then((data: StandingsRow[]) => {
        setStandings(data);
        const years = [...new Set(data.map((s) => s.year))].sort((a, b) => b - a);
        if (years.length > 0) setSelectedYear(years[0]);
      });
  }, []);

  const years = useMemo(() => [...new Set(standings.map((s) => s.year))].sort((a, b) => b - a), [standings]);

  const champions = useMemo(
    () => standings.filter((s) => s.rank === 1).sort((a, b) => b.year - a.year),
    [standings]
  );

  const yearStandings = useMemo(
    () => selectedYear ? standings.filter((s) => s.year === selectedYear).sort((a, b) => a.rank - b.rank) : [],
    [standings, selectedYear]
  );

  const activeCats = useMemo(() => {
    if (yearStandings.length === 0) return [];
    return STAT_CATS.filter((cat) =>
      yearStandings.some((row) => (row as unknown as Record<string, unknown>)[cat] !== undefined)
    );
  }, [yearStandings]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-5">
      <h1 className="mb-5 text-xl font-bold text-white">League History</h1>

      {/* Champions */}
      <div className="mb-6">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Champions</h2>
        <div className="flex flex-wrap gap-2">
          {champions.map((c) => (
            <button key={c.year} onClick={() => setSelectedYear(c.year)}
              className={`rounded border px-3 py-1.5 text-center transition-colors ${
                selectedYear === c.year
                  ? "border-amber-500/30 bg-amber-500/10"
                  : "border-border bg-surface hover:border-slate-600"
              }`}>
              <div className="text-[11px] tabular-nums text-slate-600">{c.year}</div>
              <div className="text-[13px] font-semibold text-amber-400">{c.team}</div>
              <div className="font-mono text-[10px] text-slate-600">
                {c.W}-{c.L}{c.T > 0 ? `-${c.T}` : ""}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Year picker */}
      <div className="mb-3 flex flex-wrap gap-1">
        {years.map((y) => (
          <button key={y} onClick={() => setSelectedYear(y)}
            className={`rounded px-2 py-0.5 font-mono text-[12px] transition-colors ${
              selectedYear === y ? "bg-white/10 text-white" : "text-slate-600 hover:text-slate-300"
            }`}>
            {y}
          </button>
        ))}
      </div>

      {/* Standings */}
      {selectedYear && yearStandings.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-border bg-surface text-[11px] uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-3 py-2.5 font-medium">RK</th>
                <th className="px-3 py-2.5 font-medium">Team</th>
                <th className="px-2 py-2.5 text-right font-medium">W</th>
                <th className="px-2 py-2.5 text-right font-medium">L</th>
                <th className="px-2 py-2.5 text-right font-medium">T</th>
                <th className="px-2 py-2.5 text-right font-medium">PCT</th>
                {activeCats.map((cat) => (
                  <th key={cat} className="px-2 py-2.5 text-right font-medium">{cat}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {yearStandings.map((row, idx) => (
                <tr key={`${row.year}-${row.team}`}
                  className={`border-b border-border/30 ${idx % 2 ? "bg-white/[0.01]" : ""} ${
                    row.rank === 1 ? "bg-amber-500/[0.03]" : ""
                  }`}>
                  <td className="px-3 py-1.5">
                    <span className={`font-mono font-bold ${
                      row.rank === 1 ? "text-amber-400" : row.rank <= 3 ? "text-sky-400" : "text-slate-600"
                    }`}>{row.rank}</span>
                  </td>
                  <td className="px-3 py-1.5 font-medium text-white">{row.team}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-slate-400">{row.W}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-slate-400">{row.L}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-slate-400">{row.T}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-sky-400/70">{row.PCT.toFixed(3)}</td>
                  {activeCats.map((cat) => {
                    const val = (row as unknown as Record<string, number | undefined>)[cat];
                    const fmt = cat === "AVG" || cat === "ERA" || cat === "WHIP"
                      ? val?.toFixed(3) : val !== undefined ? Math.round(val).toString() : undefined;
                    return (
                      <td key={cat} className="px-2 py-1.5 text-right font-mono text-slate-400">{fmt ?? "—"}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {standings.length === 0 && <p className="text-[13px] text-slate-600">Loading...</p>}
    </div>
  );
}
