"use client";

import { useState, useEffect, useMemo } from "react";
import { EspnAuthRequired } from "@/components/EspnAuthRequired";
import { DataFreshness } from "@/components/DataFreshness";
import {
  CATEGORY_WEIGHTS,
  categoryTierClass,
  isPunt,
} from "@/lib/category-weights";

interface CategoryRanking {
  cat: string;
  weight: number;
  rank: number;
  tier: "STRONG" | "MIDDLE" | "WEAK";
  isPunt: boolean;
}

interface DiagnosisData {
  teamName: string;
  categoryRankings: CategoryRanking[];
  marginToFlip: {
    cat: string;
    weight: number;
    currentRank: number;
    targetRank: number;
    gap: number;
  }[];
}

interface ZScorePlayer {
  name: string;
  pos: string;
  proTeam: string;
  onTeamId: number;
  zScores: Record<string, number>;
  zTotal: number;
  far: number;
  seasonStats: Record<string, number>;
}

interface MatchupPlayer {
  name: string;
  pos: string;
  slotId: number;
}

interface MatchupData {
  myRoster: MatchupPlayer[];
}

interface PlannedMove {
  type: "add" | "drop";
  playerName: string;
  reason: string;
}

function fmtStat(cat: string, val: number): string {
  if (!Number.isFinite(val)) return "-";
  if (cat === "AVG") return val.toFixed(3);
  if (cat === "ERA" || cat === "WHIP") return val.toFixed(2);
  return String(Math.round(val));
}

export default function WaiverPlanPage() {
  const [diagnosis, setDiagnosis] = useState<DiagnosisData | null>(null);
  const [zPlayers, setZPlayers] = useState<ZScorePlayer[]>([]);
  const [matchup, setMatchup] = useState<MatchupData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [plannedMoves, setPlannedMoves] = useState<PlannedMove[]>([]);

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/analysis/roster-diagnosis").then((r) => r.json()),
      fetch("/api/analysis/z-scores")
        .then((r) => r.json())
        .catch(() => ({ players: [] })),
      fetch("/api/espn/matchup")
        .then((r) => r.json())
        .catch(() => null),
    ])
      .then(([diag, zData, mup]) => {
        if (diag.error) {
          setError(diag.error);
          return;
        }
        setDiagnosis(diag);
        setZPlayers(zData.players ?? []);
        if (mup && !mup.error) setMatchup(mup);
      })
      .catch(() => setError("FETCH_FAILED"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Weak categories
  const weakCats = useMemo(
    () =>
      diagnosis?.categoryRankings
        .filter((c) => c.tier === "WEAK" && !c.isPunt)
        .sort((a, b) => b.weight - a.weight) ?? [],
    [diagnosis]
  );

  // Free agents sorted by weighted category impact
  const waiverTargets = useMemo(() => {
    if (!weakCats.length) return [];

    const freeAgents = zPlayers.filter(
      (p) => p.onTeamId === 0 && p.far > 0
    );

    // Score each FA by how much they help weak categories
    type ScoredFA = ZScorePlayer & {
      impactScore: number;
      helpsCats: { cat: string; z: number; weight: number }[];
    };

    const scored: ScoredFA[] = freeAgents.map((fa) => {
      let impactScore = 0;
      const helpsCats: { cat: string; z: number; weight: number }[] = [];

      for (const weak of weakCats) {
        const z = fa.zScores[weak.cat] ?? 0;
        if (z > 0) {
          const weightedImpact = z * (CATEGORY_WEIGHTS[weak.cat] ?? 0) * 100;
          impactScore += weightedImpact;
          helpsCats.push({ cat: weak.cat, z, weight: weak.weight });
        }
      }

      return { ...fa, impactScore, helpsCats };
    });

    return scored
      .filter((fa) => fa.impactScore > 0)
      .sort((a, b) => b.impactScore - a.impactScore)
      .slice(0, 15);
  }, [zPlayers, weakCats]);

  // Drop candidates: bench batters or low-FAR players
  const dropCandidates = useMemo(() => {
    if (!matchup) return [];
    const BENCH_SLOT = 16;
    const benchPlayers = matchup.myRoster.filter(
      (p) => p.slotId === BENCH_SLOT
    );
    const benchNames = new Set(benchPlayers.map((p) => p.name));

    return zPlayers
      .filter(
        (p) =>
          p.onTeamId !== 0 &&
          matchup.myRoster.some((r) => r.name === p.name)
      )
      .filter((p) => p.far < 1.0 || benchNames.has(p.name))
      .sort((a, b) => a.far - b.far)
      .slice(0, 5);
  }, [matchup, zPlayers]);

  const addPlannedMove = (type: "add" | "drop", name: string, reason: string) => {
    setPlannedMoves((prev) => [
      ...prev,
      { type, playerName: name, reason },
    ]);
  };

  const removePlannedMove = (index: number) => {
    setPlannedMoves((prev) => prev.filter((_, i) => i !== index));
  };

  if (loading)
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          Loading waiver data...
        </div>
      </div>
    );
  if (
    error === "ESPN_CREDS_MISSING" ||
    error === "MY_ESPN_TEAM_ID_MISSING"
  )
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <EspnAuthRequired />
      </div>
    );
  if (error || !diagnosis)
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load</div>
        <div className="text-[12px] text-slate-500">{error}</div>
      </div>
    );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">
            Waiver Priority Planner
          </h1>
          <span className="text-[12px] text-slate-500">
            FA pickups ranked by category impact
          </span>
        </div>
        <DataFreshness onRefresh={fetchAll} loading={loading} />
      </div>

      {/* Weak categories */}
      {weakCats.length > 0 && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50/50 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-red-600 mb-2">
            Your Weak Categories (targets for improvement)
          </div>
          <div className="flex flex-wrap gap-2">
            {weakCats.map((c) => (
              <span
                key={c.cat}
                className="rounded border border-red-200 bg-white px-2.5 py-1 text-[11px]"
              >
                <span className="font-bold text-red-700">{c.cat}</span>
                <span className="ml-1 text-slate-500">#{c.rank}</span>
                <span className="ml-1 text-[9px] text-slate-400">
                  w:{c.weight.toFixed(3)}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Planned Moves */}
      <div className="mb-6 rounded-xl border border-orange-300 bg-surface overflow-hidden">
        <div className="border-b border-orange-300 px-4 py-2.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-600">
            Planned Moves
          </span>
          <span className="text-[10px] text-slate-400">
            {plannedMoves.length} move{plannedMoves.length !== 1 ? "s" : ""}
          </span>
        </div>
        {plannedMoves.length > 0 ? (
          <div className="divide-y divide-border">
            {plannedMoves.map((move, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold ${
                    move.type === "add"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {move.type === "add" ? "ADD" : "DROP"}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-medium text-slate-700">
                    {move.playerName}
                  </span>
                  <span className="ml-2 text-[11px] text-slate-500">
                    {move.reason}
                  </span>
                </div>
                <button
                  onClick={() => removePlannedMove(i)}
                  className="text-[10px] text-slate-400 hover:text-red-600"
                >
                  remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-4 text-center text-[12px] text-slate-400">
            Click + next to players below to plan moves
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Waiver Targets */}
        <div className="rounded-xl border border-emerald-300 bg-surface overflow-hidden">
          <div className="border-b border-emerald-300 px-4 py-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
                Waiver Targets
              </span>
              <span className="ml-2 text-[10px] text-slate-500">
                By weak category impact
              </span>
            </div>
            <span className="text-[10px] text-slate-400">
              {waiverTargets.length}
            </span>
          </div>
          <div className="divide-y divide-border">
            {waiverTargets.map((fa) => (
              <div key={fa.name} className="px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] font-medium text-slate-700 truncate">
                      {fa.name}
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-500">
                      {fa.pos}
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-400">
                      {fa.proTeam}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-mono font-bold text-emerald-600 tabular-nums">
                      FAR {fa.far.toFixed(1)}
                    </span>
                    <button
                      onClick={() =>
                        addPlannedMove(
                          "add",
                          fa.name,
                          `Helps ${fa.helpsCats.map((c) => c.cat).join(", ")}`
                        )
                      }
                      className="rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {fa.helpsCats.map((c) => (
                    <span
                      key={c.cat}
                      className={`text-[10px] ${categoryTierClass(c.cat)}`}
                    >
                      {c.cat}{" "}
                      <span className="text-emerald-600">
                        +{c.z.toFixed(1)}z
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {waiverTargets.length === 0 && (
              <div className="px-4 py-6 text-center text-[12px] text-slate-400">
                No targeted free agents found
              </div>
            )}
          </div>
        </div>

        {/* Drop Candidates */}
        <div className="rounded-xl border border-red-300 bg-surface overflow-hidden">
          <div className="border-b border-red-300 px-4 py-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-red-600">
                Drop Candidates
              </span>
              <span className="ml-2 text-[10px] text-slate-500">
                Low FAR or benched
              </span>
            </div>
            <span className="text-[10px] text-slate-400">
              {dropCandidates.length}
            </span>
          </div>
          <div className="divide-y divide-border">
            {dropCandidates.map((p) => (
              <div key={p.name} className="px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] font-medium text-slate-700 truncate">
                      {p.name}
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-500">
                      {p.pos}
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-400">
                      {p.proTeam}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-mono font-bold text-red-600 tabular-nums">
                      FAR {p.far.toFixed(1)}
                    </span>
                    <button
                      onClick={() =>
                        addPlannedMove(
                          "drop",
                          p.name,
                          `FAR ${p.far.toFixed(1)}`
                        )
                      }
                      className="rounded border border-red-300 bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700 hover:bg-red-100"
                    >
                      drop
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {dropCandidates.length === 0 && (
              <div className="px-4 py-6 text-center text-[12px] text-slate-400">
                No obvious drop candidates
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
