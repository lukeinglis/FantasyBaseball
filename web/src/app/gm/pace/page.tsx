"use client";

import { useState, useEffect, useMemo } from "react";
import { EspnAuthRequired } from "@/components/EspnAuthRequired";
import {
  CATEGORY_WEIGHTS,
  categoryTierClass,
  LOWER_IS_BETTER,
  isPunt,
  ALL_CATS_BY_WEIGHT,
} from "@/lib/category-weights";

interface CategoryRanking {
  cat: string;
  weight: number;
  rank: number;
  value: number;
  leaderValue: number;
  gap: number;
  tier: "STRONG" | "MIDDLE" | "WEAK";
  isPunt: boolean;
}

interface MarginToFlip {
  cat: string;
  weight: number;
  currentRank: number;
  targetRank: number;
  myValue: number;
  targetValue: number;
  gap: number;
  direction: "increase" | "decrease";
}

interface DiagnosisData {
  teamName: string;
  record: string;
  categoryRankings: CategoryRanking[];
  marginToFlip: MarginToFlip[];
}

function fmtStat(cat: string, val: number): string {
  if (!Number.isFinite(val)) return "-";
  if (cat === "AVG") return val.toFixed(3);
  if (cat === "ERA" || cat === "WHIP") return val.toFixed(2);
  return String(Math.round(val));
}

export default function PacePage() {
  const [diagnosis, setDiagnosis] = useState<DiagnosisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analysis/roster-diagnosis")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setDiagnosis(d);
      })
      .catch(() => setError("FETCH_FAILED"))
      .finally(() => setLoading(false));
  }, []);

  // Season progress estimate (~26 weeks, started late March)
  const seasonProgress = useMemo(() => {
    const seasonStart = new Date("2026-03-25");
    const seasonEnd = new Date("2026-09-28");
    const now = new Date();
    const totalDays = (seasonEnd.getTime() - seasonStart.getTime()) / 86400000;
    const elapsedDays = Math.max(1, (now.getTime() - seasonStart.getTime()) / 86400000);
    const pct = Math.min(1, Math.max(0.01, elapsedDays / totalDays));
    const weeksElapsed = Math.max(1, Math.round(elapsedDays / 7));
    const weeksTotal = Math.round(totalDays / 7);
    return { pct, weeksElapsed, weeksTotal, daysRemaining: Math.max(0, Math.round(totalDays - elapsedDays)) };
  }, []);

  // Pace projections
  const paceData = useMemo(() => {
    if (!diagnosis) return [];
    const { pct } = seasonProgress;

    return diagnosis.categoryRankings.map((cr) => {
      const isRate = cr.cat === "AVG" || cr.cat === "ERA" || cr.cat === "WHIP";
      const projectedValue = isRate ? cr.value : cr.value / pct;
      const leaderProjected = isRate
        ? cr.leaderValue
        : cr.leaderValue / pct;

      // Find margin to flip entry
      const flip = diagnosis.marginToFlip.find((m) => m.cat === cr.cat);

      // Determine per-week needed to reach target rank
      let perWeekNeeded: number | null = null;
      if (flip && seasonProgress.weeksElapsed > 0) {
        const weeksLeft = seasonProgress.weeksTotal - seasonProgress.weeksElapsed;
        if (weeksLeft > 0 && !isRate) {
          perWeekNeeded = flip.gap / weeksLeft;
        }
      }

      return {
        ...cr,
        projectedValue,
        leaderProjected,
        flip,
        perWeekNeeded,
        isRate,
      };
    });
  }, [diagnosis, seasonProgress]);

  // Group categories
  const fixable = paceData.filter(
    (c) => c.flip && !c.isPunt && (c.tier === "MIDDLE" || c.tier === "WEAK")
  );
  const comfortable = paceData.filter(
    (c) => c.tier === "STRONG" && !c.isPunt
  );
  const puntCats = paceData.filter((c) => c.isPunt);

  if (loading)
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          Loading pace data...
        </div>
      </div>
    );
  if (error === "ESPN_CREDS_MISSING" || error === "MY_ESPN_TEAM_ID_MISSING")
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <EspnAuthRequired />
      </div>
    );
  if (error || !diagnosis)
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load</div>
        <div className="text-[12px] text-slate-500">{error}</div>
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Category Pace Tracker</h1>
          <span className="text-[12px] text-slate-500">
            {diagnosis.teamName} · {diagnosis.record}
          </span>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Season Progress
          </div>
          <div className="text-[14px] font-bold tabular-nums text-slate-700">
            Week {seasonProgress.weeksElapsed}/{seasonProgress.weeksTotal}
          </div>
          <div className="text-[10px] text-slate-400">
            {seasonProgress.daysRemaining}d remaining (
            {Math.round(seasonProgress.pct * 100)}%)
          </div>
        </div>
      </div>

      {/* Full category table */}
      <div className="mb-6 rounded-xl border border-border bg-surface overflow-hidden">
        <div className="border-b border-border px-4 py-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
            All Categories
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border bg-slate-50 text-left text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2">Cat</th>
                <th className="px-3 py-2 text-right">Weight</th>
                <th className="px-3 py-2 text-center">Rank</th>
                <th className="px-3 py-2 text-right">Current</th>
                <th className="px-3 py-2 text-right">Projected</th>
                <th className="px-3 py-2 text-right">Leader Proj</th>
                <th className="px-3 py-2 text-center">Flip To</th>
                <th className="px-3 py-2 text-right">Gap</th>
                <th className="px-3 py-2 text-right">Per Week</th>
              </tr>
            </thead>
            <tbody>
              {paceData.map((c) => (
                <tr
                  key={c.cat}
                  className={`border-b border-border ${c.isPunt ? "opacity-40" : ""}`}
                >
                  <td className={`px-3 py-1.5 font-medium ${categoryTierClass(c.cat)}`}>
                    {c.cat}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">
                    {c.weight.toFixed(3)}
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        c.tier === "STRONG"
                          ? "text-emerald-700 bg-emerald-50"
                          : c.tier === "WEAK"
                            ? "text-red-700 bg-red-50"
                            : "text-amber-700 bg-amber-50"
                      }`}
                    >
                      #{c.rank}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-mono text-slate-700">
                    {fmtStat(c.cat, c.value)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-mono text-slate-500">
                    {fmtStat(c.cat, c.projectedValue)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-mono text-slate-400">
                    {fmtStat(c.cat, c.leaderProjected)}
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    {c.flip ? (
                      <span className="font-bold text-emerald-600">
                        #{c.flip.targetRank}
                      </span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-mono text-amber-600">
                    {c.flip ? fmtStat(c.cat, c.flip.gap) : "-"}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-mono text-slate-500">
                    {c.perWeekNeeded !== null
                      ? fmtStat(c.cat, c.perWeekNeeded)
                      : c.flip && c.isRate
                        ? "rate"
                        : "-"}
                    {c.perWeekNeeded !== null && (
                      <span className="text-[9px] text-slate-400">/wk</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Three groups */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Fixable */}
        <div className="rounded-xl border border-amber-300 bg-surface overflow-hidden">
          <div className="border-b border-amber-300 px-4 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">
              Fixable
            </span>
            <span className="ml-2 text-[10px] text-slate-400">
              Close to flipping
            </span>
          </div>
          <div className="divide-y divide-border">
            {fixable.length > 0 ? (
              fixable.map((c) => (
                <div key={c.cat} className="px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-[13px] font-bold ${categoryTierClass(c.cat)}`}>
                      {c.cat}
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-slate-600">
                      #{c.rank}
                    </span>
                  </div>
                  {c.flip && (
                    <div className="mt-1 text-[10px] text-amber-600">
                      Gap of {fmtStat(c.cat, c.flip.gap)} to reach #{c.flip.targetRank}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="px-4 py-4 text-center text-[12px] text-slate-400">
                No fixable categories
              </div>
            )}
          </div>
        </div>

        {/* Comfortable */}
        <div className="rounded-xl border border-emerald-300 bg-surface overflow-hidden">
          <div className="border-b border-emerald-300 px-4 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
              Comfortable
            </span>
            <span className="ml-2 text-[10px] text-slate-400">
              Safe margin
            </span>
          </div>
          <div className="divide-y divide-border">
            {comfortable.length > 0 ? (
              comfortable.map((c) => (
                <div key={c.cat} className="px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-[13px] font-bold ${categoryTierClass(c.cat)}`}>
                      {c.cat}
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-emerald-600">
                      #{c.rank}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-4 text-center text-[12px] text-slate-400">
                No strong categories yet
              </div>
            )}
          </div>
        </div>

        {/* Punt */}
        <div className="rounded-xl border border-slate-200 bg-surface overflow-hidden opacity-60">
          <div className="border-b border-slate-200 px-4 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Punt
            </span>
          </div>
          <div className="divide-y divide-border">
            {puntCats.map((c) => (
              <div key={c.cat} className="px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-slate-400">{c.cat}</span>
                  <span className="text-[11px] font-mono tabular-nums text-slate-400">
                    #{c.rank}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
