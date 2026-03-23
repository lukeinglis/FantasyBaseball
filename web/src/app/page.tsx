"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { Player } from "@/lib/data";

// ── Draft order ───────────────────────────────────────────────────────────────

const DRAFT_ORDER = ["Zach", "Ricky", "Luke", "Roger", "Ethan", "Fitzy", "Dan", "Tim", "JB", "Joel"];
const TEAM_COUNT = 10;
const TOTAL_ROUNDS = 24;
const MY_NAME = "Luke";

function getDrafter(pickIndex: number) {
  const round = Math.floor(pickIndex / TEAM_COUNT) + 1;
  const pickInRound = pickIndex % TEAM_COUNT;
  const idx = (round - 1) % 2 === 0 ? pickInRound : TEAM_COUNT - 1 - pickInRound;
  return { name: DRAFT_ORDER[idx], round, pick: pickInRound + 1 };
}

// Full snake draft sequence — all picks across all rounds
const FULL_SEQUENCE = Array.from({ length: TOTAL_ROUNDS * TEAM_COUNT }, (_, i) => {
  const round = Math.floor(i / TEAM_COUNT);
  const pickInRound = i % TEAM_COUNT;
  const idx = round % 2 === 0 ? pickInRound : TEAM_COUNT - 1 - pickInRound;
  return { overall: i, round: round + 1, pick: pickInRound + 1, drafter: DRAFT_ORDER[idx] };
});

// ── Constants ─────────────────────────────────────────────────────────────────

const BAT_STATS = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG"] as const;
const PIT_STATS = ["K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"] as const;
const SCARCITY_POSITIONS = ["C", "1B", "2B", "3B", "SS", "OF", "SP", "RP"] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface DraftSession {
  drafted: string[];
  myPicks: string[];
  myRoster: Record<string, string>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function zColor(z: number): string {
  if (z >= 1.0) return "text-sky-300 font-semibold";
  if (z >= 0.5) return "text-sky-400/90";
  if (z >= 0.0) return "text-slate-300";
  if (z >= -0.3) return "text-slate-500";
  return "text-red-400/70";
}

const BAT_COLS = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG"] as const;
const PIT_COLS = ["K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"] as const;
type StatCol = (typeof BAT_COLS)[number] | (typeof PIT_COLS)[number];

function fmtStat(p: Player, col: StatCol): string {
  const v = (p as unknown as Record<string, number | undefined>)[col];
  if (v === undefined) return "—";
  if (col === "AVG" || col === "ERA" || col === "WHIP") return v.toFixed(3);
  return String(Math.round(v));
}

function urgencyTag(pct: number): { label: string; color: string; bar: string } {
  if (pct >= 75) return { label: "CRITICAL", color: "text-red-400", bar: "bg-red-500" };
  if (pct >= 50) return { label: "THIN", color: "text-orange-400", bar: "bg-orange-500" };
  if (pct >= 25) return { label: "WATCH", color: "text-amber-400", bar: "bg-amber-500" };
  return { label: "DEEP", color: "text-slate-500", bar: "bg-sky-600" };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DraftBoardPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [session, setSession] = useState<DraftSession>({ drafted: [], myPicks: [], myRoster: {} });
  const [typeFilter, setTypeFilter] = useState<"All" | "BAT" | "PIT">("All");
  const [posFilter, setPosFilter] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [showAvail, setShowAvail] = useState(true);
  // Who is actively picking — null means auto-follow draft order
  const [selectedDrafter, setSelectedDrafter] = useState<string | null>(null);
  // Live ESPN ADP — name → ADP value
  const [espnAdp, setEspnAdp] = useState<Record<string, number>>({});
  // Sorting
  const [sortCol, setSortCol] = useState<string>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const currentPickRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/rankings").then((r) => r.json()).then(setPlayers);
    fetch("/api/draft").then((r) => r.json()).then(setSession);
    fetch("/api/espn-adp").then((r) => r.json()).then((data) => {
      if (!data.error) setEspnAdp(data);
    });
  }, []);

  const draftedSet = useMemo(() => new Set(session.drafted), [session.drafted]);

  const playerMap = useMemo(() => {
    const m = new Map<string, Player>();
    players.forEach((p) => m.set(p.name, p));
    return m;
  }, [players]);

  // Deduplicate players by name
  const dedupedPlayers = useMemo(() => {
    const seen = new Set<string>();
    return players.filter((p) => {
      if (seen.has(p.name)) return false;
      seen.add(p.name);
      return true;
    });
  }, [players]);

  // Position rank among available players
  const posRanks = useMemo(() => {
    const map = new Map<string, number>();
    const byPos: Record<string, Player[]> = {};
    for (const p of dedupedPlayers) {
      if (draftedSet.has(p.name)) continue;
      if (!byPos[p.pos]) byPos[p.pos] = [];
      byPos[p.pos].push(p);
    }
    for (const group of Object.values(byPos)) {
      group.forEach((p, i) => map.set(p.name, i + 1));
    }
    return map;
  }, [dedupedPlayers, draftedSet]);

  const positions = useMemo(
    () => [...new Set(dedupedPlayers.map((p) => p.pos).filter(Boolean))].sort(),
    [dedupedPlayers]
  );

  const filtered = useMemo(() => {
    let list = dedupedPlayers;
    if (typeFilter === "BAT") list = list.filter((p) => p.type === "BAT");
    if (typeFilter === "PIT") list = list.filter((p) => p.type === "PIT");
    if (posFilter.length > 0) list = list.filter((p) => posFilter.includes(p.pos));
    if (search) list = list.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    if (showAvail) list = list.filter((p) => !draftedSet.has(p.name));

    const dir = sortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      switch (sortCol) {
        case "rank":    return dir * (a.rank - b.rank);
        case "name":    return dir * a.name.localeCompare(b.name);
        case "team":    return dir * a.team.localeCompare(b.team);
        case "pos":     return dir * a.pos.localeCompare(b.pos);
        case "espn":    return dir * ((a.espnRank ?? 9999) - (b.espnRank ?? 9999));
        case "adp":     return dir * ((espnAdp[a.name] ?? 9999) - (espnAdp[b.name] ?? 9999));
        case "zscore":  return dir * (b.zTotal - a.zTotal) * -1;
        default: {
          const av = ((a as unknown as Record<string, number | undefined>)[sortCol] ?? (sortDir === "asc" ? Infinity : -Infinity)) as number;
          const bv = ((b as unknown as Record<string, number | undefined>)[sortCol] ?? (sortDir === "asc" ? Infinity : -Infinity)) as number;
          return dir * (av - bv);
        }
      }
    });
    return list;
  }, [dedupedPlayers, typeFilter, posFilter, search, showAvail, draftedSet, sortCol, sortDir, espnAdp]);

  const drafter = useMemo(() => getDrafter(session.drafted.length), [session.drafted.length]);

  // Scroll current pick into view whenever it advances
  useEffect(() => {
    currentPickRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [session.drafted.length]);

  // Effective drafter: manual selection overrides auto
  const activeDrafter = selectedDrafter ?? drafter.name;
  const isMine = activeDrafter === MY_NAME;

  // My picks with player data
  const myPickPlayers = useMemo(
    () => session.myPicks.map((n) => playerMap.get(n)).filter(Boolean) as Player[],
    [session.myPicks, playerMap]
  );

  // Team stat totals
  const batTotals = useMemo(() => {
    const batters = myPickPlayers.filter((p) => p.type === "BAT");
    return Object.fromEntries(BAT_STATS.map((stat) => {
      if (stat === "AVG") {
        const vals = batters.map((p) => p.AVG).filter((v): v is number => v !== undefined);
        return [stat, vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0];
      }
      return [stat, batters.reduce((sum, p) => sum + ((p as unknown as Record<string, number>)[stat] ?? 0), 0)];
    }));
  }, [myPickPlayers]);

  const pitTotals = useMemo(() => {
    const pitchers = myPickPlayers.filter((p) => p.type === "PIT");
    return Object.fromEntries(PIT_STATS.map((stat) => {
      if (stat === "ERA" || stat === "WHIP") {
        const vals = pitchers.map((p) => (p as unknown as Record<string, number>)[stat]).filter((v): v is number => v !== undefined);
        return [stat, vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0];
      }
      return [stat, pitchers.reduce((sum, p) => sum + ((p as unknown as Record<string, number>)[stat] ?? 0), 0)];
    }));
  }, [myPickPlayers]);

  // Scarcity data
  const scarcityData = useMemo(() => {
    return SCARCITY_POSITIONS.map((pos) => {
      const all = dedupedPlayers.filter((p) => p.pos === pos);
      const available = all.filter((p) => !draftedSet.has(p.name));
      const totalElite = all.filter((p) => p.zTotal >= 0.5).length;
      const availElite = available.filter((p) => p.zTotal >= 0.5).length;
      const draftedElite = totalElite - availElite;
      const scarcityPct = totalElite > 0 ? Math.round((draftedElite / totalElite) * 100) : 0;
      return { pos, availElite, availSolid: available.filter((p) => p.zTotal >= 0.0).length, scarcityPct };
    });
  }, [dedupedPlayers, draftedSet]);

  // Stat columns
  const statCols = useMemo((): StatCol[] => {
    if (typeFilter === "BAT") return [...BAT_COLS];
    if (typeFilter === "PIT") return [...PIT_COLS];
    return [...BAT_COLS, ...PIT_COLS];
  }, [typeFilter]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const draftPlayer = useCallback(async (name: string, mine: boolean) => {
    const res = await fetch("/api/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "draft", player: name, isMine: mine }),
    });
    setSession(await res.json());
    // Auto-advance: clear manual selection so next pick follows draft order
    setSelectedDrafter(null);
  }, []);

  const undoLast = useCallback(async () => {
    const res = await fetch("/api/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "undo" }),
    });
    setSession(await res.json());
    setSelectedDrafter(null);
  }, []);

  const resetDraft = useCallback(async () => {
    if (!confirm("Reset entire draft?")) return;
    const res = await fetch("/api/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    setSession(await res.json());
    setSelectedDrafter(null);
  }, []);

  const togglePos = (pos: string) =>
    setPosFilter((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      // Numeric stats default descending (higher = better), text defaults ascending
      const textCols = ["name", "team", "pos", "rank"];
      setSortDir(textCols.includes(col) ? "asc" : "desc");
    }
  };

  const SortTh = ({ col, label, className }: { col: string; label: string; className?: string }) => (
    <th className={`cursor-pointer select-none px-2 py-2.5 font-medium hover:text-slate-300 ${className ?? ""}`}
      onClick={() => handleSort(col)}>
      <span className="flex items-center gap-0.5">
        {label}
        {sortCol === col && (
          <span className="text-amber-400">{sortDir === "asc" ? "↑" : "↓"}</span>
        )}
      </span>
    </th>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5">

      {/* ── Top info strip ───────────────────────────────────────────────── */}
      <div className="mb-5 grid gap-4 lg:grid-cols-[220px_1fr_340px]">

        {/* My Team picks */}
        <div className="rounded-lg border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">My Team</h2>
            <span className="text-[11px] tabular-nums text-amber-400/70">{myPickPlayers.length} picks</span>
          </div>
          {myPickPlayers.length === 0 ? (
            <div className="px-3 py-3 text-[12px] text-slate-700">No picks yet</div>
          ) : (
            <div className="divide-y divide-border/30 overflow-y-auto" style={{ maxHeight: "220px" }}>
              {myPickPlayers.map((p, i) => (
                <div key={p.name} className="flex items-center gap-2 px-3 py-1">
                  <span className="w-4 font-mono text-[10px] text-slate-700">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-medium text-slate-200">{p.name}</div>
                    <div className="text-[10px] text-slate-600">{p.pos}</div>
                  </div>
                  <span className={`font-mono text-[11px] ${zColor(p.zTotal)}`}>{p.zTotal.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Team stat projections */}
        <div className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-3 py-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Team Projections</h2>
          </div>
          <div className="px-3 py-2 space-y-2">
            <div className="grid grid-cols-8 gap-1">
              {BAT_STATS.map((stat) => (
                <div key={stat} className="text-center">
                  <div className="text-[10px] text-slate-600">{stat}</div>
                  <div className="font-mono text-[13px] font-bold text-slate-200">
                    {myPickPlayers.length === 0 ? "—" : stat === "AVG"
                      ? (batTotals[stat] as number).toFixed(3)
                      : Math.round(batTotals[stat] as number)}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border/40 pt-2 grid grid-cols-8 gap-1">
              {PIT_STATS.map((stat) => (
                <div key={stat} className="text-center">
                  <div className="text-[10px] text-slate-600">{stat}</div>
                  <div className="font-mono text-[13px] font-bold text-slate-200">
                    {myPickPlayers.length === 0 ? "—" : (stat === "ERA" || stat === "WHIP")
                      ? (pitTotals[stat] as number).toFixed(3)
                      : Math.round(pitTotals[stat] as number)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scarcity */}
        <div className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-3 py-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Scarcity</h2>
          </div>
          <div className="grid grid-cols-4 gap-px p-2">
            {scarcityData.map((d) => {
              const tag = urgencyTag(d.scarcityPct);
              return (
                <div key={d.pos} className="rounded bg-white/[0.02] px-2 py-1.5 text-center">
                  <div className="text-[12px] font-bold text-white">{d.pos}</div>
                  <div className={`text-[10px] font-bold ${tag.color}`}>{tag.label}</div>
                  <div className="mt-1 text-[11px] font-mono text-sky-400">{d.availElite}</div>
                  <div className="text-[9px] text-slate-600">elite left</div>
                  <div className="mt-1.5 h-0.5 overflow-hidden rounded-full bg-slate-800">
                    <div className={`h-full rounded-full ${tag.bar}`} style={{ width: `${d.scarcityPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Main + Sidebar ───────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_260px]">

        {/* ── Main column ────────────────────────────────────────────────── */}
        <div className="min-w-0">

          {/* Toolbar */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 rounded bg-surface px-3 py-1.5 text-[13px] tabular-nums">
              <span className="text-slate-500">Drafted</span>
              <span className="font-semibold text-white">{session.drafted.length}</span>
              <span className="text-slate-700">|</span>
              <span className="text-slate-500">Mine</span>
              <span className="font-semibold text-amber-400">{session.myPicks.length}</span>
              <span className="text-slate-700">|</span>
              <span className="text-slate-500">Drafting for:</span>
              <span className={`font-bold ${isMine ? "text-amber-400" : "text-white"}`}>
                {activeDrafter}
              </span>
              <span className="text-slate-600">Rd {drafter.round} Pk {drafter.pick}</span>
            </div>
            <div className="flex gap-1.5 text-[12px]">
              <button onClick={undoLast}
                className="rounded px-2.5 py-1 text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200">
                Undo
              </button>
              <button onClick={resetDraft}
                className="rounded px-2.5 py-1 text-red-400/60 transition-colors hover:bg-red-500/10 hover:text-red-400">
                Reset
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="flex gap-0.5 rounded bg-surface p-0.5">
              {(["All", "BAT", "PIT"] as const).map((t) => (
                <button key={t} onClick={() => setTypeFilter(t)}
                  className={`rounded px-3 py-1 text-[12px] font-medium transition-colors ${
                    typeFilter === t ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
                  }`}>
                  {t === "BAT" ? "Bat" : t === "PIT" ? "Pitch" : "All"}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {positions.map((pos) => (
                <button key={pos} onClick={() => togglePos(pos)}
                  className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    posFilter.includes(pos)
                      ? "bg-amber-500/20 text-amber-300"
                      : "text-slate-600 hover:text-slate-400"
                  }`}>
                  {pos}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-[12px] text-slate-500">
              <input
                type="checkbox"
                checked={showAvail}
                onChange={(e) => setShowAvail(e.target.checked)}
                className="accent-amber-500"
              />
              Available
            </label>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="rounded border border-border bg-surface px-2.5 py-1 text-[12px] text-white placeholder:text-slate-600 focus:border-slate-500 focus:outline-none" />
          </div>

          {/* Rankings table */}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-border bg-surface text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <SortTh col="rank" label="#" className="w-10 px-3" />
                  <th className="w-12 px-2 py-2.5 font-medium">POS#</th>
                  {dedupedPlayers[0]?.espnRank !== undefined && (
                    <SortTh col="espn" label="ESPN" className="w-14" />
                  )}
                  {Object.keys(espnAdp).length > 0 && (
                    <SortTh col="adp" label="ADP" className="w-14" />
                  )}
                  <SortTh col="name" label="Player" className="min-w-[160px] px-3" />
                  <SortTh col="team" label="Team" className="w-14" />
                  <SortTh col="pos" label="Pos" className="w-12" />
                  <SortTh col="zTotal" label="zScore" className="w-16 text-right" />
                  {statCols.map((c) => (
                    <SortTh key={c} col={c} label={c} className="w-14 text-right" />
                  ))}
                  <th className="px-2 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((p, idx) => {
                  const drafted = draftedSet.has(p.name);
                  const pr = posRanks.get(p.name);
                  return (
                    <tr key={p.name}
                      className={`border-b border-border/50 transition-colors ${
                        drafted ? "opacity-30" : "hover:bg-white/[0.02]"
                      } ${idx % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                      <td className="px-3 py-1.5 font-mono text-slate-600">{p.rank}</td>
                      <td className="px-2 py-1.5 font-mono text-[11px] text-slate-600">
                        {pr ? `${p.pos}${pr}` : "—"}
                      </td>
                      {dedupedPlayers[0]?.espnRank !== undefined && (
                        <td className="px-2 py-1.5 font-mono text-slate-600">{p.espnRank ?? "—"}</td>
                      )}
                      {Object.keys(espnAdp).length > 0 && (
                        <td className="px-2 py-1.5 font-mono text-slate-500">
                          {espnAdp[p.name] ?? "—"}
                        </td>
                      )}
                      <td className="px-3 py-1.5 font-medium text-slate-100">{p.name}</td>
                      <td className="px-2 py-1.5 text-slate-500">{p.team}</td>
                      <td className="px-2 py-1.5 text-slate-500">{p.pos}</td>
                      <td className={`px-2 py-1.5 text-right font-mono ${zColor(p.zTotal)}`}>
                        {p.zTotal.toFixed(2)}
                      </td>
                      {statCols.map((c) => (
                        <td key={c} className="px-2 py-1.5 text-right font-mono text-slate-400">
                          {fmtStat(p, c)}
                        </td>
                      ))}
                      <td className="px-2 py-1.5">
                        {!drafted && (
                          <button onClick={() => draftPlayer(p.name, isMine)}
                            className={`rounded px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                              isMine
                                ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                                : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                            }`}>
                            Draft
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-[11px] tabular-nums text-slate-600">
            {filtered.length} players · {dedupedPlayers.filter((p) => !draftedSet.has(p.name)).length} available
          </div>
        </div>

        {/* ── Sidebar ────────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Draft ticker — full scrollable pick list */}
          <div className="rounded-lg border border-border bg-surface">
            <div className="border-b border-border px-3 py-2">
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Draft Order</h2>
                <div className="flex items-center gap-2">
                  {selectedDrafter && (
                    <button onClick={() => setSelectedDrafter(null)}
                      className="text-[10px] text-slate-600 hover:text-slate-400">
                      clear
                    </button>
                  )}
                  {session.drafted.length > 0 && (
                    <button onClick={undoLast}
                      className="rounded bg-white/5 px-2 py-0.5 text-[11px] text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200">
                      ← Undo pick
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-y-auto" style={{ height: "520px" }}>
              {FULL_SEQUENCE.map((pick) => {
                const isPast = pick.overall < session.drafted.length;
                const isCurrent = pick.overall === session.drafted.length;
                const isFuture = pick.overall > session.drafted.length;
                const draftedPlayer = session.drafted[pick.overall];
                const isMe = pick.drafter === MY_NAME;
                const isSelected = pick.drafter === activeDrafter;
                const isManual = selectedDrafter !== null;

                if (isPast) {
                  return (
                    <div key={pick.overall}
                      className="flex items-center gap-2 border-b border-border/20 px-3 py-1.5 opacity-40">
                      <span className="w-8 font-mono text-[10px] text-slate-600">
                        {pick.round}.{pick.pick}
                      </span>
                      <span className={`w-14 text-[11px] ${isMe ? "text-amber-400/70" : "text-slate-500"}`}>
                        {pick.drafter}
                      </span>
                      <span className="flex-1 truncate text-[11px] text-slate-400">{draftedPlayer ?? ""}</span>
                    </div>
                  );
                }

                if (isCurrent) {
                  return (
                    <div key={pick.overall} ref={currentPickRef}
                      className={`flex items-center gap-2 border-b border-amber-500/20 px-3 py-2.5 ${
                        isMe ? "bg-amber-500/10" : "bg-white/5"
                      }`}>
                      <span className="w-8 font-mono text-[10px] text-slate-500">
                        {pick.round}.{pick.pick}
                      </span>
                      <span className={`flex-1 text-[13px] font-bold ${isMe ? "text-amber-300" : "text-white"}`}>
                        {pick.drafter}
                      </span>
                      <span className="text-[10px] font-semibold text-amber-400">ON CLOCK</span>
                    </div>
                  );
                }

                // Future picks — clickable to set active drafter
                if (isFuture) {
                  return (
                    <button key={pick.overall}
                      onClick={() => setSelectedDrafter(pick.drafter === selectedDrafter ? null : pick.drafter)}
                      className={`flex w-full items-center gap-2 border-b border-border/20 px-3 py-1.5 text-left transition-colors ${
                        isSelected && isManual
                          ? isMe ? "bg-amber-500/10" : "bg-blue-500/8"
                          : "hover:bg-white/[0.03]"
                      }`}>
                      <span className="w-8 font-mono text-[10px] text-slate-700">
                        {pick.round}.{pick.pick}
                      </span>
                      <span className={`flex-1 text-[11px] ${
                        isSelected && isManual && isMe ? "font-semibold text-amber-400" :
                        isSelected && isManual ? "font-semibold text-blue-400" :
                        isMe ? "text-amber-400/50" : "text-slate-600"
                      }`}>
                        {pick.drafter}
                      </span>
                      {isSelected && isManual && (
                        <span className={`text-[10px] ${isMe ? "text-amber-500" : "text-blue-500"}`}>●</span>
                      )}
                    </button>
                  );
                }
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
