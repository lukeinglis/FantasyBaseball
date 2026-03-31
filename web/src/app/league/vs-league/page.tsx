"use client";

import { useState, useEffect, useMemo } from "react";

interface TeamCategoryStats {
  teamId: number;
  teamName: string;
  abbrev: string;
  wins: number;
  losses: number;
  ties: number;
  categories: Record<string, number>;
  ranks: Record<string, number>;
}

interface LeagueStatsData {
  scoringPeriodId: number;
  myTeamId: number;
  teams: TeamCategoryStats[];
}

const BAT_CATS = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG"];
const PIT_CATS = ["K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"];
const ALL_CATS = [...BAT_CATS, ...PIT_CATS];
const LOWER_IS_BETTER = new Set(["ERA", "WHIP", "L"]);

interface VsResult {
  oppTeamId: number;
  oppTeamName: string;
  wins: number;
  losses: number;
  ties: number;
  catResults: Record<string, "W" | "L" | "T">;
}

function resultColor(w: number, l: number): string {
  if (w > l) return "text-emerald-600";
  if (l > w) return "text-red-600";
  return "text-orange-600";
}

function recordBg(w: number, l: number): string {
  if (w > l) return "bg-emerald-50 border-emerald-200";
  if (l > w) return "bg-red-50 border-red-200";
  return "bg-orange-50 border-orange-200";
}

function fmtValue(cat: string, val: number | undefined): string {
  if (val === undefined) return "-";
  if (cat === "AVG") return val.toFixed(3);
  if (cat === "ERA" || cat === "WHIP") return val.toFixed(2);
  return String(Math.round(val));
}

function EspnSetupCard() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-surface px-8 py-10 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-orange-600/60">Setup Required</div>
      <div className="mt-3 text-xl font-bold text-gray-900">Connect ESPN Credentials</div>
    </div>
  );
}

export default function VsLeaguePage() {
  const [data, setData] = useState<LeagueStatsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/espn/league-stats")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(() => setError("FETCH_FAILED"))
      .finally(() => setLoading(false));
  }, []);

  const myTeam = useMemo(() => data?.teams.find((t) => t.teamId === data.myTeamId), [data]);

  // Compute hypothetical matchup vs every team
  const vsResults = useMemo((): VsResult[] => {
    if (!data || !myTeam) return [];

    return data.teams
      .filter((t) => t.teamId !== data.myTeamId)
      .map((opp) => {
        const catResults: Record<string, "W" | "L" | "T"> = {};
        let wins = 0, losses = 0, ties = 0;

        for (const cat of ALL_CATS) {
          const myVal = myTeam.categories[cat] ?? 0;
          const oppVal = opp.categories[cat] ?? 0;
          let result: "W" | "L" | "T" = "T";

          if (LOWER_IS_BETTER.has(cat)) {
            if (myVal < oppVal) result = "W";
            else if (myVal > oppVal) result = "L";
          } else {
            if (myVal > oppVal) result = "W";
            else if (myVal < oppVal) result = "L";
          }

          catResults[cat] = result;
          if (result === "W") wins++;
          else if (result === "L") losses++;
          else ties++;
        }

        return { oppTeamId: opp.teamId, oppTeamName: opp.teamName, wins, losses, ties, catResults };
      })
      .sort((a, b) => {
        // Sort by how well we'd do: most wins first
        if (a.wins !== b.wins) return b.wins - a.wins;
        return a.losses - b.losses;
      });
  }, [data, myTeam]);

  // Summary stats
  const totalWins = useMemo(() => vsResults.filter((r) => r.wins > r.losses).length, [vsResults]);
  const totalLosses = useMemo(() => vsResults.filter((r) => r.losses > r.wins).length, [vsResults]);
  const totalTies = useMemo(() => vsResults.filter((r) => r.wins === r.losses).length, [vsResults]);

  // Find categories where we beat/lose to most teams
  const catStrength = useMemo(() => {
    if (!vsResults.length) return [];
    return ALL_CATS.map((cat) => {
      const wins = vsResults.filter((r) => r.catResults[cat] === "W").length;
      const losses = vsResults.filter((r) => r.catResults[cat] === "L").length;
      return { cat, wins, losses, ties: vsResults.length - wins - losses };
    }).sort((a, b) => b.wins - a.wins);
  }, [vsResults]);

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading...</div>;
  if (error === "ESPN_CREDS_MISSING" || error === "MY_ESPN_TEAM_ID_MISSING") {
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnSetupCard /></div>;
  }
  if (error || !data || !myTeam) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load</div>
        <div className="text-[12px] text-slate-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">vs. The League</h1>
          <span className="text-[12px] text-slate-500">
            How your current week stats stack up against every team
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold tabular-nums text-emerald-600">{totalWins}</div>
            <div className="text-[9px] text-slate-500">WOULD WIN</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold tabular-nums text-red-600">{totalLosses}</div>
            <div className="text-[9px] text-slate-500">WOULD LOSE</div>
          </div>
          {totalTies > 0 && (
            <div className="text-center">
              <div className="text-2xl font-bold tabular-nums text-orange-600">{totalTies}</div>
              <div className="text-[9px] text-slate-500">WOULD TIE</div>
            </div>
          )}
        </div>
      </div>

      {/* Matchup cards */}
      <div className="space-y-2 mb-6">
        {vsResults.map((r) => {
          const isWin = r.wins > r.losses;
          const isLoss = r.losses > r.wins;
          const isExpanded = expanded === r.oppTeamId;

          return (
            <div key={r.oppTeamId}>
              <button
                onClick={() => setExpanded(isExpanded ? null : r.oppTeamId)}
                className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${recordBg(r.wins, r.losses)} hover:shadow-sm`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-[14px] font-semibold ${isWin ? "text-emerald-700" : isLoss ? "text-red-700" : "text-orange-700"}`}>
                      {isWin ? "W" : isLoss ? "L" : "T"}
                    </span>
                    <span className="text-[14px] font-medium text-slate-700">{r.oppTeamName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[16px] font-bold tabular-nums ${resultColor(r.wins, r.losses)}`}>
                      {r.wins}-{r.losses}{r.ties > 0 ? `-${r.ties}` : ""}
                    </span>
                    <span className="text-[10px] text-slate-400">{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </div>
              </button>

              {/* Expanded category breakdown */}
              {isExpanded && (
                <div className="mt-1 rounded-lg border border-border bg-surface px-2 py-2">
                  <div className="grid grid-cols-8 sm:grid-cols-16 gap-0">
                    {ALL_CATS.map((cat) => {
                      const result = r.catResults[cat];
                      const myVal = myTeam.categories[cat];
                      const oppTeamData = data.teams.find((t) => t.teamId === r.oppTeamId);
                      const oppVal = oppTeamData?.categories[cat];
                      return (
                        <div key={cat} className={`px-1.5 py-2 text-center border-r border-border last:border-r-0 ${
                          result === "W" ? "bg-emerald-50" : result === "L" ? "bg-red-50" : ""
                        }`}>
                          <div className="text-[9px] font-bold text-slate-500">{cat}</div>
                          <div className={`text-[11px] font-mono tabular-nums font-bold ${
                            result === "W" ? "text-emerald-600" : result === "L" ? "text-red-600" : "text-orange-600"
                          }`}>
                            {fmtValue(cat, myVal)}
                          </div>
                          <div className="text-[9px] font-mono tabular-nums text-slate-400">
                            {fmtValue(cat, oppVal)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Category strength analysis */}
      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Category Strength vs League</span>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-16">
          {catStrength.map(({ cat, wins, losses }) => (
            <div key={cat} className="border-r border-b border-border last:border-r-0 px-2 py-2.5 text-center">
              <div className="text-[9px] font-bold text-slate-500">{cat}</div>
              <div className={`text-[14px] font-bold tabular-nums ${
                wins >= 7 ? "text-emerald-600" : wins >= 4 ? "text-slate-600" : "text-red-600"
              }`}>
                {wins}-{losses}
              </div>
              <div className="text-[8px] text-slate-400">
                {wins >= 7 ? "dominant" : wins >= 5 ? "strong" : wins >= 3 ? "average" : "weak"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
