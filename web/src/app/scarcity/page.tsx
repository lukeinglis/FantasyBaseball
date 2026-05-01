"use client";

import { useState, useEffect, useMemo } from "react";
import type { Player } from "@/lib/data";
import type { EspnPlayerData } from "@/app/api/espn-adp/route";
import { useDraft } from "@/lib/draft-context";

const POSITIONS = ["C", "1B", "2B", "3B", "SS", "OF", "SP", "RP"] as const;

const STARTER_COUNTS: Record<string, number> = {
  C: 10, "1B": 10, "2B": 10, "3B": 10, SS: 10,
  OF: 30, SP: 50, RP: 20,
};

function tierLabel(z: number): { label: string; color: string } {
  if (z >= 0.8) return { label: "Elite", color: "text-sky-600" };
  if (z >= 0.4) return { label: "Great", color: "text-sky-600/60" };
  if (z >= 0.0) return { label: "Solid", color: "text-orange-600/70" };
  return { label: "Depth", color: "text-slate-600" };
}

function urgencyTag(pct: number): { label: string; color: string; bar: string } {
  if (pct >= 75) return { label: "CRITICAL", color: "text-red-600 bg-red-100", bar: "bg-red-500" };
  if (pct >= 50) return { label: "THIN", color: "text-orange-600 bg-orange-500/10", bar: "bg-orange-500" };
  if (pct >= 25) return { label: "WATCH", color: "text-orange-600 bg-orange-100", bar: "bg-orange-600" };
  return { label: "DEEP", color: "text-slate-500 bg-black/5", bar: "bg-sky-600" };
}

export default function ScarcityPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const { session } = useDraft();
  const [espnData, setEspnData] = useState<Record<string, EspnPlayerData>>({});
  const [drillPos, setDrillPos] = useState<string>("");

  useEffect(() => {
    fetch("/api/rankings").then((r) => r.json()).then(setPlayers);
    fetch("/api/espn-adp").then((r) => r.json()).then((data) => {
      if (!data.error) setEspnData(data);
    });
  }, []);

  const draftedSet = useMemo(() => new Set(session.drafted), [session.drafted]);

  // Deduplicate players by name
  const dedupedPlayers = useMemo(() => {
    const seen = new Set<string>();
    return players.filter((p) => {
      if (seen.has(p.name)) return false;
      seen.add(p.name);
      return true;
    });
  }, [players]);

  const scarcityData = useMemo(() => {
    return POSITIONS.map((pos) => {
      const all = dedupedPlayers
        .filter((p) => (espnData[p.name]?.primaryPos ?? p.pos) === pos)
        .sort((a, b) => b.zTotal - a.zTotal);
      const available = all.filter((p) => !draftedSet.has(p.name));
      const availElite = available.filter((p) => p.zTotal >= 0.5).length;
      const availSolid = available.filter((p) => p.zTotal >= 0.0).length;

      const starterCap = STARTER_COUNTS[pos] ?? 10;
      const starterPool = all.slice(0, starterCap);
      const availStarters = starterPool.filter((p) => !draftedSet.has(p.name)).length;
      const startersPct = Math.round(((starterCap - availStarters) / starterCap) * 100);

      return { pos, available: available.length, availElite, availSolid, availStarters, starterCap, startersPct };
    });
  }, [dedupedPlayers, draftedSet, espnData]);

  const drillPlayers = useMemo(() => {
    if (!drillPos) return [];
    return dedupedPlayers
      .filter((p) => (espnData[p.name]?.primaryPos ?? p.pos) === drillPos && !draftedSet.has(p.name))
      .sort((a, b) => b.zTotal - a.zTotal);
  }, [dedupedPlayers, draftedSet, espnData, drillPos]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-5">
      <h1 className="mb-5 text-xl font-bold text-gray-900">Position Scarcity</h1>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {scarcityData.map((d) => {
          const tag = urgencyTag(d.startersPct);
          return (
            <button key={d.pos} onClick={() => setDrillPos(d.pos === drillPos ? "" : d.pos)}
              className={`rounded-lg border bg-surface p-4 text-left transition-colors ${
                drillPos === d.pos ? "border-slate-500" : "border-border hover:border-slate-600"
              }`}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-lg font-bold text-gray-900">{d.pos}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${tag.color}`}>
                  {tag.label}
                </span>
              </div>
              <div className="space-y-1 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Elite left</span>
                  <span className="font-mono text-sky-600">{d.availElite}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Solid left</span>
                  <span className="font-mono text-slate-600">{d.availSolid}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Starters left</span>
                  <span className="font-mono text-emerald-600">{d.availStarters}/{d.starterCap}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Starters gone</span>
                  <span className="font-mono text-red-600/70">{d.startersPct}%</span>
                </div>
              </div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-200">
                <div className={`h-full rounded-full transition-all ${tag.bar}`}
                  style={{ width: `${d.startersPct}%` }} />
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
                  <tr key={p.name} className={`border-b border-border ${idx % 2 ? "bg-black/[0.02]" : ""}`}>
                    <td className="px-3 py-1.5 font-mono text-slate-600">{p.rank}</td>
                    <td className="px-3 py-1.5 font-medium text-gray-900">{p.name}</td>
                    <td className="px-3 py-1.5 text-slate-500">{p.team}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-sky-600/80">{p.zTotal.toFixed(2)}</td>
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
