"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { DataFreshness } from "@/components/DataFreshness";
import { EspnAuthRequired } from "@/components/EspnAuthRequired";
import { sanitizeNum } from "@/lib/sanitize";
import { categoryTierClass, LOWER_IS_BETTER } from "@/lib/category-weights";

interface TeamRawStats {
  H: number; AB: number; R: number; HR: number;
  TB: number; RBI: number; BB: number; SB: number; AVG: number;
}

interface TeamPitchingRaw {
  IP: number; H: number; ER: number; BB: number;
  K: number; QS: number; W: number; L: number;
  SV: number; HD: number; ERA: number; WHIP: number;
}

interface DailyPoints {
  date: string; dayLabel: string; myPts: number; oppPts: number;
}

interface CatResult {
  cat: string; myValue: number; oppValue: number;
  result: "WIN" | "LOSS" | "TIE" | "PENDING";
}

interface TrackerData {
  week: number;
  startDate: string;
  endDate: string;
  daysElapsed: number;
  totalDays: number;
  myTeam: { id: number; name: string };
  oppTeam: { id: number; name: string };
  batting: { my: TeamRawStats; opp: TeamRawStats };
  pitching: { my: TeamPitchingRaw; opp: TeamPitchingRaw };
  dailyPoints: DailyPoints[];
  catResults: CatResult[];
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

function resultColor(result: string): string {
  if (result === "WIN") return "text-emerald-600";
  if (result === "LOSS") return "text-red-600";
  if (result === "TIE") return "text-orange-600";
  return "text-slate-500";
}

function resultBg(result: string): string {
  if (result === "WIN") return "bg-emerald-50";
  if (result === "LOSS") return "bg-red-50";
  if (result === "TIE") return "bg-orange-50";
  return "";
}

function compareCat(cat: string, myVal: number, oppVal: number): "WIN" | "LOSS" | "TIE" {
  if (LOWER_IS_BETTER.has(cat)) {
    if (myVal < oppVal) return "WIN";
    if (myVal > oppVal) return "LOSS";
    return "TIE";
  }
  if (myVal > oppVal) return "WIN";
  if (myVal < oppVal) return "LOSS";
  return "TIE";
}

function StatTable({ label, myStats, oppStats, cols, myTeamName, oppTeamName }: {
  label: string;
  myStats: Record<string, number>;
  oppStats: Record<string, number>;
  cols: readonly string[];
  myTeamName: string;
  oppTeamName: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface overflow-x-auto">
      <div className="border-b border-border px-4 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</span>
      </div>
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-border bg-black/[0.02]">
            <th className="px-3 py-1.5 text-left font-semibold text-slate-500 w-28">Team</th>
            {cols.map((col) => {
              const result = compareCat(col, sanitizeNum(myStats[col]), sanitizeNum(oppStats[col]));
              return (
                <th key={col} className={`px-2 py-1.5 text-right font-semibold tabular-nums ${resultColor(result)}`}>
                  {col}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border">
            <td className="px-3 py-1.5 font-semibold text-orange-600 truncate max-w-[120px]">{myTeamName}</td>
            {cols.map((col) => {
              const myVal = sanitizeNum(myStats[col]);
              const oppVal = sanitizeNum(oppStats[col]);
              const result = compareCat(col, myVal, oppVal);
              return (
                <td key={col} className={`px-2 py-1.5 text-right font-mono tabular-nums ${resultBg(result)} ${resultColor(result)} font-bold`}>
                  {fmtVal(col, myVal)}
                </td>
              );
            })}
          </tr>
          <tr className="border-b border-border">
            <td className="px-3 py-1.5 font-semibold text-slate-500 truncate max-w-[120px]">{oppTeamName}</td>
            {cols.map((col) => {
              const myVal = sanitizeNum(myStats[col]);
              const oppVal = sanitizeNum(oppStats[col]);
              const result = compareCat(col, myVal, oppVal);
              const oppResult = result === "WIN" ? "LOSS" : result === "LOSS" ? "WIN" : "TIE";
              return (
                <td key={col} className={`px-2 py-1.5 text-right font-mono tabular-nums ${resultBg(oppResult)} ${resultColor(oppResult)}`}>
                  {fmtVal(col, oppVal)}
                </td>
              );
            })}
          </tr>
          <tr className="bg-black/[0.02]">
            <td className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase">Diff</td>
            {cols.map((col) => {
              const myVal = sanitizeNum(myStats[col]);
              const oppVal = sanitizeNum(oppStats[col]);
              const diff = LOWER_IS_BETTER.has(col) ? oppVal - myVal : myVal - oppVal;
              const isRate = ["AVG", "ERA", "WHIP"].includes(col);
              return (
                <td key={col} className={`px-2 py-1.5 text-right font-mono tabular-nums text-[10px] font-bold ${
                  diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-600" : "text-slate-400"
                }`}>
                  {diff > 0 ? "+" : ""}{isRate ? diff.toFixed(3) : col === "IP" ? diff.toFixed(1) : Math.round(diff)}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function fmtDateRange(start: string, end: string): string {
  const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} to ${fmt(end)}`;
}

export default function MatchupTrackerPage() {
  const [data, setData] = useState<TrackerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch("/api/espn/matchup-tracker")
      .then((r) => r.json())
      .then((d: TrackerData & { error?: string }) => {
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(() => setError("FETCH_FAILED"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/espn/matchup-tracker")
      .then((r) => r.json())
      .then((d: TrackerData & { error?: string }) => {
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(() => setError("FETCH_FAILED"))
      .finally(() => setLoading(false));
  }, []);

  const winCount = useMemo(() => data?.catResults.filter((c) => c.result === "WIN").length ?? 0, [data]);
  const lossCount = useMemo(() => data?.catResults.filter((c) => c.result === "LOSS").length ?? 0, [data]);
  const tieCount = useMemo(() => data?.catResults.filter((c) => c.result === "TIE").length ?? 0, [data]);

  // Daily points bar chart max
  const maxDailyPts = useMemo(() => {
    if (!data?.dailyPoints) return 1;
    return Math.max(1, ...data.dailyPoints.map((d) => Math.max(d.myPts, d.oppPts)));
  }, [data]);

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading matchup tracker...</div>;
  if (error === "ESPN_CREDS_MISSING" || error === "MY_ESPN_TEAM_ID_MISSING") {
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnAuthRequired /></div>;
  }
  if (error || !data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load matchup tracker</div>
        <div className="text-[12px] text-slate-600">{error}</div>
      </div>
    );
  }

  const hasDailyData = data.dailyPoints.some((d) => d.myPts > 0 || d.oppPts > 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-600">
            Week {data.week} Matchup Tracker
          </span>
          <DataFreshness onRefresh={fetchData} loading={loading} />
        </div>
        <div className="mt-1 flex items-center gap-3 flex-wrap">
          <span className="text-xl font-bold text-orange-600">{data.myTeam.name}</span>
          <span className="text-slate-400">vs</span>
          <span className="text-xl font-bold text-slate-500">{data.oppTeam.name}</span>
          <span className="text-[11px] text-slate-400">{fmtDateRange(data.startDate, data.endDate)}</span>
        </div>
        <div className="mt-2 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tabular-nums text-emerald-600">{winCount}</span>
            <span className="text-[10px] text-slate-500">W</span>
            <span className="text-slate-400">-</span>
            <span className="text-2xl font-bold tabular-nums text-red-600">{lossCount}</span>
            <span className="text-[10px] text-slate-500">L</span>
            {tieCount > 0 && (
              <>
                <span className="text-slate-400">-</span>
                <span className="text-2xl font-bold tabular-nums text-orange-600">{tieCount}</span>
                <span className="text-[10px] text-slate-500">T</span>
              </>
            )}
          </div>
          <span className="text-[11px] text-slate-400">
            Day {data.daysElapsed} of {data.totalDays}
          </span>
        </div>
      </div>

      {/* Category Results Grid */}
      <div className="mb-6">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Category Standings</div>
        <div className="flex flex-wrap gap-1.5">
          {data.catResults.map((c) => (
            <div key={c.cat} className={`rounded px-2.5 py-1.5 text-center min-w-[52px] border ${
              c.result === "WIN" ? "bg-emerald-50 border-emerald-200" :
              c.result === "LOSS" ? "bg-red-50 border-red-200" :
              c.result === "TIE" ? "bg-orange-50 border-orange-200" :
              "bg-slate-50 border-border"
            }`}>
              <div className={`text-[9px] font-bold ${categoryTierClass(c.cat)}`}>{c.cat}</div>
              <div className={`text-[12px] font-bold font-mono tabular-nums ${resultColor(c.result)}`}>
                {fmtVal(c.cat, c.myValue)}
              </div>
              <div className="text-[10px] font-mono tabular-nums text-slate-400">
                {fmtVal(c.cat, c.oppValue)}
              </div>
              <div className={`text-[8px] font-bold uppercase ${resultColor(c.result)}`}>
                {c.result === "PENDING" ? "" : c.result}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Batting Comparison */}
      <div className="mb-4">
        <StatTable
          label="Batting"
          myStats={data.batting.my as unknown as Record<string, number>}
          oppStats={data.batting.opp as unknown as Record<string, number>}
          cols={BAT_COLS}
          myTeamName={data.myTeam.name}
          oppTeamName={data.oppTeam.name}
        />
      </div>

      {/* Pitching Comparison */}
      <div className="mb-6">
        <StatTable
          label="Pitching"
          myStats={data.pitching.my as unknown as Record<string, number>}
          oppStats={data.pitching.opp as unknown as Record<string, number>}
          cols={PIT_COLS}
          myTeamName={data.myTeam.name}
          oppTeamName={data.oppTeam.name}
        />
      </div>

      {/* Daily Points */}
      {hasDailyData && (
        <div className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-4 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Daily Fantasy Points</span>
          </div>
          <div className="px-4 py-3">
            <div className="space-y-2">
              {data.dailyPoints.map((d, i) => {
                const isPast = i < data.daysElapsed;
                const isToday = i === data.daysElapsed - 1;
                const myW = Math.max(0, (d.myPts / maxDailyPts) * 100);
                const oppW = Math.max(0, (d.oppPts / maxDailyPts) * 100);
                return (
                  <div key={d.date} className={`flex items-center gap-2 ${!isPast && !isToday ? "opacity-30" : ""}`}>
                    <span className={`w-12 text-[10px] font-bold ${isToday ? "text-orange-600" : "text-slate-500"}`}>
                      {d.dayLabel}
                    </span>
                    <div className="flex-1 flex gap-1">
                      <div className="flex-1 flex items-center gap-1">
                        <div className="h-3 rounded bg-orange-400" style={{ width: `${myW}%`, minWidth: d.myPts > 0 ? "4px" : "0px" }} />
                        <span className="text-[10px] font-mono tabular-nums text-slate-600">{d.myPts > 0 ? d.myPts.toFixed(1) : ""}</span>
                      </div>
                      <div className="flex-1 flex items-center gap-1">
                        <div className="h-3 rounded bg-slate-300" style={{ width: `${oppW}%`, minWidth: d.oppPts > 0 ? "4px" : "0px" }} />
                        <span className="text-[10px] font-mono tabular-nums text-slate-400">{d.oppPts > 0 ? d.oppPts.toFixed(1) : ""}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex gap-4 text-[9px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded bg-orange-400" /> {data.myTeam.name}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded bg-slate-300" /> {data.oppTeam.name}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
