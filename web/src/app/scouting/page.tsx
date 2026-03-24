"use client";

import { useState, useEffect, useMemo } from "react";
import type { DraftProfile, DraftPick, StandingsRow } from "@/lib/data";

const CAT_KEYS = ["H","R","HR","TB","RBI","BB","SB","AVG","K","QS","SV","HD","ERA","WHIP"] as const;
type CatKey = (typeof CAT_KEYS)[number];
const LOWER_BETTER = new Set<CatKey>(["ERA","WHIP"]);

function catLabel(c: CatKey) {
  const map: Record<CatKey, string> = {
    H:"H", R:"R", HR:"HR", TB:"TB", RBI:"RBI", BB:"BB", SB:"SB", AVG:"AVG",
    K:"K", QS:"QS", SV:"SV", HD:"HD", ERA:"ERA", WHIP:"WHIP",
  };
  return map[c];
}

function rankColor(rank: number, n: number) {
  if (n === 0) return { bar: "bg-slate-700", text: "text-slate-600", label: "—" };
  const pct = (rank - 1) / (n - 1 || 1);
  if (pct <= 0.25) return { bar: "bg-sky-500", text: "text-sky-400", label: "ELITE" };
  if (pct <= 0.50) return { bar: "bg-emerald-500", text: "text-emerald-400", label: "SOLID" };
  if (pct <= 0.75) return { bar: "bg-amber-500", text: "text-amber-400", label: "AVG" };
  return { bar: "bg-red-500", text: "text-red-400", label: "WEAK" };
}

function finishColor(f: number) {
  if (f === 1) return "text-amber-400 font-bold";
  if (f <= 3) return "text-sky-400";
  if (f >= 8) return "text-red-400/70";
  return "text-white";
}

function computeCategoryRanks(
  teamNamesSet: Set<string>,
  allStandings: StandingsRow[]
): Record<CatKey, { avgRank: number; n: number }> {
  const byYear = new Map<number, StandingsRow[]>();
  for (const row of allStandings) {
    if (!byYear.has(row.year)) byYear.set(row.year, []);
    byYear.get(row.year)!.push(row);
  }

  const accum: Record<string, number[]> = {};
  for (const c of CAT_KEYS) accum[c] = [];

  for (const [, rows] of byYear) {
    const myRow = rows.find((r) => teamNamesSet.has(r.team));
    if (!myRow) continue;

    for (const c of CAT_KEYS) {
      const myVal = (myRow as unknown as Record<string, number | undefined>)[c];
      if (myVal == null) continue;
      const lowerBetter = LOWER_BETTER.has(c);
      const rank =
        rows.filter((r) => {
          const v = (r as unknown as Record<string, number | undefined>)[c];
          return v != null && (lowerBetter ? v < myVal : v > myVal);
        }).length + 1;
      accum[c].push(rank);
    }
  }

  const result = {} as Record<CatKey, { avgRank: number; n: number }>;
  for (const c of CAT_KEYS) {
    const arr = accum[c];
    result[c] = {
      avgRank: arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0,
      n: arr.length,
    };
  }
  return result;
}

const ALL_POSITIONS = ["C","1B","2B","3B","SS","OF","SP","RP"] as const;
type FantasyPos = (typeof ALL_POSITIONS)[number];

function computePosAvgRounds(
  teamNamesSet: Set<string>,
  picks: DraftPick[],
  posMap: Record<string, string>
): Record<FantasyPos, { avg: number; n: number }> {
  // For each year, find the first round at which this franchise drafted each position
  const yearFirstRound: Record<FantasyPos, number[]> = {} as Record<FantasyPos, number[]>;
  for (const pos of ALL_POSITIONS) yearFirstRound[pos] = [];

  const myPicks = picks.filter((p) => teamNamesSet.has(p.team));
  const years = [...new Set(myPicks.map((p) => p.year))];

  for (const year of years) {
    const yearPicks = myPicks.filter((p) => p.year === year).sort((a, b) => a.round - b.round);
    const firstByPos: Partial<Record<FantasyPos, number>> = {};
    for (const pick of yearPicks) {
      const pos = posMap[pick.playerName] as FantasyPos | undefined;
      if (pos && ALL_POSITIONS.includes(pos) && !(pos in firstByPos)) {
        firstByPos[pos] = pick.round;
      }
    }
    for (const pos of ALL_POSITIONS) {
      if (pos in firstByPos) yearFirstRound[pos].push(firstByPos[pos]!);
    }
  }

  const result = {} as Record<FantasyPos, { avg: number; n: number }>;
  for (const pos of ALL_POSITIONS) {
    const arr = yearFirstRound[pos];
    result[pos] = { avg: arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0, n: arr.length };
  }
  return result;
}

export default function ScoutingPage() {
  const [profiles, setProfiles] = useState<DraftProfile[]>([]);
  const [allStandings, setAllStandings] = useState<StandingsRow[]>([]);
  const [allPicks, setAllPicks] = useState<DraftPick[]>([]);
  const [posMap, setPosMap] = useState<Record<string, string>>({});
  const [selectedTeam, setSelectedTeam] = useState<string>("");

  useEffect(() => {
    fetch("/api/profiles").then((r) => r.json()).then((data: DraftProfile[]) => {
      setProfiles(data);
      if (data.length > 0) setSelectedTeam(data[0].team);
    });
    fetch("/api/standings").then((r) => r.json()).then(setAllStandings);
    fetch("/api/draft-results").then((r) => r.json()).then(setAllPicks);
    fetch("/api/player-positions").then((r) => r.json()).then(setPosMap);
  }, []);

  const selected = useMemo(() => profiles.find((p) => p.team === selectedTeam), [profiles, selectedTeam]);

  const teamNamesSet = useMemo(
    () => new Set<string>(selected?.teamNames ?? []),
    [selected]
  );

  // Season stats matched to this franchise's historical team names
  const franchiseStandings = useMemo(
    () => allStandings.filter((r) => teamNamesSet.has(r.team)).sort((a, b) => b.year - a.year),
    [allStandings, teamNamesSet]
  );

  // Category rank profile
  const catRanks = useMemo(
    () => computeCategoryRanks(teamNamesSet, allStandings),
    [teamNamesSet, allStandings]
  );

  // Draft picks for this franchise
  const franchisePicks = useMemo(
    () => allPicks.filter((p) => teamNamesSet.has(p.team)),
    [allPicks, teamNamesSet]
  );

  // Avg first-round by position (all 8 positions)
  const posAvgRounds = useMemo(
    () => computePosAvgRounds(teamNamesSet, allPicks, posMap),
    [teamNamesSet, allPicks, posMap]
  );

  // Years with pick data (most recent 3)
  const draftYears = useMemo(() => {
    const years = [...new Set(franchisePicks.map((p) => p.year))].sort((a, b) => b - a).slice(0, 3);
    return years.reverse();
  }, [franchisePicks]);

  // Summary stats from finishes
  const finishValues = useMemo(() => {
    if (!selected) return [];
    return Object.values(selected.finishes).filter((f) => f > 0);
  }, [selected]);

  const avgFinish = finishValues.length ? (finishValues.reduce((a, b) => a + b, 0) / finishValues.length).toFixed(1) : "—";
  const bestFinish = finishValues.length ? Math.min(...finishValues) : null;
  const titles = finishValues.filter((f) => f === 1).length;

  // Avg win % from standings
  const avgWinPct = useMemo(() => {
    if (!franchiseStandings.length) return null;
    const avg = franchiseStandings.reduce((a, r) => a + r.PCT, 0) / franchiseStandings.length;
    return (avg * 100).toFixed(1);
  }, [franchiseStandings]);

  // Category sorted by strength (best first)
  const sortedCats = useMemo(() => {
    return [...CAT_KEYS]
      .filter((c) => catRanks[c].n > 0)
      .sort((a, b) => catRanks[a].avgRank - catRanks[b].avgRank);
  }, [catRanks]);

  const strengths = sortedCats.slice(0, 3);
  const weaknesses = [...sortedCats].reverse().slice(0, 3);

  if (!selected) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-5">
        <h1 className="mb-5 text-xl font-bold text-white">Opponent Scouting</h1>
        <p className="text-[13px] text-slate-600">Loading...</p>
      </div>
    );
  }

  const finishYears = Object.keys(selected.finishes).map(Number).sort((a, b) => b - a);

  return (
    <div className="mx-auto max-w-7xl px-4 py-5">
      <h1 className="mb-4 text-xl font-bold text-white">Opponent Scouting</h1>

      {/* Team selector */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        {profiles.map((p) => (
          <button
            key={p.team}
            onClick={() => setSelectedTeam(p.team)}
            className={`rounded px-2.5 py-1 text-[12px] font-medium transition-colors ${
              selectedTeam === p.team ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {p.team}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {/* ── Profile Header ── */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-white">{selected.team}</h2>
              {selected.ownerName && (
                <p className="mt-0.5 text-[12px] text-slate-500">Owner: {selected.ownerName}</p>
              )}
            </div>
            <span className="rounded bg-white/5 px-2 py-0.5 text-[11px] text-slate-500">
              {selected.seasons} season{selected.seasons !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Avg Finish", value: avgFinish, sub: "across seasons" },
              { label: "Best Finish", value: bestFinish ? `#${bestFinish}${bestFinish === 1 ? " ★" : ""}` : "—", sub: "all-time" },
              { label: "Championships", value: titles || "0", sub: titles === 1 ? "title" : "titles" },
              { label: "Avg Win%", value: avgWinPct ? `${avgWinPct}%` : "—", sub: "head-to-head" },
            ].map((s) => (
              <div key={s.label} className="rounded border border-border bg-background p-3 text-center">
                <div className="text-[11px] text-slate-600">{s.label}</div>
                <div className={`mt-1 font-mono text-2xl font-bold ${s.label === "Best Finish" && bestFinish === 1 ? "text-amber-400" : "text-white"}`}>
                  {s.value}
                </div>
                <div className="text-[11px] text-slate-600">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Draft DNA + Recent Picks ── */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Draft DNA */}
          <div className="rounded-lg border border-border bg-surface">
            <div className="border-b border-border px-3 py-2 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Draft DNA</h3>
              <span className="text-[11px] text-slate-600">avg round of first pick at each position</span>
            </div>
            <div className="p-3">
              <div className="grid grid-cols-4 gap-2">
                {ALL_POSITIONS.map((pos) => {
                  const { avg, n } = posAvgRounds[pos];
                  const hasData = n > 0;
                  // Color: earlier = more urgent (amber/red), later = deeper (slate)
                  const roundColor = !hasData ? "text-slate-700"
                    : avg <= 3 ? "text-amber-400"
                    : avg <= 6 ? "text-sky-400"
                    : avg <= 10 ? "text-slate-300"
                    : "text-slate-500";
                  return (
                    <div key={pos} className="rounded border border-border bg-background p-2 text-center">
                      <div className="text-[10px] font-bold text-slate-500">{pos}</div>
                      <div className={`mt-1 font-mono text-lg font-bold ${roundColor}`}>
                        {hasData ? `R${avg.toFixed(1)}` : "—"}
                      </div>
                      {hasData && <div className="text-[9px] text-slate-700">{n}yr avg</div>}
                    </div>
                  );
                })}
              </div>

              {/* Tendencies callout */}
              <div className="mt-3 space-y-1 text-[12px]">
                {posAvgRounds["SP"].avg > 0 && posAvgRounds["SP"].avg <= 3 && (
                  <p className="text-amber-400/80">⚡ Drafts SP in top 3 rounds (R{posAvgRounds["SP"].avg.toFixed(1)})</p>
                )}
                {posAvgRounds["RP"].avg > 0 && posAvgRounds["RP"].avg >= 12 && (
                  <p className="text-slate-500">⏳ Waits on RP until round {posAvgRounds["RP"].avg.toFixed(1)}</p>
                )}
                {posAvgRounds["C"].avg > 0 && posAvgRounds["C"].avg <= 5 && (
                  <p className="text-sky-400/80">🎯 Prioritizes catcher early (R{posAvgRounds["C"].avg.toFixed(1)})</p>
                )}
                {posAvgRounds["SS"].avg > 0 && posAvgRounds["SS"].avg <= 4 && (
                  <p className="text-emerald-400/80">🎯 Grabs SS early (R{posAvgRounds["SS"].avg.toFixed(1)})</p>
                )}
                {posAvgRounds["OF"].avg > 0 && posAvgRounds["OF"].avg <= 2 && (
                  <p className="text-purple-400/80">⚡ Opens with OF in round {posAvgRounds["OF"].avg.toFixed(1)}</p>
                )}
              </div>
            </div>
          </div>

          {/* Recent Draft Picks */}
          <div className="rounded-lg border border-border bg-surface">
            <div className="border-b border-border px-3 py-2 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Recent Draft Picks
              </h3>
              <span className="text-[11px] text-slate-600">Rounds 1–5</span>
            </div>
            {draftYears.length === 0 ? (
              <p className="px-3 py-4 text-[12px] text-slate-600">No draft data available</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="border-b border-border text-[10px] uppercase tracking-wider text-slate-600">
                    <tr>
                      <th className="px-3 py-2 font-medium">Rd</th>
                      {draftYears.map((y) => (
                        <th key={y} className="px-3 py-2 font-medium">{y}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4, 5].map((round) => (
                      <tr key={round} className="border-b border-border/30">
                        <td className="px-3 py-1.5 font-mono text-slate-600">{round}</td>
                        {draftYears.map((year) => {
                          const pick = franchisePicks.find(
                            (p) => p.year === year && p.round === round
                          );
                          return (
                            <td key={year} className="px-3 py-1.5 text-slate-300">
                              {pick ? (
                                <span className={pick.keeper ? "text-amber-400/70" : ""}>
                                  {pick.playerName}
                                  {pick.keeper && " ®"}
                                </span>
                              ) : (
                                <span className="text-slate-700">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Category Profile ── */}
        {sortedCats.length > 0 && (
          <div className="rounded-lg border border-border bg-surface">
            <div className="border-b border-border px-3 py-2 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Category Profile
              </h3>
              <span className="text-[11px] text-slate-600">
                avg rank across {franchiseStandings.length} seasons
              </span>
            </div>

            {/* Strengths / Weaknesses summary */}
            {strengths.length > 0 && (
              <div className="grid gap-3 border-b border-border p-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sky-500">Strengths</p>
                  <div className="flex flex-wrap gap-1.5">
                    {strengths.map((c) => (
                      <span key={c} className="rounded bg-sky-500/10 px-2 py-0.5 text-[11px] font-bold text-sky-400">
                        {catLabel(c)} #{catRanks[c].avgRank.toFixed(1)}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-red-500">Weaknesses</p>
                  <div className="flex flex-wrap gap-1.5">
                    {weaknesses.map((c) => (
                      <span key={c} className="rounded bg-red-500/10 px-2 py-0.5 text-[11px] font-bold text-red-400/80">
                        {catLabel(c)} #{catRanks[c].avgRank.toFixed(1)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Full category grid */}
            <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 lg:grid-cols-7">
              {CAT_KEYS.map((c) => {
                const { avgRank, n } = catRanks[c];
                const { bar, text, label } = rankColor(avgRank, 10);
                if (n === 0) return (
                  <div key={c} className="rounded border border-border bg-background p-2 opacity-30">
                    <div className="text-[10px] font-bold text-slate-500">{catLabel(c)}</div>
                    <div className="mt-1 font-mono text-base text-slate-700">—</div>
                  </div>
                );
                return (
                  <div key={c} className="rounded border border-border bg-background p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500">{catLabel(c)}</span>
                      <span className={`text-[9px] font-bold ${text}`}>{label}</span>
                    </div>
                    <div className={`mt-1 font-mono text-lg font-bold ${text}`}>
                      #{avgRank.toFixed(1)}
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full ${bar}`}
                        style={{ width: `${((10 - avgRank) / 9) * 100}%` }}
                      />
                    </div>
                    <div className="mt-1 text-[9px] text-slate-700">{n}yr avg</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Season History ── */}
        <div className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-3 py-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Season History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="border-b border-border text-[10px] uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Year</th>
                  <th className="px-3 py-2 font-medium">Team Name</th>
                  <th className="px-3 py-2 font-medium text-center">Finish</th>
                  <th className="px-3 py-2 font-medium text-right">Win%</th>
                  <th className="px-3 py-2 font-medium text-right">HR</th>
                  <th className="px-3 py-2 font-medium text-right">SB</th>
                  <th className="px-3 py-2 font-medium text-right">K</th>
                  <th className="px-3 py-2 font-medium text-right">SV</th>
                  <th className="px-3 py-2 font-medium text-right">ERA</th>
                  <th className="px-3 py-2 font-medium text-right">WHIP</th>
                </tr>
              </thead>
              <tbody>
                {finishYears.map((year) => {
                  const finish = selected.finishes[year];
                  const standingRow = franchiseStandings.find((r) => r.year === year);
                  return (
                    <tr key={year} className="border-b border-border/30 hover:bg-white/[0.01]">
                      <td className="px-3 py-1.5 font-mono text-slate-500">{year}</td>
                      <td className="px-3 py-1.5 text-slate-400">
                        {standingRow?.team ?? <span className="text-slate-700">—</span>}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {finish ? (
                          <span className={`font-mono font-bold ${finishColor(finish)}`}>
                            {finish}{finish === 1 && " ★"}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-400">
                        {standingRow ? (standingRow.PCT * 100).toFixed(1) + "%" : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-400">{standingRow?.HR ?? "—"}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-400">{standingRow?.SB ?? "—"}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-400">{standingRow?.K ?? "—"}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-400">{standingRow?.SV ?? "—"}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-400">
                        {standingRow?.ERA != null ? standingRow.ERA.toFixed(3) : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-400">
                        {standingRow?.WHIP != null ? standingRow.WHIP.toFixed(3) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
