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

function safeNum(val: number): number {
  return Number.isFinite(val) ? val : 0;
}

export default function PickValuePage() {
  const [data, setData] = useState<OwnerSeason[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  const years = useMemo(() => {
    return [...new Set(data.map((d) => d.year))].sort((a, b) => a - b);
  }, [data]);

  const leagueSize = useMemo(() => {
    if (years.length === 0) return 10;
    const counts = years.map((y) => data.filter((d) => d.year === y).length);
    return Math.max(...counts);
  }, [data, years]);

  const pickAnalysis = useMemo(() => {
    if (!data.length || years.length === 0) return [];

    const byYear: Record<number, OwnerSeason[]> = {};
    for (const s of data) {
      if (!byYear[s.year]) byYear[s.year] = [];
      byYear[s.year].push(s);
    }

    const results: {
      pick: number;
      avgStanding: number;
      top3Pct: number;
      bottom3Pct: number;
      bestFinish: number;
      worstFinish: number;
      seasons: number;
    }[] = [];

    for (let pick = 1; pick <= leagueSize; pick++) {
      const standings: number[] = [];
      for (const year of years) {
        const yearTeams = byYear[year];
        if (!yearTeams) continue;
        const sorted = [...yearTeams].sort((a, b) => {
          const totalA = safeNum(a.wins) + safeNum(a.losses) + safeNum(a.ties);
          const totalB = safeNum(b.wins) + safeNum(b.losses) + safeNum(b.ties);
          const pctA = totalA > 0 ? safeNum(a.wins) / totalA : 0;
          const pctB = totalB > 0 ? safeNum(b.wins) / totalB : 0;
          return pctB - pctA;
        });
        if (pick <= sorted.length) {
          standings.push(sorted[pick - 1].standing);
        }
      }
      if (standings.length === 0) continue;
      const avg = standings.reduce((a, b) => a + b, 0) / standings.length;
      results.push({
        pick,
        avgStanding: safeNum(avg),
        top3Pct: safeNum((standings.filter((s) => s <= 3).length / standings.length) * 100),
        bottom3Pct: safeNum((standings.filter((s) => s >= leagueSize - 2).length / standings.length) * 100),
        bestFinish: Math.min(...standings),
        worstFinish: Math.max(...standings),
        seasons: standings.length,
      });
    }

    return results;
  }, [data, years, leagueSize]);

  const standingCorrelation = useMemo(() => {
    if (!data.length) return [];
    const byYear: Record<number, OwnerSeason[]> = {};
    for (const s of data) {
      if (!byYear[s.year]) byYear[s.year] = [];
      byYear[s.year].push(s);
    }
    const pairs: { pick: number; standing: number; year: number; owner: string }[] = [];
    for (const year of years) {
      const yearTeams = byYear[year];
      if (!yearTeams) continue;
      const sorted = [...yearTeams].sort((a, b) => {
        const totalA = safeNum(a.wins) + safeNum(a.losses) + safeNum(a.ties);
        const totalB = safeNum(b.wins) + safeNum(b.losses) + safeNum(b.ties);
        return (totalB > 0 ? safeNum(b.wins) / totalB : 0) - (totalA > 0 ? safeNum(a.wins) / totalA : 0);
      });
      sorted.forEach((s, i) => {
        pairs.push({ pick: i + 1, standing: s.standing, year: s.year, owner: s.owner });
      });
    }
    return pairs;
  }, [data, years]);

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading...</div>;
  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load data</div>
        <div className="text-[12px] text-slate-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-gray-900">Draft Pick Value</h1>
        <div className="text-[12px] text-slate-500">
          How draft position correlates with final standings across {years.length} seasons ({years[0]}&ndash;{years[years.length - 1]})
        </div>
      </div>

      {/* Pick value table */}
      {pickAnalysis.length > 0 && (
        <div className="mb-6 rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border bg-surface text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2.5 text-left">Rank (by win %)</th>
                <th className="px-2 py-2.5 text-center">Avg Finish</th>
                <th className="px-2 py-2.5 text-center">Top 3 %</th>
                <th className="px-2 py-2.5 text-center">Bottom 3 %</th>
                <th className="px-2 py-2.5 text-center">Best</th>
                <th className="px-2 py-2.5 text-center">Worst</th>
                <th className="px-2 py-2.5 text-center">Seasons</th>
              </tr>
            </thead>
            <tbody>
              {pickAnalysis.map((p) => {
                const barWidth = Math.min(100, p.top3Pct);
                return (
                  <tr key={p.pick} className="border-b border-border/50">
                    <td className="px-3 py-2 font-bold text-slate-700">#{p.pick}</td>
                    <td className={`px-2 py-2 text-center font-mono tabular-nums font-bold ${
                      p.avgStanding <= 3 ? "text-emerald-600" :
                      p.avgStanding <= 6 ? "text-slate-700" : "text-red-600"
                    }`}>{p.avgStanding.toFixed(1)}</td>
                    <td className="px-2 py-2 text-center">
                      <div className="flex items-center gap-1.5 justify-center">
                        <span className="font-mono tabular-nums text-emerald-600 font-bold">{p.top3Pct.toFixed(0)}%</span>
                        <div className="w-16 h-1.5 rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${barWidth}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className={`px-2 py-2 text-center font-mono tabular-nums ${
                      p.bottom3Pct > 30 ? "text-red-600" : "text-slate-500"
                    }`}>{p.bottom3Pct.toFixed(0)}%</td>
                    <td className="px-2 py-2 text-center font-mono tabular-nums text-emerald-600">{p.bestFinish}</td>
                    <td className="px-2 py-2 text-center font-mono tabular-nums text-red-600">{p.worstFinish}</td>
                    <td className="px-2 py-2 text-center font-mono tabular-nums text-slate-500">{p.seasons}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Scatter: draft rank vs finish */}
      {standingCorrelation.length > 0 && (
        <div className="rounded-lg border border-border bg-surface px-4 py-4">
          <div className="mb-3">
            <div className="text-[12px] font-bold text-gray-900">Draft Rank vs Final Standing</div>
            <div className="text-[10px] text-slate-500">Each dot is a team in a season. Diagonal = perfect correlation.</div>
          </div>
          <div className="relative" style={{ height: "280px" }}>
            <svg viewBox="0 0 300 280" className="w-full h-full">
              {/* Grid lines */}
              {Array.from({ length: leagueSize }, (_, i) => (
                <line key={`h${i}`} x1="30" y1={20 + (i * 240) / (leagueSize - 1)} x2="290" y2={20 + (i * 240) / (leagueSize - 1)}
                  stroke="#e2e8f0" strokeWidth="0.5" />
              ))}
              {Array.from({ length: leagueSize }, (_, i) => (
                <line key={`v${i}`} x1={30 + (i * 260) / (leagueSize - 1)} y1="20" x2={30 + (i * 260) / (leagueSize - 1)} y2="260"
                  stroke="#e2e8f0" strokeWidth="0.5" />
              ))}
              {/* Diagonal reference */}
              <line x1="30" y1="20" x2="290" y2="260" stroke="#f97316" strokeWidth="1" strokeDasharray="4,3" opacity="0.3" />
              {/* Axis labels */}
              {Array.from({ length: leagueSize }, (_, i) => (
                <text key={`xl${i}`} x={30 + (i * 260) / (leagueSize - 1)} y="275" textAnchor="middle" fontSize="8" fill="#94a3b8">{i + 1}</text>
              ))}
              {Array.from({ length: leagueSize }, (_, i) => (
                <text key={`yl${i}`} x="24" y={24 + (i * 240) / (leagueSize - 1)} textAnchor="end" fontSize="8" fill="#94a3b8">{i + 1}</text>
              ))}
              <text x="160" y="12" textAnchor="middle" fontSize="8" fill="#64748b">Rank (by win %)</text>
              <text x="8" y="140" textAnchor="middle" fontSize="8" fill="#64748b" transform="rotate(-90,8,140)">Final Standing</text>
              {/* Data points */}
              {standingCorrelation.map((p, i) => {
                const x = 30 + ((p.pick - 1) * 260) / Math.max(1, leagueSize - 1);
                const y = 20 + ((p.standing - 1) * 240) / Math.max(1, leagueSize - 1);
                const overperformed = p.standing < p.pick;
                return (
                  <circle key={i} cx={x} cy={y} r="3.5"
                    fill={overperformed ? "#059669" : p.standing > p.pick ? "#dc2626" : "#f97316"}
                    opacity="0.5" />
                );
              })}
            </svg>
          </div>
          <div className="mt-2 flex items-center gap-4 text-[9px] text-slate-400 justify-center">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" /> Overperformed</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" /> As expected</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" /> Underperformed</span>
          </div>
        </div>
      )}
    </div>
  );
}
