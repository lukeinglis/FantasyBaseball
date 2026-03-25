"use client";

import { useState, useEffect, useMemo } from "react";
import type { Player } from "@/lib/data";

interface DraftSession {
  myPicks: string[];
}

function statColor(val: number | undefined, better: "high" | "low", thresholds: [number, number]): string {
  if (val === undefined) return "text-slate-500";
  const [good, ok] = thresholds;
  const isGood = better === "high" ? val >= good : val <= good;
  const isOk = better === "high" ? val >= ok : val <= ok;
  if (isGood) return "text-emerald-400 font-semibold";
  if (isOk) return "text-amber-400";
  return "text-red-400/80";
}

function fmt(val: number | undefined, decimals = 0): string {
  if (val === undefined) return "—";
  return decimals > 0 ? val.toFixed(decimals) : String(Math.round(val));
}

export default function BullpenPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [session, setSession] = useState<DraftSession>({ myPicks: [] });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"SP" | "RP">("SP");

  useEffect(() => {
    Promise.all([
      fetch("/api/rankings").then((r) => r.json()),
      fetch("/api/draft").then((r) => r.json()),
    ]).then(([p, s]) => {
      setPlayers(p);
      setSession(s);
      setLoading(false);
    });
  }, []);

  const playerMap = useMemo(() => {
    const m = new Map<string, Player>();
    players.forEach((p) => m.set(p.name, p));
    return m;
  }, [players]);

  const myPitchers = useMemo(() => {
    return session.myPicks
      .map((n) => playerMap.get(n))
      .filter((p): p is Player => p?.type === "PIT");
  }, [session.myPicks, playerMap]);

  const sp = myPitchers.filter((p) => p.pos === "SP");
  const rp = myPitchers.filter((p) => p.pos === "RP");
  const shown = view === "SP" ? sp : rp;

  // Projected season totals for my SP
  const spTotals = useMemo(() => ({
    K: sp.reduce((s, p) => s + (p.K ?? 0), 0),
    QS: sp.reduce((s, p) => s + (p.QS ?? 0), 0),
    W: sp.reduce((s, p) => s + (p.W ?? 0), 0),
    L: sp.reduce((s, p) => s + (p.L ?? 0), 0),
    ERA: sp.length ? sp.reduce((s, p) => s + (p.ERA ?? 0), 0) / sp.length : 0,
    WHIP: sp.length ? sp.reduce((s, p) => s + (p.WHIP ?? 0), 0) / sp.length : 0,
  }), [sp]);

  const rpTotals = useMemo(() => ({
    K: rp.reduce((s, p) => s + (p.K ?? 0), 0),
    SV: rp.reduce((s, p) => s + (p.SV ?? 0), 0),
    HD: rp.reduce((s, p) => s + (p.HD ?? 0), 0),
    ERA: rp.length ? rp.reduce((s, p) => s + (p.ERA ?? 0), 0) / rp.length : 0,
    WHIP: rp.length ? rp.reduce((s, p) => s + (p.WHIP ?? 0), 0) / rp.length : 0,
  }), [rp]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-500">Loading...</div>;
  }

  if (myPitchers.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        No pitchers found. Log your draft picks in the War Room first.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">Bullpen</h1>
        <div className="flex gap-0.5 rounded bg-surface p-0.5">
          {(["SP", "RP"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`rounded px-4 py-1 text-[12px] font-bold transition-colors ${
                view === v ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
              }`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Season projection summary */}
      <div className="mb-6 rounded-lg border border-border bg-surface p-4">
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
          {view === "SP" ? "Starting Rotation" : "Relief Corps"} — Season Projections
        </div>
        {view === "SP" ? (
          <div className="grid grid-cols-6 gap-4 text-center">
            {([
              { label: "K", val: spTotals.K, fmt: fmt(spTotals.K), color: statColor(spTotals.K, "high", [800, 600]) },
              { label: "QS", val: spTotals.QS, fmt: fmt(spTotals.QS), color: statColor(spTotals.QS, "high", [80, 60]) },
              { label: "W", val: spTotals.W, fmt: fmt(spTotals.W), color: statColor(spTotals.W, "high", [55, 40]) },
              { label: "L", val: spTotals.L, fmt: fmt(spTotals.L), color: statColor(spTotals.L, "low", [30, 40]) },
              { label: "ERA", val: spTotals.ERA, fmt: fmt(spTotals.ERA, 3), color: statColor(spTotals.ERA, "low", [3.5, 4.2]) },
              { label: "WHIP", val: spTotals.WHIP, fmt: fmt(spTotals.WHIP, 3), color: statColor(spTotals.WHIP, "low", [1.15, 1.30]) },
            ]).map((s) => (
              <div key={s.label}>
                <div className="text-[10px] text-slate-600">{s.label}</div>
                <div className={`font-mono text-[18px] font-bold ${s.color}`}>{s.fmt}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-4 text-center">
            {([
              { label: "K", fmt: fmt(rpTotals.K), color: statColor(rpTotals.K, "high", [200, 150]) },
              { label: "SV", fmt: fmt(rpTotals.SV), color: statColor(rpTotals.SV, "high", [25, 15]) },
              { label: "HD", fmt: fmt(rpTotals.HD), color: statColor(rpTotals.HD, "high", [30, 20]) },
              { label: "ERA", fmt: fmt(rpTotals.ERA, 3), color: statColor(rpTotals.ERA, "low", [3.2, 4.0]) },
              { label: "WHIP", fmt: fmt(rpTotals.WHIP, 3), color: statColor(rpTotals.WHIP, "low", [1.10, 1.25]) },
            ]).map((s) => (
              <div key={s.label}>
                <div className="text-[10px] text-slate-600">{s.label}</div>
                <div className={`font-mono text-[18px] font-bold ${s.color}`}>{s.fmt}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per-pitcher breakdown */}
      <div className="rounded-lg border border-border">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-border bg-surface text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2.5">Pitcher</th>
              <th className="px-2 py-2.5">Team</th>
              <th className="px-2 py-2.5 text-right">zScore</th>
              <th className="px-2 py-2.5 text-right">K</th>
              {view === "SP" ? (
                <>
                  <th className="px-2 py-2.5 text-right">QS</th>
                  <th className="px-2 py-2.5 text-right">W</th>
                  <th className="px-2 py-2.5 text-right">L</th>
                </>
              ) : (
                <>
                  <th className="px-2 py-2.5 text-right">SV</th>
                  <th className="px-2 py-2.5 text-right">HD</th>
                </>
              )}
              <th className="px-2 py-2.5 text-right">ERA</th>
              <th className="px-2 py-2.5 text-right">WHIP</th>
            </tr>
          </thead>
          <tbody>
            {shown
              .sort((a, b) => b.zTotal - a.zTotal)
              .map((p, i) => (
                <tr key={i} className={`border-b border-border/50 ${i % 2 === 0 ? "" : "bg-white/[0.01]"} hover:bg-white/[0.02]`}>
                  <td className="px-3 py-2 font-medium text-slate-100">{p.name}</td>
                  <td className="px-2 py-2 text-slate-500">{p.team}</td>
                  <td className={`px-2 py-2 text-right font-mono ${
                    p.zTotal >= 0.5 ? "text-sky-400" : p.zTotal >= 0 ? "text-slate-300" : "text-red-400/70"
                  }`}>{p.zTotal.toFixed(2)}</td>
                  <td className="px-2 py-2 text-right font-mono text-slate-400">{fmt(p.K)}</td>
                  {view === "SP" ? (
                    <>
                      <td className="px-2 py-2 text-right font-mono text-slate-400">{fmt(p.QS)}</td>
                      <td className="px-2 py-2 text-right font-mono text-slate-400">{fmt(p.W)}</td>
                      <td className="px-2 py-2 text-right font-mono text-slate-400">{fmt(p.L)}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-2 py-2 text-right font-mono text-slate-400">{fmt(p.SV)}</td>
                      <td className="px-2 py-2 text-right font-mono text-slate-400">{fmt(p.HD)}</td>
                    </>
                  )}
                  <td className={`px-2 py-2 text-right font-mono ${statColor(p.ERA, "low", [3.5, 4.2])}`}>
                    {fmt(p.ERA, 3)}
                  </td>
                  <td className={`px-2 py-2 text-right font-mono ${statColor(p.WHIP, "low", [1.15, 1.30])}`}>
                    {fmt(p.WHIP, 3)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-[11px] text-slate-700">
        Stats shown are season projections from draft rankings. Weekly starts data requires ESPN credentials.
      </div>
    </div>
  );
}
