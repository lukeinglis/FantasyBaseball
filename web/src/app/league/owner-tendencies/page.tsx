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
  avgStanding: number;
  bestFinish: number;
  worstFinish: number;
  top3Count: number;
  totalWins: number;
  totalLosses: number;
  totalTies: number;
  winPct: number;
  consistency: number;
  years: OwnerSeason[];
  recentTeamName: string;
}

function safeNum(val: number): number {
  return Number.isFinite(val) ? val : 0;
}

export default function OwnerTendenciesPage() {
  const [data, setData] = useState<OwnerSeason[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"avgStanding" | "winPct" | "consistency" | "top3Count">("avgStanding");

  useEffect(() => {
    fetch("/api/owners")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(() => setError("FETCH_FAILED"))
      .finally(() => setLoading(false));
  }, []);

  const owners = useMemo((): OwnerSummary[] => {
    if (!data.length) return [];
    const grouped: Record<string, OwnerSeason[]> = {};
    for (const s of data) {
      if (!grouped[s.owner]) grouped[s.owner] = [];
      grouped[s.owner].push(s);
    }
    return Object.entries(grouped)
      .map(([owner, seasons]) => {
        const standings = seasons.map((s) => s.standing).filter(Number.isFinite);
        const avgStanding = standings.length > 0 ? standings.reduce((a, b) => a + b, 0) / standings.length : 99;
        const bestFinish = standings.length > 0 ? Math.min(...standings) : 99;
        const worstFinish = standings.length > 0 ? Math.max(...standings) : 0;
        const top3Count = standings.filter((s) => s <= 3).length;
        const totalWins = seasons.reduce((s, r) => s + safeNum(r.wins), 0);
        const totalLosses = seasons.reduce((s, r) => s + safeNum(r.losses), 0);
        const totalTies = seasons.reduce((s, r) => s + safeNum(r.ties), 0);
        const total = totalWins + totalLosses + totalTies;
        const winPct = total > 0 ? totalWins / total : 0;
        const mean = avgStanding;
        const variance = standings.length > 1
          ? standings.reduce((sum, s) => sum + (s - mean) ** 2, 0) / standings.length
          : 0;
        const consistency = Math.sqrt(variance);
        const sorted = [...seasons].sort((a, b) => b.year - a.year);
        return {
          owner,
          seasons: seasons.length,
          avgStanding: safeNum(avgStanding),
          bestFinish,
          worstFinish,
          top3Count,
          totalWins,
          totalLosses,
          totalTies,
          winPct: safeNum(winPct),
          consistency: safeNum(consistency),
          years: sorted,
          recentTeamName: sorted[0]?.teamName ?? "",
        };
      })
      .filter((o) => o.seasons >= 2)
      .sort((a, b) => {
        if (sortBy === "avgStanding") return a.avgStanding - b.avgStanding;
        if (sortBy === "winPct") return b.winPct - a.winPct;
        if (sortBy === "consistency") return a.consistency - b.consistency;
        return b.top3Count - a.top3Count;
      });
  }, [data, sortBy]);

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading...</div>;
  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load owner data</div>
        <div className="text-[12px] text-slate-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Owner Tendencies</h1>
          <div className="text-[12px] text-slate-500">
            Historical performance across {new Set(data.map((d) => d.year)).size} seasons
          </div>
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden text-[10px] font-semibold">
          {([
            { key: "avgStanding" as const, label: "Avg Finish" },
            { key: "winPct" as const, label: "Win %" },
            { key: "consistency" as const, label: "Consistency" },
            { key: "top3Count" as const, label: "Top 3s" },
          ]).map((s) => (
            <button
              key={s.key}
              onClick={() => setSortBy(s.key)}
              className={`px-2.5 py-1.5 transition-colors ${sortBy === s.key ? "bg-orange-600 text-white" : "bg-surface text-slate-600 hover:bg-slate-100"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Owner cards */}
      <div className="space-y-3">
        {owners.map((o, idx) => {
          const standingColor = (s: number) =>
            s === 1 ? "text-amber-500 font-bold" :
            s <= 3 ? "text-emerald-600 font-bold" :
            s <= 6 ? "text-slate-600" :
            s <= 9 ? "text-orange-600" : "text-red-600";
          return (
            <div key={o.owner} className="rounded-lg border border-border bg-surface">
              <div className="border-b border-border px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-[12px] font-bold text-slate-400 w-6 tabular-nums">{idx + 1}.</span>
                  <div>
                    <div className="text-[14px] font-bold text-gray-900">{o.owner}</div>
                    <div className="text-[11px] text-slate-500">{o.recentTeamName}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className={`text-[16px] font-bold tabular-nums ${o.avgStanding <= 3 ? "text-emerald-600" : o.avgStanding <= 6 ? "text-slate-700" : "text-red-600"}`}>
                      {o.avgStanding.toFixed(1)}
                    </div>
                    <div className="text-[8px] text-slate-400 uppercase">Avg Finish</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[16px] font-bold tabular-nums text-slate-700">
                      {(o.winPct * 100).toFixed(1)}%
                    </div>
                    <div className="text-[8px] text-slate-400 uppercase">Win %</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-[16px] font-bold tabular-nums ${o.top3Count >= 3 ? "text-emerald-600" : "text-slate-700"}`}>
                      {o.top3Count}
                    </div>
                    <div className="text-[8px] text-slate-400 uppercase">Top 3</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-[16px] font-bold tabular-nums ${o.consistency < 2.5 ? "text-emerald-600" : o.consistency > 3.5 ? "text-red-600" : "text-slate-700"}`}>
                      {o.consistency.toFixed(1)}
                    </div>
                    <div className="text-[8px] text-slate-400 uppercase">Volatility</div>
                  </div>
                </div>
              </div>
              <div className="px-4 py-2 flex items-center gap-1">
                <span className="text-[9px] text-slate-400 w-12 shrink-0">Finishes:</span>
                <div className="flex gap-1 flex-wrap">
                  {o.years.map((y) => (
                    <span key={y.year} className={`text-[10px] font-mono tabular-nums rounded px-1.5 py-0.5 ${
                      y.standing === 1 ? "bg-amber-100 text-amber-700 border border-amber-300" :
                      y.standing <= 3 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                      y.standing >= 9 ? "bg-red-50 text-red-600 border border-red-200" :
                      "bg-slate-50 text-slate-600 border border-border"
                    }`}>
                      {y.year.toString().slice(2)}:{y.standing}
                    </span>
                  ))}
                </div>
                <span className="ml-auto text-[10px] text-slate-400 font-mono tabular-nums shrink-0">
                  {o.totalWins}-{o.totalLosses}-{o.totalTies}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
