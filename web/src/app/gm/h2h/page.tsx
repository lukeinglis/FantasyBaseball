"use client";

import { useState, useEffect, useMemo } from "react";
import { categoryTierHeaderClass, isPunt, ALL_CATS_BY_WEIGHT } from "@/lib/category-weights";

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

interface AllPlayWeek {
  week: number;
  wins: number;
  losses: number;
  ties: number;
}

interface H2HData {
  myTeamId: number;
  myTeamName: string;
  scoringPeriodId: number;
  matchups: H2HMatchup[];
  opponents: Record<string, OpponentRecord>;
  allPlay?: {
    totalWins: number;
    totalLosses: number;
    totalTies: number;
    weeks: AllPlayWeek[];
  };
}

interface TeamCategoryStats {
  teamId: number;
  teamName: string;
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

function safe(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return v;
}

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

function fmtValue(cat: string, val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return "-";
  if (cat === "AVG") return val.toFixed(3);
  if (cat === "ERA" || cat === "WHIP") return val.toFixed(2);
  return String(Math.round(val));
}

function fmtPct(numerator: number, denominator: number): string {
  if (denominator <= 0) return ".000";
  const pct = numerator / denominator;
  if (!Number.isFinite(pct)) return ".000";
  return pct.toFixed(3);
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

/* ── This Week: hypothetical H2H matchup helpers ── */

interface HypotheticalMatchup {
  teamId: number;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  catResults: { cat: string; myValue: number; oppValue: number; result: "WIN" | "LOSS" | "TIE" }[];
}

function compareTeams(
  myStats: Record<string, number>,
  oppStats: Record<string, number>
): { wins: number; losses: number; ties: number; catResults: { cat: string; myValue: number; oppValue: number; result: "WIN" | "LOSS" | "TIE" }[] } {
  let wins = 0, losses = 0, ties = 0;
  const catResults: { cat: string; myValue: number; oppValue: number; result: "WIN" | "LOSS" | "TIE" }[] = [];

  for (const cat of ALL_CATS) {
    const myVal = safe(myStats[cat]);
    const oppVal = safe(oppStats[cat]);
    const lower = LOWER_IS_BETTER.has(cat);
    let result: "WIN" | "LOSS" | "TIE";

    if (myVal === oppVal) {
      result = "TIE";
      ties++;
    } else if (lower ? myVal < oppVal : myVal > oppVal) {
      result = "WIN";
      wins++;
    } else {
      result = "LOSS";
      losses++;
    }

    catResults.push({ cat, myValue: myVal, oppValue: oppVal, result });
  }

  return { wins, losses, ties, catResults };
}

/* ── Tab type ── */

type Tab = "thisWeek" | "seasonH2H" | "allPlay";

/* ── This Week Tab Component ── */

function ThisWeekView({ leagueData }: { leagueData: LeagueStatsData }) {
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);

  const myTeam = leagueData.teams.find((t) => t.teamId === leagueData.myTeamId);

  const hypotheticals = useMemo(() => {
    if (!myTeam) return [];
    const results: HypotheticalMatchup[] = [];
    for (const opp of leagueData.teams) {
      if (opp.teamId === leagueData.myTeamId) continue;
      const { wins, losses, ties, catResults } = compareTeams(myTeam.categories, opp.categories);
      results.push({ teamId: opp.teamId, teamName: opp.teamName, wins, losses, ties, catResults });
    }
    results.sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses));
    return results;
  }, [myTeam, leagueData]);

  const overallSummary = useMemo(() => {
    let beat = 0, loseTo = 0, tie = 0;
    for (const h of hypotheticals) {
      if (h.wins > h.losses) beat++;
      else if (h.losses > h.wins) loseTo++;
      else tie++;
    }
    return { beat, loseTo, tie };
  }, [hypotheticals]);

  const catStrength = useMemo(() => {
    if (!myTeam) return [];
    return ALL_CATS_BY_WEIGHT.map((cat) => {
      let winsCount = 0;
      for (const opp of leagueData.teams) {
        if (opp.teamId === leagueData.myTeamId) continue;
        const myVal = safe(myTeam.categories[cat]);
        const oppVal = safe(opp.categories[cat]);
        const lower = LOWER_IS_BETTER.has(cat);
        if (myVal === oppVal) continue;
        if (lower ? myVal < oppVal : myVal > oppVal) winsCount++;
      }
      const totalOpps = leagueData.teams.length - 1;
      return { cat, wins: winsCount, total: totalOpps };
    });
  }, [myTeam, leagueData]);

  if (!myTeam) {
    return <div className="text-center text-slate-500 py-10">Could not find your team in league data.</div>;
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="rounded-lg border border-border bg-surface px-4 py-3">
        <div className="text-[12px] text-slate-600">
          <span className="font-semibold text-gray-900">Hypothetical record vs all opponents:</span>{" "}
          Would{" "}
          <span className="font-bold text-emerald-600">beat {overallSummary.beat}</span>
          {overallSummary.tie > 0 && <>, <span className="font-bold text-orange-600">tie {overallSummary.tie}</span></>}
          , <span className="font-bold text-red-600">lose to {overallSummary.loseTo}</span>{" "}
          team{overallSummary.loseTo !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Category Strength Grid */}
      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Category Strength</div>
        <div className="grid grid-cols-8 sm:grid-cols-16 gap-0 rounded-lg border border-border bg-surface overflow-hidden">
          {catStrength.map(({ cat, wins, total }) => {
            const ratio = total > 0 ? wins / total : 0;
            const colorClass = ratio >= 0.7 ? "text-emerald-600" : ratio >= 0.4 ? "text-orange-600" : "text-red-600";
            return (
              <div key={cat} className={`px-2 py-2 text-center border-r border-border last:border-r-0${isPunt(cat) ? " opacity-50" : ""}`}>
                <div className={`text-[9px] ${categoryTierHeaderClass(cat)}`}>{cat}</div>
                <div className={`text-[13px] font-bold font-mono tabular-nums ${colorClass}`}>
                  {wins}/{total}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Matchup Cards */}
      <div className="space-y-2">
        {hypotheticals.map((h) => {
          const isWin = h.wins > h.losses;
          const isLoss = h.losses > h.wins;
          const isExpanded = expandedTeam === h.teamId;
          return (
            <div key={h.teamId} className="rounded-lg border border-border bg-surface overflow-hidden">
              <button
                onClick={() => setExpandedTeam(isExpanded ? null : h.teamId)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors ${
                  isWin ? "border-l-4 border-l-emerald-500" : isLoss ? "border-l-4 border-l-red-400" : "border-l-4 border-l-orange-400"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-[13px] font-semibold ${isWin ? "text-emerald-700" : isLoss ? "text-red-700" : "text-orange-700"}`}>
                    {isWin ? "W" : isLoss ? "L" : "T"}
                  </span>
                  <span className="text-[13px] text-slate-600">{h.teamName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[15px] font-bold font-mono tabular-nums ${resultColor(h.wins, h.losses)}`}>
                    {h.wins}-{h.losses}{h.ties > 0 ? `-${h.ties}` : ""}
                  </span>
                  <span className="text-slate-400 text-[11px]">{isExpanded ? "▲" : "▼"}</span>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-border px-4 py-3">
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {h.catResults.map((cr) => (
                      <div key={cr.cat} className={`rounded px-2 py-1.5 text-center ${
                        cr.result === "WIN" ? "bg-emerald-50" : cr.result === "LOSS" ? "bg-red-50" : "bg-orange-50"
                      }`}>
                        <div className="text-[9px] font-bold text-slate-500">{cr.cat}</div>
                        <div className={`text-[12px] font-bold font-mono tabular-nums ${
                          cr.result === "WIN" ? "text-emerald-600" : cr.result === "LOSS" ? "text-red-600" : "text-orange-600"
                        }`}>
                          {fmtValue(cr.cat, cr.myValue)}
                        </div>
                        <div className="text-[10px] font-mono tabular-nums text-slate-400">
                          {fmtValue(cr.cat, cr.oppValue)}
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
    </div>
  );
}

/* ── Season H2H Tab Component ── */

function SeasonH2HView({ data }: { data: H2HData }) {
  const [view, setView] = useState<"opponents" | "weekly">("opponents");

  const sortedOpponents = useMemo(() => {
    return Object.entries(data.opponents)
      .map(([id, opp]) => ({ id: parseInt(id), ...opp }))
      .sort((a, b) => safe(b.totalWins) - safe(a.totalWins));
  }, [data]);

  const seasonRecord = useMemo(() => {
    return data.matchups.reduce(
      (acc, m) => ({ w: acc.w + safe(m.myWins), l: acc.l + safe(m.myLosses), t: acc.t + safe(m.myTies) }),
      { w: 0, l: 0, t: 0 }
    );
  }, [data]);

  return (
    <div className="space-y-4">
      {/* Season record summary */}
      <div className="rounded-lg border border-border bg-surface px-4 py-3">
        <div className="text-[12px] text-slate-600">
          <span className="font-semibold text-gray-900">Season Category Record:</span>{" "}
          <span className={`font-bold tabular-nums ${resultColor(seasonRecord.w, seasonRecord.l)}`}>
            {seasonRecord.w}-{seasonRecord.l}{seasonRecord.t > 0 ? `-${seasonRecord.t}` : ""}
          </span>
        </div>
      </div>

      {/* Sub-view toggle */}
      <div className="flex gap-0.5 rounded bg-surface p-0.5 w-fit">
        {(["opponents", "weekly"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={`rounded px-3 py-1 text-[11px] font-bold transition-colors ${
              view === v ? "bg-black/10 text-gray-900" : "text-slate-500 hover:text-slate-700"
            }`}>
            {v === "opponents" ? "By Opponent" : "Week by Week"}
          </button>
        ))}
      </div>

      {view === "opponents" ? (
        <>
          <div className="space-y-3">
            {sortedOpponents.map((opp) => {
              const matchupResult = safe(opp.totalWins) > safe(opp.totalLosses) ? "winning"
                : safe(opp.totalLosses) > safe(opp.totalWins) ? "losing" : "tied";
              return (
                <div key={opp.id} className="rounded-lg border border-border bg-surface">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <div>
                      <span className="text-[14px] font-semibold text-slate-400">{opp.teamName}</span>
                      <span className="ml-2 text-[11px] text-slate-600">
                        ({safe(opp.matchupsPlayed)} matchup{safe(opp.matchupsPlayed) !== 1 ? "s" : ""})
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[16px] font-bold tabular-nums ${resultColor(safe(opp.totalWins), safe(opp.totalLosses))}`}>
                        {safe(opp.totalWins)}-{safe(opp.totalLosses)}
                        {safe(opp.totalTies) > 0 ? `-${safe(opp.totalTies)}` : ""}
                      </span>
                      <span className={`text-[10px] font-semibold uppercase ${
                        matchupResult === "winning" ? "text-emerald-600/60" :
                        matchupResult === "losing" ? "text-red-600/60" : "text-orange-600/60"
                      }`}>cats</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-8 sm:grid-cols-16 gap-0">
                    {ALL_CATS.map((cat) => {
                      const w = safe(opp.catWins[cat]);
                      const l = safe(opp.catLosses[cat]);
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
                const isWin = safe(m.myWins) > safe(m.myLosses);
                const isLoss = safe(m.myLosses) > safe(m.myWins);
                return (
                  <tr key={m.week} className={`border-b border-border/50 ${
                    isWin ? "bg-emerald-50" : isLoss ? "bg-red-50" : ""
                  }`}>
                    <td className="px-3 py-2 font-bold text-slate-500 sticky left-0 bg-inherit">{m.week}</td>
                    <td className="px-2 py-2 text-slate-400 whitespace-nowrap">{m.oppTeamName}</td>
                    <td className="px-2 py-2 text-center">
                      <span className={`font-bold font-mono tabular-nums ${resultColor(safe(m.myWins), safe(m.myLosses))}`}>
                        {safe(m.myWins)}-{safe(m.myLosses)}{safe(m.myTies) > 0 ? `-${safe(m.myTies)}` : ""}
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

/* ── All-Play Record Tab Component ── */

function AllPlayView({ allPlay }: { allPlay: NonNullable<H2HData["allPlay"]> }) {
  const totalGames = safe(allPlay.totalWins) + safe(allPlay.totalLosses) + safe(allPlay.totalTies);
  const winPct = fmtPct(safe(allPlay.totalWins), totalGames);

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="rounded-lg border border-border bg-surface px-4 py-4">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">All-Play Record</div>
            <div className={`text-[22px] font-bold tabular-nums ${resultColor(safe(allPlay.totalWins), safe(allPlay.totalLosses))}`}>
              {safe(allPlay.totalWins)}-{safe(allPlay.totalLosses)}{safe(allPlay.totalTies) > 0 ? `-${safe(allPlay.totalTies)}` : ""}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Win %</div>
            <div className="text-[22px] font-bold tabular-nums text-gray-900">{winPct}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Weeks Played</div>
            <div className="text-[22px] font-bold tabular-nums text-gray-900">{allPlay.weeks.length}</div>
          </div>
        </div>
      </div>

      {/* Week-by-week table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-[12px]">
          <thead className="border-b border-border bg-surface text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2.5">Week</th>
              <th className="px-3 py-2.5 text-center">Record</th>
              <th className="px-3 py-2.5 text-center">Win %</th>
              <th className="px-3 py-2.5 text-right">Running Total</th>
            </tr>
          </thead>
          <tbody>
            {allPlay.weeks.map((w, i) => {
              const weekTotal = safe(w.wins) + safe(w.losses) + safe(w.ties);
              const weekPct = fmtPct(safe(w.wins), weekTotal);

              const runW = allPlay.weeks.slice(0, i + 1).reduce((s, wk) => s + safe(wk.wins), 0);
              const runL = allPlay.weeks.slice(0, i + 1).reduce((s, wk) => s + safe(wk.losses), 0);
              const runT = allPlay.weeks.slice(0, i + 1).reduce((s, wk) => s + safe(wk.ties), 0);

              const isGood = safe(w.wins) > safe(w.losses);
              const isBad = safe(w.losses) > safe(w.wins);

              return (
                <tr key={w.week} className={`border-b border-border/50 ${
                  isGood ? "bg-emerald-50" : isBad ? "bg-red-50" : ""
                }`}>
                  <td className="px-3 py-2 font-bold text-slate-500">{w.week}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`font-bold font-mono tabular-nums ${resultColor(safe(w.wins), safe(w.losses))}`}>
                      {safe(w.wins)}-{safe(w.losses)}{safe(w.ties) > 0 ? `-${safe(w.ties)}` : ""}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center font-mono tabular-nums text-slate-600">{weekPct}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={`font-mono tabular-nums ${resultColor(runW, runL)}`}>
                      {runW}-{runL}{runT > 0 ? `-${runT}` : ""}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {allPlay.weeks.length === 0 && (
        <div className="rounded-lg border border-border bg-surface px-6 py-10 text-center text-slate-500">
          No scoring periods completed yet. All-play records will appear after the first week.
        </div>
      )}
    </div>
  );
}

/* ── Main Page ── */

const TAB_CONFIG: { key: Tab; label: string }[] = [
  { key: "thisWeek", label: "This Week" },
  { key: "seasonH2H", label: "Season H2H" },
  { key: "allPlay", label: "All-Play Record" },
];

export default function TeamH2HPage() {
  const [data, setData] = useState<H2HData | null>(null);
  const [leagueData, setLeagueData] = useState<LeagueStatsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("thisWeek");

  useEffect(() => {
    Promise.all([
      fetch("/api/espn/h2h").then((r) => r.json()),
      fetch("/api/espn/league-stats").then((r) => r.json()),
    ])
      .then(([h2h, ls]) => {
        if (h2h.error) { setError(h2h.error); return; }
        setData(h2h);
        if (!ls.error) setLeagueData(ls);
      })
      .catch(() => setError("FETCH_FAILED"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading...</div>;
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
            {data.allPlay && (
              <>
                <span className="text-slate-500">All-Play:</span>
                <span className={`font-bold tabular-nums ${resultColor(safe(data.allPlay.totalWins), safe(data.allPlay.totalLosses))}`}>
                  {safe(data.allPlay.totalWins)}-{safe(data.allPlay.totalLosses)}{safe(data.allPlay.totalTies) > 0 ? `-${safe(data.allPlay.totalTies)}` : ""}
                </span>
              </>
            )}
          </div>
        </div>
        {/* Tab toggle */}
        <div className="flex gap-0.5 rounded bg-surface p-0.5">
          {TAB_CONFIG.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`rounded px-3 py-1 text-[11px] font-bold transition-colors ${
                tab === t.key ? "bg-black/10 text-gray-900" : "text-slate-500 hover:text-slate-700"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "thisWeek" ? (
        leagueData ? (
          <ThisWeekView leagueData={leagueData} />
        ) : (
          <div className="rounded-lg border border-border bg-surface px-6 py-10 text-center text-slate-500">
            League stats unavailable. Cannot compute hypothetical matchups.
          </div>
        )
      ) : tab === "seasonH2H" ? (
        <SeasonH2HView data={data} />
      ) : (
        data.allPlay ? (
          <AllPlayView allPlay={data.allPlay} />
        ) : (
          <div className="rounded-lg border border-border bg-surface px-6 py-10 text-center text-slate-500">
            All-play data is not available yet. Check back after the first scoring period.
          </div>
        )
      )}
    </div>
  );
}
