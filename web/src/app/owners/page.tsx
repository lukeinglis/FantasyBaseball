"use client";

import { useState, useEffect, useMemo } from "react";

interface OwnerSeason {
  year: number;
  owner: string;
  teamName: string;
  standing: number;
  wins: number;
  losses: number;
  ties: number;
}

interface OwnerSummary {
  owner: string;
  seasons: number;
  avgFinish: number;
  bestFinish: number;
  totalWins: number;
  totalLosses: number;
  totalTies: number;
  winPct: number;
  championships: number;
}

export default function OwnersPage() {
  const [data, setData] = useState<OwnerSeason[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string>("");

  useEffect(() => {
    fetch("/api/owners").then((r) => r.json()).then(setData);
  }, []);

  const summaries = useMemo(() => {
    const byOwner = new Map<string, OwnerSeason[]>();
    for (const row of data) {
      if (!row.owner) continue;
      if (!byOwner.has(row.owner)) byOwner.set(row.owner, []);
      byOwner.get(row.owner)!.push(row);
    }

    const list: OwnerSummary[] = [];
    for (const [owner, seasons] of byOwner) {
      const totalWins = seasons.reduce((s, r) => s + r.wins, 0);
      const totalLosses = seasons.reduce((s, r) => s + r.losses, 0);
      const totalTies = seasons.reduce((s, r) => s + r.ties, 0);
      const totalGames = totalWins + totalLosses + totalTies;
      list.push({
        owner,
        seasons: seasons.length,
        avgFinish: seasons.reduce((s, r) => s + r.standing, 0) / seasons.length,
        bestFinish: Math.min(...seasons.map((r) => r.standing)),
        totalWins, totalLosses, totalTies,
        winPct: totalGames > 0 ? totalWins / totalGames : 0,
        championships: seasons.filter((r) => r.standing === 1).length,
      });
    }
    return list.sort((a, b) => a.avgFinish - b.avgFinish);
  }, [data]);

  const ownerSeasons = useMemo(() => {
    if (!selectedOwner) return [];
    return data.filter((r) => r.owner === selectedOwner).sort((a, b) => b.year - a.year);
  }, [data, selectedOwner]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-5">
      <h1 className="mb-5 text-xl font-bold text-white">Owner Records</h1>

      <div className="mb-6 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-border bg-surface text-[11px] uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-3 py-2.5 font-medium">#</th>
              <th className="px-3 py-2.5 font-medium">Owner</th>
              <th className="px-2 py-2.5 text-right font-medium">Yrs</th>
              <th className="px-2 py-2.5 text-right font-medium">Avg</th>
              <th className="px-2 py-2.5 text-right font-medium">Best</th>
              <th className="px-3 py-2.5 text-right font-medium">Record</th>
              <th className="px-2 py-2.5 text-right font-medium">Win%</th>
              <th className="px-2 py-2.5 text-right font-medium">Titles</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((s, i) => (
              <tr key={s.owner}
                onClick={() => setSelectedOwner(selectedOwner === s.owner ? "" : s.owner)}
                className={`cursor-pointer border-b border-border/30 transition-colors ${
                  selectedOwner === s.owner ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
                } ${i % 2 ? "bg-white/[0.01]" : ""}`}>
                <td className="px-3 py-1.5 font-mono text-slate-600">{i + 1}</td>
                <td className="px-3 py-1.5 font-medium text-white">{s.owner}</td>
                <td className="px-2 py-1.5 text-right font-mono text-slate-400">{s.seasons}</td>
                <td className="px-2 py-1.5 text-right">
                  <span className={`font-mono font-semibold ${
                    s.avgFinish <= 3 ? "text-sky-400" : s.avgFinish <= 5 ? "text-amber-400/80" : "text-slate-400"
                  }`}>{s.avgFinish.toFixed(1)}</span>
                </td>
                <td className="px-2 py-1.5 text-right">
                  <span className={`font-mono ${s.bestFinish === 1 ? "font-bold text-amber-400" : "text-slate-400"}`}>
                    {s.bestFinish}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-slate-400 whitespace-nowrap">
                  {s.totalWins}-{s.totalLosses}{s.totalTies > 0 ? `-${s.totalTies}` : ""}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-slate-400">
                  {(s.winPct * 100).toFixed(1)}%
                </td>
                <td className="px-2 py-1.5 text-right">
                  {s.championships > 0 ? (
                    <span className="font-mono font-bold text-amber-400">{s.championships}</span>
                  ) : (
                    <span className="text-slate-700">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedOwner && (
        <div className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-3 py-2">
            <h2 className="text-[13px] font-semibold text-white">{selectedOwner}</h2>
          </div>
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-border text-[11px] uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Year</th>
                <th className="px-3 py-2 font-medium">Team</th>
                <th className="px-2 py-2 text-right font-medium">Finish</th>
                <th className="px-2 py-2 text-right font-medium">W</th>
                <th className="px-2 py-2 text-right font-medium">L</th>
                <th className="px-2 py-2 text-right font-medium">T</th>
                <th className="px-2 py-2 text-right font-medium">Win%</th>
              </tr>
            </thead>
            <tbody>
              {ownerSeasons.map((s, idx) => {
                const games = s.wins + s.losses + s.ties;
                const pct = games > 0 ? s.wins / games : 0;
                return (
                  <tr key={s.year} className={`border-b border-border/30 ${idx % 2 ? "bg-white/[0.01]" : ""}`}>
                    <td className="px-3 py-1.5 font-mono text-slate-500">{s.year}</td>
                    <td className="px-3 py-1.5 text-white">{s.teamName}</td>
                    <td className="px-2 py-1.5 text-right">
                      <span className={`font-mono font-bold ${
                        s.standing === 1 ? "text-amber-400" : s.standing <= 3 ? "text-sky-400" : s.standing >= 8 ? "text-red-400/70" : "text-white"
                      }`}>{s.standing}</span>
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-slate-400">{s.wins}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-slate-400">{s.losses}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-slate-400">{s.ties}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-slate-400">{(pct * 100).toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data.length === 0 && <p className="text-[13px] text-slate-600">Loading...</p>}
    </div>
  );
}
