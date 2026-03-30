"use client";

import { useState, useEffect, useMemo } from "react";
import type { Player, DraftProfile, DraftPick } from "@/lib/data";
import type { EspnPlayerData } from "@/app/api/espn-adp/route";

// ── Config ────────────────────────────────────────────────────────────────────

const DRAFT_ORDER = ["Zach","Ricky","Luke","Roger","Ethan","Fitzy","Dan","Tim","JB","Joel"];
const MY_NAME = "Luke";
const TEAM_COUNT = 10;
const TOTAL_ROUNDS = 24;

const ROSTER_TARGETS: Record<string, number> = {
  C: 2, "1B": 2, "2B": 2, "3B": 2, SS: 2, OF: 5, SP: 8, RP: 4,
};

const DEFAULT_FIRST_ROUND: Record<string, number> = {
  OF: 1.5, SP: 3.0, SS: 3.5, "3B": 4.0, "1B": 4.0, "2B": 5.0, C: 9.0, RP: 13.0,
};

const DRAFTER_TO_FRANCHISE: Record<string, string> = {
  Luke: "Craig Albernaz", Zach: "Daisy + Shay Bel-Airs", Ricky: "Cash Betts Only",
  Roger: "The Houston Asstros", Ethan: "Delray Beach Air Biscuits", Fitzy: "Smokin' Bases",
  Dan: "Lisa dANN", Tim: "The G.O.A.T", JB: "MOArch Redbirds", Joel: "Cream City Cowtippers",
};

// ── Categories ────────────────────────────────────────────────────────────────

const BAT_CATS = ["H","R","HR","TB","RBI","BB","SB","AVG"] as const;
const PIT_CATS = ["K","QS","SV","HD","ERA","WHIP"] as const;
const ALL_CATS = [...BAT_CATS, ...PIT_CATS] as const;
type Cat = (typeof ALL_CATS)[number];
const LOWER_BETTER = new Set<Cat>(["ERA","WHIP"]);

interface TeamProjection {
  drafter: string;
  stats: Record<Cat, number>;
  ranks: Record<Cat, number>;
  totalRank: number;
}

function projectStats(mockPicks: MockPick[], players: Player[]): TeamProjection[] {
  const playerMap = new Map<string, Player>();
  for (const p of players) playerMap.set(p.name, p);

  const raw = DRAFT_ORDER.map((drafter) => {
    const picks = mockPicks.filter((pk) => pk.drafter === drafter);
    const stats: Record<string, number> = {};

    // Counting stat accumulators
    let H=0, R=0, HR=0, TB=0, RBI=0, BB=0, SB=0, K=0, QS=0, SV=0, HD=0;
    // Rate stat weighted accumulators
    let hitH=0, hitAB=0;          // for AVG
    let erIP=0, erER=0;           // for ERA (ER = ERA * IP / 9)
    let whipIP=0, whipBB_H=0;     // for WHIP (BB+H = WHIP * IP)

    for (const pk of picks) {
      const p = playerMap.get(pk.player.name);
      if (!p) continue;

      if (!["SP","RP"].includes(pk.pos)) {
        // Hitter
        H  += p.H   ?? 0;
        R  += p.R   ?? 0;
        HR += p.HR  ?? 0;
        TB += p.TB  ?? 0;
        RBI+= p.RBI ?? 0;
        BB += p.BB  ?? 0;
        SB += p.SB  ?? 0;
        const h = p.H ?? 0;
        const avg = p.AVG ?? 0;
        const ab = avg > 0 ? h / avg : 0;
        hitH += h; hitAB += ab;
      } else {
        // Pitcher
        K  += p.K  ?? 0;
        QS += p.QS ?? 0;
        SV += p.SV ?? 0;
        HD += p.HD ?? 0;
        // Estimate innings: starters use QS*6, relievers fixed 65 IP
        const ip = pk.pos === "SP" ? (p.QS ?? 0) * 6 + 20 : 65;
        if (ip > 0) {
          erIP  += ip;
          erER  += (p.ERA  ?? 4.0) * ip / 9;
          whipIP   += ip;
          whipBB_H += (p.WHIP ?? 1.25) * ip;
        }
      }
    }

    stats.H  = Math.round(H);
    stats.R  = Math.round(R);
    stats.HR = Math.round(HR);
    stats.TB = Math.round(TB);
    stats.RBI= Math.round(RBI);
    stats.BB = Math.round(BB);
    stats.SB = Math.round(SB);
    stats.AVG= hitAB > 0 ? hitH / hitAB : 0;
    stats.K  = Math.round(K);
    stats.QS = Math.round(QS);
    stats.SV = Math.round(SV);
    stats.HD = Math.round(HD);
    stats.ERA = erIP > 0 ? (erER / erIP) * 9 : 4.0;
    stats.WHIP= whipIP > 0 ? whipBB_H / whipIP : 1.25;

    return { drafter, stats };
  });

  // Rank each team per category (1 = best)
  const projections: TeamProjection[] = raw.map(({ drafter, stats }) => ({
    drafter,
    stats: stats as Record<Cat, number>,
    ranks: {} as Record<Cat, number>,
    totalRank: 0,
  }));

  for (const cat of ALL_CATS) {
    const sorted = [...projections].sort((a, b) =>
      LOWER_BETTER.has(cat)
        ? a.stats[cat] - b.stats[cat]
        : b.stats[cat] - a.stats[cat]
    );
    sorted.forEach((t, i) => { t.ranks[cat] = i + 1; });
  }

  for (const t of projections) {
    t.totalRank = ALL_CATS.reduce((s, c) => s + t.ranks[c], 0);
  }

  return projections.sort((a, b) => a.totalRank - b.totalRank);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface MockPick {
  round: number;
  pickInRound: number;
  overall: number;
  drafter: string;
  player: Player;
  pos: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDrafter(overall: number): string {
  const round = Math.floor(overall / TEAM_COUNT);
  const pickInRound = overall % TEAM_COUNT;
  const idx = round % 2 === 0 ? pickInRound : TEAM_COUNT - 1 - pickInRound;
  return DRAFT_ORDER[idx];
}

function resolvePos(
  name: string,
  fallbackPos: string,
  espnData: Record<string, { primaryPos?: string | null }>,
  posMap: Record<string, string>
): string {
  const raw = espnData[name]?.primaryPos ?? posMap[name] ?? fallbackPos ?? "";
  if (["CF","RF","LF","OF"].includes(raw)) return "OF";
  if (["C","1B","2B","3B","SS","SP","RP"].includes(raw)) return raw;
  if (raw === "DH") return "OF";
  return "";
}

function buildTeamPosRounds(
  profiles: DraftProfile[],
  allPicks: DraftPick[],
  espnData: Record<string, { primaryPos?: string | null }>,
  posMap: Record<string, string>
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const profile of profiles) {
    const teamSet = new Set(profile.teamNames);
    const myPicks = allPicks.filter((p) => teamSet.has(p.team));
    const accum: Record<string, number[]> = {};
    const years = [...new Set(myPicks.map((p) => p.year))];
    for (const year of years) {
      const yp = myPicks.filter((p) => p.year === year).sort((a, b) => a.round - b.round);
      const first: Record<string, number> = {};
      for (const pick of yp) {
        const pos = resolvePos(pick.playerName, "", espnData, posMap);
        if (pos && !(pos in first)) first[pos] = pick.round;
      }
      for (const [pos, rnd] of Object.entries(first)) {
        if (!accum[pos]) accum[pos] = [];
        accum[pos].push(rnd);
      }
    }
    const posRounds: Record<string, number> = { ...DEFAULT_FIRST_ROUND };
    for (const pos of Object.keys(ROSTER_TARGETS)) {
      const arr = accum[pos] ?? [];
      if (arr.length >= 2) posRounds[pos] = arr.reduce((a, b) => a + b, 0) / arr.length;
    }
    // Profile data covers more seasons — use as authoritative for these 4
    if (profile.firstSp > 0) posRounds["SP"] = profile.firstSp;
    if (profile.firstRp > 0) posRounds["RP"] = profile.firstRp;
    if (profile.firstC > 0) posRounds["C"] = profile.firstC;
    if (profile.firstSs > 0) posRounds["SS"] = profile.firstSs;
    out[profile.team] = posRounds;
  }
  return out;
}

function simulate(
  players: Player[],
  espnData: Record<string, EspnPlayerData>,
  profiles: DraftProfile[],
  allPicks: DraftPick[],
  posMap: Record<string, string>,
  seed: number
): MockPick[] {
  const teamPosRounds = buildTeamPosRounds(profiles, allPicks, espnData, posMap);

  // Deduplicate players by name, sort by ADP → ESPN rank → our rank
  const seen = new Set<string>();
  const ranked = players
    .filter((p) => { if (seen.has(p.name)) return false; seen.add(p.name); return p.zTotal > -2.5; })
    .sort((a, b) => {
      const av = espnData[a.name]?.adp ?? espnData[a.name]?.espnRank ?? a.rank;
      const bv = espnData[b.name]?.adp ?? espnData[b.name]?.espnRank ?? b.rank;
      return av - bv;
    });

  const available = new Set(ranked.map((p) => p.name));
  const results: MockPick[] = [];
  const rosters: Record<string, Record<string, number>> = {};
  for (const d of DRAFT_ORDER) rosters[d] = {};

  for (let overall = 0; overall < TOTAL_ROUNDS * TEAM_COUNT; overall++) {
    const round = Math.floor(overall / TEAM_COUNT) + 1;
    const pickNum = overall + 1; // 1-indexed pick number
    const drafter = getDrafter(overall);
    const franchise = DRAFTER_TO_FRANCHISE[drafter] ?? drafter;
    const posRounds = teamPosRounds[franchise] ?? DEFAULT_FIRST_ROUND;
    const posCounts = rosters[drafter];

    // Count how many of each position have been drafted this round globally
    const thisRoundPicks = results.filter((r) => r.round === round);
    const spThisRound = thisRoundPicks.filter((r) => r.pos === "SP").length;
    const rpThisRound = thisRoundPicks.filter((r) => r.pos === "RP").length;

    let best: Player | null = null;
    let bestScore = -Infinity;
    let checked = 0;

    for (const p of ranked) {
      if (!available.has(p.name)) continue;
      if (checked++ > 150) break;

      const pos = resolvePos(p.name, p.pos, espnData, posMap);
      if (!pos) continue;
      const count = posCounts[pos] ?? 0;
      if (count >= (ROSTER_TARGETS[pos] ?? 2)) continue;

      const adp = espnData[p.name]?.adp ?? espnData[p.name]?.espnRank ?? p.rank;

      // ── PRIMARY: ADP value ────────────────────────────────────────────────
      // Penalise REACHING (picking a player before their consensus ADP).
      // reachAmount > 0 means we're picking earlier than consensus.
      // If a player FALLS to us, that's value — no penalty.
      const reachAmount = adp - pickNum; // positive = reaching early
      const reachFactor = reachAmount > 0
        ? Math.exp(-reachAmount / 7)  // strong decay: 7 picks early → 37%
        : 1.0;                        // player fell to us: full value
      const adpValue = 300 / (adp + 4);

      // ── SECONDARY: position timing (capped ±25%) ──────────────────────
      const target = posRounds[pos] ?? DEFAULT_FIRST_ROUND[pos] ?? 6;
      const roundsBeforeTarget = target - round; // positive = we're early
      const timingMod = roundsBeforeTarget > 4 ? 0.55   // way too early
                      : roundsBeforeTarget > 2 ? 0.80   // a bit early
                      : roundsBeforeTarget >= -1 ? 1.10  // sweet spot
                      : 1.00;                            // past target

      // ── MARKET SATURATION: prevent SP/RP glut per round ───────────────
      // Each round should have at most ~2-3 SPs and ~1 RP, matching real drafts
      const spLimit = round <= 3 ? 2 : 3;
      const saturated = (pos === "SP" && spThisRound >= spLimit) ||
                        (pos === "RP" && rpThisRound >= 1 && round <= 8);
      const saturationMod = saturated ? 0.45 : 1.0;

      // ── URGENCY: fill slots before they run out ──────────────────────────
      const roundsLeft = TOTAL_ROUNDS - round + 1;
      const needed = (ROSTER_TARGETS[pos] ?? 2) - count;
      const urgency = roundsLeft <= needed * 2.5 ? 2.0 : 1.0;

      // ── NOISE: light variation (±8%) so results differ per seed ──────────
      const noise = 0.96 + (Math.sin(seed * 1.618 + overall * 3571 + checked * 137) * 0.5 + 0.5) * 0.08;

      const score = adpValue * reachFactor * timingMod * saturationMod * urgency * noise;
      if (score > bestScore) { bestScore = score; best = p; }
    }

    if (!best) {
      for (const p of ranked) { if (available.has(p.name)) { best = p; break; } }
    }
    if (!best) continue;

    const pos = resolvePos(best.name, best.pos, espnData, posMap) || "SP";
    results.push({ round, pickInRound: (overall % TEAM_COUNT) + 1, overall, drafter, player: best, pos });
    available.delete(best.name);
    posCounts[pos] = (posCounts[pos] ?? 0) + 1;
  }
  return results;
}

// ── UI Helpers ────────────────────────────────────────────────────────────────

const POS_BADGE: Record<string, string> = {
  C: "bg-blue-500/20 text-blue-400",
  "1B": "bg-green-500/20 text-green-400",
  "2B": "bg-emerald-500/20 text-emerald-400",
  "3B": "bg-teal-500/20 text-teal-400",
  SS: "bg-sky-500/20 text-sky-400",
  OF: "bg-violet-500/20 text-violet-400",
  SP: "bg-orange-600/20 text-orange-500",
  RP: "bg-orange-500/20 text-orange-400",
};
function badge(pos: string) { return POS_BADGE[pos] ?? "bg-slate-500/20 text-slate-400"; }

const PITCHER_POS = new Set(["SP","RP"]);

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MockDraftPage() {
  const [players, setPlayers]   = useState<Player[]>([]);
  const [espnData, setEspnData] = useState<Record<string, EspnPlayerData>>({});
  const [profiles, setProfiles] = useState<DraftProfile[]>([]);
  const [allPicks, setAllPicks] = useState<DraftPick[]>([]);
  const [posMap, setPosMap]     = useState<Record<string, string>>({});
  const [seed, setSeed]     = useState(() => {
    try { return parseInt(localStorage.getItem("mockDraftSeed") ?? "0") || 0; } catch { return 0; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/rankings").then((r) => r.json()),
      fetch("/api/espn-adp").then((r) => r.json()),
      fetch("/api/profiles").then((r) => r.json()),
      fetch("/api/draft-results").then((r) => r.json()),
      fetch("/api/player-positions").then((r) => r.json()),
    ]).then(([p, e, pr, picks, pm]) => {
      setPlayers(p);
      setEspnData(e?.error ? {} : e);
      setProfiles(pr);
      setAllPicks(picks);
      setPosMap(pm);
      setLoading(false);
    });
  }, []);

  const mockPicks = useMemo(
    () => (players.length && profiles.length ? simulate(players, espnData, profiles, allPicks, posMap, seed) : []),
    [players, espnData, profiles, allPicks, posMap, seed]
  );

  const projections = useMemo(
    () => (mockPicks.length && players.length ? projectStats(mockPicks, players) : []),
    [mockPicks, players]
  );

  const byDrafter = useMemo(() => {
    const m: Record<string, MockPick[]> = {};
    for (const d of DRAFT_ORDER) m[d] = [];
    for (const pk of mockPicks) m[pk.drafter]?.push(pk);
    return m;
  }, [mockPicks]);

  const grid = useMemo(() => {
    const g: (MockPick | null)[][] = Array.from({ length: TOTAL_ROUNDS }, () => new Array(TEAM_COUNT).fill(null));
    for (const pk of mockPicks) {
      const ti = DRAFT_ORDER.indexOf(pk.drafter);
      if (ti >= 0) g[pk.round - 1][ti] = pk;
    }
    return g;
  }, [mockPicks]);

  if (loading) return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-4 text-xl font-bold text-white">Mock Draft</h1>
      <p className="text-[13px] text-slate-600">Loading player data…</p>
    </div>
  );

  const myPicks = byDrafter[MY_NAME] ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-5">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Mock Draft Simulator</h1>
          <p className="mt-0.5 text-[12px] text-slate-500">
            Each team drafted using historical position timing &amp; live ADP. Snake draft, 24 rounds.
          </p>
        </div>
        <button
          onClick={() => setSeed((s) => {
            const next = s + 1;
            try { localStorage.setItem("mockDraftSeed", String(next)); } catch {}
            return next;
          })}
          className="rounded border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
        >
          ↻ Re-Simulate
        </button>
      </div>

      {/* ── Your Picks ── */}
      <div className="mb-4 rounded-lg border border-orange-600/30 bg-orange-600/5 p-4">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-orange-500">
          Your Projected Picks (Luke)
        </h2>
        <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {myPicks.map((pk) => (
            <div key={pk.overall} className="flex items-center gap-2 text-[12px]">
              <span className="w-6 shrink-0 font-mono text-slate-600">{pk.round}</span>
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${badge(pk.pos)}`}>{pk.pos}</span>
              <span className="truncate text-slate-200">{pk.player.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Draft Board Table ── */}
      <div className="mb-4 rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-3 py-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Full Draft Board</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]" style={{ minWidth: "1080px" }}>
            <thead className="border-b border-border text-[10px] uppercase tracking-wider text-slate-600">
              <tr>
                <th className="w-8 px-2 py-2 text-left font-medium">Rd</th>
                {DRAFT_ORDER.map((d) => (
                  <th key={d} className={`px-1 py-2 text-left font-medium ${d === MY_NAME ? "text-orange-500" : ""}`}>
                    {d}{d === MY_NAME ? " ★" : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((row, ri) => (
                <tr key={ri} className={`border-b border-border/20 ${ri % 2 === 1 ? "bg-white/[0.01]" : ""}`}>
                  <td className="px-2 py-1 font-mono text-slate-600">{ri + 1}</td>
                  {row.map((pk, ti) => {
                    const d = DRAFT_ORDER[ti];
                    const isMe = d === MY_NAME;
                    return (
                      <td key={ti} className={`px-1 py-1 ${isMe ? "bg-orange-600/5" : ""}`}>
                        {pk ? (
                          <div>
                            <div
                              className={`truncate leading-tight font-medium ${isMe ? "text-orange-300" : "text-slate-300"}`}
                              style={{ maxWidth: "96px" }}
                            >
                              {pk.player.name.split(" ").slice(-1)[0]}
                            </div>
                            <span className={`rounded px-1 text-[8px] font-bold leading-tight ${badge(pk.pos)}`}>
                              {pk.pos}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-800">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Projected Results ── */}
      {projections.length > 0 && (
        <div className="mb-4 rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-3 py-2 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Projected Results</h2>
            <span className="text-[11px] text-slate-600">rank 1–10 per category based on drafted roster</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]" style={{ minWidth: "900px" }}>
              <thead className="border-b border-border text-[10px] uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left font-medium w-8">Proj</th>
                  <th className="px-3 py-2 text-left font-medium">Team</th>
                  <th className="px-2 py-2 text-center font-medium">Score</th>
                  {ALL_CATS.map((c) => (
                    <th key={c} className="px-1.5 py-2 text-center font-medium">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projections.map((t, i) => {
                  const isMe = t.drafter === MY_NAME;
                  return (
                    <tr key={t.drafter} className={`border-b border-border/20 ${isMe ? "bg-orange-600/5" : i % 2 === 1 ? "bg-white/[0.01]" : ""}`}>
                      <td className={`px-3 py-1.5 font-mono font-bold text-center ${i === 0 ? "text-orange-500" : i <= 2 ? "text-sky-400" : i >= 7 ? "text-red-400/70" : "text-slate-400"}`}>
                        {i + 1}
                      </td>
                      <td className={`px-3 py-1.5 font-medium ${isMe ? "text-orange-400" : "text-slate-300"}`}>
                        {t.drafter}{isMe ? " ★" : ""}
                      </td>
                      <td className="px-2 py-1.5 text-center font-mono text-slate-500 text-[10px]">{t.totalRank}</td>
                      {ALL_CATS.map((c) => {
                        const rank = t.ranks[c];
                        const color = rank === 1 ? "text-orange-500 font-bold"
                          : rank <= 3 ? "text-sky-400"
                          : rank >= 8 ? "text-red-400/60"
                          : "text-slate-400";
                        return (
                          <td key={c} className={`px-1.5 py-1.5 text-center font-mono ${color}`}>
                            {rank}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-border text-[10px] text-slate-600">
                <tr>
                  <td colSpan={3} />
                  {ALL_CATS.map((c) => (
                    <td key={c} className="px-1.5 py-1.5 text-center">
                      {projections.find((t) => t.ranks[c] === 1)?.drafter.slice(0, 4)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="px-3 py-2 text-[10px] text-slate-700">
            Score = sum of category ranks (lower is better). Rate stats (AVG, ERA, WHIP) weighted by projected plate appearances / innings.
          </p>
        </div>
      )}

      {/* ── Projected Rosters ── */}
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Projected Rosters</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {DRAFT_ORDER.map((drafter) => {
          const isMe = drafter === MY_NAME;
          const picks = byDrafter[drafter] ?? [];
          const batters = picks.filter((p) => !PITCHER_POS.has(p.pos));
          const pitchers = picks.filter((p) => PITCHER_POS.has(p.pos));
          return (
            <div key={drafter} className={`rounded-lg border p-3 ${
              isMe ? "border-orange-600/30 bg-orange-600/5" : "border-border bg-surface"
            }`}>
              <div className={`mb-2 text-[11px] font-bold uppercase tracking-wide ${
                isMe ? "text-orange-500" : "text-slate-400"
              }`}>
                {drafter}{isMe ? " ★" : ""}
              </div>

              {/* Batting */}
              <div className="mb-1.5 space-y-0.5">
                {batters.map((pk) => (
                  <div key={pk.overall} className="flex items-center gap-1 text-[10px]">
                    <span className={`w-7 shrink-0 rounded px-1 text-[8px] font-bold ${badge(pk.pos)}`}>{pk.pos}</span>
                    <span className={`truncate ${isMe ? "text-orange-300/80" : "text-slate-400"}`}>
                      {pk.player.name}
                    </span>
                  </div>
                ))}
              </div>

              {/* Divider */}
              {batters.length > 0 && pitchers.length > 0 && (
                <div className="my-1 border-t border-border/40" />
              )}

              {/* Pitching */}
              <div className="space-y-0.5">
                {pitchers.map((pk) => (
                  <div key={pk.overall} className="flex items-center gap-1 text-[10px]">
                    <span className={`w-7 shrink-0 rounded px-1 text-[8px] font-bold ${badge(pk.pos)}`}>{pk.pos}</span>
                    <span className={`truncate ${isMe ? "text-orange-300/80" : "text-slate-400"}`}>
                      {pk.player.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
