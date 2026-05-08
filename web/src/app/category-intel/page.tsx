"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { LOWER_IS_BETTER } from "@/lib/category-weights";

interface CategoryWeights {
  weights: Record<string, number>;
  raw_correlations: Record<string, number>;
  negative_categories: string[];
  method: string;
  sample_sizes: Record<string, number>;
}

interface LiveTeam {
  teamId: number;
  teamName: string;
  categories: Record<string, number>;
  ranks: Record<string, number>;
}

interface LiveStatsData {
  myTeamId: number;
  teams: LiveTeam[];
}

export default function CategoryIntelPage() {
  const [data, setData] = useState<CategoryWeights | null>(null);
  const [liveData, setLiveData] = useState<LiveStatsData | null>(null);

  useEffect(() => {
    fetch("/api/weights")
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); });
    fetch("/api/espn/league-stats?scope=season")
      .then((r) => r.json())
      .then((d) => { if (!d.error && d.teams) setLiveData(d); })
      .catch(() => {});
  }, []);

  const chartData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.weights)
      .map(([cat, weight]) => ({
        category: cat,
        weight,
        isNegative: data.negative_categories.includes(cat),
      }))
      .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  }, [data]);

  const sorted = useMemo(() => [...chartData].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)), [chartData]);
  const top3 = sorted.slice(0, 3);
  const bottom3 = sorted.slice(-3).reverse();
  const svWeight = data?.weights?.SV;

  if (!data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-5">
        <h1 className="mb-5 text-xl font-bold text-gray-900">Category Intel</h1>
        <p className="text-[13px] text-slate-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-5">
      <h1 className="mb-5 text-xl font-bold text-gray-900">Category Intel</h1>

      {/* Chart */}
      <div className="mb-6 rounded-lg border border-border bg-surface p-4">
        <div className="mb-4 flex items-baseline gap-2">
          <h2 className="text-[13px] font-semibold text-gray-900">Category Weights</h2>
          <span className="text-[11px] text-slate-600">{data.method}</span>
        </div>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
              <XAxis type="number" stroke="#1c2940" tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis type="category" dataKey="category" stroke="#1c2940" tick={{ fill: "#94a3b8", fontSize: 12 }} width={50} />
              <Tooltip
                contentStyle={{ backgroundColor: "#0d1321", border: "1px solid #1c2940", borderRadius: "6px", color: "#e2e8f0", fontSize: 12 }}
                formatter={(value) => [Number(value).toFixed(4), "Weight"]}
              />
              <Bar dataKey="weight" radius={[0, 3, 3, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.isNegative ? "#ef4444" : "#38bdf8"} opacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex gap-4 text-[11px] text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm bg-sky-400" /> Positive
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm bg-red-500" /> Inverse
          </span>
        </div>
      </div>

      {/* In-Season Category Standings */}
      {liveData && data && (
        <div className="mb-6 rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-4 py-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              In-Season Category Standings
            </span>
            <span className="text-[9px] text-slate-400">Your rank in each category, colored by weight tier</span>
          </div>
          <div className="px-4 py-4">
            {(() => {
              const myTeam = liveData.teams.find((t) => t.teamId === liveData.myTeamId);
              if (!myTeam) return <div className="text-[11px] text-slate-500">No data</div>;

              const catEntries = sorted.map((d) => {
                const rank = myTeam.ranks[d.category] ?? 0;
                const value = myTeam.categories[d.category] ?? 0;
                return { ...d, rank, value };
              });

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {catEntries.map((c) => {
                      const rankColor =
                        c.rank <= 3 ? "bg-emerald-500 text-white" :
                        c.rank <= 6 ? "bg-yellow-400 text-yellow-900" :
                        "bg-red-500 text-white";
                      const tierBorder =
                        Math.abs(c.weight) >= 0.09 ? "border-orange-300" :
                        Math.abs(c.weight) >= 0.05 ? "border-blue-300" :
                        "border-slate-200";
                      const fmtVal = LOWER_IS_BETTER.has(c.category)
                        ? c.value.toFixed(c.category === "L" ? 0 : 2)
                        : c.category === "AVG" ? c.value.toFixed(3)
                        : String(Math.round(c.value));
                      return (
                        <div key={c.category} className={`rounded-lg border p-2 text-center ${tierBorder}`}>
                          <div className="text-[10px] font-bold text-slate-600">{c.category}</div>
                          <div className={`mt-1 inline-flex items-center justify-center w-7 h-7 rounded-full text-[12px] font-bold ${rankColor}`}>
                            {c.rank}
                          </div>
                          <div className="mt-1 text-[10px] font-mono tabular-nums text-slate-600">{fmtVal}</div>
                          <div className="text-[8px] text-slate-400">
                            wt: {(Math.abs(c.weight) * 100).toFixed(1)}%
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Weighted strength summary */}
                  {(() => {
                    const strong = catEntries.filter((c) => c.rank <= 3 && Math.abs(c.weight) >= 0.05);
                    const weak = catEntries.filter((c) => c.rank >= 8 && Math.abs(c.weight) >= 0.05);
                    return (
                      <div className="flex flex-wrap gap-4 pt-2 border-t border-border text-[11px]">
                        {strong.length > 0 && (
                          <div>
                            <span className="text-emerald-600 font-semibold">Strong in high-weight: </span>
                            <span className="text-slate-600">{strong.map((c) => c.category).join(", ")}</span>
                          </div>
                        )}
                        {weak.length > 0 && (
                          <div>
                            <span className="text-red-600 font-semibold">Weak in high-weight: </span>
                            <span className="text-slate-600">{weak.map((c) => c.category).join(", ")}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* All Weights */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">All Weights</h2>
          <div className="space-y-1.5">
            {sorted.map((d) => (
              <div key={d.category} className="flex items-center justify-between text-[13px]">
                <span className={d.isNegative ? "text-red-600/80" : "text-slate-400"}>{d.category}</span>
                <div className="flex items-center gap-2">
                  <div className="h-1 w-24 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full ${d.isNegative ? "bg-red-500/60" : "bg-sky-500/60"}`}
                      style={{ width: `${Math.min(100, (Math.abs(d.weight) / Math.abs(sorted[0].weight)) * 100)}%` }}
                    />
                  </div>
                  <span className="w-14 text-right font-mono text-[11px] text-slate-500">{d.weight.toFixed(4)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Takeaways */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Most Predictive
            </h2>
            {top3.map((d, i) => (
              <div key={d.category} className="flex items-center gap-2 py-1 text-[13px]">
                <span className="font-mono text-[11px] text-slate-600">{i + 1}.</span>
                <span className="font-medium text-gray-900">{d.category}</span>
                <span className="font-mono text-[11px] text-slate-600">{d.weight.toFixed(4)}</span>
              </div>
            ))}
          </div>

          {svWeight !== undefined && (
            <div className="rounded-lg border border-orange-300 bg-orange-50 p-4">
              <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-orange-600/80">
                Saves Are Overrated
              </h3>
              <p className="text-[13px] text-slate-500">
                SV weight: <span className="font-mono text-orange-600">{svWeight.toFixed(4)}</span>
                {Math.abs(svWeight) < Math.abs(sorted[Math.floor(sorted.length / 2)]?.weight ?? 0) && (
                  <span> — below median. Don&apos;t overpay for closers.</span>
                )}
              </p>
            </div>
          )}

          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Deprioritize
            </h2>
            {bottom3.map((d) => (
              <div key={d.category} className="flex items-center gap-2 py-1 text-[13px]">
                <span className="text-slate-400">—</span>
                <span className="text-slate-500">{d.category}</span>
                <span className="font-mono text-[11px] text-slate-400">{d.weight.toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
