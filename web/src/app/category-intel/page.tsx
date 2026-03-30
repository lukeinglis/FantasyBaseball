"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface CategoryWeights {
  weights: Record<string, number>;
  raw_correlations: Record<string, number>;
  negative_categories: string[];
  method: string;
  sample_sizes: Record<string, number>;
}

export default function CategoryIntelPage() {
  const [data, setData] = useState<CategoryWeights | null>(null);

  useEffect(() => {
    fetch("/api/weights")
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); });
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
        <h1 className="mb-5 text-xl font-bold text-white">Category Intel</h1>
        <p className="text-[13px] text-slate-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-5">
      <h1 className="mb-5 text-xl font-bold text-white">Category Intel</h1>

      {/* Chart */}
      <div className="mb-6 rounded-lg border border-border bg-surface p-4">
        <div className="mb-4 flex items-baseline gap-2">
          <h2 className="text-[13px] font-semibold text-white">Category Weights</h2>
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

      <div className="grid gap-4 lg:grid-cols-2">
        {/* All Weights */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">All Weights</h2>
          <div className="space-y-1.5">
            {sorted.map((d) => (
              <div key={d.category} className="flex items-center justify-between text-[13px]">
                <span className={d.isNegative ? "text-red-400/80" : "text-slate-200"}>{d.category}</span>
                <div className="flex items-center gap-2">
                  <div className="h-1 w-24 overflow-hidden rounded-full bg-slate-800">
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
                <span className="font-medium text-white">{d.category}</span>
                <span className="font-mono text-[11px] text-slate-600">{d.weight.toFixed(4)}</span>
              </div>
            ))}
          </div>

          {svWeight !== undefined && (
            <div className="rounded-lg border border-orange-600/20 bg-orange-600/5 p-4">
              <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-orange-500/80">
                Saves Are Overrated
              </h3>
              <p className="text-[13px] text-slate-400">
                SV weight: <span className="font-mono text-orange-400">{svWeight.toFixed(4)}</span>
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
                <span className="text-slate-700">—</span>
                <span className="text-slate-500">{d.category}</span>
                <span className="font-mono text-[11px] text-slate-700">{d.weight.toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
