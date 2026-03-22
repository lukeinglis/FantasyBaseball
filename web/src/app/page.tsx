"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Player } from "@/lib/data";

interface DraftSession {
  drafted: string[];
  myPicks: string[];
  myRoster: Record<string, string>;
}

function zColor(z: number): string {
  if (z >= 1.0) return "text-sky-300 font-semibold";
  if (z >= 0.5) return "text-sky-400/90";
  if (z >= 0.0) return "text-slate-300";
  if (z >= -0.3) return "text-slate-500";
  return "text-red-400/70";
}

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

  const togglePos = (pos: string) => {
    setPosFilter((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );
  };

  const roundNum = Math.floor(session.drafted.length / 10) + 1;
  const pickInRound = (session.drafted.length % 10) + 1;

  const batCols = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG"] as const;
  const pitCols = ["K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"] as const;
  const statCols = typeFilter === "PIT" ? pitCols : typeFilter === "BAT" ? batCols : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-5">
      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3 rounded bg-surface px-3 py-1.5 text-[13px] tabular-nums">
          <span className="text-slate-500">Drafted</span>
          <span className="font-semibold text-white">{session.drafted.length}</span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-500">Mine</span>
          <span className="font-semibold text-amber-400">{session.myPicks.length}</span>
          {session.drafted.length > 0 && (
            <>
              <span className="text-slate-700">|</span>
              <span className="text-slate-500">
                Rd {roundNum} Pick {pickInRound}
              </span>
            </>
          )}
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

      {/* Best Available */}
      {top5.length > 0 && (
        <div className="mb-5 grid grid-cols-5 gap-2">
          {top5.map((p, i) => (
            <button key={p.name}
              onClick={() => { setDraftInput(p.name); }}
              className="group relative rounded-lg border border-border bg-surface p-3 text-left transition-colors hover:border-slate-600">
              <div className="mb-1 flex items-baseline justify-between">
                <span className={`font-mono text-[11px] font-bold ${
                  i === 0 ? "text-amber-400" : "text-slate-600"
                }`}>
                  #{p.rank}
                </span>
                <span className="font-mono text-[11px] text-sky-400/80">
                  {p.zTotal.toFixed(2)}
                </span>
              </div>
              <div className="truncate text-[13px] font-semibold text-white group-hover:text-amber-200">
                {p.name}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                {p.team} · {p.pos}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Draft Input */}
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
                typeFilter === t
                  ? "bg-white/10 text-white"
                  : "text-slate-500 hover:text-slate-300"
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

      {/* Rankings Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-border bg-surface text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="w-12 px-3 py-2.5 font-medium">#</th>
              {players[0]?.espnRank !== undefined && (
                <th className="w-14 px-2 py-2.5 font-medium">ESPN</th>
              )}
              <th className="min-w-[180px] px-3 py-2.5 font-medium">Player</th>
              <th className="w-16 px-2 py-2.5 font-medium">Team</th>
              <th className="w-14 px-2 py-2.5 font-medium">Pos</th>
              <th className="w-20 px-2 py-2.5 text-right font-medium">zScore</th>
              {statCols.map((c) => (
                <th key={c} className="w-14 px-2 py-2.5 text-right font-medium">{c}</th>
              ))}
              <th className="w-16 px-2 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map((p, idx) => {
              const drafted = draftedSet.has(p.name);
              return (
                <tr key={p.name}
                  className={`border-b border-border/50 transition-colors ${
                    drafted ? "opacity-30" : "hover:bg-white/[0.02]"
                  } ${idx % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                  <td className="px-3 py-1.5 font-mono text-slate-600">{p.rank}</td>
                  {players[0]?.espnRank !== undefined && (
                    <td className="px-2 py-1.5 font-mono text-slate-600">
                      {p.espnRank ?? "—"}
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
                      {p[c] !== undefined ? (c === "AVG" || c === "ERA" || c === "WHIP"
                        ? p[c]!.toFixed(3) : Math.round(p[c]!)) : "—"}
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
  );
}
