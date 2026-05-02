"use client";

import { useState, useEffect, useMemo } from "react";
import {
  findWeakCategories,
  rankByWeaknessGap,
  sanitizeNum,
  type WeakCategory,
  type RecommendedFA,
} from "@/lib/free-agent-recs";

interface PlayerStats {
  name: string;
  playerId: number;
  pos: string;
  proTeam: string;
  seasonStats: Record<string, number>;
  last7Stats: Record<string, number>;
  last15Stats: Record<string, number>;
  last30Stats: Record<string, number>;
}

interface ZScorePlayer {
  name: string;
  playerId: number;
  pos: string;
  proTeam: string;
  isPitcher: boolean;
  onTeamId: number;
  seasonStats: Record<string, number>;
  zScores: Record<string, number>;
  zTotal: number;
  far: number;
}

interface RosterPlayer {
  name: string;
}

interface EspnTeam {
  id: number;
  name: string;
  roster: RosterPlayer[];
}

interface ProbableStart {
  date: string;
  pitcherName: string;
  opponent: string;
  gameTime: string;
  isHome: boolean;
}

const POSITIONS = ["ALL", "C", "1B", "2B", "3B", "SS", "OF", "SP", "RP", "DH"];
const BAT_SORT_OPTIONS = [
  { key: "FAR", label: "FAR" },
  { key: "HR", label: "HR" },
  { key: "AVG", label: "AVG" },
  { key: "R", label: "R" },
  { key: "RBI", label: "RBI" },
  { key: "SB", label: "SB" },
  { key: "H", label: "H" },
  { key: "BB", label: "BB" },
  { key: "TB", label: "TB" },
];
const PIT_SORT_OPTIONS = [
  { key: "FAR", label: "FAR" },
  { key: "K", label: "K" },
  { key: "ERA", label: "ERA" },
  { key: "WHIP", label: "WHIP" },
  { key: "W", label: "W" },
  { key: "SV", label: "SV" },
  { key: "QS", label: "QS" },
  { key: "HD", label: "HD" },
];
const LOWER_IS_BETTER = new Set(["ERA", "WHIP", "L"]);
const BAT_CATS = ["AVG", "HR", "R", "RBI", "SB", "H", "BB", "TB"];
const PIT_CATS = ["K", "QS", "W", "SV", "HD", "ERA", "WHIP"];

function fmtStat(cat: string, val: number | undefined): string {
  if (val === undefined || val === null || !Number.isFinite(val)) return "-";
  const v = sanitizeNum(val);
  if (cat === "AVG") return v.toFixed(3);
  if (cat === "ERA" || cat === "WHIP") return v.toFixed(2);
  if (cat === "IP") return v.toFixed(1);
  return String(Math.round(v));
}

function zColorClass(z: number): string {
  if (!Number.isFinite(z)) return "text-slate-400";
  const v = sanitizeNum(z);
  if (v >= 1.5) return "text-emerald-700 font-bold";
  if (v >= 0.5) return "text-emerald-600";
  if (v >= 0) return "text-slate-600";
  return "text-red-600";
}

function EspnSetupCard() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-surface px-8 py-10 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-orange-600/60">Setup Required</div>
      <div className="mt-3 text-xl font-bold text-gray-900">Connect ESPN Credentials</div>
    </div>
  );
}

interface WeaknessInfo {
  cat: string;
  rank: number;
}

export default function FreeAgentsPage() {
  const [allPlayers, setAllPlayers] = useState<PlayerStats[]>([]);
  const [zScorePlayers, setZScorePlayers] = useState<ZScorePlayer[]>([]);
  const [zScoreMap, setZScoreMap] = useState<Map<number, ZScorePlayer>>(new Map());
  const [rosteredNames, setRosteredNames] = useState<Set<string>>(new Set());
  const [weaknesses, setWeaknesses] = useState<WeaknessInfo[]>([]);
  const [myTeamId, setMyTeamId] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("FAR");
  const [statPeriod, setStatPeriod] = useState<"season" | "last7" | "last15" | "last30">("season");
  const [weaknessFilter, setWeaknessFilter] = useState<string | null>(null);
  const [showStreaming, setShowStreaming] = useState(false);
  const [pitcherStarts, setPitcherStarts] = useState<Record<string, ProbableStart[]>>({});

  useEffect(() => {
    Promise.all([
      fetch("/api/espn/player-stats?status=ALL").then((r) => r.json()).catch(() => ({ players: [] })),
      fetch("/api/espn/roster").then((r) => r.json()).catch(() => []),
      fetch("/api/analysis/z-scores").then((r) => r.json()).catch(() => ({ players: [] })),
      fetch("/api/espn/league-stats?scope=season").then((r) => r.json()).catch(() => null),
      fetch("/api/mlb/probable-pitchers").then((r) => r.json()).catch(() => ({ byPitcher: {} })),
    ]).then(([statsData, rosterData, zData, leagueStats, pitcherData]) => {
      if (statsData.error) { setError(statsData.error); return; }
      setAllPlayers(statsData.players ?? []);

      const zPlayers: ZScorePlayer[] = zData.players ?? [];
      setZScorePlayers(zPlayers);
      const zMap = new Map<number, ZScorePlayer>();
      for (const p of zPlayers) {
        zMap.set(p.playerId, p);
      }
      setZScoreMap(zMap);

      if (Array.isArray(rosterData)) {
        const names = new Set<string>();
        for (const team of rosterData) {
          for (const p of team.roster ?? []) {
            names.add(p.name);
          }
        }
        setRosteredNames(names);
      }

      if (leagueStats?.teams && leagueStats.myTeamId) {
        setMyTeamId(leagueStats.myTeamId);
        const myTeam = leagueStats.teams.find((t: EspnTeam) => t.id === leagueStats.myTeamId);
        if (myTeam?.ranks) {
          const weak: WeaknessInfo[] = [];
          for (const [cat, rank] of Object.entries(myTeam.ranks as Record<string, number>)) {
            if (typeof rank === 'number' && Number.isFinite(rank) && rank >= 7) weak.push({ cat, rank });
          }
          weak.sort((a, b) => b.rank - a.rank);
          setWeaknesses(weak);
        }
      }

      setPitcherStarts(pitcherData?.byPitcher ?? {});
    })
    .catch(() => setError("FETCH_FAILED"))
    .finally(() => setLoading(false));
  }, []);

  const freeAgents = useMemo(() => {
    return allPlayers.filter((p) => !rosteredNames.has(p.name));
  }, [allPlayers, rosteredNames]);

  // Weakness-aware recommendations using z-scores
  const { recommended, weakCats } = useMemo(() => {
    if (myTeamId === 0 || zScorePlayers.length === 0) {
      return { recommended: [] as RecommendedFA[], weakCats: [] as WeakCategory[] };
    }

    const teamPlayers = zScorePlayers.filter((p) => p.onTeamId === myTeamId);
    if (teamPlayers.length === 0) {
      return { recommended: [] as RecommendedFA[], weakCats: [] as WeakCategory[] };
    }

    const allCats = [...BAT_CATS, ...PIT_CATS];
    const wc = findWeakCategories(teamPlayers, allCats, 3);

    const faZPlayers = zScorePlayers.filter(
      (p) => p.onTeamId === 0 || !rosteredNames.has(p.name),
    );

    const recs = rankByWeaknessGap(faZPlayers, wc, 15);
    return { recommended: recs, weakCats: wc };
  }, [zScorePlayers, myTeamId, rosteredNames]);

  // Streaming pitchers: SP free agents with upcoming starts
  const streamingPitchers = useMemo(() => {
    if (!showStreaming) return [];

    const spFAs = freeAgents.filter((p) => p.pos === "SP");

    return spFAs
      .map((p) => {
        const starts = pitcherStarts[p.name] ?? [];
        const zp = zScoreMap.get(p.playerId);
        return {
          ...p,
          starts,
          startCount: starts.length,
          far: sanitizeNum(zp?.far ?? 0),
          zTotal: sanitizeNum(zp?.zTotal ?? 0),
        };
      })
      .filter((p) => p.startCount > 0)
      .sort((a, b) => b.startCount - a.startCount || b.far - a.far)
      .slice(0, 20);
  }, [showStreaming, freeAgents, pitcherStarts, zScoreMap]);

  function getStats(p: PlayerStats): Record<string, number> {
    if (statPeriod === "last7") return p.last7Stats;
    if (statPeriod === "last15") return p.last15Stats;
    if (statPeriod === "last30") return p.last30Stats;
    return p.seasonStats;
  }

  const isPitcherFilter = posFilter === "SP" || posFilter === "RP";

  const filtered = useMemo(() => {
    let list = freeAgents;

    if (posFilter !== "ALL") {
      list = list.filter((p) => p.pos === posFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.proTeam.toLowerCase().includes(q));
    }

    if (weaknessFilter) {
      list = list.filter((p) => {
        const zp = zScoreMap.get(p.playerId);
        if (!zp) return false;
        return sanitizeNum(zp.zScores[weaknessFilter] ?? 0) > 0;
      });
    }

    const effectiveSort = weaknessFilter ?? sortBy;
    list = [...list].sort((a, b) => {
      if (effectiveSort === "FAR" || (!weaknessFilter && sortBy === "FAR")) {
        const aZ = zScoreMap.get(a.playerId);
        const bZ = zScoreMap.get(b.playerId);
        return sanitizeNum(bZ?.far ?? -999) - sanitizeNum(aZ?.far ?? -999);
      }

      if (weaknessFilter) {
        const aZ = zScoreMap.get(a.playerId);
        const bZ = zScoreMap.get(b.playerId);
        return sanitizeNum(bZ?.zScores[weaknessFilter] ?? -999) - sanitizeNum(aZ?.zScores[weaknessFilter] ?? -999);
      }

      const aStats = getStats(a);
      const bStats = getStats(b);
      const aVal = sanitizeNum(aStats[sortBy] ?? (LOWER_IS_BETTER.has(sortBy) ? 999 : -999));
      const bVal = sanitizeNum(bStats[sortBy] ?? (LOWER_IS_BETTER.has(sortBy) ? 999 : -999));
      return LOWER_IS_BETTER.has(sortBy) ? aVal - bVal : bVal - aVal;
    });

    return list.slice(0, 50);
  }, [freeAgents, posFilter, search, sortBy, statPeriod, zScoreMap, weaknessFilter]);

  const sortOptions = isPitcherFilter ? PIT_SORT_OPTIONS : BAT_SORT_OPTIONS;

  useEffect(() => {
    if (posFilter === "SP" || posFilter === "RP") {
      if (!PIT_SORT_OPTIONS.find((o) => o.key === sortBy)) setSortBy("FAR");
    } else {
      if (!BAT_SORT_OPTIONS.find((o) => o.key === sortBy)) setSortBy("FAR");
    }
  }, [posFilter, sortBy]);

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading free agents...</div>;
  if (error === "ESPN_CREDS_MISSING") {
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnSetupCard /></div>;
  }
  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load free agents</div>
        <div className="text-[12px] text-slate-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Free Agents</h1>
          <span className="text-[12px] text-slate-500">{freeAgents.length} available players &middot; sorted by Fantasy Above Replacement</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Streaming SP toggle */}
          <button
            onClick={() => setShowStreaming(!showStreaming)}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors border ${
              showStreaming
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-surface text-slate-600 border-border hover:bg-black/5"
            }`}
          >
            Streaming SP
          </button>
          {/* Stat period toggle */}
          <div className="flex gap-0.5 rounded bg-surface border border-border p-0.5">
            {([
              { key: "season", label: "Season" },
              { key: "last30", label: "30D" },
              { key: "last15", label: "15D" },
              { key: "last7", label: "7D" },
            ] as const).map((v) => (
              <button key={v.key} onClick={() => setStatPeriod(v.key)}
                className={`rounded px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  statPeriod === v.key ? "bg-black/10 text-gray-900" : "text-slate-500 hover:text-slate-700"
                }`}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recommended pickups section */}
      {recommended.length > 0 && !showStreaming && (
        <div className="mb-5">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-[13px] font-bold text-gray-900">Recommended Pickups</h2>
            <span className="text-[10px] text-slate-500">
              Based on team weaknesses: {weakCats.map((w) => w.cat).join(", ")}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {recommended.slice(0, 9).map((rec, i) => (
              <div
                key={rec.playerId || i}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 hover:bg-black/[0.03]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400">#{i + 1}</span>
                    <span className="truncate text-[12px] font-semibold text-slate-700">{rec.name}</span>
                    <span className="text-[10px] text-slate-400">{rec.pos}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-[10px] text-slate-500">{rec.proTeam}</span>
                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 border border-amber-200">
                      Helps {rec.helpsCat}
                    </span>
                    <span className={`text-[10px] font-mono ${zColorClass(rec.helpsZ)}`}>
                      z{rec.helpsZ >= 0 ? "+" : ""}{rec.helpsZ.toFixed(1)}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-[12px] font-bold font-mono tabular-nums ${zColorClass(rec.far)}`}>
                    {rec.far.toFixed(1)}
                  </div>
                  <div className="text-[9px] text-slate-400">FAR</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Streaming pitchers section */}
      {showStreaming && (
        <div className="mb-5">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-[13px] font-bold text-gray-900">Streaming Pitchers</h2>
            <span className="text-[10px] text-slate-500">SP free agents with upcoming starts (next 7 days)</span>
          </div>
          {streamingPitchers.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-[12px] text-slate-500">
              No streaming pitcher data available for the upcoming week.
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-left text-[12px]">
                <thead className="border-b border-border bg-surface text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5">Pitcher</th>
                    <th className="px-2 py-2.5">Team</th>
                    <th className="px-2 py-2.5 text-center">Starts</th>
                    <th className="px-2 py-2.5 text-right">FAR</th>
                    <th className="px-3 py-2.5">Upcoming Matchups</th>
                  </tr>
                </thead>
                <tbody>
                  {streamingPitchers.map((p, i) => (
                    <tr key={p.playerId || i} className={`border-b border-border ${i % 2 === 0 ? "" : "bg-surface/50"} hover:bg-black/[0.03]`}>
                      <td className="px-3 py-2">
                        <span className="font-medium text-slate-700">{p.name}</span>
                        {p.startCount >= 2 && (
                          <span className="ml-1.5 rounded bg-blue-50 px-1 py-0.5 text-[9px] font-bold text-blue-700 border border-blue-200">
                            2+ GS
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-slate-500">{p.proTeam}</td>
                      <td className="px-2 py-2 text-center font-bold text-slate-700">{p.startCount}</td>
                      <td className={`px-2 py-2 text-right font-mono tabular-nums ${zColorClass(p.far)}`}>
                        {p.far.toFixed(1)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1.5">
                          {p.starts.map((s, si) => (
                            <span key={si} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                              {s.opponent} {s.date.slice(5)}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Weakness quick-filters */}
      {weaknesses.length > 0 && (
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Weak categories:</span>
          {weaknesses.map(w => (
            <button key={w.cat}
              onClick={() => setWeaknessFilter(weaknessFilter === w.cat ? null : w.cat)}
              className={`text-[10px] font-bold px-2 py-1 rounded border transition-colors ${
                weaknessFilter === w.cat
                  ? "bg-red-600 text-white border-red-600"
                  : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
              }`}>
              {w.cat} (#{w.rank})
            </button>
          ))}
          {weaknessFilter && (
            <button onClick={() => setWeaknessFilter(null)} className="text-[10px] text-slate-500 hover:text-slate-700 font-semibold">
              Clear
            </button>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        {/* Search */}
        <input type="text" placeholder="Search players..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="rounded border border-border bg-surface px-3 py-1.5 text-[12px] text-slate-700 outline-none placeholder:text-slate-400 w-48" />

        {/* Position filter */}
        <div className="flex gap-0.5 rounded bg-surface border border-border p-0.5">
          {POSITIONS.map((pos) => (
            <button key={pos} onClick={() => setPosFilter(pos)}
              className={`rounded px-2 py-1 text-[10px] font-bold transition-colors ${
                posFilter === pos ? "bg-black/10 text-gray-900" : "text-slate-500 hover:text-slate-700"
              }`}>
              {pos}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500">Sort:</span>
          <div className="flex gap-0.5 rounded bg-surface border border-border p-0.5">
            {sortOptions.map((opt) => (
              <button key={opt.key} onClick={() => setSortBy(opt.key)}
                className={`rounded px-2 py-1 text-[10px] font-bold transition-colors ${
                  sortBy === opt.key ? "bg-black/10 text-gray-900" : "text-slate-500 hover:text-slate-700"
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Player table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-left text-[12px]">
          <thead className="border-b border-border bg-surface text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2.5">Player</th>
              <th className="px-2 py-2.5">Pos</th>
              <th className="px-2 py-2.5">Team</th>
              <th className="px-2 py-2.5 text-right">Z</th>
              <th className="px-2 py-2.5 text-right">FAR</th>
              {isPitcherFilter ? (
                <>
                  <th className="px-2 py-2.5 text-right">ERA</th>
                  <th className="px-2 py-2.5 text-right">WHIP</th>
                  <th className="px-2 py-2.5 text-right">K</th>
                  <th className="px-2 py-2.5 text-right">W</th>
                  <th className="px-2 py-2.5 text-right">QS</th>
                  <th className="px-2 py-2.5 text-right">SV</th>
                  <th className="px-2 py-2.5 text-right">HD</th>
                  <th className="px-2 py-2.5 text-right">IP</th>
                </>
              ) : (
                <>
                  <th className="px-2 py-2.5 text-right">AVG</th>
                  <th className="px-2 py-2.5 text-right">HR</th>
                  <th className="px-2 py-2.5 text-right">R</th>
                  <th className="px-2 py-2.5 text-right">RBI</th>
                  <th className="px-2 py-2.5 text-right">SB</th>
                  <th className="px-2 py-2.5 text-right">H</th>
                  <th className="px-2 py-2.5 text-right">BB</th>
                  <th className="px-2 py-2.5 text-right">TB</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => {
              const stats = getStats(p);
              const zPlayer = zScoreMap.get(p.playerId);
              const zTotal = sanitizeNum(zPlayer?.zTotal ?? 0);
              const far = sanitizeNum(zPlayer?.far ?? 0);
              return (
                <tr key={p.playerId || i} className={`border-b border-border ${i % 2 === 0 ? "" : "bg-surface/50"} hover:bg-black/[0.03]`}>
                  <td className="px-3 py-2 font-medium text-slate-700">{p.name}</td>
                  <td className="px-2 py-2 text-slate-500">{p.pos}</td>
                  <td className="px-2 py-2 text-slate-500">{p.proTeam}</td>
                  <td className={`px-2 py-2 text-right font-mono tabular-nums ${zColorClass(zTotal)}`}>
                    {zPlayer ? zTotal.toFixed(2) : "-"}
                  </td>
                  <td className={`px-2 py-2 text-right font-mono tabular-nums ${zColorClass(zTotal)}`}>
                    {zPlayer ? far.toFixed(1) : "-"}
                  </td>
                  {isPitcherFilter ? (
                    <>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-600">{fmtStat("ERA", stats.ERA)}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-600">{fmtStat("WHIP", stats.WHIP)}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-600">{fmtStat("K", stats.K)}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-600">{fmtStat("W", stats.W)}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-600">{fmtStat("QS", stats.QS)}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-600">{fmtStat("SV", stats.SV)}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-600">{fmtStat("HD", stats.HD)}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-500">{fmtStat("IP", stats.IP)}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-600">{fmtStat("AVG", stats.AVG)}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-600">{fmtStat("HR", stats.HR)}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-600">{fmtStat("R", stats.R)}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-600">{fmtStat("RBI", stats.RBI)}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-600">{fmtStat("SB", stats.SB)}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-600">{fmtStat("H", stats.H)}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-600">{fmtStat("BB", stats.BB)}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-600">{fmtStat("TB", stats.TB)}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="mt-4 text-center text-[12px] text-slate-500">
          {allPlayers.length === 0 ? "Player stats will appear once games have been played." : "No players match your filters."}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="mt-2 text-[10px] text-slate-400">Showing top {filtered.length} of {freeAgents.length} free agents</div>
      )}
    </div>
  );
}
