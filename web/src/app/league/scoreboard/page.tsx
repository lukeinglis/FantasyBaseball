"use client";

import { useState, useEffect } from "react";

interface ScoreboardCatResult {
  cat: string;
  homeValue: number;
  awayValue: number;
  result: "HOME" | "AWAY" | "TIE";
}

interface ScoreboardMatchup {
  homeTeamId: number;
  homeTeamName: string;
  homeWins: number;
  homeLosses: number;
  homeTies: number;
  awayTeamId: number;
  awayTeamName: string;
  awayWins: number;
  awayLosses: number;
  awayTies: number;
  categories?: ScoreboardCatResult[];
}

interface ScoreboardData {
  currentMatchupPeriod: number;
  myTeamId: number;
  matchups: ScoreboardMatchup[];
}

function fmtCatVal(cat: string, val: number): string {
  if (cat === "AVG") return val.toFixed(3);
  if (cat === "ERA" || cat === "WHIP") return val.toFixed(2);
  return String(Math.round(val));
}

function resultColor(w: number, l: number): string {
  if (w > l) return "text-emerald-600 font-bold";
  if (l > w) return "text-red-600";
  return "text-slate-500";
}

function EspnSetupCard() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-surface px-8 py-10 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-orange-600/60">Setup Required</div>
      <div className="mt-3 text-xl font-bold text-gray-900">Connect ESPN Credentials</div>
    </div>
  );
}

export default function ScoreboardPage() {
  const [data, setData] = useState<ScoreboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/espn/scoreboard")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(() => setError("FETCH_FAILED"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading scoreboard...</div>;
  if (error === "ESPN_CREDS_MISSING") {
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnSetupCard /></div>;
  }
  if (error || !data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load scoreboard</div>
        <div className="text-[12px] text-slate-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-gray-900">Scoreboard</h1>
        <span className="text-[12px] text-slate-500">Week {data.currentMatchupPeriod} — All matchups</span>
      </div>

      <div className="space-y-3">
        {data.matchups.map((m, i) => {
          const isMyMatchup = m.homeTeamId === data.myTeamId || m.awayTeamId === data.myTeamId;
          const homeLeading = m.homeWins > m.homeLosses;
          const awayLeading = m.awayWins > m.awayLosses;
          const tied = m.homeWins === m.homeLosses;

          const isExpanded = expanded === i;
          return (
            <div key={i}
              className={`rounded-lg border ${isMyMatchup ? "border-orange-300 bg-orange-50" : "border-border bg-surface"} overflow-hidden cursor-pointer`}
              onClick={() => setExpanded(isExpanded ? null : i)}
            >
              {/* Away team */}
              <div className={`flex items-center justify-between px-4 py-3 ${awayLeading ? "bg-emerald-50" : ""}`}>
                <div className="flex items-center gap-3">
                  {isMyMatchup && m.awayTeamId === data.myTeamId && (
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  )}
                  <span className={`text-[14px] ${m.awayTeamId === data.myTeamId ? "font-bold text-orange-600" : "font-medium text-slate-700"}`}>
                    {m.awayTeamName}
                  </span>
                </div>
                <span className={`text-[16px] font-bold tabular-nums ${resultColor(m.awayWins, m.awayLosses)}`}>
                  {m.awayWins}-{m.awayLosses}{m.awayTies > 0 ? `-${m.awayTies}` : ""}
                </span>
              </div>

              {/* Divider */}
              <div className="border-t border-border/50" />

              {/* Home team */}
              <div className={`flex items-center justify-between px-4 py-3 ${homeLeading ? "bg-emerald-50" : ""}`}>
                <div className="flex items-center gap-3">
                  {isMyMatchup && m.homeTeamId === data.myTeamId && (
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  )}
                  <span className={`text-[14px] ${m.homeTeamId === data.myTeamId ? "font-bold text-orange-600" : "font-medium text-slate-700"}`}>
                    {m.homeTeamName}
                  </span>
                </div>
                <span className={`text-[16px] font-bold tabular-nums ${resultColor(m.homeWins, m.homeLosses)}`}>
                  {m.homeWins}-{m.homeLosses}{m.homeTies > 0 ? `-${m.homeTies}` : ""}
                </span>
              </div>

              {/* Expanded category breakdown */}
              {isExpanded && m.categories && (
                <div className="border-t border-border/50 px-4 py-2">
                  <div className="grid grid-cols-8 gap-1">
                    {m.categories.map(c => (
                      <div key={c.cat} className="text-center py-1">
                        <div className="text-[9px] font-bold text-slate-400">{c.cat}</div>
                        <div className={`text-[10px] font-mono tabular-nums ${c.result === "AWAY" ? "text-emerald-600 font-bold" : "text-slate-500"}`}>
                          {fmtCatVal(c.cat, c.awayValue)}
                        </div>
                        <div className={`text-[10px] font-mono tabular-nums ${c.result === "HOME" ? "text-emerald-600 font-bold" : "text-slate-500"}`}>
                          {fmtCatVal(c.cat, c.homeValue)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {data.matchups.length === 0 && (
        <div className="rounded-lg border border-border bg-surface px-6 py-10 text-center text-slate-500">
          No matchups found for this week.
        </div>
      )}
    </div>
  );
}
