"use client";

import { useState, useEffect, useMemo } from "react";
import { EspnAuthRequired } from "@/components/EspnAuthRequired";
import {
  CATEGORY_WEIGHTS,
  categoryTierClass,
  isPunt,
  LOWER_IS_BETTER,
  BAT_CATS_BY_WEIGHT,
  PIT_CATS_BY_WEIGHT,
} from "@/lib/category-weights";

interface PlayerStats {
  name: string;
  pos: string;
  proTeam: string;
  seasonStats: Record<string, number>;
  last7Stats: Record<string, number>;
  last15Stats: Record<string, number>;
  last30Stats: Record<string, number>;
}

interface ZScorePlayer {
  name: string;
  pos: string;
  proTeam: string;
  onTeamId: number;
  zScores: Record<string, number>;
  zTotal: number;
  far: number;
}

interface CategoryRanking {
  cat: string;
  tier: "STRONG" | "MIDDLE" | "WEAK";
  isPunt: boolean;
}

interface DiagnosisData {
  categoryRankings: CategoryRanking[];
}

const BAT_CATS = ["TB", "HR", "R", "RBI", "H", "SB", "BB", "AVG"];
const PIT_CATS = ["W", "K", "WHIP", "QS", "ERA", "L", "HD", "SV"];

function fmtStat(cat: string, val: number | undefined): string {
  if (val === undefined || !Number.isFinite(val)) return "-";
  if (cat === "AVG") return val.toFixed(3);
  if (cat === "ERA" || cat === "WHIP") return val.toFixed(2);
  if (cat === "IP") return val.toFixed(1);
  return String(Math.round(val));
}

function zColorClass(z: number): string {
  if (z >= 1.5) return "text-emerald-700 font-bold";
  if (z >= 0.5) return "text-emerald-600";
  if (z >= 0) return "text-slate-600";
  return "text-red-600";
}

export default function ComparePage() {
  const [allPlayers, setAllPlayers] = useState<string[]>([]);
  const [statsMap, setStatsMap] = useState<Map<string, PlayerStats>>(
    new Map()
  );
  const [zByName, setZByName] = useState<Map<string, ZScorePlayer>>(
    new Map()
  );
  const [weakCats, setWeakCats] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [playerA, setPlayerA] = useState<string>("");
  const [playerB, setPlayerB] = useState<string>("");
  const [searchA, setSearchA] = useState("");
  const [searchB, setSearchB] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/espn/player-stats")
        .then((r) => r.json())
        .catch(() => ({ players: [] })),
      fetch("/api/analysis/z-scores")
        .then((r) => r.json())
        .catch(() => ({ players: [] })),
      fetch("/api/analysis/roster-diagnosis")
        .then((r) => r.json())
        .catch(() => null),
    ])
      .then(([statsData, zData, diag]) => {
        if (statsData.error) {
          setError(statsData.error);
          return;
        }
        const players: PlayerStats[] = statsData.players ?? [];
        const sm = new Map<string, PlayerStats>();
        const names: string[] = [];
        players.forEach((p) => {
          sm.set(p.name, p);
          names.push(p.name);
        });
        setStatsMap(sm);

        const zm = new Map<string, ZScorePlayer>();
        const zp: ZScorePlayer[] = zData.players ?? [];
        zp.forEach((p) => {
          zm.set(p.name, p);
          if (!sm.has(p.name)) names.push(p.name);
        });
        setZByName(zm);
        setAllPlayers(names.sort());

        if (diag && !diag.error) {
          const weak = new Set<string>();
          for (const cr of diag.categoryRankings) {
            if (cr.tier === "WEAK" && !cr.isPunt) weak.add(cr.cat);
          }
          setWeakCats(weak);
        }
      })
      .catch(() => setError("FETCH_FAILED"))
      .finally(() => setLoading(false));
  }, []);

  const filteredA = useMemo(
    () =>
      searchA
        ? allPlayers
            .filter((n) =>
              n.toLowerCase().includes(searchA.toLowerCase())
            )
            .slice(0, 15)
        : [],
    [allPlayers, searchA]
  );

  const filteredB = useMemo(
    () =>
      searchB
        ? allPlayers
            .filter((n) =>
              n.toLowerCase().includes(searchB.toLowerCase())
            )
            .slice(0, 15)
        : [],
    [allPlayers, searchB]
  );

  const pA = statsMap.get(playerA) ?? null;
  const pB = statsMap.get(playerB) ?? null;
  const zA = zByName.get(playerA) ?? null;
  const zB = zByName.get(playerB) ?? null;

  // Determine which cats to show
  const isPitcherA = pA?.pos === "SP" || pA?.pos === "RP" || zA?.pos === "SP" || zA?.pos === "RP";
  const isPitcherB = pB?.pos === "SP" || pB?.pos === "RP" || zB?.pos === "SP" || zB?.pos === "RP";
  const showBat = !isPitcherA || !isPitcherB;
  const showPit = isPitcherA || isPitcherB;

  // Verdict
  const verdict = useMemo(() => {
    if (!playerA || !playerB || !zA || !zB) return null;

    const aHelps: { cat: string; diff: number; weight: number }[] = [];
    const bHelps: { cat: string; diff: number; weight: number }[] = [];

    for (const cat of [...BAT_CATS, ...PIT_CATS]) {
      if (isPunt(cat)) continue;
      const aZ = zA.zScores[cat] ?? 0;
      const bZ = zB.zScores[cat] ?? 0;
      if (!weakCats.has(cat)) continue;

      if (aZ > bZ + 0.1) {
        aHelps.push({ cat, diff: aZ - bZ, weight: CATEGORY_WEIGHTS[cat] ?? 0 });
      } else if (bZ > aZ + 0.1) {
        bHelps.push({ cat, diff: bZ - aZ, weight: CATEGORY_WEIGHTS[cat] ?? 0 });
      }
    }

    const aWeightedImpact = aHelps.reduce(
      (sum, c) => sum + c.diff * c.weight,
      0
    );
    const bWeightedImpact = bHelps.reduce(
      (sum, c) => sum + c.diff * c.weight,
      0
    );

    return {
      aHelps,
      bHelps,
      aWeightedImpact,
      bWeightedImpact,
      pick: aWeightedImpact > bWeightedImpact ? "A" : bWeightedImpact > aWeightedImpact ? "B" : "TIE",
    };
  }, [playerA, playerB, zA, zB, weakCats]);

  if (loading)
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        Loading player data...
      </div>
    );
  if (error === "ESPN_CREDS_MISSING")
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <EspnAuthRequired />
      </div>
    );
  if (error)
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load</div>
        <div className="text-[12px] text-slate-500">{error}</div>
      </div>
    );

  const PlayerSelector = ({
    label,
    selected,
    setSelected,
    search,
    setSearch,
    filtered,
    color,
  }: {
    label: string;
    selected: string;
    setSelected: (n: string) => void;
    search: string;
    setSearch: (s: string) => void;
    filtered: string[];
    color: string;
  }) => (
    <div className="flex-1">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
        {label}
      </label>
      {selected ? (
        <div
          className={`flex items-center gap-2 rounded border px-3 py-2 ${color}`}
        >
          <span className="text-[14px] font-medium text-slate-700 flex-1">
            {selected}
          </span>
          <span className="text-[10px] text-slate-500">
            {statsMap.get(selected)?.pos ?? zByName.get(selected)?.pos ?? ""}
          </span>
          <button
            onClick={() => setSelected("")}
            className="text-slate-400 hover:text-red-600 text-[12px] font-bold"
          >
            x
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search players..."
            className="w-full rounded border border-border bg-background px-3 py-2 text-[13px] text-slate-700 outline-none placeholder:text-slate-400"
          />
          {filtered.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-[240px] overflow-y-auto rounded border border-border bg-surface shadow-lg">
              {filtered.map((name) => (
                <button
                  key={name}
                  onClick={() => {
                    setSelected(name);
                    setSearch("");
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-black/[0.03] border-b border-border"
                >
                  <span className="text-[12px] text-slate-700">{name}</span>
                  <span className="text-[10px] text-slate-500">
                    {statsMap.get(name)?.pos ??
                      zByName.get(name)?.pos ??
                      ""}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-gray-900">
          Player Comparison
        </h1>
        <span className="text-[12px] text-slate-500">
          Compare any two players side by side
        </span>
      </div>

      {/* Player selectors */}
      <div className="mb-6 flex gap-4">
        <PlayerSelector
          label="Player A"
          selected={playerA}
          setSelected={setPlayerA}
          search={searchA}
          setSearch={setSearchA}
          filtered={filteredA}
          color="border-blue-300 bg-blue-50"
        />
        <div className="flex items-end pb-2 text-slate-400 font-bold">
          vs
        </div>
        <PlayerSelector
          label="Player B"
          selected={playerB}
          setSelected={setPlayerB}
          search={searchB}
          setSearch={setSearchB}
          filtered={filteredB}
          color="border-purple-300 bg-purple-50"
        />
      </div>

      {/* Comparison */}
      {playerA && playerB && (
        <>
          {/* Z-score comparison */}
          {zA && zB && (
            <div className="mb-6 rounded-xl border border-border bg-surface overflow-hidden">
              <div className="border-b border-border px-4 py-2.5 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  Z-Score Comparison
                </span>
                <div className="flex items-center gap-4 text-[11px] font-mono tabular-nums">
                  <span className="text-blue-600">
                    FAR {zA.far.toFixed(1)}
                  </span>
                  <span className="text-slate-400">vs</span>
                  <span className="text-purple-600">
                    FAR {zB.far.toFixed(1)}
                  </span>
                </div>
              </div>

              {(showBat
                ? [{ label: "Batting", cats: BAT_CATS_BY_WEIGHT }]
                : []
              )
                .concat(
                  showPit
                    ? [{ label: "Pitching", cats: PIT_CATS_BY_WEIGHT }]
                    : []
                )
                .map(({ label, cats }) => (
                  <div key={label}>
                    <div className="px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-400 bg-black/[0.02]">
                      {label}
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-8">
                      {cats.map((cat) => {
                        const aZ = zA.zScores[cat] ?? 0;
                        const bZ = zB.zScores[cat] ?? 0;
                        const isWeak = weakCats.has(cat);
                        const aWins = LOWER_IS_BETTER.has(cat)
                          ? aZ < bZ
                          : aZ > bZ;
                        const bWins = !aWins && aZ !== bZ;
                        return (
                          <div
                            key={cat}
                            className={`border-r border-b border-border last:border-r-0 px-2 py-2.5 text-center ${
                              isWeak ? "bg-amber-50/50" : ""
                            }${isPunt(cat) ? " opacity-50" : ""}`}
                          >
                            <div
                              className={`text-[10px] ${categoryTierClass(cat)} ${isWeak ? "text-amber-600" : ""}`}
                            >
                              {cat}
                              {isWeak ? "*" : ""}
                            </div>
                            <div
                              className={`mt-1 text-[12px] font-mono tabular-nums ${aWins ? "text-blue-600 font-bold" : "text-slate-500"}`}
                            >
                              {aZ >= 0 ? "+" : ""}
                              {aZ.toFixed(1)}
                            </div>
                            <div
                              className={`text-[12px] font-mono tabular-nums ${bWins ? "text-purple-600 font-bold" : "text-slate-500"}`}
                            >
                              {bZ >= 0 ? "+" : ""}
                              {bZ.toFixed(1)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

              {weakCats.size > 0 && (
                <div className="px-4 py-2 border-t border-border text-[10px] text-amber-600 bg-amber-50/30">
                  * Your weak categories
                </div>
              )}
            </div>
          )}

          {/* Season stats comparison */}
          {pA && pB && (
            <div className="mb-6 rounded-xl border border-border bg-surface overflow-hidden">
              <div className="border-b border-border px-4 py-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  Season Stats
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-border bg-slate-50 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="px-3 py-2 text-left">Stat</th>
                      <th className="px-3 py-2 text-right text-blue-600">
                        {playerA.split(" ").pop()}
                      </th>
                      <th className="px-3 py-2 text-right text-purple-600">
                        {playerB.split(" ").pop()}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(showBat ? BAT_CATS : PIT_CATS).map((cat) => {
                      const aVal = pA.seasonStats[cat];
                      const bVal = pB.seasonStats[cat];
                      const lower = LOWER_IS_BETTER.has(cat);
                      const aWins =
                        aVal !== undefined &&
                        bVal !== undefined &&
                        (lower ? aVal < bVal : aVal > bVal);
                      const bWins =
                        aVal !== undefined &&
                        bVal !== undefined &&
                        (lower ? bVal < aVal : bVal > aVal);
                      return (
                        <tr key={cat} className="border-b border-border">
                          <td
                            className={`px-3 py-1.5 ${categoryTierClass(cat)}`}
                          >
                            {cat}
                          </td>
                          <td
                            className={`px-3 py-1.5 text-right font-mono tabular-nums ${aWins ? "text-blue-600 font-bold" : "text-slate-600"}`}
                          >
                            {fmtStat(cat, aVal)}
                          </td>
                          <td
                            className={`px-3 py-1.5 text-right font-mono tabular-nums ${bWins ? "text-purple-600 font-bold" : "text-slate-600"}`}
                          >
                            {fmtStat(cat, bVal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Verdict */}
          {verdict && (
            <div
              className={`rounded-xl border px-4 py-4 ${
                verdict.pick === "A"
                  ? "border-blue-300 bg-blue-50/50"
                  : verdict.pick === "B"
                    ? "border-purple-300 bg-purple-50/50"
                    : "border-slate-300 bg-slate-50"
              }`}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-2">
                Verdict
              </div>
              {verdict.pick === "TIE" ? (
                <div className="text-[14px] font-medium text-slate-600">
                  Even impact on your weak categories
                </div>
              ) : (
                <div>
                  <div
                    className={`text-[14px] font-bold ${verdict.pick === "A" ? "text-blue-600" : "text-purple-600"}`}
                  >
                    Pick {verdict.pick === "A" ? playerA : playerB}
                    <span className="ml-1 text-[12px] font-normal text-slate-500">
                      (higher weighted impact on weak categories)
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    {(verdict.pick === "A"
                      ? verdict.aHelps
                      : verdict.bHelps
                    ).map((c) => (
                      <span
                        key={c.cat}
                        className="rounded bg-white border border-current px-2 py-0.5 text-emerald-600"
                      >
                        {c.cat} +{c.diff.toFixed(1)}z
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {(!playerA || !playerB) && (
        <div className="rounded-xl border border-border bg-surface px-6 py-12 text-center">
          <div className="text-[14px] font-medium text-slate-600">
            Select two players to compare
          </div>
          <div className="mt-1 text-[12px] text-slate-400">
            See side-by-side stats, z-scores, and which player helps your team more
          </div>
        </div>
      )}
    </div>
  );
}
