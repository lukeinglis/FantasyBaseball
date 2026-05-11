"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { DataFreshness } from "@/components/DataFreshness";
import { EspnAuthRequired } from "@/components/EspnAuthRequired";
import { sanitizeNum } from "@/lib/sanitize";

interface WeekBatting {
  H: number; AB: number; R: number; HR: number;
  TB: number; RBI: number; BB: number; SB: number; AVG: number;
}

interface WeekPitching {
  IP: number; H: number; ER: number; BB: number;
  K: number; QS: number; W: number; L: number;
  SV: number; HD: number; ERA: number; WHIP: number;
}

interface WeekLog {
  week: number;
  startDate: string;
  endDate: string;
  oppName: string;
  catWins: number;
  catLosses: number;
  catTies: number;
  matchResult: "W" | "L" | "T";
  batting: WeekBatting;
  pitching: WeekPitching;
}

interface SeasonLogData {
  myTeamId: number;
  myTeamName: string;
  currentWeek: number;
  weeks: WeekLog[];
  seasonTotals: { batting: WeekBatting; pitching: WeekPitching };
}

const BAT_COLS = ["H", "AB", "R", "HR", "TB", "RBI", "BB", "SB", "AVG"] as const;
const PIT_COLS = ["IP", "H", "ER", "BB", "K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"] as const;

function fmtVal(cat: string, val: number): string {
  if (!Number.isFinite(val)) return "-";
  if (cat === "AVG") return val.toFixed(3);
  if (cat === "ERA" || cat === "WHIP") return val.toFixed(2);
  if (cat === "IP") return val.toFixed(1);
  return String(Math.round(val));
}

function fmtDate(d: string): string {
  if (!d) return "";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function resultBadge(result: "W" | "L" | "T"): { text: string; bg: string; color: string } {
  if (result === "W") return { text: "W", bg: "bg-emerald-100", color: "text-emerald-700" };
  if (result === "L") return { text: "L", bg: "bg-red-100", color: "text-red-700" };
  return { text: "T", bg: "bg-orange-100", color: "text-orange-700" };
}

function StatsTable({ label, weeks, cols, totals, weekAverages, bestWeeks, worstWeeks }: {
  label: string;
  weeks: WeekLog[];
  cols: readonly string[];
  totals: Record<string, number>;
  weekAverages: Record<string, number>;
  bestWeeks: Record<string, number>;
  worstWeeks: Record<string, number>;
}) {
  const statsKey = label === "Batting" ? "batting" : "pitching";

  return (
    <div className="rounded-lg border border-border bg-surface overflow-x-auto">
      <div className="border-b border-border px-4 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</span>
      </div>
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-border bg-black/[0.02]">
            <th className="px-2 py-1.5 text-left font-semibold text-slate-500 w-10">Wk</th>
            <th className="px-2 py-1.5 text-left font-semibold text-slate-500 w-16">Dates</th>
            <th className="px-2 py-1.5 text-left font-semibold text-slate-500 w-8">Res</th>
            <th className="px-2 py-1.5 text-left font-semibold text-slate-500 w-20 truncate">vs</th>
            {cols.map((col) => (
              <th key={col} className="px-1.5 py-1.5 text-right font-semibold text-slate-500">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => {
            const badge = resultBadge(w.matchResult);
            const stats = w[statsKey] as unknown as Record<string, number>;
            return (
              <tr key={w.week} className="border-b border-border hover:bg-black/[0.02]">
                <td className="px-2 py-1.5 font-mono tabular-nums text-slate-600">{w.week}</td>
                <td className="px-2 py-1.5 text-[10px] text-slate-400 whitespace-nowrap">{fmtDate(w.startDate)}</td>
                <td className="px-2 py-1.5">
                  <span className={`inline-block w-5 text-center text-[10px] font-bold rounded ${badge.bg} ${badge.color}`}>
                    {badge.text}
                  </span>
                  <span className="ml-1 text-[9px] text-slate-400 font-mono tabular-nums">
                    {w.catWins}-{w.catLosses}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-[10px] text-slate-500 truncate max-w-[100px]">{w.oppName}</td>
                {cols.map((col) => {
                  const val = sanitizeNum(stats[col]);
                  const isBest = bestWeeks[col] === w.week;
                  const isWorst = worstWeeks[col] === w.week;
                  return (
                    <td key={col} className={`px-1.5 py-1.5 text-right font-mono tabular-nums ${
                      isBest ? "text-emerald-600 font-bold" :
                      isWorst ? "text-red-600 font-bold" :
                      "text-slate-700"
                    }`}>
                      {fmtVal(col, val)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {/* Season Totals */}
          <tr className="border-t-2 border-border bg-black/[0.04] font-bold">
            <td className="px-2 py-2 text-[10px] text-slate-600" colSpan={4}>SEASON TOTALS</td>
            {cols.map((col) => (
              <td key={col} className="px-1.5 py-2 text-right font-mono tabular-nums text-slate-800">
                {fmtVal(col, sanitizeNum(totals[col]))}
              </td>
            ))}
          </tr>
          {/* Weekly Average */}
          <tr className="bg-black/[0.02]">
            <td className="px-2 py-1.5 text-[10px] text-slate-400" colSpan={4}>AVG/WEEK</td>
            {cols.map((col) => (
              <td key={col} className="px-1.5 py-1.5 text-right font-mono tabular-nums text-[10px] text-slate-500">
                {fmtVal(col, sanitizeNum(weekAverages[col]))}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function SeasonLogPage() {
  const [data, setData] = useState<SeasonLogData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch("/api/espn/season-log")
      .then((r) => r.json())
      .then((d: SeasonLogData & { error?: string }) => {
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(() => setError("FETCH_FAILED"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/espn/season-log")
      .then((r) => r.json())
      .then((d: SeasonLogData & { error?: string }) => {
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(() => setError("FETCH_FAILED"))
      .finally(() => setLoading(false));
  }, []);

  // Compute best/worst weeks for each stat
  const { batBest, batWorst, pitBest, pitWorst, batAvg, pitAvg } = useMemo(() => {
    if (!data || data.weeks.length === 0) {
      return { batBest: {}, batWorst: {}, pitBest: {}, pitWorst: {}, batAvg: {}, pitAvg: {} };
    }

    const LOWER_BETTER = new Set(["ERA", "WHIP", "L", "ER", "H"]);
    const RATE_STATS = new Set(["AVG", "ERA", "WHIP"]);

    function findBestWorst(weeks: WeekLog[], cols: readonly string[], key: "batting" | "pitching") {
      const best: Record<string, number> = {};
      const worst: Record<string, number> = {};
      for (const col of cols) {
        let bestVal = LOWER_BETTER.has(col) ? Infinity : -Infinity;
        let worstVal = LOWER_BETTER.has(col) ? -Infinity : Infinity;
        let bestWeek = 0;
        let worstWeek = 0;
        for (const w of weeks) {
          const val = sanitizeNum((w[key] as unknown as Record<string, number>)[col]);
          if (LOWER_BETTER.has(col)) {
            if (val < bestVal) { bestVal = val; bestWeek = w.week; }
            if (val > worstVal) { worstVal = val; worstWeek = w.week; }
          } else {
            if (val > bestVal) { bestVal = val; bestWeek = w.week; }
            if (val < worstVal) { worstVal = val; worstWeek = w.week; }
          }
        }
        best[col] = bestWeek;
        worst[col] = worstWeek;
      }
      return { best, worst };
    }

    function computeAvg(totals: Record<string, number>, weekCount: number, cols: readonly string[]): Record<string, number> {
      const avg: Record<string, number> = {};
      for (const col of cols) {
        if (RATE_STATS.has(col)) {
          avg[col] = sanitizeNum(totals[col]);
        } else {
          avg[col] = weekCount > 0 ? sanitizeNum(totals[col]) / weekCount : 0;
        }
      }
      return avg;
    }

    const { best: batBest, worst: batWorst } = findBestWorst(data.weeks, BAT_COLS, "batting");
    const { best: pitBest, worst: pitWorst } = findBestWorst(data.weeks, PIT_COLS, "pitching");
    const batAvg = computeAvg(data.seasonTotals.batting as unknown as Record<string, number>, data.weeks.length, BAT_COLS);
    const pitAvg = computeAvg(data.seasonTotals.pitching as unknown as Record<string, number>, data.weeks.length, PIT_COLS);

    return { batBest, batWorst, pitBest, pitWorst, batAvg, pitAvg };
  }, [data]);

  const record = useMemo(() => {
    if (!data) return { w: 0, l: 0, t: 0 };
    return {
      w: data.weeks.filter((w) => w.matchResult === "W").length,
      l: data.weeks.filter((w) => w.matchResult === "L").length,
      t: data.weeks.filter((w) => w.matchResult === "T").length,
    };
  }, [data]);

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading season log...</div>;
  if (error === "ESPN_CREDS_MISSING" || error === "MY_ESPN_TEAM_ID_MISSING") {
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnAuthRequired /></div>;
  }
  if (error || !data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load season log</div>
        <div className="text-[12px] text-slate-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-600">Season Log</span>
          <DataFreshness onRefresh={fetchData} loading={loading} />
        </div>
        <div className="mt-1 flex items-center gap-3 flex-wrap">
          <span className="text-xl font-bold text-orange-600">{data.myTeamName}</span>
          <span className="text-[13px] font-bold tabular-nums">
            <span className="text-emerald-600">{record.w}</span>
            <span className="text-slate-400">-</span>
            <span className="text-red-600">{record.l}</span>
            {record.t > 0 && (
              <>
                <span className="text-slate-400">-</span>
                <span className="text-orange-600">{record.t}</span>
              </>
            )}
          </span>
          <span className="text-[11px] text-slate-400">
            Through Week {data.currentWeek}
          </span>
        </div>
        <div className="mt-1 flex gap-4 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded bg-emerald-500" /> Best week
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded bg-red-500" /> Worst week
          </span>
        </div>
      </div>

      {/* Batting Table */}
      <div className="mb-4">
        <StatsTable
          label="Batting"
          weeks={data.weeks}
          cols={BAT_COLS}
          totals={data.seasonTotals.batting as unknown as Record<string, number>}
          weekAverages={batAvg}
          bestWeeks={batBest}
          worstWeeks={batWorst}
        />
      </div>

      {/* Pitching Table */}
      <div className="mb-4">
        <StatsTable
          label="Pitching"
          weeks={data.weeks}
          cols={PIT_COLS}
          totals={data.seasonTotals.pitching as unknown as Record<string, number>}
          weekAverages={pitAvg}
          bestWeeks={pitBest}
          worstWeeks={pitWorst}
        />
      </div>
    </div>
  );
}
