"use client";

import { useState, useEffect } from "react";
import {
  categoryTierClass,
  LOWER_IS_BETTER,
} from "@/lib/category-weights";

interface CategoryRanking {
  cat: string;
  weight: number;
  rank: number;
  value: number;
  leaderValue: number;
  gap: number;
  tier: "STRONG" | "MIDDLE" | "WEAK";
  tierLabel: string;
  isPunt: boolean;
}

interface BatterAnalysis {
  name: string;
  pos: string;
  slotLabel: string;
  proTeam: string;
  injuryStatus: string;
  ops: number;
  avg: number;
  hr: number;
  rbi: number;
  r: number;
  tb: number;
  sb: number;
  ab: number;
  verdict: "STAR" | "SOLID" | "BELOW_AVG" | "DRAG" | "SMALL_SAMPLE";
}

interface PitcherAnalysis {
  name: string;
  pos: string;
  slotLabel: string;
  proTeam: string;
  injuryStatus: string;
  era: number;
  whip: number;
  k: number;
  w: number;
  qs: number;
  ip: number;
  eraImpact: number;
  verdict: "ACE" | "SOLID" | "BELOW_AVG" | "HURTING";
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

interface ActionItem {
  priority: "HIGH" | "MEDIUM" | "LOW";
  type: "DROP" | "IMPROVE" | "TRADE" | "STREAM" | "PUNT";
  message: string;
}

interface DiagnosisData {
  teamName: string;
  teamId: number;
  record: string;
  categoryRankings: CategoryRanking[];
  batterAnalysis: BatterAnalysis[];
  pitcherAnalysis: PitcherAnalysis[];
  marginToFlip: MarginToFlip[];
  expectedWinsPerWeek: { total: number; byCategory: Record<string, number> };
  actionItems: ActionItem[];
  generatedAt: string;
}

function tierColor(tier: string): string {
  if (tier === "STRONG") return "text-emerald-700 bg-emerald-50";
  if (tier === "MIDDLE") return "text-amber-700 bg-amber-50";
  if (tier === "WEAK") return "text-red-700 bg-red-50";
  return "text-slate-500";
}

function verdictColor(verdict: string): string {
  if (verdict === "STAR" || verdict === "ACE") return "text-emerald-700 bg-emerald-50 border-emerald-300";
  if (verdict === "SOLID") return "text-blue-700 bg-blue-50 border-blue-300";
  if (verdict === "BELOW_AVG") return "text-amber-700 bg-amber-50 border-amber-300";
  if (verdict === "DRAG" || verdict === "HURTING") return "text-red-700 bg-red-50 border-red-300";
  if (verdict === "SMALL_SAMPLE") return "text-slate-500 bg-slate-50 border-slate-300";
  return "text-slate-600 bg-slate-50 border-border";
}

function verdictLabel(verdict: string): string {
  if (verdict === "BELOW_AVG") return "Below Avg";
  if (verdict === "SMALL_SAMPLE") return "Small Sample";
  return verdict.charAt(0) + verdict.slice(1).toLowerCase();
}

function fmtStat(cat: string, val: number): string {
  if (!Number.isFinite(val)) return "–";
  if (cat === "AVG" || cat === "OPS") return val.toFixed(3);
  if (cat === "ERA" || cat === "WHIP") return val.toFixed(2);
  if (cat === "IP") return val.toFixed(1);
  return String(Math.round(val));
}

function priorityBadge(priority: string): string {
  if (priority === "HIGH") return "bg-red-100 text-red-700 border-red-300";
  if (priority === "MEDIUM") return "bg-amber-100 text-amber-700 border-amber-300";
  return "bg-slate-100 text-slate-600 border-slate-300";
}

function typeBadge(type: string): string {
  if (type === "DROP") return "bg-red-50 text-red-600";
  if (type === "IMPROVE") return "bg-blue-50 text-blue-600";
  if (type === "STREAM") return "bg-purple-50 text-purple-600";
  if (type === "TRADE") return "bg-emerald-50 text-emerald-600";
  if (type === "PUNT") return "bg-slate-50 text-slate-500";
  return "bg-slate-50 text-slate-500";
}

export default function DiagnosisPage() {
  const [data, setData] = useState<DiagnosisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/analysis/roster-diagnosis")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
        } else {
          setData(d);
        }
      })
      .catch(() => setError("Failed to fetch diagnosis"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          Running roster diagnosis...
        </div>
      </div>
    );
  }

  if (error === "ESPN_CREDS_MISSING") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-orange-600/60">Setup Required</div>
        <div className="mt-3 text-xl font-bold text-gray-900">Connect ESPN Credentials</div>
        <div className="mt-3 text-[13px] text-slate-500">
          Add ESPN_S2, ESPN_SWID, and MY_ESPN_TEAM_ID as environment variables.
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Diagnosis failed</div>
        <div className="text-[12px] text-slate-600">{error}</div>
      </div>
    );
  }

  const strongCats = data.categoryRankings.filter((c) => c.tier === "STRONG" && !c.isPunt);
  const weakCats = data.categoryRankings.filter((c) => c.tier === "WEAK" && !c.isPunt);
  const topFlips = data.marginToFlip.slice(0, 5);
  const highActions = data.actionItems.filter((a) => a.priority === "HIGH");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Roster Diagnosis</h1>
            <div className="mt-1 flex items-center gap-3 text-[12px] text-slate-500">
              <span>{data.teamName}</span>
              <span className="tabular-nums">{data.record}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Expected Wins/Week</div>
              <div className="text-xl font-bold tabular-nums text-slate-800">
                {data.expectedWinsPerWeek.total.toFixed(1)}
                <span className="ml-1 text-[12px] font-normal text-slate-500">/16</span>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-[10px]">
                <span className="text-emerald-600">STRONG</span>
                <span className="ml-1 font-bold text-emerald-700">{strongCats.length}</span>
              </span>
              <span className="rounded-lg border border-red-300 bg-red-50 px-2.5 py-1.5 text-[10px]">
                <span className="text-red-600">WEAK</span>
                <span className="ml-1 font-bold text-red-700">{weakCats.length}</span>
              </span>
            </div>
          </div>
        </div>
        {data.generatedAt && (
          <div className="mt-2 text-[10px] text-slate-400">
            Generated {new Date(data.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </div>
        )}
      </div>

      {/* Urgent Actions */}
      {highActions.length > 0 && (
        <div className="mb-6 rounded-xl border border-red-300 bg-red-50/50 overflow-hidden">
          <div className="border-b border-red-200 px-4 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-red-600">Urgent Actions</span>
          </div>
          <div className="divide-y divide-red-200">
            {highActions.map((action, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${typeBadge(action.type)}`}>
                  {action.type}
                </span>
                <span className="text-[12px] text-slate-700">{action.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Rankings Table */}
      <div className="mb-6 rounded-xl border border-border bg-surface overflow-hidden">
        <div className="border-b border-border px-4 py-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Category Rankings</span>
          <span className="ml-2 text-[10px] text-slate-400">Season, all teams</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border bg-slate-50 text-left text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2 text-right">Weight</th>
                <th className="px-3 py-2 text-center">Rank</th>
                <th className="px-3 py-2 text-right">Value</th>
                <th className="px-3 py-2 text-right">Leader</th>
                <th className="px-3 py-2 text-right">Gap</th>
                <th className="px-3 py-2 text-center">Verdict</th>
                <th className="px-3 py-2 text-right">Win Prob</th>
              </tr>
            </thead>
            <tbody>
              {data.categoryRankings.map((cr) => (
                <tr key={cr.cat} className={`border-b border-border ${cr.isPunt ? "opacity-50" : ""}`}>
                  <td className={`px-3 py-1.5 font-medium ${categoryTierClass(cr.cat)}`}>{cr.cat}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{cr.weight.toFixed(3)}</td>
                  <td className="px-3 py-1.5 text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${tierColor(cr.tier)}`}>
                      #{cr.rank}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-mono text-slate-700">
                    {fmtStat(cr.cat, cr.value)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-mono text-slate-400">
                    {fmtStat(cr.cat, cr.leaderValue)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-mono text-slate-500">
                    {cr.gap > 0 ? (LOWER_IS_BETTER.has(cr.cat) ? "+" : "-") : ""}{fmtStat(cr.cat, Math.abs(cr.gap))}
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <span className={`inline-block rounded border px-1.5 py-0.5 text-[9px] font-bold ${tierColor(cr.tier)}`}>
                      {cr.isPunt ? "PUNT" : cr.tier}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">
                    {((data.expectedWinsPerWeek.byCategory[cr.cat] ?? 0) * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two-column: Batters + Pitchers */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {/* Batter Analysis */}
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="border-b border-border px-4 py-2.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Batter Analysis</span>
            <span className="text-[10px] text-slate-400">{data.batterAnalysis.length} active</span>
          </div>
          <div className="divide-y divide-border">
            {data.batterAnalysis.map((b) => (
              <div key={b.name} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-7 shrink-0 text-[10px] font-bold text-slate-500">{b.slotLabel}</span>
                    <span className="truncate text-[12px] font-medium text-slate-700">{b.name}</span>
                    <span className="shrink-0 text-[10px] text-slate-400">{b.pos}</span>
                    <span className="shrink-0 text-[10px] text-slate-400">{b.proTeam}</span>
                  </div>
                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold ${verdictColor(b.verdict)}`}>
                    {verdictLabel(b.verdict)}
                  </span>
                </div>
                <div className="mt-1 flex gap-3 text-[10px] font-mono tabular-nums text-slate-500">
                  <span>{b.ops.toFixed(3)} <span className="text-slate-400">OPS</span></span>
                  <span>{fmtStat("AVG", b.avg)} <span className="text-slate-400">AVG</span></span>
                  <span>{Math.round(b.hr)} <span className="text-slate-400">HR</span></span>
                  <span>{Math.round(b.rbi)} <span className="text-slate-400">RBI</span></span>
                  <span>{Math.round(b.r)} <span className="text-slate-400">R</span></span>
                  <span>{Math.round(b.sb)} <span className="text-slate-400">SB</span></span>
                </div>
              </div>
            ))}
            {data.batterAnalysis.length === 0 && (
              <div className="px-3 py-4 text-[11px] text-slate-400 text-center">No batter data</div>
            )}
          </div>
        </div>

        {/* Pitcher Analysis */}
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="border-b border-border px-4 py-2.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Pitcher Analysis</span>
            <span className="text-[10px] text-slate-400">{data.pitcherAnalysis.length} active</span>
          </div>
          <div className="divide-y divide-border">
            {data.pitcherAnalysis.map((p) => (
              <div key={p.name} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-7 shrink-0 text-[10px] font-bold text-slate-500">{p.slotLabel}</span>
                    <span className="truncate text-[12px] font-medium text-slate-700">{p.name}</span>
                    <span className="shrink-0 text-[10px] text-slate-400">{p.pos}</span>
                    <span className="shrink-0 text-[10px] text-slate-400">{p.proTeam}</span>
                  </div>
                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold ${verdictColor(p.verdict)}`}>
                    {verdictLabel(p.verdict)}
                  </span>
                </div>
                <div className="mt-1 flex gap-3 text-[10px] font-mono tabular-nums text-slate-500">
                  <span>{fmtStat("ERA", p.era)} <span className="text-slate-400">ERA</span></span>
                  <span>{fmtStat("WHIP", p.whip)} <span className="text-slate-400">WHIP</span></span>
                  <span>{Math.round(p.k)} <span className="text-slate-400">K</span></span>
                  <span>{Math.round(p.w)} <span className="text-slate-400">W</span></span>
                  <span>{Math.round(p.qs)} <span className="text-slate-400">QS</span></span>
                  <span>{fmtStat("IP", p.ip)} <span className="text-slate-400">IP</span></span>
                </div>
                {p.eraImpact > 0.5 && (
                  <div className="mt-1 text-[9px] text-red-500">
                    ERA +{p.eraImpact.toFixed(2)} above 3.80 target
                  </div>
                )}
              </div>
            ))}
            {data.pitcherAnalysis.length === 0 && (
              <div className="px-3 py-4 text-[11px] text-slate-400 text-center">No pitcher data</div>
            )}
          </div>
        </div>
      </div>

      {/* Margin to Flip */}
      {topFlips.length > 0 && (
        <div className="mb-6 rounded-xl border border-border bg-surface overflow-hidden">
          <div className="border-b border-border px-4 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Best Category Flip Opportunities</span>
            <span className="ml-2 text-[10px] text-slate-400">Smallest gap, highest weight</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-border bg-slate-50 text-left text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2 text-right">Weight</th>
                  <th className="px-3 py-2 text-center">Current</th>
                  <th className="px-3 py-2 text-center">Target</th>
                  <th className="px-3 py-2 text-right">My Value</th>
                  <th className="px-3 py-2 text-right">Target Value</th>
                  <th className="px-3 py-2 text-right">Gap</th>
                </tr>
              </thead>
              <tbody>
                {topFlips.map((m) => (
                  <tr key={m.cat} className="border-b border-border">
                    <td className={`px-3 py-1.5 font-medium ${categoryTierClass(m.cat)}`}>{m.cat}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{m.weight.toFixed(3)}</td>
                    <td className="px-3 py-1.5 text-center font-bold text-slate-600">#{m.currentRank}</td>
                    <td className="px-3 py-1.5 text-center font-bold text-emerald-600">#{m.targetRank}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-mono text-slate-700">{fmtStat(m.cat, m.myValue)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-mono text-slate-500">{fmtStat(m.cat, m.targetValue)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-mono text-amber-600">{fmtStat(m.cat, m.gap)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Playoff Math */}
      <div className="mb-6 rounded-xl border border-border bg-surface overflow-hidden">
        <div className="border-b border-border px-4 py-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Playoff Math</span>
        </div>
        <div className="px-4 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Expected Category Wins / Week</div>
              <div className="text-3xl font-bold tabular-nums text-slate-800">
                {data.expectedWinsPerWeek.total.toFixed(1)}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {data.expectedWinsPerWeek.total >= 8.5
                  ? "On pace for a strong record"
                  : data.expectedWinsPerWeek.total >= 7.5
                  ? "Competitive but needs improvement"
                  : "Below playoff pace, action needed"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Win Probability by Category</div>
              <div className="flex flex-wrap gap-1.5">
                {data.categoryRankings.map((cr) => {
                  const prob = data.expectedWinsPerWeek.byCategory[cr.cat] ?? 0;
                  const pctColor = prob >= 0.7 ? "bg-emerald-100 text-emerald-700" :
                    prob >= 0.4 ? "bg-amber-100 text-amber-700" :
                    "bg-red-100 text-red-700";
                  return (
                    <span key={cr.cat} className={`rounded px-1.5 py-0.5 text-[9px] font-mono font-bold ${pctColor} ${cr.isPunt ? "opacity-40" : ""}`}>
                      {cr.cat} {(prob * 100).toFixed(0)}%
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* All Actions */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="border-b border-border px-4 py-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">All Recommendations</span>
          <span className="ml-2 text-[10px] text-slate-400">{data.actionItems.length} items</span>
        </div>
        <div className="divide-y divide-border">
          {data.actionItems.map((action, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-2.5">
              <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold ${priorityBadge(action.priority)}`}>
                {action.priority}
              </span>
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${typeBadge(action.type)}`}>
                {action.type}
              </span>
              <span className="text-[12px] text-slate-700">{action.message}</span>
            </div>
          ))}
          {data.actionItems.length === 0 && (
            <div className="px-4 py-6 text-[12px] text-slate-400 text-center">No action items generated</div>
          )}
        </div>
      </div>
    </div>
  );
}
