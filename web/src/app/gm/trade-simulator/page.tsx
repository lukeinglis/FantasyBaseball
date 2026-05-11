"use client";

import { useState, useEffect, useMemo } from "react";
import { EspnAuthRequired } from "@/components/EspnAuthRequired";
import {
  isPunt,
  CATEGORY_WEIGHTS,
  LOWER_IS_BETTER,
  BAT_CATS_BY_WEIGHT,
  PIT_CATS_BY_WEIGHT,
  categoryTierHeaderClass,
} from "@/lib/category-weights";

interface RosterPlayer {
  name: string;
  pos: string;
  slotLabel: string;
  slotId: number;
  proTeam: string;
}

interface EspnTeam {
  id: number;
  name: string;
  roster: RosterPlayer[];
}

interface LiveTeam {
  teamId: number;
  teamName: string;
  ranks: Record<string, number>;
  stats: Record<string, number>;
}

interface ZScorePlayer {
  name: string;
  pos: string;
  onTeamId: number;
  zScores: Record<string, number>;
  far: number;
}

const BAT_CATS = ["TB", "HR", "R", "RBI", "H", "SB", "BB", "AVG"];
const PIT_CATS = ["W", "K", "WHIP", "QS", "ERA", "L", "HD", "SV"];
const ALL_CATS = [...BAT_CATS, ...PIT_CATS];

function fmtStat(cat: string, val: number): string {
  if (!Number.isFinite(val)) return "-";
  if (cat === "AVG") return val.toFixed(3);
  if (cat === "ERA" || cat === "WHIP") return val.toFixed(2);
  return String(Math.round(val));
}

export default function TradeSimulatorPage() {
  const [teams, setTeams] = useState<EspnTeam[]>([]);
  const [liveTeams, setLiveTeams] = useState<LiveTeam[]>([]);
  const [zPlayers, setZPlayers] = useState<ZScorePlayer[]>([]);
  const [myTeamId, setMyTeamId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [giving, setGiving] = useState<string[]>([]);
  const [getting, setGetting] = useState<string[]>([]);
  const [searchGive, setSearchGive] = useState("");
  const [searchGet, setSearchGet] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/espn/roster").then((r) => r.json()),
      fetch("/api/espn/matchup")
        .then((r) => r.json())
        .catch(() => ({})),
      fetch("/api/espn/league-stats?scope=season")
        .then((r) => r.json())
        .catch(() => ({ teams: [] })),
      fetch("/api/analysis/z-scores")
        .then((r) => r.json())
        .catch(() => ({ players: [] })),
    ])
      .then(([rosterData, matchupData, leagueData, zData]) => {
        if (rosterData.error) {
          setError(rosterData.error);
          return;
        }
        setTeams(rosterData);
        if (matchupData.myTeamId) setMyTeamId(matchupData.myTeamId);
        if (leagueData.teams) setLiveTeams(leagueData.teams);
        setZPlayers(zData.players ?? []);
      })
      .catch(() => setError("FETCH_FAILED"))
      .finally(() => setLoading(false));
  }, []);

  const myTeam = useMemo(
    () =>
      teams.find((t) => t.id === myTeamId) ?? (teams.length > 0 ? teams[0] : null),
    [teams, myTeamId]
  );

  const allRosteredPlayers = useMemo(() => {
    const players: (RosterPlayer & { teamId: number; teamName: string })[] = [];
    for (const t of teams) {
      for (const p of t.roster) {
        players.push({ ...p, teamId: t.id, teamName: t.name });
      }
    }
    return players;
  }, [teams]);

  const zByName = useMemo(() => {
    const m = new Map<string, ZScorePlayer>();
    zPlayers.forEach((p) => m.set(p.name, p));
    return m;
  }, [zPlayers]);

  const myLiveTeam = useMemo(
    () => liveTeams.find((t) => t.teamId === (myTeamId ?? 0)),
    [liveTeams, myTeamId]
  );

  // Current ranks
  const currentRanks = useMemo(() => {
    if (!myLiveTeam) return {} as Record<string, number>;
    return myLiveTeam.ranks;
  }, [myLiveTeam]);

  // Estimate rank changes from trade
  const rankProjections = useMemo(() => {
    if (!myLiveTeam || (giving.length === 0 && getting.length === 0)) return null;

    const numTeams = liveTeams.length || 12;
    const projections: Record<
      string,
      {
        currentRank: number;
        projectedRank: number;
        change: number;
        improved: boolean;
        worsened: boolean;
      }
    > = {};

    for (const cat of ALL_CATS) {
      const currentRank = currentRanks[cat] ?? 6;

      // Sum z-score contributions
      const givingZ = giving.reduce(
        (sum, name) => sum + (zByName.get(name)?.zScores[cat] ?? 0),
        0
      );
      const gettingZ = getting.reduce(
        (sum, name) => sum + (zByName.get(name)?.zScores[cat] ?? 0),
        0
      );
      const netZ = gettingZ - givingZ;
      const lower = LOWER_IS_BETTER.has(cat);

      // Estimate rank change: each 0.5 z-score roughly = 1 rank position
      const rankDelta = lower ? netZ * 2 : -netZ * 2;
      const projRank = Math.max(1, Math.min(numTeams, Math.round(currentRank + rankDelta)));
      const change = currentRank - projRank;

      projections[cat] = {
        currentRank,
        projectedRank: projRank,
        change,
        improved: change > 0,
        worsened: change < 0,
      };
    }

    return projections;
  }, [myLiveTeam, giving, getting, currentRanks, zByName, liveTeams.length]);

  // Net category rank change summary
  const netSummary = useMemo(() => {
    if (!rankProjections) return null;
    let totalChange = 0;
    const improved: string[] = [];
    const worsened: string[] = [];
    for (const [cat, proj] of Object.entries(rankProjections)) {
      if (isPunt(cat)) continue;
      totalChange += proj.change;
      if (proj.change > 0) improved.push(`+${proj.change} ${cat}`);
      if (proj.change < 0) worsened.push(`${proj.change} ${cat}`);
    }
    return { totalChange, improved, worsened };
  }, [rankProjections]);

  // Filter players for dropdowns
  const giveOptions = useMemo(() => {
    if (!myTeam) return [];
    return myTeam.roster
      .filter((p) => !giving.includes(p.name))
      .filter(
        (p) =>
          !searchGive ||
          p.name.toLowerCase().includes(searchGive.toLowerCase())
      );
  }, [myTeam, giving, searchGive]);

  const getOptions = useMemo(() => {
    return allRosteredPlayers
      .filter((p) => p.teamId !== (myTeamId ?? 0))
      .filter((p) => !getting.includes(p.name))
      .filter(
        (p) =>
          !searchGet ||
          p.name.toLowerCase().includes(searchGet.toLowerCase())
      )
      .slice(0, 30);
  }, [allRosteredPlayers, myTeamId, getting, searchGet]);

  if (loading)
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        Loading trade simulator...
      </div>
    );
  if (error === "ESPN_CREDS_MISSING")
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <EspnAuthRequired />
      </div>
    );
  if (error || !myTeam)
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load</div>
        <div className="text-[12px] text-slate-500">{error}</div>
      </div>
    );

  const hasTrade = giving.length > 0 || getting.length > 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-gray-900">Trade Simulator</h1>
        <span className="text-[12px] text-slate-500">
          See before/after category rank projections
        </span>
      </div>

      {/* Two-column: I give / I get */}
      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        {/* I Give */}
        <div className="rounded-lg border border-red-300 bg-surface">
          <div className="border-b border-red-300 px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-red-600">
              I Give
            </span>
          </div>
          {giving.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-border">
              {giving.map((name) => {
                const z = zByName.get(name);
                return (
                  <div
                    key={name}
                    className="flex items-center gap-1.5 rounded border border-red-200 bg-red-50 px-2 py-1"
                  >
                    <span className="text-[12px] font-medium text-slate-700">
                      {name}
                    </span>
                    {z && (
                      <span className="text-[10px] text-slate-500 font-mono">
                        FAR {z.far.toFixed(1)}
                      </span>
                    )}
                    <button
                      onClick={() =>
                        setGiving(giving.filter((n) => n !== name))
                      }
                      className="text-[10px] text-slate-400 hover:text-red-600 font-bold"
                    >
                      x
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <div className="px-3 py-2">
            <input
              type="text"
              value={searchGive}
              onChange={(e) => setSearchGive(e.target.value)}
              placeholder="Search your roster..."
              className="w-full rounded border border-border bg-background px-2 py-1 text-[12px] text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="overflow-y-auto max-h-[240px]">
            {giveOptions.map((p) => (
              <button
                key={p.name}
                onClick={() => {
                  setGiving([...giving, p.name]);
                  setSearchGive("");
                }}
                className="flex w-full items-center justify-between border-b border-border px-3 py-2 text-left hover:bg-black/[0.03]"
              >
                <div>
                  <div className="text-[12px] font-medium text-slate-700">
                    {p.name}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {p.pos} · {p.proTeam}
                  </div>
                </div>
                {zByName.get(p.name) && (
                  <span className="text-[10px] font-mono text-slate-500">
                    FAR {zByName.get(p.name)!.far.toFixed(1)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* I Get */}
        <div className="rounded-lg border border-emerald-300 bg-surface">
          <div className="border-b border-emerald-300 px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">
              I Get
            </span>
          </div>
          {getting.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-border">
              {getting.map((name) => {
                const z = zByName.get(name);
                const p = allRosteredPlayers.find((pl) => pl.name === name);
                return (
                  <div
                    key={name}
                    className="flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-2 py-1"
                  >
                    <span className="text-[12px] font-medium text-slate-700">
                      {name}
                    </span>
                    {p && (
                      <span className="text-[9px] text-slate-400">
                        {p.teamName}
                      </span>
                    )}
                    {z && (
                      <span className="text-[10px] text-slate-500 font-mono">
                        FAR {z.far.toFixed(1)}
                      </span>
                    )}
                    <button
                      onClick={() =>
                        setGetting(getting.filter((n) => n !== name))
                      }
                      className="text-[10px] text-slate-400 hover:text-red-600 font-bold"
                    >
                      x
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <div className="px-3 py-2">
            <input
              type="text"
              value={searchGet}
              onChange={(e) => setSearchGet(e.target.value)}
              placeholder="Search all league rosters..."
              className="w-full rounded border border-border bg-background px-2 py-1 text-[12px] text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="overflow-y-auto max-h-[240px]">
            {getOptions.map((p) => (
              <button
                key={`${p.name}-${p.teamId}`}
                onClick={() => {
                  setGetting([...getting, p.name]);
                  setSearchGet("");
                }}
                className="flex w-full items-center justify-between border-b border-border px-3 py-2 text-left hover:bg-black/[0.03]"
              >
                <div>
                  <div className="text-[12px] font-medium text-slate-700">
                    {p.name}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {p.pos} · {p.proTeam} · {p.teamName}
                  </div>
                </div>
                {zByName.get(p.name) && (
                  <span className="text-[10px] font-mono text-slate-500">
                    FAR {zByName.get(p.name)!.far.toFixed(1)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Trade Impact */}
      {hasTrade && rankProjections && netSummary && (
        <div className="rounded-lg border border-border bg-surface">
          {/* Net summary */}
          <div className="border-b border-border px-4 py-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Category Rank Impact
            </span>
            <span
              className={`text-[16px] font-bold tabular-nums ${
                netSummary.totalChange > 0
                  ? "text-emerald-600"
                  : netSummary.totalChange < 0
                    ? "text-red-600"
                    : "text-slate-500"
              }`}
            >
              Net {netSummary.totalChange > 0 ? "+" : ""}
              {netSummary.totalChange} ranks
            </span>
          </div>

          {/* Category grid */}
          {[
            { label: "Batting", cats: BAT_CATS_BY_WEIGHT },
            { label: "Pitching", cats: PIT_CATS_BY_WEIGHT },
          ].map(({ label, cats }) => (
            <div key={label}>
              <div className="px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-400 bg-black/[0.02]">
                {label}
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-8">
                {cats.map((cat) => {
                  const proj = rankProjections[cat];
                  if (!proj) return null;
                  const puntCat = isPunt(cat);
                  return (
                    <div
                      key={cat}
                      className={`border-r border-b border-border last:border-r-0 px-2 py-3 text-center ${
                        proj.improved
                          ? "bg-emerald-50"
                          : proj.worsened
                            ? "bg-red-50"
                            : ""
                      }${puntCat ? " opacity-50" : ""}`}
                    >
                      <div
                        className={`text-[10px] ${categoryTierHeaderClass(cat)}`}
                      >
                        {cat}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        #{proj.currentRank}
                      </div>
                      <div className="text-[10px] text-slate-400">to</div>
                      <div
                        className={`text-[13px] font-bold tabular-nums ${
                          proj.improved
                            ? "text-emerald-600"
                            : proj.worsened
                              ? "text-red-600"
                              : "text-slate-600"
                        }`}
                      >
                        #{proj.projectedRank}
                      </div>
                      {proj.change !== 0 && (
                        <div
                          className={`text-[10px] font-bold ${
                            proj.improved
                              ? "text-emerald-600"
                              : "text-red-600"
                          }`}
                        >
                          {proj.change > 0 ? "+" : ""}
                          {proj.change}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Detailed changes */}
          {(netSummary.improved.length > 0 ||
            netSummary.worsened.length > 0) && (
            <div className="border-t border-border px-4 py-3 flex flex-wrap gap-4">
              {netSummary.improved.length > 0 && (
                <div>
                  <span className="text-[10px] font-semibold text-emerald-600">
                    Improves:{" "}
                  </span>
                  <span className="text-[11px] text-slate-600">
                    {netSummary.improved.join(", ")}
                  </span>
                </div>
              )}
              {netSummary.worsened.length > 0 && (
                <div>
                  <span className="text-[10px] font-semibold text-red-600">
                    Worsens:{" "}
                  </span>
                  <span className="text-[11px] text-slate-600">
                    {netSummary.worsened.join(", ")}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="px-4 py-3 border-t border-border">
            <button
              onClick={() => {
                setGiving([]);
                setGetting([]);
              }}
              className="text-[11px] text-slate-500 hover:text-slate-700"
            >
              Clear trade
            </button>
          </div>
        </div>
      )}

      {!hasTrade && (
        <div className="rounded-lg border border-border bg-surface px-6 py-12 text-center">
          <div className="text-[14px] font-medium text-slate-600">
            Select players above to simulate a trade
          </div>
          <div className="mt-1 text-[12px] text-slate-400">
            See how your category rankings would change
          </div>
        </div>
      )}
    </div>
  );
}
