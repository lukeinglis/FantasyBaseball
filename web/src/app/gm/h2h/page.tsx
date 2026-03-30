"use client";

import { useState, useEffect, useMemo } from "react";

interface H2HMatchup {
  week: number;
  oppTeamId: number;
  oppTeamName: string;
  myWins: number;
  myLosses: number;
  myTies: number;
  categories: Record<string, { myValue: number; oppValue: number; result: "WIN" | "LOSS" | "TIE" }>;
}

interface OpponentRecord {
  teamName: string;
  totalWins: number;
  totalLosses: number;
  totalTies: number;
  catWins: Record<string, number>;
  catLosses: Record<string, number>;
  matchupsPlayed: number;
}

interface H2HData {
  myTeamId: number;
  myTeamName: string;
  scoringPeriodId: number;
  matchups: H2HMatchup[];
  opponents: Record<string, OpponentRecord>;
}

const BAT_CATS = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG"];
const PIT_CATS = ["K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"];
const ALL_CATS = [...BAT_CATS, ...PIT_CATS];

function resultColor(w: number, l: number): string {
  if (w > l) return "text-emerald-600";
  if (l > w) return "text-red-600";
  return "text-orange-600";
}

function catCellColor(wins: number, losses: number): string {
  if (wins > losses) return "text-emerald-600";
  if (losses > wins) return "text-red-600";
  if (wins === 0 && losses === 0) return "text-slate-400";
  return "text-orange-600";
}

function EspnSetupCard() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-surface px-8 py-10 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-orange-600/60">Setup Required</div>
      <div className="mt-3 text-xl font-bold text-gray-900">Connect ESPN Credentials</div>
      <div className="mt-3 text-[13px] text-slate-500">
        Team H2H pulls live data from your private ESPN league.
      </div>
    </div>
  );
}

export default function TeamH2HPage() {
  const [data, setData] = useState<H2HData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"opponents" | "weekly">("opponents");

  useEffect(() => {
    fetch("/api/espn/h2h")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(() => setError("FETCH_FAILED"))
      .finally(() => setLoading(false));
  }, []);

  // Sort opponents by total category wins desc
  const sortedOpponents = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.opponents)
      .map(([id, opp]) => ({ id: parseInt(id), ...opp }))
      .sort((a, b) => b.totalWins - a.totalWins);
  }, [data]);

  // Overall season record
  const seasonRecord = useMemo(() => {
    if (!data) return { w: 0, l: 0, t: 0 };
    return data.matchups.reduce(
      (acc, m) => ({ w: acc.w + m.myWins, l: acc.l + m.myLosses, t: acc.t + m.myTies }),
      { w: 0, l: 0, t: 0 }
    );
  }, [data]);

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading H2H records...</div>;
  if (error === "ESPN_CREDS_MISSING" || error === "MY_ESPN_TEAM_ID_MISSING") {
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnSetupCard /></div>;
  }
  if (error || !data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load H2H records</div>
        <div className="text-[12px] text-slate-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Head-to-Head</h1>
          <div className="flex items-center gap-3 text-[12px]">
            <span className="text-slate-500">Season Record:</span>
            <span className={`font-bold tabular-nums ${resultColor(seasonRecord.w, seasonRecord.l)}`}>
              {seasonRecord.w}-{seasonRecord.l}{seasonRecord.t > 0 ? `-${seasonRecord.t}` : ""}
            </span>
          </div>
        </div>
        <div className="flex gap-0.5 rounded bg-surface p-0.5">
          {(["opponents", "weekly"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`rounded px-3 py-1 text-[11px] font-bold transition-colors ${
                view === v ? "bg-black/10 text-gray-900" : "text-slate-500 hover:text-slate-700"
              }`}>
              {v === "opponents" ? "By Opponent" : "Week by Week"}
            </button>
          ))}
        </div>
      </div>

      {view === "opponents" ? (
        <>
          {/* Opponent summary cards */}
          <div className="space-y-3">
            {sortedOpponents.map((opp) => {
              const matchupResult = opp.totalWins > opp.totalLosses ? "winning"
                : opp.totalLosses > opp.totalWins ? "losing" : "tied";
              return (
                <div key={opp.id} className="rounded-lg border border-border bg-surface">
                  {/* Opponent header */}
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <div>
                      <span className="text-[14px] font-semibold text-slate-400">{opp.teamName}</span>
                      <span className="ml-2 text-[11px] text-slate-600">
                        ({opp.matchupsPlayed} matchup{opp.matchupsPlayed !== 1 ? "s" : ""})
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[16px] font-bold tabular-nums ${resultColor(opp.totalWins, opp.totalLosses)}`}>
                        {opp.totalWins}-{opp.totalLosses}
                        {opp.totalTies > 0 ? `-${opp.totalTies}` : ""}
                      </span>
                      <span className={`text-[10px] font-semibold uppercase ${
                        matchupResult === "winning" ? "text-emerald-600/60" :
                        matchupResult === "losing" ? "text-red-600/60" : "text-orange-600/60"
                      }`}>cats</span>
                    </div>
                  </div>

                  {/* Per-category W-L */}
                  <div className="grid grid-cols-8 sm:grid-cols-16 gap-0">
                    {ALL_CATS.map((cat) => {
                      const w = opp.catWins[cat] ?? 0;
                      const l = opp.catLosses[cat] ?? 0;
                      return (
                        <div key={cat} className="px-2 py-2 text-center border-r border-border last:border-r-0">
                          <div className="text-[9px] font-bold text-slate-600">{cat}</div>
                          <div className={`text-[12px] font-mono tabular-nums font-semibold ${catCellColor(w, l)}`}>
                            {w}-{l}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {sortedOpponents.length === 0 && (
            <div className="rounded-lg border border-border bg-surface px-6 py-10 text-center text-slate-500">
              No matchup data yet. Check back after the first scoring period.
            </div>
          )}
        </>
      ) : (
        /* Week-by-week view */
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-[12px]">
            <thead className="border-b border-border bg-surface text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2.5 sticky left-0 bg-surface">Wk</th>
                <th className="px-2 py-2.5">Opponent</th>
                <th className="px-2 py-2.5 text-center">Result</th>
                {ALL_CATS.map((cat) => (
                  <th key={cat} className="px-1.5 py-2.5 text-center w-8">{cat}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.matchups.map((m) => {
                const isWin = m.myWins > m.myLosses;
                const isLoss = m.myLosses > m.myWins;
                return (
                  <tr key={m.week} className={`border-b border-border/50 ${
                    isWin ? "bg-emerald-50" : isLoss ? "bg-red-50" : ""
                  }`}>
                    <td className="px-3 py-2 font-bold text-slate-500 sticky left-0 bg-inherit">{m.week}</td>
                    <td className="px-2 py-2 text-slate-400 whitespace-nowrap">{m.oppTeamName}</td>
                    <td className="px-2 py-2 text-center">
                      <span className={`font-bold font-mono tabular-nums ${resultColor(m.myWins, m.myLosses)}`}>
                        {m.myWins}-{m.myLosses}{m.myTies > 0 ? `-${m.myTies}` : ""}
                      </span>
                    </td>
                    {ALL_CATS.map((cat) => {
                      const c = m.categories[cat];
                      if (!c) return <td key={cat} className="px-1.5 py-2 text-center text-slate-400">-</td>;
                      return (
                        <td key={cat} className={`px-1.5 py-2 text-center text-[11px] font-bold ${
                          c.result === "WIN" ? "text-emerald-600" :
                          c.result === "LOSS" ? "text-red-600" : "text-orange-600"
                        }`}>
                          {c.result === "WIN" ? "W" : c.result === "LOSS" ? "L" : "T"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
