"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Player } from "@/lib/data";

// ── Draft order ───────────────────────────────────────────────────────────────

const DRAFT_ORDER = ["Zach", "Ricky", "Luke", "Roger", "Ethan", "Fitzy", "Dan", "Tim", "JB", "Joel"];
const TEAM_COUNT = 10;

function getDrafter(pickIndex: number) {
  const round = Math.floor(pickIndex / TEAM_COUNT) + 1;
  const pickInRound = pickIndex % TEAM_COUNT;
  const idx = (round - 1) % 2 === 0 ? pickInRound : TEAM_COUNT - 1 - pickInRound;
  return { name: DRAFT_ORDER[idx], round, pick: pickInRound + 1 };
}

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function DraftBoardPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [session, setSession] = useState<DraftSession>({ drafted: [], myPicks: [], myRoster: {} });
  const [typeFilter, setTypeFilter] = useState<"All" | "BAT" | "PIT">("All");
  const [posFilter, setPosFilter] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [showAvail, setShowAvail] = useState(true);
  const [draftInput, setDraftInput] = useState("");
  const [isMine, setIsMine] = useState(true);

  useEffect(() => {
    fetch("/api/rankings").then((r) => r.json()).then(setPlayers);
    fetch("/api/draft").then((r) => r.json()).then(setSession);
  }, []);

  const draftedSet = useMemo(() => new Set(session.drafted), [session.drafted]);

  const playerMap = useMemo(() => {
    const m = new Map<string, Player>();
    players.forEach((p) => m.set(p.name, p));
    return m;
  }, [players]);

  // Rank within position among still-available players
  const posRanks = useMemo(() => {
    const map = new Map<string, number>();
    const byPos: Record<string, Player[]> = {};
    for (const p of players) {
      if (draftedSet.has(p.name)) continue;
      if (!byPos[p.pos]) byPos[p.pos] = [];
      byPos[p.pos].push(p);
    }
    for (const group of Object.values(byPos)) {
      group.forEach((p, i) => map.set(p.name, i + 1));
    }
    return map;
  }, [players, draftedSet]);

  const positions = useMemo(
    () => [...new Set(players.map((p) => p.pos).filter(Boolean))].sort(),
    [players]
  );

  const filtered = useMemo(() => {
    let list = players;
    if (typeFilter === "BAT") list = list.filter((p) => p.type === "BAT");
    if (typeFilter === "PIT") list = list.filter((p) => p.type === "PIT");
    if (posFilter.length > 0) list = list.filter((p) => posFilter.includes(p.pos));
    if (search) list = list.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    if (showAvail) list = list.filter((p) => !draftedSet.has(p.name));
    return list;
  }, [players, typeFilter, posFilter, search, showAvail, draftedSet]);

  const top5 = useMemo(
    () => players.filter((p) => !draftedSet.has(p.name)).slice(0, 5),
    [players, draftedSet]
  );

  const drafter = useMemo(() => getDrafter(session.drafted.length), [session.drafted.length]);

  const myPickPlayers = useMemo(
    () => session.myPicks.map((n) => playerMap.get(n)).filter(Boolean) as Player[],
    [session.myPicks, playerMap]
  );

  // Stat columns: all 16 when "All", type-specific when filtered
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
  }, []);

  const undoLast = useCallback(async () => {
    const res = await fetch("/api/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "undo" }),
    });
    setSession(await res.json());
  }, []);

  const resetDraft = useCallback(async () => {
    if (!confirm("Reset entire draft?")) return;
    const res = await fetch("/api/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    setSession(await res.json());
  }, []);

  const handleConfirmPick = () => {
    if (!draftInput.trim()) return;
    const match = players.find((p) =>
      p.name.toLowerCase().includes(draftInput.trim().toLowerCase())
    );
    if (match && !draftedSet.has(match.name)) {
      draftPlayer(match.name, isMine);
      setDraftInput("");
    }
  };

  const togglePos = (pos: string) =>
    setPosFilter((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_260px]">

        {/* ── Main column ────────────────────────────────────────────────── */}
        <div className="min-w-0">

          {/* Toolbar */}
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 rounded bg-surface px-3 py-1.5 text-[13px] tabular-nums">
              <span className="text-slate-500">Drafted</span>
              <span className="font-semibold text-white">{session.drafted.length}</span>
              <span className="text-slate-700">|</span>
              <span className="text-slate-500">Mine</span>
              <span className="font-semibold text-amber-400">{session.myPicks.length}</span>
              <span className="text-slate-700">|</span>
              <span className="text-slate-500">On the clock:</span>
              <span className={`font-bold ${drafter.name === "Luke" ? "text-amber-400" : "text-white"}`}>
                {drafter.name}
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

          {/* Best Available cards */}
          {top5.length > 0 && (
            <div className="mb-5 grid grid-cols-5 gap-2">
              {top5.map((p, i) => {
                const pr = posRanks.get(p.name);
                return (
                  <div key={p.name} className="rounded-lg border border-border bg-surface p-3">
                    <div className="mb-1 flex items-baseline justify-between">
                      <span className={`font-mono text-[11px] font-bold ${i === 0 ? "text-amber-400" : "text-slate-600"}`}>
                        #{p.rank}
                      </span>
                      <span className="font-mono text-[10px] text-slate-600">
                        {pr ? `${p.pos}${pr}` : p.pos}
                      </span>
                    </div>
                    <div className="truncate text-[13px] font-semibold text-white">{p.name}</div>
                    <div className="mt-0.5 flex items-baseline justify-between text-[11px]">
                      <span className="text-slate-500">{p.team}</span>
                      <span className={`font-mono ${zColor(p.zTotal)}`}>{p.zTotal.toFixed(2)}</span>
                    </div>
                    <div className="mt-2 flex gap-1">
                      <button onClick={() => draftPlayer(p.name, true)}
                        className="flex-1 rounded bg-amber-500/20 py-0.5 text-[11px] font-medium text-amber-300 transition-colors hover:bg-amber-500/30">
                        Mine
                      </button>
                      <button onClick={() => draftPlayer(p.name, false)}
                        className="flex-1 rounded bg-white/5 py-0.5 text-[11px] text-slate-400 transition-colors hover:bg-white/10">
                        Other
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Draft input */}
          <div className="mb-5 flex gap-2">
            <input
              type="text"
              value={draftInput}
              onChange={(e) => setDraftInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirmPick()}
              placeholder="Type player name..."
              className="min-w-0 flex-1 rounded border border-border bg-surface px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-slate-500 focus:outline-none"
            />
            <label className="flex items-center gap-1.5 px-2 text-[12px] text-slate-500">
              <input
                type="checkbox"
                checked={isMine}
                onChange={(e) => setIsMine(e.target.checked)}
                className="accent-amber-500"
              />
              Mine
            </label>
            <button onClick={handleConfirmPick}
              className="rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500">
              Draft
            </button>
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
                  <th className="w-10 px-3 py-2.5 font-medium">#</th>
                  <th className="w-12 px-2 py-2.5 font-medium">POS#</th>
                  {players[0]?.espnRank !== undefined && (
                    <th className="w-14 px-2 py-2.5 font-medium">ESPN</th>
                  )}
                  <th className="min-w-[160px] px-3 py-2.5 font-medium">Player</th>
                  <th className="w-14 px-2 py-2.5 font-medium">Team</th>
                  <th className="w-12 px-2 py-2.5 font-medium">Pos</th>
                  <th className="w-16 px-2 py-2.5 text-right font-medium">zScore</th>
                  {statCols.map((c) => (
                    <th key={c} className="w-14 px-2 py-2.5 text-right font-medium">{c}</th>
                  ))}
                  <th className="w-16 px-2 py-2.5"></th>
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
                      {players[0]?.espnRank !== undefined && (
                        <td className="px-2 py-1.5 font-mono text-slate-600">{p.espnRank ?? "—"}</td>
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
                      <td className="px-2 py-1.5 text-right">
                        {!drafted && (
                          <button onClick={() => draftPlayer(p.name, isMine)}
                            className="rounded px-2 py-0.5 text-[11px] text-slate-500 transition-colors hover:bg-blue-600/20 hover:text-blue-400">
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
            {filtered.length} players · {players.filter((p) => !draftedSet.has(p.name)).length} available
          </div>
        </div>

        {/* ── Sidebar ────────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Draft Order */}
          <div className="rounded-lg border border-border bg-surface">
            <div className="border-b border-border px-3 py-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Draft Order</h2>
            </div>
            <div className="px-2 py-2 space-y-0.5">
              {DRAFT_ORDER.map((name, i) => {
                const isCurrent = name === drafter.name;
                const isMe = name === "Luke";
                return (
                  <div key={name}
                    className={`flex items-center gap-2 rounded px-2 py-1.5 text-[12px] ${
                      isCurrent ? "bg-amber-500/10" : ""
                    }`}>
                    <span className="w-4 font-mono text-[10px] text-slate-700">{i + 1}</span>
                    <span className={[
                      "flex-1",
                      isCurrent ? "font-bold text-amber-300" : isMe ? "font-semibold text-amber-400/70" : "text-slate-400",
                    ].join(" ")}>
                      {name}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-medium text-amber-400">clock</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* My Team */}
          <div className="rounded-lg border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">My Team</h2>
              <span className="text-[11px] tabular-nums text-amber-400/70">{myPickPlayers.length} picks</span>
            </div>
            {myPickPlayers.length === 0 ? (
              <div className="px-3 py-4 text-[12px] text-slate-700">No picks yet</div>
            ) : (
              <div className="divide-y divide-border/30">
                {myPickPlayers.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-2 px-3 py-1.5">
                    <span className="w-5 font-mono text-[10px] text-slate-700">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium text-slate-200">{p.name}</div>
                      <div className="text-[10px] text-slate-600">{p.team} · {p.pos}</div>
                    </div>
                    <span className={`font-mono text-[11px] ${zColor(p.zTotal)}`}>{p.zTotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
