"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Player } from "@/lib/data";

interface DraftSession {
  drafted: string[];
  myPicks: string[];
  myRoster: Record<string, string>;
}

const ROSTER_SLOTS = [
  "C", "1B", "2B", "3B", "SS", "OF1", "OF2", "OF3", "UTIL",
  "SP1", "SP2", "SP3", "SP4", "SP5", "RP1", "RP2", "P1", "P2",
  "BN1", "BN2", "BN3", "BN4", "BN5", "BN6",
] as const;

type Slot = (typeof ROSTER_SLOTS)[number];

function slotLabel(slot: Slot): string {
  if (slot.startsWith("OF")) return "OF";
  if (slot.startsWith("SP")) return "SP";
  if (slot.startsWith("RP")) return "RP";
  if (slot === "P1" || slot === "P2") return "P";
  if (slot.startsWith("BN")) return "BN";
  return slot;
}

function isEligible(slot: Slot, player: Player): boolean {
  const label = slotLabel(slot);
  const pos = player.pos;
  const type = player.type;
  if (label === "BN") return true;
  if (label === "UTIL") return type === "BAT";
  if (label === "OF") return pos === "OF";
  if (label === "SP") return pos === "SP";
  if (label === "RP") return pos === "RP";
  if (label === "P") return pos === "SP" || pos === "RP";
  return pos === label;
}

const BAT_STATS = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG"] as const;
const PIT_STATS = ["K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"] as const;

export default function TeamPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [session, setSession] = useState<DraftSession>({
    drafted: [], myPicks: [], myRoster: {},
  });
  const [assigningSlot, setAssigningSlot] = useState<Slot | null>(null);

  useEffect(() => {
    fetch("/api/rankings").then((r) => r.json()).then(setPlayers);
    fetch("/api/draft").then((r) => r.json()).then(setSession);
  }, []);

  const playerMap = useMemo(() => {
    const map = new Map<string, Player>();
    for (const p of players) map.set(p.name, p);
    return map;
  }, [players]);

  const myPickPlayers = useMemo(
    () => session.myPicks.map((n) => playerMap.get(n)).filter(Boolean) as Player[],
    [session.myPicks, playerMap]
  );

  const assignedNames = useMemo(
    () => new Set(Object.values(session.myRoster)),
    [session.myRoster]
  );

  const unassigned = useMemo(
    () => myPickPlayers.filter((p) => !assignedNames.has(p.name)),
    [myPickPlayers, assignedNames]
  );

  const assignPlayer = useCallback(async (slot: Slot, playerName: string) => {
    const res = await fetch("/api/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "assign", slot, player: playerName }),
    });
    setSession(await res.json());
    setAssigningSlot(null);
  }, []);

  const unassignSlot = useCallback(async (slot: Slot) => {
    const res = await fetch("/api/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unassign", slot }),
    });
    setSession(await res.json());
  }, []);

  const rosteredPlayers = useMemo(() => {
    const list: Player[] = [];
    for (const name of Object.values(session.myRoster)) {
      const p = playerMap.get(name);
      if (p) list.push(p);
    }
    return list;
  }, [session.myRoster, playerMap]);

  const batTotals = useMemo(() => {
    const batters = rosteredPlayers.filter((p) => p.type === "BAT");
    const totals: Record<string, number> = {};
    for (const stat of BAT_STATS) {
      if (stat === "AVG") {
        const vals = batters.map((p) => p.AVG).filter((v) => v !== undefined) as number[];
        totals[stat] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      } else {
        totals[stat] = batters.reduce((sum, p) => sum + ((p as unknown as Record<string, number | undefined>)[stat] ?? 0), 0);
      }
    }
    return totals;
  }, [rosteredPlayers]);

  const pitTotals = useMemo(() => {
    const pitchers = rosteredPlayers.filter((p) => p.type === "PIT");
    const totals: Record<string, number> = {};
    for (const stat of PIT_STATS) {
      if (stat === "ERA" || stat === "WHIP") {
        const vals = pitchers.map((p) => (p as unknown as Record<string, number | undefined>)[stat]).filter((v) => v !== undefined) as number[];
        totals[stat] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      } else {
        totals[stat] = pitchers.reduce((sum, p) => sum + ((p as unknown as Record<string, number | undefined>)[stat] ?? 0), 0);
      }
    }
    return totals;
  }, [rosteredPlayers]);

  const isBatSlot = (slot: Slot) => {
    const label = slotLabel(slot);
    return ["C", "1B", "2B", "3B", "SS", "OF", "UTIL"].includes(label);
  };

  function SlotRow({ slot }: { slot: Slot }) {
    const name = session.myRoster[slot];
    const player = name ? playerMap.get(name) : undefined;
    return (
      <div className="flex items-center gap-3 border-b border-border/30 px-3 py-1.5 last:border-0">
        <span className="w-9 font-mono text-[11px] font-bold text-slate-600">{slotLabel(slot)}</span>
        {player ? (
          <>
            <span className="flex-1 text-[13px] font-medium text-white">{player.name}</span>
            <span className="text-[11px] text-slate-500">{player.team}</span>
            <span className="font-mono text-[11px] text-sky-400/80">{player.zTotal.toFixed(2)}</span>
            <button onClick={() => unassignSlot(slot)}
              className="text-[11px] text-slate-600 transition-colors hover:text-red-400">
              &times;
            </button>
          </>
        ) : (
          <button onClick={() => setAssigningSlot(assigningSlot === slot ? null : slot)}
            className={`flex-1 text-left text-[12px] ${
              assigningSlot === slot ? "text-amber-400" : "text-slate-700 hover:text-slate-500"
            }`}>
            {assigningSlot === slot ? "Select below..." : "—"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-5">
      <h1 className="mb-5 text-xl font-bold text-white">My Team</h1>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {/* Batting */}
        <div className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-3 py-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Batting</h2>
          </div>
          {ROSTER_SLOTS.filter((s) => isBatSlot(s) && !s.startsWith("BN")).map((slot) => (
            <SlotRow key={slot} slot={slot} />
          ))}
        </div>

        {/* Pitching */}
        <div className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-3 py-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Pitching</h2>
          </div>
          {ROSTER_SLOTS.filter((s) => !isBatSlot(s) && !s.startsWith("BN")).map((slot) => (
            <SlotRow key={slot} slot={slot} />
          ))}
        </div>
      </div>

      {/* Bench */}
      <div className="mb-6 rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-3 py-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Bench</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3">
          {ROSTER_SLOTS.filter((s) => s.startsWith("BN")).map((slot) => (
            <SlotRow key={slot} slot={slot} />
          ))}
        </div>
      </div>

      {/* Assign picker */}
      {assigningSlot && (
        <div className="mb-6 rounded-lg border border-amber-500/20 bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[13px] text-slate-300">
              Assign to <span className="font-mono font-bold text-amber-400">{assigningSlot}</span>
            </span>
            <button onClick={() => setAssigningSlot(null)}
              className="text-[11px] text-slate-600 hover:text-slate-400">Cancel</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {unassigned.filter((p) => isEligible(assigningSlot, p)).map((p) => (
              <button key={p.name} onClick={() => assignPlayer(assigningSlot, p.name)}
                className="rounded border border-border bg-surface-raised px-2.5 py-1 text-[12px] text-white transition-colors hover:border-slate-500">
                {p.name}
                <span className="ml-1 text-slate-500">{p.pos}</span>
              </button>
            ))}
            {unassigned.filter((p) => isEligible(assigningSlot, p)).length === 0 && (
              <span className="text-[12px] text-slate-600">No eligible players</span>
            )}
          </div>
        </div>
      )}

      {/* Projected Totals */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Batting Projections
          </h2>
          <div className="grid grid-cols-4 gap-3">
            {BAT_STATS.map((stat) => (
              <div key={stat} className="text-center">
                <div className="text-[11px] text-slate-600">{stat}</div>
                <div className="font-mono text-lg font-bold text-white">
                  {stat === "AVG" ? batTotals[stat]?.toFixed(3) ?? ".000" : Math.round(batTotals[stat] ?? 0)}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Pitching Projections
          </h2>
          <div className="grid grid-cols-4 gap-3">
            {PIT_STATS.map((stat) => (
              <div key={stat} className="text-center">
                <div className="text-[11px] text-slate-600">{stat}</div>
                <div className="font-mono text-lg font-bold text-white">
                  {stat === "ERA" || stat === "WHIP" ? pitTotals[stat]?.toFixed(3) ?? "0.000" : Math.round(pitTotals[stat] ?? 0)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {unassigned.length > 0 && (
        <div className="mt-6 rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-3 py-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-amber-400/80">
              Unassigned ({unassigned.length})
            </h2>
          </div>
          <table className="w-full text-left text-[13px]">
            <tbody>
              {unassigned.map((p) => (
                <tr key={p.name} className="border-b border-border/30 last:border-0">
                  <td className="px-3 py-1.5 font-mono text-slate-600">{p.rank}</td>
                  <td className="px-3 py-1.5 font-medium text-white">{p.name}</td>
                  <td className="px-3 py-1.5 text-slate-500">{p.team}</td>
                  <td className="px-3 py-1.5 text-slate-500">{p.pos}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-sky-400/80">{p.zTotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
