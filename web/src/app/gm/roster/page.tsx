"use client";

import { useState, useEffect, useMemo } from "react";
import type { Player } from "@/lib/data";

interface DraftSession {
  drafted: string[];
  myPicks: string[];
  myRoster: Record<string, string>;
}

const BATTING_SLOTS = ["C", "1B", "2B", "3B", "SS", "OF", "OF", "OF", "UTIL"] as const;
const PITCHING_SLOTS = ["SP", "SP", "SP", "SP", "SP", "RP", "RP", "P", "P"] as const;
const SLOT_ELIGIBLE: Record<string, string[]> = {
  C: ["C"], "1B": ["1B"], "2B": ["2B"], "3B": ["3B"], SS: ["SS"],
  OF: ["OF"], UTIL: ["C", "1B", "2B", "3B", "SS", "OF", "DH"],
  SP: ["SP"], RP: ["RP"], P: ["SP", "RP"],
};

function zColor(z: number) {
  if (z >= 1.0) return "text-sky-300 font-semibold";
  if (z >= 0.5) return "text-sky-400/90";
  if (z >= 0.0) return "text-slate-300";
  if (z >= -0.3) return "text-slate-500";
  return "text-red-400/70";
}

function injuryBadge(status?: string) {
  if (!status || status === "ACTIVE") return null;
  const colors: Record<string, string> = {
    DAY_TO_DAY: "text-amber-400",
    SEVEN_DAY_DL: "text-orange-400",
    FIFTEEN_DAY_DL: "text-red-400",
    SIXTY_DAY_DL: "text-red-500",
    OUT: "text-red-400",
  };
  const labels: Record<string, string> = {
    DAY_TO_DAY: "DTD",
    SEVEN_DAY_DL: "7-IL",
    FIFTEEN_DAY_DL: "15-IL",
    SIXTY_DAY_DL: "60-IL",
    OUT: "OUT",
  };
  return (
    <span className={`ml-1 text-[10px] font-bold ${colors[status] ?? "text-slate-500"}`}>
      {labels[status] ?? status}
    </span>
  );
}

interface EspnRosterPlayer {
  name: string;
  injuryStatus: string;
  injuryLabel: string;
  injuryColor: string;
  injuryNote?: string;
  slotLabel: string;
  slotId: number;
  proTeam: string;
}

export default function RosterPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [session, setSession] = useState<DraftSession>({ drafted: [], myPicks: [], myRoster: {} });
  const [espnRoster, setEspnRoster] = useState<EspnRosterPlayer[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [espnLoaded, setEspnLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/rankings").then((r) => r.json()),
      fetch("/api/draft").then((r) => r.json()),
    ]).then(([p, s]) => {
      setPlayers(p);
      setSession(s);
      setLoading(false);
    });

    // Try ESPN live roster (optional — works only if credentials configured)
    fetch("/api/espn/roster")
      .then((r) => r.json())
      .then((teams) => {
        if (!teams.error && Array.isArray(teams)) {
          // Find my team — pick the one with MY_TEAM flag or just store all
          setEspnRoster(teams.flatMap((t: any) => t.roster ?? []));
        }
        setEspnLoaded(true);
      })
      .catch(() => setEspnLoaded(true));
  }, []);

  const playerMap = useMemo(() => {
    const m = new Map<string, Player>();
    players.forEach((p) => m.set(p.name, p));
    return m;
  }, [players]);

  const myPickPlayers = useMemo(
    () => session.myPicks.map((n) => playerMap.get(n)).filter(Boolean) as Player[],
    [session.myPicks, playerMap]
  );

  // Greedily fill lineup slots
  const lineupSlots = useMemo(() => {
    const pool = [...myPickPlayers].sort((a, b) => b.zTotal - a.zTotal);
    const assigned = new Set<string>();
    const fill = (slots: readonly string[]) =>
      slots.map((slot) => {
        const eligible = SLOT_ELIGIBLE[slot];
        const player = pool.find((p) => {
          if (assigned.has(p.name)) return false;
          return eligible ? eligible.includes(p.pos) : true;
        }) ?? null;
        if (player) assigned.add(player.name);
        return { slot, player };
      });
    const batSlots = fill(BATTING_SLOTS);
    const pitSlots = fill(PITCHING_SLOTS);
    const bnPlayers = myPickPlayers.filter((p) => !assigned.has(p.name));
    return { batSlots, pitSlots, bnPlayers };
  }, [myPickPlayers]);

  // FA / waiver suggestions: top available by z-score (not on my roster)
  const draftedSet = useMemo(() => new Set(session.drafted), [session.drafted]);
  const myPickSet = useMemo(() => new Set(session.myPicks), [session.myPicks]);
  const faSuggestions = useMemo(() => {
    const seen = new Set<string>();
    return players
      .filter((p) => {
        if (seen.has(p.name)) { return false; }
        seen.add(p.name);
        return !draftedSet.has(p.name) && !myPickSet.has(p.name);
      })
      .sort((a, b) => b.zTotal - a.zTotal)
      .slice(0, 30);
  }, [players, draftedSet, myPickSet]);

  // IL players (from ESPN roster if available)
  const ilPlayers = useMemo(() => {
    if (!espnRoster) return [];
    return espnRoster.filter((p) =>
      ["SEVEN_DAY_DL", "FIFTEEN_DAY_DL", "SIXTY_DAY_DL", "OUT"].includes(p.injuryStatus)
    );
  }, [espnRoster]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-500">Loading...</div>;
  }

  const SlotRow = ({ slot, player }: { slot: string; player: Player | null }) => (
    <div className="flex items-center gap-2 border-b border-border/30 px-2 py-1.5">
      <span className="w-8 shrink-0 text-[10px] font-bold text-slate-600">{slot}</span>
      {player ? (
        <>
          <span className="min-w-0 flex-1 truncate text-[12px] text-slate-200">{player.name}</span>
          <span className="shrink-0 text-[10px] text-slate-600">{player.team}</span>
          <span className={`shrink-0 font-mono text-[11px] ${zColor(player.zTotal)}`}>
            {player.zTotal.toFixed(2)}
          </span>
        </>
      ) : (
        <span className="text-[11px] text-slate-700">—</span>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">

        {/* Main roster */}
        <div className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h1 className="text-lg font-bold text-white">My Roster</h1>
            <span className="text-[12px] tabular-nums text-slate-500">
              {myPickPlayers.length} players
            </span>
          </div>

          {myPickPlayers.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface px-6 py-10 text-center text-slate-500">
              No roster data yet. Use the War Room to log your draft picks.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Batting */}
              <div className="rounded-lg border border-border bg-surface">
                <div className="border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  Batting
                </div>
                {lineupSlots.batSlots.map((s, i) => <SlotRow key={i} {...s} />)}
              </div>
              {/* Pitching */}
              <div className="rounded-lg border border-border bg-surface">
                <div className="border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  Pitching
                </div>
                {lineupSlots.pitSlots.map((s, i) => <SlotRow key={i} {...s} />)}
              </div>
              {/* Bench */}
              <div className="rounded-lg border border-border bg-surface">
                <div className="border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  Bench
                </div>
                {lineupSlots.bnPlayers.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 border-b border-border/30 px-2 py-1.5">
                    <span className="w-8 shrink-0 text-[10px] font-bold text-slate-600">BN</span>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-slate-400">{p.name}</span>
                    <span className={`shrink-0 font-mono text-[11px] ${zColor(p.zTotal)}`}>{p.zTotal.toFixed(2)}</span>
                  </div>
                ))}
                {lineupSlots.bnPlayers.length === 0 && (
                  <div className="px-3 py-3 text-[11px] text-slate-700">—</div>
                )}
              </div>
            </div>
          )}

          {/* IL section */}
          {ilPlayers.length > 0 && (
            <div className="rounded-lg border border-red-500/20 bg-surface">
              <div className="border-b border-red-500/20 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-red-400/70">
                Injured List ({ilPlayers.length})
              </div>
              <div className="divide-y divide-border/30">
                {ilPlayers.map((p, i) => (
                  <div key={i} className="flex items-start gap-3 px-3 py-2">
                    <span className={`shrink-0 text-[11px] font-bold ${p.injuryColor}`}>
                      {p.injuryLabel}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] text-slate-200">{p.name}</div>
                      {p.injuryNote && (
                        <div className="mt-0.5 text-[11px] text-slate-500">{p.injuryNote}</div>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] text-slate-600">{p.proTeam}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* FA sidebar */}
        <div className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-3 py-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Free Agents
            </div>
            <div className="mt-0.5 text-[10px] text-slate-700">Top available by z-score</div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: "600px" }}>
            {faSuggestions.map((p, i) => (
              <div key={i} className="flex items-center gap-2 border-b border-border/30 px-3 py-1.5">
                <span className="w-4 shrink-0 text-[10px] tabular-nums text-slate-700">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] text-slate-300">{p.name}</div>
                  <div className="text-[10px] text-slate-600">{p.pos} · {p.team}</div>
                </div>
                <span className={`shrink-0 font-mono text-[11px] ${zColor(p.zTotal)}`}>
                  {p.zTotal.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
