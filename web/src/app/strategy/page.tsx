"use client";

import { useState, useEffect, useMemo } from "react";
import type { Player } from "@/lib/data";

// ── Constants ─────────────────────────────────────────────────────────────────

const MY_PICK = 3;   // Luke's draft position (1-indexed)
const TEAM_COUNT = 10;
const TOTAL_ROUNDS = 24;
const DRAFT_ORDER = ["Zach", "Ricky", "Luke", "Roger", "Ethan", "Fitzy", "Dan", "Tim", "JB", "Joel"];
const MY_NAME = "Luke";

// Category weights (from league history)
const CAT_WEIGHTS: Record<string, number> = {
  TB: 0.114, HR: 0.108, R: 0.100, RBI: 0.099, H: 0.083,
  W: 0.072, K: 0.070, WHIP: 0.062, QS: 0.060, ERA: 0.057,
  SB: 0.046, BB: 0.035, AVG: 0.034, L: 0.033, HD: 0.025, SV: 0.002,
};

const NEGATIVE_CATS = new Set(["ERA", "WHIP", "L"]);

interface DraftProfile {
  team: string;
  seasons: number;
  firstSp: number;
  firstRp: number;
  firstC: number;
  firstSs: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function myPicksForRound(round: number): number {
  // 1-indexed round, returns overall pick number (1-indexed)
  const roundIdx = round - 1;
  const pickInRound = roundIdx % 2 === 0
    ? MY_PICK - 1                        // odd rounds: forward
    : TEAM_COUNT - MY_PICK;              // even rounds: reversed
  return roundIdx * TEAM_COUNT + pickInRound + 1;
}

function urgencyColor(round: number) {
  if (round <= 4)  return "text-sky-600";
  if (round <= 8)  return "text-emerald-600";
  if (round <= 15) return "text-orange-600";
  return "text-slate-500";
}

// ── Component ─────────────────────────────────────────────────────────────────

const POSITIONS = ["C", "1B", "2B", "3B", "SS", "OF", "SP", "RP"] as const;

export default function StrategyPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [profiles, setProfiles] = useState<DraftProfile[]>([]);
  const [espnData, setEspnData] = useState<Record<string, { adp: number | null; primaryPos: string | null }>>({});

  useEffect(() => {
    fetch("/api/rankings").then((r) => r.json()).then(setPlayers);
    fetch("/api/profiles").then((r) => r.json()).then(setProfiles);
    fetch("/api/espn-adp").then((r) => r.json()).then((d) => { if (!d.error) setEspnData(d); });
  }, []);

  // Deduplicate
  const dedupedPlayers = useMemo(() => {
    const seen = new Set<string>();
    return players.filter((p) => { if (seen.has(p.name)) return false; seen.add(p.name); return true; });
  }, [players]);

  // My pick numbers for each round
  const myPicks = useMemo(() =>
    Array.from({ length: TOTAL_ROUNDS }, (_, i) => ({
      round: i + 1,
      overall: myPicksForRound(i + 1),
    })),
  []);

  // Value board: our rank vs ADP/ESPN — positive = undervalued by market
  const valueBoard = useMemo(() => {
    return dedupedPlayers
      .filter((p) => p.espnRank !== undefined && p.espnRank < 999)
      .map((p) => ({
        player: p,
        ourRank: p.rank,
        adp: p.espnRank ?? p.rank,   // espnRank is the ADP-based rank we have
        valueDiff: (p.espnRank ?? p.rank) - p.rank,  // positive = we rank higher than market
        farBonus: p.zTotal,
      }))
      .sort((a, b) => b.valueDiff - a.valueDiff);
  }, [dedupedPlayers]);

  const undervalued = valueBoard.filter((v) => v.valueDiff >= 15).slice(0, 12);
  const overvalued  = valueBoard.filter((v) => v.valueDiff <= -20).slice(0, 8);

  // Value picks by position — best undervalued player at each spot using live ADP
  const espnLoaded = Object.keys(espnData).length > 0;
  const valueByPosition = useMemo(() => {
    if (!espnLoaded) return [];
    return POSITIONS.map((pos) => {
      const atPos = dedupedPlayers
        .filter((p) => (espnData[p.name]?.primaryPos ?? p.pos) === pos)
        .map((p) => {
          const adp = espnData[p.name]?.adp;
          const edge = adp != null ? adp - p.rank : (p.espnRank ?? p.rank) - p.rank;
          return { player: p, adp, edge };
        })
        .filter((v) => v.edge > 0)
        .sort((a, b) => b.edge - a.edge);
      return { pos, picks: atPos.slice(0, 3) };
    });
  }, [dedupedPlayers, espnData, espnLoaded]);

  // Opponent positional timing — league averages
  const leagueAvg = useMemo(() => {
    const others = profiles.filter((p) => p.team !== MY_NAME);
    if (others.length === 0) return null;
    const avg = (key: keyof DraftProfile) => {
      const vals = others.map((p) => p[key] as number).filter((v) => v > 0);
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };
    return { firstSp: avg("firstSp"), firstRp: avg("firstRp"), firstC: avg("firstC"), firstSs: avg("firstSs") };
  }, [profiles]);

  // Top categories by weight (batting vs pitching)
  const topBatCats = Object.entries(CAT_WEIGHTS)
    .filter(([k]) => ["H","R","HR","TB","RBI","BB","SB","AVG"].includes(k))
    .sort(([,a],[,b]) => b - a);
  const topPitCats = Object.entries(CAT_WEIGHTS)
    .filter(([k]) => ["K","QS","W","L","SV","HD","ERA","WHIP"].includes(k))
    .sort(([,a],[,b]) => b - a);

  // Positional timing recommendations based on avg opponent behavior
  const posTimings = leagueAvg ? [
    {
      pos: "SP",
      avgRound: leagueAvg.firstSp,
      rec: leagueAvg.firstSp >= 4
        ? `Opponents average their first SP in round ${leagueAvg.firstSp.toFixed(1)}. Safe to wait until round 4-5 for your first starter.`
        : `Opponents go SP early (avg round ${leagueAvg.firstSp.toFixed(1)}). Don't wait past round 3.`,
      urgency: leagueAvg.firstSp <= 3 ? "high" : leagueAvg.firstSp <= 5 ? "medium" : "low",
    },
    {
      pos: "C",
      avgRound: leagueAvg.firstC,
      rec: leagueAvg.firstC >= 6
        ? `Catchers usually go in round ${leagueAvg.firstC.toFixed(1)}. Cal Raleigh is a genuine top-10 pick — take him early or wait for round 7-8.`
        : `League grabs C early (avg round ${leagueAvg.firstC.toFixed(1)}). Don't let Cal Raleigh slip past round 4.`,
      urgency: leagueAvg.firstC <= 5 ? "high" : "medium",
    },
    {
      pos: "RP",
      avgRound: leagueAvg.firstRp,
      rec: `Opponents average first RP in round ${leagueAvg.firstRp.toFixed(1)}. SV is the weakest category predictor (0.2% weight) — delay RP until rounds 10+.`,
      urgency: "low",
    },
    {
      pos: "SS",
      avgRound: leagueAvg.firstSs,
      rec: leagueAvg.firstSs <= 4
        ? `SS goes early in this league (avg round ${leagueAvg.firstSs.toFixed(1)}). Bobby Witt Jr. is the consensus pick. Grab him if he falls to you.`
        : `SS usually goes in round ${leagueAvg.firstSs.toFixed(1)}. Francisco Lindor is deep value if top SS go early.`,
      urgency: leagueAvg.firstSs <= 4 ? "high" : "medium",
    },
  ] : [];

  const urgencyBadge = (u: string) =>
    u === "high"   ? "bg-red-500/15 text-red-600" :
    u === "medium" ? "bg-orange-600/15 text-orange-600" :
                     "bg-slate-500/10 text-slate-500";

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Draft Strategy — Pick {MY_PICK}</h1>

      {/* ── Two-column layout ─────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">

          {/* ── Your pick cadence ───────────────────────────────────────── */}
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-slate-500">
              Your Pick Cadence — Snake Draft
            </h2>
            <p className="mb-3 text-[12px] text-slate-500">
              Pick 3 means you miss the top 2 but land a true elite player. The real challenge is the
              long wait between rounds (e.g. picks 3→18, 23→38). Plan 2 picks ahead each time.
            </p>
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-12">
              {myPicks.map(({ round, overall }) => (
                <div key={round} className="rounded bg-white/[0.04] px-2 py-1.5 text-center">
                  <div className="text-[9px] text-slate-400">Rd {round}</div>
                  <div className={`font-mono text-[12px] font-bold ${urgencyColor(round)}`}>
                    #{overall}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Undervalued picks ───────────────────────────────────────── */}
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-1 text-[12px] font-semibold uppercase tracking-wider text-slate-500">
              Value Picks — We Rank Higher Than the Market
            </h2>
            <p className="mb-3 text-[12px] text-slate-500">
              These players are being drafted later than our z-score/FAR model says they should be.
              Target them in later rounds rather than reaching early.
            </p>
            {undervalued.length === 0 ? (
              <p className="text-[12px] text-slate-400">Loading ESPN ADP data…</p>
            ) : (
              <table className="w-full text-[12px]">
                <thead className="border-b border-border text-[10px] uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="pb-1.5 text-left font-medium">Player</th>
                    <th className="pb-1.5 text-center font-medium">Our Rank</th>
                    <th className="pb-1.5 text-center font-medium">ESPN Rank</th>
                    <th className="pb-1.5 text-center font-medium">Edge</th>
                    <th className="pb-1.5 text-right font-medium">zScore</th>
                  </tr>
                </thead>
                <tbody>
                  {undervalued.map(({ player, ourRank, adp, valueDiff }) => (
                    <tr key={player.name} className="border-b border-border">
                      <td className="py-1 font-medium text-slate-400">{player.name}
                        <span className="ml-1.5 text-[10px] text-slate-600">{player.team}</span>
                      </td>
                      <td className="py-1 text-center font-mono text-sky-600">{ourRank}</td>
                      <td className="py-1 text-center font-mono text-slate-500">{adp}</td>
                      <td className="py-1 text-center font-mono font-bold text-emerald-600">+{valueDiff}</td>
                      <td className="py-1 text-right font-mono text-slate-500">{player.zTotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* ── Overvalued alerts ───────────────────────────────────────── */}
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-1 text-[12px] font-semibold uppercase tracking-wider text-slate-500">
              Avoid Reaching — Market Overvalues These Players
            </h2>
            <p className="mb-3 text-[12px] text-slate-500">
              The ESPN/ADP consensus takes these players significantly earlier than our model says they're worth.
              Let them go and find better value elsewhere.
            </p>
            {overvalued.length === 0 ? (
              <p className="text-[12px] text-slate-400">Loading…</p>
            ) : (
              <table className="w-full text-[12px]">
                <thead className="border-b border-border text-[10px] uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="pb-1.5 text-left font-medium">Player</th>
                    <th className="pb-1.5 text-center font-medium">Our Rank</th>
                    <th className="pb-1.5 text-center font-medium">ESPN Rank</th>
                    <th className="pb-1.5 text-center font-medium">Gap</th>
                    <th className="pb-1.5 text-right font-medium">zScore</th>
                  </tr>
                </thead>
                <tbody>
                  {overvalued.map(({ player, ourRank, adp, valueDiff }) => (
                    <tr key={player.name} className="border-b border-border">
                      <td className="py-1 font-medium text-slate-400">{player.name}
                        <span className="ml-1.5 text-[10px] text-slate-600">{player.team}</span>
                      </td>
                      <td className="py-1 text-center font-mono text-slate-500">{ourRank}</td>
                      <td className="py-1 text-center font-mono text-sky-600">{adp}</td>
                      <td className="py-1 text-center font-mono font-bold text-red-600">{valueDiff}</td>
                      <td className="py-1 text-right font-mono text-slate-500">{player.zTotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* ── Value picks by position ─────────────────────────────────── */}
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-1 text-[12px] font-semibold uppercase tracking-wider text-slate-500">
              Value Picks by Position
            </h2>
            <p className="mb-3 text-[12px] text-slate-500">
              Best undervalued player at each position — our rank vs live ESPN ADP. Edge = picks you gain by waiting.
            </p>
            {!espnLoaded ? (
              <p className="text-[12px] text-slate-400">Loading ESPN ADP data…</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {valueByPosition.map(({ pos, picks }) => (
                  <div key={pos} className="rounded border border-border/60 bg-black/[0.03] p-2.5">
                    <div className="mb-2 text-[11px] font-bold text-gray-900">{pos}</div>
                    {picks.length === 0 ? (
                      <div className="text-[11px] text-slate-400">No clear value</div>
                    ) : (
                      <div className="space-y-2">
                        {picks.map(({ player, adp, edge }) => (
                          <div key={player.name} className="space-y-0.5">
                            <div className="truncate text-[11px] font-medium text-slate-400">{player.name}</div>
                            <div className="flex items-center gap-2 text-[10px]">
                              <span className="text-slate-600">Our #{player.rank}</span>
                              <span className="text-slate-400">·</span>
                              <span className="text-slate-600">
                                ADP {adp != null ? adp.toFixed(1) : `#${player.espnRank}`}
                              </span>
                              <span className="ml-auto font-mono font-bold text-emerald-600">
                                +{Math.round(edge)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>

        {/* ── Right column ──────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Positional timing */}
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-slate-500">
              Positional Timing
            </h2>
            {posTimings.length === 0 ? (
              <p className="text-[12px] text-slate-400">Loading opponent profiles…</p>
            ) : (
              <div className="space-y-3">
                {posTimings.map((t) => (
                  <div key={t.pos} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-8 text-[12px] font-bold text-gray-900">{t.pos}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${urgencyBadge(t.urgency)}`}>
                        {t.urgency}
                      </span>
                      <span className="ml-auto font-mono text-[11px] text-slate-600">
                        avg Rd {t.avgRound.toFixed(1)}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-500">{t.rec}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Category priorities */}
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-slate-500">
              Category Priorities
            </h2>
            <div className="mb-3">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Batting</div>
              <div className="space-y-1">
                {topBatCats.map(([cat, w]) => (
                  <div key={cat} className="flex items-center gap-2">
                    <span className={`w-10 text-[11px] font-bold ${NEGATIVE_CATS.has(cat) ? "text-slate-500" : "text-slate-600"}`}>{cat}</span>
                    <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-sky-500" style={{ width: `${(w / 0.114) * 100}%` }} />
                    </div>
                    <span className="w-10 text-right font-mono text-[10px] text-slate-600">{(w * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-border/40 pt-3">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Pitching</div>
              <div className="space-y-1">
                {topPitCats.map(([cat, w]) => (
                  <div key={cat} className="flex items-center gap-2">
                    <span className={`w-10 text-[11px] font-bold ${NEGATIVE_CATS.has(cat) ? "text-slate-500" : "text-slate-600"}`}>{cat}</span>
                    <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-orange-600" style={{ width: `${(w / 0.072) * 100}%` }} />
                    </div>
                    <span className="w-10 text-right font-mono text-[10px] text-slate-600">{(w * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-slate-400">
                SV (0.2%) is the weakest predictor in this league by far. Do not reach for closers.
              </p>
            </div>
          </section>

          {/* Quick principles */}
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-slate-500">
              Key Principles
            </h2>
            <ul className="space-y-2 text-[11px] text-slate-500">
              <li><span className="text-orange-600 font-bold">TB & HR first.</span> The two most predictive stats in this league. Prioritize power hitters in rounds 1-4.</li>
              <li><span className="text-orange-600 font-bold">Pick 3 advantage.</span> Aaron Judge and Shohei Ohtani likely gone at 1-2. Juan Soto / Bobby Witt Jr. are the most likely targets. Both project elite TB+HR.</li>
              <li><span className="text-orange-600 font-bold">Delay closers.</span> SV predicts wins less than any other category (0.2%). Let others reach for closers; pick one late.</li>
              <li><span className="text-orange-600 font-bold">Cal Raleigh is worth a reach.</span> Elite catcher bats are rare. His z-score and FAR both show genuine starter-level value. Round 4-5 is not too early.</li>
              <li><span className="text-orange-600 font-bold">W and K matter more than ERA.</span> Wins (7.2%) and strikeouts (7.0%) are the top pitching categories. ERA (5.7%) matters less than people think.</li>
              <li><span className="text-orange-600 font-bold">Trust the FAR column.</span> When two players have similar z-scores, the one with higher FAR is harder to replace from the waiver wire.</li>
            </ul>
          </section>

        </div>
      </div>
    </div>
  );
}
