"use client";

import { useState, useEffect, useMemo } from "react";

interface MatchupCat {
  cat: string;
  myValue: number | null;
  oppValue: number | null;
  result: "WIN" | "LOSS" | "TIE" | "PENDING";
}

interface MatchupData {
  scoringPeriodId: number;
  matchupStartDate: string | null;
  matchupEndDate: string | null;
  myTeamName: string;
  oppTeamName: string;
  categories: MatchupCat[];
}

interface TeamCategoryStats {
  teamId: number;
  teamName: string;
  categories: Record<string, number>;
  ranks: Record<string, number>;
}

interface LeagueStatsData {
  myTeamId: number;
  teams: TeamCategoryStats[];
}

const BAT_CATS = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG"];
const PIT_CATS = ["K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"];
const LOWER_IS_BETTER = new Set(["ERA", "WHIP", "L"]);

function resultColor(result: string) {
  if (result === "WIN") return "text-emerald-600";
  if (result === "LOSS") return "text-red-600";
  if (result === "TIE") return "text-orange-600";
  return "text-slate-500";
}

function resultBg(result: string) {
  if (result === "WIN") return "bg-emerald-100 border-emerald-300";
  if (result === "LOSS") return "bg-red-100 border-red-300";
  if (result === "TIE") return "bg-orange-100 border-orange-300";
  return "bg-surface border-border";
}

function rankColor(rank: number): string {
  if (rank <= 3) return "text-emerald-600";
  if (rank <= 7) return "text-slate-500";
  return "text-red-600";
}

function fmtValue(cat: string, val: number | null | undefined): string {
  if (val === null || val === undefined) return "-";
  if (cat === "AVG") return val.toFixed(3);
  if (cat === "ERA" || cat === "WHIP") return val.toFixed(2);
  return String(Math.round(val));
}

function fmtDateRange(start: string | null, end: string | null): string {
  if (!start || !end) return "";
  const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} - ${fmt(end)}`;
}

function EspnSetupCard() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-surface px-8 py-10 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-orange-600/60">Setup Required</div>
      <div className="mt-3 text-xl font-bold text-gray-900">Connect ESPN Credentials</div>
      <div className="mt-3 text-[13px] text-slate-500">
        Category Breakdown pulls live data from your private ESPN league.
      </div>
    </div>
  );
}

export default function CategoryBreakdownPage() {
  const [matchup, setMatchup] = useState<MatchupData | null>(null);
  const [leagueStats, setLeagueStats] = useState<LeagueStatsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/espn/matchup").then((r) => r.json()),
      fetch("/api/espn/league-stats").then((r) => r.json()),
    ]).then(([m, ls]) => {
      if (m.error) { setError(m.error); return; }
      setMatchup(m);
      if (!ls.error) setLeagueStats(ls);
    })
    .catch(() => setError("FETCH_FAILED"))
    .finally(() => setLoading(false));
  }, []);

  const myLeagueTeam = useMemo(() => {
    if (!leagueStats) return null;
    return leagueStats.teams.find((t) => t.teamId === leagueStats.myTeamId) ?? null;
  }, [leagueStats]);

  // For each category, find who's #1 and the gap
  const catDetails = useMemo(() => {
    if (!matchup || !leagueStats || !myLeagueTeam) return [];
    return [...BAT_CATS, ...PIT_CATS].map((cat) => {
      const matchupCat = matchup.categories.find((c) => c.cat === cat);
      const myRank = myLeagueTeam.ranks[cat] ?? 0;
      const myValue = myLeagueTeam.categories[cat] ?? 0;

      // Find leader
      const lower = LOWER_IS_BETTER.has(cat);
      const sorted = [...leagueStats.teams].sort((a, b) => {
        const aVal = a.categories[cat] ?? 0;
        const bVal = b.categories[cat] ?? 0;
        return lower ? aVal - bVal : bVal - aVal;
      });
      const leader = sorted[0];
      const leaderValue = leader?.categories[cat] ?? 0;
      const gap = lower ? myValue - leaderValue : leaderValue - myValue;

      // Find next team ahead and behind
      const myIdx = sorted.findIndex((t) => t.teamId === leagueStats.myTeamId);
      const teamAhead = myIdx > 0 ? sorted[myIdx - 1] : null;
      const teamBehind = myIdx < sorted.length - 1 ? sorted[myIdx + 1] : null;
      const gapAhead = teamAhead
        ? (lower ? myValue - (teamAhead.categories[cat] ?? 0) : (teamAhead.categories[cat] ?? 0) - myValue)
        : 0;
      const gapBehind = teamBehind
        ? (lower ? (teamBehind.categories[cat] ?? 0) - myValue : myValue - (teamBehind.categories[cat] ?? 0))
        : 0;

      return {
        cat,
        matchupResult: matchupCat?.result ?? "PENDING",
        matchupMyValue: matchupCat?.myValue ?? null,
        matchupOppValue: matchupCat?.oppValue ?? null,
        leagueRank: myRank,
        leagueValue: myValue,
        leaderName: leader?.teamName ?? "",
        leaderValue,
        gapToLeader: gap,
        teamAheadName: teamAhead?.teamName ?? null,
        gapAhead,
        teamBehindName: teamBehind?.teamName ?? null,
        gapBehind,
      };
    });
  }, [matchup, leagueStats, myLeagueTeam]);

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading category breakdown...</div>;
  if (error === "ESPN_CREDS_MISSING" || error === "MY_ESPN_TEAM_ID_MISSING") {
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnSetupCard /></div>;
  }
  if (error || !matchup) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load breakdown</div>
        <div className="text-[12px] text-slate-600">{error}</div>
      </div>
    );
  }

  const batDetails = catDetails.filter((d) => BAT_CATS.includes(d.cat));
  const pitDetails = catDetails.filter((d) => PIT_CATS.includes(d.cat));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-lg font-bold text-gray-900">Category Breakdown</h1>
        <div className="flex items-center gap-2 text-[12px] text-slate-500">
          <span>Week {matchup.scoringPeriodId}</span>
          {matchup.matchupStartDate && (
            <span className="text-slate-400">{fmtDateRange(matchup.matchupStartDate, matchup.matchupEndDate)}</span>
          )}
          <span className="text-slate-400">vs</span>
          <span>{matchup.oppTeamName}</span>
        </div>
      </div>

      {/* Category cards */}
      {[
        { label: "Batting", details: batDetails },
        { label: "Pitching", details: pitDetails },
      ].map(({ label, details }) => (
        <div key={label} className="mb-6">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {details.map((d) => (
              <div key={d.cat} className={`rounded-lg border p-3 ${resultBg(d.matchupResult)}`}>
                {/* Category header */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-bold text-slate-600">{d.cat}</span>
                  <div className="flex items-center gap-2">
                    {d.leagueRank > 0 && (
                      <span className={`text-[10px] font-bold ${rankColor(d.leagueRank)}`}>
                        #{d.leagueRank} in league
                      </span>
                    )}
                    {d.matchupResult !== "PENDING" && (
                      <span className={`text-[10px] font-bold uppercase ${resultColor(d.matchupResult)}`}>
                        {d.matchupResult}
                      </span>
                    )}
                  </div>
                </div>

                {/* This week's matchup values */}
                <div className="flex items-baseline justify-between mb-3">
                  <div>
                    <div className={`text-[20px] font-bold font-mono tabular-nums ${resultColor(d.matchupResult)}`}>
                      {fmtValue(d.cat, d.matchupMyValue)}
                    </div>
                    <div className="text-[10px] text-slate-600">My total</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[16px] font-mono tabular-nums text-slate-500">
                      {fmtValue(d.cat, d.matchupOppValue)}
                    </div>
                    <div className="text-[10px] text-slate-400">Opponent</div>
                  </div>
                </div>

                {/* League context */}
                {myLeagueTeam && (
                  <div className="border-t border-border pt-2 space-y-1">
                    {d.teamAheadName && (
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-600">Gap to #{d.leagueRank - 1}</span>
                        <span className="text-orange-600 tabular-nums font-mono">
                          {LOWER_IS_BETTER.has(d.cat) ? "+" : "-"}{Math.abs(d.gapAhead).toFixed(
                            d.cat === "AVG" ? 3 : d.cat === "ERA" || d.cat === "WHIP" ? 2 : 0
                          )}
                        </span>
                      </div>
                    )}
                    {d.teamBehindName && (
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-600">Lead on #{d.leagueRank + 1}</span>
                        <span className="text-emerald-600/70 tabular-nums font-mono">
                          +{Math.abs(d.gapBehind).toFixed(
                            d.cat === "AVG" ? 3 : d.cat === "ERA" || d.cat === "WHIP" ? 2 : 0
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
