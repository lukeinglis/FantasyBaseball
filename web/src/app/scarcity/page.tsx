"use client";

import { useState, useEffect, useMemo } from "react";
import type { Player } from "@/lib/data";

interface DraftSession {
  drafted: string[];
  myPicks: string[];
  myRoster: Record<string, string>;
}

const POSITIONS = ["C", "1B", "2B", "3B", "SS", "OF", "SP", "RP"] as const;

function tierLabel(z: number): { label: string; color: string } {
  if (z >= 0.8) return { label: "Elite", color: "text-sky-400" };
  if (z >= 0.4) return { label: "Great", color: "text-sky-400/60" };
  if (z >= 0.0) return { label: "Solid", color: "text-amber-400/70" };
  return { label: "Depth", color: "text-slate-600" };
}

function urgencyTag(pct: number): { label: string; color: string } {
  if (pct >= 75) return { label: "CRITICAL", color: "text-red-400 bg-red-500/10" };
  if (pct >= 50) return { label: "THIN", color: "text-orange-400 bg-orange-500/10" };
  if (pct >= 25) return { label: "WATCH", color: "text-amber-400 bg-amber-500/10" };
  return { label: "DEEP", color: "text-slate-500 bg-white/5" };
}

export default function ScarcityPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [session, setSession] = useState<DraftSession>({
    drafted: [], myPicks: [], myRoster: {},
  });
  const [drillPos, setDrillPos] = useState<string>("");

  useEffect(() => {
    fetch("/api/rankings").then((r) => r.json()).then(setPlayers);
    fetch("/api/draft").then((r) => r.json()).then(setSession);
  }, []);

  const draftedSet = useMemo(() => new Set(session.drafted), [session.drafted]);

  const scarcityData = useMemo(() => {
    return POSITIONS.map((pos) => {
      const all = players.filter((p) => p.pos === pos);
      const available = all.filter((p) => !draftedSet.has(p.name));
      const totalElite = all.filter((p) => p.zTotal >= 0.5).length;
      const availElite = available.filter((p) => p.zTotal >= 0.5).length;
      const availSolid = available.filter((p) => p.zTotal >= 0.0).length;
      const draftedElite = totalElite - availElite;
      const scarcityPct = totalElite > 0 ? Math.round((draftedElite / totalElite) * 100) : 0;

      return { pos, total: all.length, available: available.length, availElite, availSolid, totalElite, scarcityPct };
    });
  }, [players, draftedSet]);

  const drillPlayers = useMemo(() => {
    if (!drillPos) return [];
    return players
      .filter((p) => p.pos === drillPos && !draftedSet.has(p.name))
      .sort((a, b) => b.zTotal - a.zTotal);
  }, [players, draftedSet, drillPos]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-5">
      <h1 className="mb-5 text-xl font-bold text-white">Position Scarcity</h1>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {scarcityData.map((d) => {
          const tag = urgencyTag(d.scarcityPct);
          return (
            <button key={d.pos} onClick={() => setDrillPos(d.pos)}
              className={`rounded-lg border bg-surface p-4 text-left transition-colors ${
                drillPos === d.pos ? "border-slate-500" : "border-border hover:border-slate-600"
              }`}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-lg font-bold text-white">{d.pos}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${tag.color}`}>
                  {tag.label}
                </span>
              </div>
              <div className="space-y-1 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Elite left</span>
                  <span className="font-mono text-sky-400">{d.availElite}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Solid left</span>
                  <span className="font-mono text-slate-300">{d.availSolid}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Elite gone</span>
                  <span className="font-mono text-red-400/70">{d.scarcityPct}%</span>
                </div>
              </div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all ${
                    d.scarcityPct >= 75 ? "bg-red-500" : d.scarcityPct >= 50 ? "bg-orange-500" : d.scarcityPct >= 25 ? "bg-amber-500" : "bg-sky-500"
                  }`}
                  style={{ width: `${d.scarcityPct}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {drillPos && (
        <div className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-3 py-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Available at {drillPos}
              <span className="ml-2 font-mono text-slate-600">{drillPlayers.length}</span>
            </h2>
          </div>
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-border text-[11px] uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Player</th>
                <th className="px-3 py-2 font-medium">Team</th>
                <th className="px-3 py-2 text-right font-medium">zScore</th>
                <th className="px-3 py-2 text-right font-medium">Tier</th>
              </tr>
            </thead>
            <tbody>
              {drillPlayers.map((p, idx) => {
                const tier = tierLabel(p.zTotal);
                return (
                  <tr key={p.name} className={`border-b border-border/30 ${idx % 2 ? "bg-white/[0.01]" : ""}`}>
                    <td className="px-3 py-1.5 font-mono text-slate-600">{p.rank}</td>
                    <td className="px-3 py-1.5 font-medium text-white">{p.name}</td>
                    <td className="px-3 py-1.5 text-slate-500">{p.team}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-sky-400/80">{p.zTotal.toFixed(2)}</td>
                    <td className={`px-3 py-1.5 text-right text-[11px] font-bold ${tier.color}`}>{tier.label}</td>
                  </tr>
                );
              })}
              {drillPlayers.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-4 text-center text-[12px] text-slate-600">
                  No available players at {drillPos}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
