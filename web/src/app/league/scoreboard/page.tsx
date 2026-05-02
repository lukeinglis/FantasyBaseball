"use client";

import { useState, useEffect } from "react";
import { categoryTierHeaderClass, isPunt } from "@/lib/category-weights";

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

export interface TeamCatValues {
  teamId: number;
  teamName: string;
  values: Record<string, number>;
}

const LOWER_IS_BETTER = new Set(["ERA", "WHIP", "L"]);

export function sanitizeCatVal(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return v;
}

export function buildTeamCatValues(matchups: ScoreboardMatchup[]): TeamCatValues[] {
  const teams: Record<number, TeamCatValues> = {};
  for (const m of matchups) {
    if (!teams[m.homeTeamId]) {
      teams[m.homeTeamId] = { teamId: m.homeTeamId, teamName: m.homeTeamName, values: {} };
    }
    if (!teams[m.awayTeamId]) {
      teams[m.awayTeamId] = { teamId: m.awayTeamId, teamName: m.awayTeamName, values: {} };
    }
    for (const c of m.categories ?? []) {
      teams[m.homeTeamId].values[c.cat] = sanitizeCatVal(c.homeValue);
      teams[m.awayTeamId].values[c.cat] = sanitizeCatVal(c.awayValue);
    }
  }
  return Object.values(teams);
}

// Returns a map of teamId -> rank (1 = best) for the given category.
// Tied teams receive the same rank; the next rank skips accordingly.
export function rankByCategory(teams: TeamCatValues[], cat: string): Record<number, number> {
  const lowerIsBetter = LOWER_IS_BETTER.has(cat);
  const sorted = [...teams]
    .map((t) => ({ teamId: t.teamId, val: sanitizeCatVal(t.values[cat]) }))
    .sort((a, b) => (lowerIsBetter ? a.val - b.val : b.val - a.val));

  const result: Record<number, number> = {};
  let rank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].val !== sorted[i - 1].val) {
      rank = i + 1;
    }
    result[sorted[i].teamId] = rank;
  }
  return result;
}

function rankColor(rank: number): string {
  if (rank <= 3) return "bg-emerald-100 text-emerald-800";
  if (rank >= 8) return "bg-red-100 text-red-800";
  return "bg-amber-50 text-amber-800";
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

interface CategoryRankingsGridProps {
  matchups: ScoreboardMatchup[];
  myTeamId: number;
}

function CategoryRankingsGrid({ matchups, myTeamId }: CategoryRankingsGridProps) {
  const teams = buildTeamCatValues(matchups);
  if (teams.length === 0) return null;

  const cats = matchups[0]?.categories?.map((c) => c.cat) ?? [];
  const rankMaps: Record<string, Record<number, number>> = {};
  for (const cat of cats) {
    rankMaps[cat] = rankByCategory(teams, cat);
  }

  const sorted = [...teams].sort((a, b) => a.teamName.localeCompare(b.teamName));

  return (
    <div className="mt-6">
      <h2 className="mb-2 text-[13px] font-semibold text-slate-700">Category Rankings</h2>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-border bg-slate-50">
              <th className="px-3 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">Team</th>
              {cats.map((cat) => (
                <th key={cat} className={`px-1.5 py-2 text-center whitespace-nowrap ${categoryTierHeaderClass(cat)}`}>
                  {cat}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((team) => {
              const isMyTeam = team.teamId === myTeamId;
              return (
                <tr
                  key={team.teamId}
                  className={`border-b border-border/50 last:border-0 ${isMyTeam ? "bg-orange-50" : ""}`}
                >
                  <td className={`px-3 py-1.5 whitespace-nowrap font-medium ${isMyTeam ? "text-orange-600" : "text-slate-700"}`}>
                    {isMyTeam && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-orange-500 align-middle" />}
                    {team.teamName}
                  </td>
                  {cats.map((cat) => {
                    const rank = rankMaps[cat]?.[team.teamId] ?? 0;
                    return (
                      <td key={cat} className={`px-1 py-1.5 text-center${isPunt(cat) ? " opacity-50" : ""}`}>
                        <span className={`inline-block min-w-[22px] rounded px-1 py-0.5 font-mono tabular-nums font-semibold ${rankColor(rank)}`}>
                          {rank}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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

      {data.matchups.length > 0 && (
        <CategoryRankingsGrid matchups={data.matchups} myTeamId={data.myTeamId} />
      )}
    </div>
  );
}
