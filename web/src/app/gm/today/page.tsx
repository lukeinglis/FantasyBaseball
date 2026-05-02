"use client";

const IL_INJURY_STATUSES = new Set(["SEVEN_DAY_DL", "TEN_DAY_DL", "FIFTEEN_DAY_DL", "SIXTY_DAY_DL", "OUT"]);
function isOnIL(status: string): boolean { return IL_INJURY_STATUSES.has(status); }

import { useState, useEffect, useMemo } from "react";

interface RosterPlayer {
  name: string;
  pos: string;
  slotLabel: string;
  slotId: number;
  injuryStatus: string;
  injuryLabel: string;
  injuryColor: string;
  proTeam: string;
}

interface EspnTeam {
  id: number;
  name: string;
  roster: RosterPlayer[];
}

interface TeamSchedule {
  todayOpponent: string | null;
  todayTime: string | null;
  todayProbable: string | null;
  todayVenue: string | null;
  weekGames: number;
  isHome: boolean | null;
}

interface WeatherData {
  temp: number | null;
  condition: string | null;
  rainChance: number | null;
  icon: string;
}

const BATTER_SLOTS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 12]);
const PITCHER_SLOTS = new Set([13, 14, 15]);
const BENCH_SLOT = 16;


function weatherIcon(condition: string | null, rainChance: number | null): { icon: string; color: string; label: string } {
  if (rainChance !== null && rainChance >= 60) return { icon: "!", color: "text-red-600 bg-red-50 border-red-200", label: `${rainChance}% rain` };
  if (rainChance !== null && rainChance >= 30) return { icon: "~", color: "text-orange-600 bg-orange-50 border-orange-200", label: `${rainChance}% rain` };
  return { icon: "", color: "", label: "" };
}

function EspnSetupCard() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-surface px-8 py-10 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-orange-600/60">Setup Required</div>
      <div className="mt-3 text-xl font-bold text-gray-900">Connect ESPN Credentials</div>
    </div>
  );
}

interface BvpStats {
  summary: string;
  atBats: number;
  hits: number;
  homeRuns: number;
  avg: string;
}

interface AdvisorRec {
  type: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

interface MatchupCat {
  cat: string;
  myValue: number | null;
  oppValue: number | null;
  result: "WIN" | "LOSS" | "TIE" | "PENDING";
}

interface MatchupSnapshot {
  myWins: number;
  myLosses: number;
  myTies: number;
  oppTeamName: string;
  categories: MatchupCat[];
  matchupEndDate: string | null;
}

interface MatchupPlayerLocal {
  name: string;
  stats: Record<string, number>;
}

import { CATEGORY_WEIGHTS, LOWER_IS_BETTER, isPunt } from "@/lib/category-weights";

export function sanitizeNum(val: unknown): number {
  if (typeof val !== "number" || !Number.isFinite(val)) return 0;
  return val;
}

export function scoreActionItem(
  stats: Record<string, number>,
  atRiskCats: string[],
  lowerIsBetter: ReadonlySet<string> = LOWER_IS_BETTER,
  weights: Record<string, number> = CATEGORY_WEIGHTS,
): number {
  let total = 0;
  for (const cat of atRiskCats) {
    const val = sanitizeNum(stats[cat]);
    const w = weights[cat] ?? 1;
    if (lowerIsBetter.has(cat)) {
      total -= val * w;
    } else {
      total += val * w;
    }
  }
  return total;
}

function fmtCatVal(cat: string, val: number | null): string {
  if (typeof val !== "number" || !Number.isFinite(val)) return "-";
  if (cat === "AVG") return val.toFixed(3);
  if (cat === "ERA" || cat === "WHIP") return val.toFixed(2);
  return String(Math.round(val));
}

export default function TodayPage() {
  const [teams, setTeams] = useState<EspnTeam[]>([]);
  const [schedule, setSchedule] = useState<Record<string, TeamSchedule>>({});
  const [probableNames, setProbableNames] = useState<Set<string>>(new Set());
  const [bvpData, setBvpData] = useState<Record<string, BvpStats | null>>({});
  const [advisorRecs, setAdvisorRecs] = useState<AdvisorRec[]>([]);
  const [matchupSnapshot, setMatchupSnapshot] = useState<MatchupSnapshot | null>(null);
  const [myTeamId, setMyTeamId] = useState<number | null>(null);
  const [matchupRoster, setMatchupRoster] = useState<MatchupPlayerLocal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [matchupEndDate, setMatchupEndDate] = useState<string | null>(null);

  // Phase 1: fetch roster, matchup, probables
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);

    Promise.all([
      fetch("/api/espn/roster").then((r) => r.json()),
      fetch("/api/espn/matchup").then((r) => r.json()).catch(() => ({})),
      fetch(`/api/mlb/probable-pitchers?startDate=${today}&endDate=${today}`).then((r) => r.json()).catch(() => null),
    ]).then(([rosterData, matchupData, probableData]) => {
      if (rosterData.error) { setError(rosterData.error); setLoading(false); return; }
      setTeams(rosterData);
      if (matchupData.myTeamId) setMyTeamId(matchupData.myTeamId);
      if (matchupData.matchupEndDate) setMatchupEndDate(matchupData.matchupEndDate);
      if (matchupData.categories) {
        setMatchupSnapshot({
          myWins: matchupData.myWins ?? 0,
          myLosses: matchupData.myLosses ?? 0,
          myTies: matchupData.myTies ?? 0,
          oppTeamName: matchupData.oppTeamName ?? "Opponent",
          categories: matchupData.categories,
          matchupEndDate: matchupData.matchupEndDate,
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (Array.isArray(matchupData.myRoster)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setMatchupRoster((matchupData.myRoster as any[]).map((p: any) => ({
          name: p.name ?? "",
          stats: p.stats ?? {},
        })));
      }
      if (probableData?.allStarts) {
        setProbableNames(new Set(probableData.allStarts.map((s: any) => s.pitcherName)));
      }
    })
    .catch(() => setError("FETCH_FAILED"));
  }, []);

  // Phase 2: once we know the matchup end date, fetch schedule with correct range
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const endDate = matchupEndDate ?? (() => {
      const d = new Date(); d.setDate(d.getDate() + 6); return d.toISOString().slice(0, 10);
    })();

    fetch(`/api/mlb/schedule?startDate=${today}&endDate=${endDate}`)
      .then((r) => r.json())
      .then((schedData) => { if (!schedData.error) setSchedule(schedData); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [matchupEndDate]);

  // Fetch advisor recommendations
  useEffect(() => {
    fetch("/api/analysis/advisor")
      .then((r) => r.json())
      .then((d) => { if (d.recommendations) setAdvisorRecs(d.recommendations); })
      .catch(() => {});
  }, []);

  const myTeam = useMemo(() => {
    if (!teams.length) return null;
    if (myTeamId) return teams.find((t) => t.id === myTeamId) ?? teams[0];
    return teams[0];
  }, [teams, myTeamId]);

  const roster = myTeam?.roster ?? [];
  const getGame = (p: RosterPlayer) => schedule[p.proTeam] ?? null;

  // Fetch batter vs pitcher career stats once we have roster + schedule
  useEffect(() => {
    if (!myTeam || Object.keys(schedule).length === 0) return;

    const batters = myTeam.roster.filter((p) => BATTER_SLOTS.has(p.slotId) || p.slotId === BENCH_SLOT);
    const matchups: { batter: string; pitcher: string }[] = [];

    for (const b of batters) {
      const game = schedule[b.proTeam];
      if (game?.todayProbable) {
        matchups.push({ batter: b.name, pitcher: game.todayProbable });
      }
    }

    if (matchups.length === 0) return;

    fetch(`/api/mlb/bvp?matchups=${encodeURIComponent(JSON.stringify(matchups))}`)
      .then((r) => r.json())
      .then((data) => { if (!data.error) setBvpData(data); })
      .catch(() => {});
  }, [myTeam, schedule]);

  // Categorize all players
  const activeBatters = useMemo(() => roster.filter((p) => BATTER_SLOTS.has(p.slotId)), [roster]);
  const activePitchers = useMemo(() => roster.filter((p) => PITCHER_SLOTS.has(p.slotId)), [roster]);
  const benchPlayers = useMemo(() => roster.filter((p) => p.slotId === BENCH_SLOT), [roster]);
  const ilPlayers = useMemo(() => roster.filter((p) => isOnIL(p.injuryStatus)), [roster]);

  // Split by game status
  const allActive = useMemo(() => [...activeBatters, ...activePitchers], [activeBatters, activePitchers]);
  const playing = useMemo(() => allActive.filter((p) => getGame(p)?.todayOpponent), [allActive, schedule]);
  const off = useMemo(() => allActive.filter((p) => !getGame(p)?.todayOpponent), [allActive, schedule]);
  const benchWithGames = useMemo(() => benchPlayers.filter((p) => getGame(p)?.todayOpponent), [benchPlayers, schedule]);

  // Identify at-risk and targetable categories
  const categoryAlerts = useMemo(() => {
    if (!matchupSnapshot) return { atRisk: [] as MatchupCat[], targets: [] as MatchupCat[], score: "" };
    const cats = matchupSnapshot.categories;
    const atRisk = cats.filter(c => {
      if (c.result !== "WIN" || c.myValue === null || c.oppValue === null) return false;
      const gap = LOWER_IS_BETTER.has(c.cat) ? c.oppValue - c.myValue : c.myValue - c.oppValue;
      const threshold = LOWER_IS_BETTER.has(c.cat) ? 0.5 : (["AVG"].includes(c.cat) ? 0.005 : 3);
      return gap < threshold && gap >= 0;
    });
    const targets = cats.filter(c => {
      if (c.result !== "LOSS" || c.myValue === null || c.oppValue === null) return false;
      const gap = LOWER_IS_BETTER.has(c.cat) ? c.myValue - c.oppValue : c.oppValue - c.myValue;
      const threshold = LOWER_IS_BETTER.has(c.cat) ? 0.5 : (["AVG"].includes(c.cat) ? 0.010 : 5);
      return gap < threshold && gap >= 0;
    });
    const score = `${matchupSnapshot.myWins}-${matchupSnapshot.myLosses}${matchupSnapshot.myTies > 0 ? `-${matchupSnapshot.myTies}` : ""}`;
    return { atRisk, targets, score };
  }, [matchupSnapshot]);

  // Categories we're currently losing — used to rank action items
  const atRiskCats = useMemo(() => {
    if (!matchupSnapshot) return [] as string[];
    return matchupSnapshot.categories
      .filter(c => c.result === "LOSS" && !isPunt(c.cat))
      .map(c => c.cat);
  }, [matchupSnapshot]);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading today...</div>;
  if (error === "ESPN_CREDS_MISSING") {
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnSetupCard /></div>;
  }
  if (error || !myTeam) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load</div>
        <div className="text-[12px] text-slate-500">{error}</div>
      </div>
    );
  }

  const GamePlayerRow = ({ player, showBenchAlert }: { player: RosterPlayer; showBenchAlert?: boolean }) => {
    const game = getGame(player);
    const hasGame = !!game?.todayOpponent;
    const isInjured = player.injuryStatus !== "ACTIVE";
    const isBatter = BATTER_SLOTS.has(player.slotId) || (player.slotId === BENCH_SLOT && !["SP", "RP"].includes(player.pos));

    return (
      <div className={`border-b border-border px-4 py-2.5 ${showBenchAlert ? "bg-orange-50" : ""}`}>
        <div className="flex items-center gap-3">
          {/* Slot + Name */}
          <span className="w-7 shrink-0 text-[10px] font-bold text-slate-500">{player.slotLabel}</span>
          <div className="min-w-0 w-[150px]">
            <span className={`text-[13px] font-medium ${isInjured ? "text-slate-400" : "text-slate-700"}`}>
              {player.name}
            </span>
            <div className="text-[10px] text-slate-500">{player.pos} · {player.proTeam}</div>
          </div>

          {/* Game details */}
          {hasGame ? (
            <div className="flex-1 flex items-center gap-4">
              {/* Opponent */}
              <div className="w-[70px] shrink-0">
                <span className="text-[13px] font-semibold text-slate-700">{game!.todayOpponent}</span>
              </div>

              {/* Time */}
              <div className="w-[65px] shrink-0">
                <span className="text-[12px] text-slate-600">{game!.todayTime}</span>
              </div>

              {/* Probable starter + BvP career stats */}
              {isBatter && game!.todayProbable && (
                <div className="flex-1 min-w-0">
                  <div>
                    <span className="text-[10px] text-slate-400">vs </span>
                    <span className="text-[11px] text-slate-600">{game!.todayProbable}</span>
                  </div>
                  {(() => {
                    const key = `${player.name}__${game!.todayProbable}`;
                    const bvp = bvpData[key];
                    if (!bvp) return null;
                    return (
                      <div className={`text-[10px] font-mono tabular-nums ${
                        parseFloat(bvp.avg) >= .300 ? "text-emerald-600" :
                        parseFloat(bvp.avg) >= .200 ? "text-slate-600" : "text-red-600"
                      }`}>
                        {bvp.summary}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Venue */}
              {game!.todayVenue && (
                <span className="hidden lg:block text-[10px] text-slate-400 shrink-0">{game!.todayVenue}</span>
              )}
            </div>
          ) : (
            <div className="flex-1">
              <span className="text-[11px] text-slate-400">No game</span>
            </div>
          )}

          {/* Games this week */}
          {game && (
            <span className={`shrink-0 text-[10px] tabular-nums font-semibold ${
              game.weekGames >= 5 ? "text-emerald-600" :
              game.weekGames >= 3 ? "text-orange-600" : "text-slate-500"
            }`}>{game.weekGames}G</span>
          )}

          {/* Injury */}
          {isInjured && (
            <span className={`shrink-0 text-[10px] font-bold ${player.injuryColor}`}>{player.injuryLabel}</span>
          )}

          {/* Bench alert */}
          {showBenchAlert && hasGame && (
            <span className="shrink-0 text-[9px] font-bold text-orange-600 border border-orange-300 rounded px-1.5 py-0.5">
              BENCH
            </span>
          )}
        </div>
      </div>
    );
  };

  // Check if a pitcher is a probable starter today (by name match)
  const isProbableStarter = (name: string): boolean => {
    if (probableNames.has(name)) return true;
    // Case-insensitive fallback
    const lower = name.toLowerCase();
    for (const pn of probableNames) {
      if (pn.toLowerCase() === lower) return true;
    }
    return false;
  };

  // Sort playing players: batters first (by slot), then pitchers
  const playingBatters = playing.filter((p) => BATTER_SLOTS.has(p.slotId)).sort((a, b) => a.slotId - b.slotId);
  const playingPitchers = playing.filter((p) => PITCHER_SLOTS.has(p.slotId)).sort((a, b) => a.slotId - b.slotId);

  // Split pitchers:
  // - "Starting Today" = SPs who are the probable starter today
  // - "Relief Pitchers" = actual RPs (pos=RP) with games
  // - SPs who have a game but aren't starting → they go to "Off" (they won't pitch)
  const startingToday = playingPitchers.filter((p) => isProbableStarter(p.name));
  const relieversToday = playingPitchers.filter((p) => p.pos === "RP" && !isProbableStarter(p.name));
  const spsNotStarting = playingPitchers.filter((p) => p.pos === "SP" && !isProbableStarter(p.name));

  // Active starters with season stats (used in Today's Starters section)
  const todayStartersWithStats = [...playingBatters, ...startingToday].map(p => {
    const rosterData = matchupRoster.find(m => m.name === p.name);
    return { player: p, stats: rosterData?.stats ?? {} };
  });

  // Bench players with games, ranked by impact on at-risk categories (used in Action Items)
  const actionItems = benchWithGames
    .filter(p => !isOnIL(p.injuryStatus))
    .map(p => {
      const rosterData = matchupRoster.find(m => m.name === p.name);
      const stats = rosterData?.stats ?? {};
      const score = scoreActionItem(stats, atRiskCats);
      return { player: p, stats, score };
    })
    .sort((a, b) => b.score - a.score);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Main content */}
      <div>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Today&apos;s Games</h1>
          <span className="text-[12px] text-slate-500">{today}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className={`text-2xl font-bold tabular-nums ${(playing.length - spsNotStarting.length) > 0 ? "text-emerald-600" : "text-slate-400"}`}>
              {playing.length - spsNotStarting.length}
            </div>
            <div className="text-[9px] text-slate-500">PLAYING</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold tabular-nums text-slate-400">{off.length + spsNotStarting.length}</div>
            <div className="text-[9px] text-slate-500">OFF</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold tabular-nums text-slate-400">
              {off.length + spsNotStarting.length + benchWithGames.length}
            </div>
            <div className="text-[9px] text-slate-500">NOT IN LINEUP</div>
          </div>
        </div>
      </div>

      {/* Category Status */}
      {matchupSnapshot && (
        <div className="mb-4 rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Category Status</span>
              <span className="text-[10px] text-slate-400">vs {matchupSnapshot.oppTeamName}</span>
            </div>
            <span className={`text-[13px] font-bold tabular-nums ${matchupSnapshot.myWins > matchupSnapshot.myLosses ? "text-emerald-600" : "text-red-600"}`}>
              {categoryAlerts.score}
            </span>
          </div>
          <div className="flex flex-wrap gap-1 px-4 py-3">
            {matchupSnapshot.categories.map(c => {
              const margin = c.myValue !== null && c.oppValue !== null
                ? sanitizeNum(LOWER_IS_BETTER.has(c.cat) ? c.oppValue - c.myValue : c.myValue - c.oppValue)
                : null;
              return (
                <div key={c.cat} className={`flex flex-col items-center rounded px-2 py-1.5 min-w-[52px] ${
                  c.result === "WIN" ? "bg-emerald-50 border border-emerald-200" :
                  c.result === "LOSS" ? "bg-red-50 border border-red-200" :
                  c.result === "TIE" ? "bg-orange-50 border border-orange-200" :
                  "bg-slate-50 border border-border"
                }`}>
                  <span className={`text-[9px] font-bold mb-0.5 ${
                    c.result === "WIN" ? "text-emerald-600" :
                    c.result === "LOSS" ? "text-red-600" :
                    c.result === "TIE" ? "text-orange-600" : "text-slate-400"
                  }`}>{c.result === "PENDING" ? "-" : c.result}</span>
                  <span className="text-[10px] font-bold text-slate-700">{c.cat}</span>
                  <span className="text-[10px] font-mono tabular-nums text-slate-700">{fmtCatVal(c.cat, c.myValue)}</span>
                  <span className="text-[9px] text-slate-400 font-mono">{fmtCatVal(c.cat, c.oppValue)}</span>
                  {margin !== null && (
                    <span className={`text-[9px] font-mono tabular-nums ${margin > 0 ? "text-emerald-600" : margin < 0 ? "text-red-600" : "text-slate-400"}`}>
                      {margin > 0 ? "+" : ""}{fmtCatVal(c.cat, margin)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {(categoryAlerts.atRisk.length > 0 || categoryAlerts.targets.length > 0) && (
            <div className="border-t border-border px-4 py-2 flex gap-3 text-[10px]">
              {categoryAlerts.atRisk.length > 0 && (
                <span className="text-orange-600 font-semibold">
                  At risk: {categoryAlerts.atRisk.map(c => c.cat).join(", ")}
                </span>
              )}
              {categoryAlerts.targets.length > 0 && (
                <span className="text-emerald-600 font-semibold">
                  Targetable: {categoryAlerts.targets.map(c => c.cat).join(", ")}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Today's Starters */}
      {todayStartersWithStats.length > 0 && (
        <div className="mb-4 rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-4 py-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Today&apos;s Starters</span>
            <span className="text-[10px] text-slate-400">{todayStartersWithStats.length} active</span>
          </div>
          {todayStartersWithStats.map(({ player, stats }, i) => {
            const game = getGame(player);
            const isBatter = BATTER_SLOTS.has(player.slotId);
            return (
              <div key={i} className="border-b border-border last:border-0 px-4 py-2 flex flex-wrap items-center gap-3">
                <div className="min-w-0 w-[140px]">
                  <div className="text-[12px] font-medium text-slate-700">{player.name}</div>
                  <div className="text-[10px] text-slate-500">{player.pos} · {player.proTeam}</div>
                </div>
                <div className="w-[100px] text-[11px] text-slate-600">
                  {game?.todayOpponent ?? ""} {game?.todayTime ?? ""}
                </div>
                {isBatter ? (
                  <div className="flex gap-3 text-[10px] font-mono tabular-nums text-slate-600">
                    <span>AVG {fmtCatVal("AVG", stats.AVG ?? null)}</span>
                    <span>HR {sanitizeNum(stats.HR)}</span>
                    <span>RBI {sanitizeNum(stats.RBI)}</span>
                    <span>SB {sanitizeNum(stats.SB)}</span>
                    <span>R {sanitizeNum(stats.R)}</span>
                  </div>
                ) : (
                  <div className="flex gap-3 text-[10px] font-mono tabular-nums text-slate-600">
                    <span>ERA {fmtCatVal("ERA", stats.ERA ?? null)}</span>
                    <span>WHIP {fmtCatVal("WHIP", stats.WHIP ?? null)}</span>
                    <span>K {sanitizeNum(stats.K)}</span>
                    <span>W {sanitizeNum(stats.W)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Action Items: ranked bench players with games today */}
      {actionItems.length > 0 && (
        <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50">
          <div className="border-b border-orange-200 px-4 py-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-orange-600">Action Items</span>
            <span className="text-[10px] text-orange-400">{actionItems.length} eligible on bench</span>
          </div>
          {actionItems.map(({ player, stats, score }, i) => {
            const game = getGame(player);
            const isBatter = !["SP", "RP"].includes(player.pos);
            return (
              <div key={i} className="border-b border-orange-200 last:border-0 px-4 py-2 flex flex-wrap items-center gap-3">
                <span className="w-4 text-[10px] font-bold text-orange-500 shrink-0">{i + 1}.</span>
                <div className="min-w-0 w-[140px]">
                  <div className="text-[12px] font-medium text-slate-700">{player.name}</div>
                  <div className="text-[10px] text-slate-500">{player.pos} · {player.proTeam}</div>
                </div>
                <div className="w-[100px] text-[11px] text-slate-600">
                  {game?.todayOpponent ?? ""} {game?.todayTime ?? ""}
                </div>
                {isBatter ? (
                  <div className="flex gap-3 text-[10px] font-mono tabular-nums text-slate-600">
                    <span>AVG {fmtCatVal("AVG", stats.AVG ?? null)}</span>
                    <span>HR {sanitizeNum(stats.HR)}</span>
                    <span>RBI {sanitizeNum(stats.RBI)}</span>
                    <span>SB {sanitizeNum(stats.SB)}</span>
                  </div>
                ) : (
                  <div className="flex gap-3 text-[10px] font-mono tabular-nums text-slate-600">
                    <span>ERA {fmtCatVal("ERA", stats.ERA ?? null)}</span>
                    <span>WHIP {fmtCatVal("WHIP", stats.WHIP ?? null)}</span>
                    <span>K {sanitizeNum(stats.K)}</span>
                  </div>
                )}
                {atRiskCats.length > 0 && (
                  <span className="ml-auto text-[9px] font-semibold text-orange-600">
                    score: {score > 0 ? "+" : ""}{Math.round(score)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Column headers */}
      {playing.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-1 text-[9px] uppercase tracking-wider text-slate-400">
          <span className="w-7 shrink-0">Slot</span>
          <span className="w-[150px]">Player</span>
          <div className="flex-1 flex items-center gap-4">
            <span className="w-[70px] shrink-0">Opp</span>
            <span className="w-[65px] shrink-0">Time</span>
            <span className="flex-1">vs Pitcher</span>
          </div>
          <span className="shrink-0">Left</span>
        </div>
      )}

      <div className="space-y-4">
        {/* Batters playing */}
        {playingBatters.length > 0 && (
          <div className="rounded-lg border border-emerald-300 bg-surface">
            <div className="border-b border-emerald-300 px-4 py-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Batters Playing</span>
              <span className="text-[10px] tabular-nums text-emerald-600">{playingBatters.length}</span>
            </div>
            {playingBatters.map((p, i) => <GamePlayerRow key={i} player={p} />)}
          </div>
        )}

        {/* Starting pitchers today */}
        {startingToday.length > 0 && (
          <div className="rounded-lg border border-emerald-300 bg-surface">
            <div className="border-b border-emerald-300 px-4 py-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Starting Today</span>
              <span className="text-[10px] tabular-nums text-emerald-600">{startingToday.length}</span>
            </div>
            {startingToday.map((p, i) => <GamePlayerRow key={i} player={p} />)}
          </div>
        )}

        {/* Relief pitchers with games */}
        {relieversToday.length > 0 && (
          <div className="rounded-lg border border-border bg-surface">
            <div className="border-b border-border px-4 py-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Relief Pitchers</span>
              <span className="text-[10px] tabular-nums text-slate-500">{relieversToday.length}</span>
            </div>
            {relieversToday.map((p, i) => <GamePlayerRow key={i} player={p} />)}
          </div>
        )}

        {/* Not in lineup: benched with games + SPs not starting + off today */}
        {(benchWithGames.length + spsNotStarting.length + off.length) > 0 && (
          <div className="rounded-lg border border-border bg-surface">
            <div className="border-b border-border px-4 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Not In Lineup ({benchWithGames.length + spsNotStarting.length + off.length})
              </span>
            </div>
            {benchWithGames.map((p, i) => <GamePlayerRow key={`bn-${i}`} player={p} showBenchAlert />)}
            {spsNotStarting.map((p, i) => <GamePlayerRow key={`sp-${i}`} player={p} />)}
            {off.map((p, i) => <GamePlayerRow key={`off-${i}`} player={p} />)}
          </div>
        )}

        {/* IL */}
        {ilPlayers.length > 0 && (
          <div className="rounded-lg border border-red-300 bg-surface">
            <div className="border-b border-red-300 px-4 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-red-600">Injured List ({ilPlayers.length})</span>
            </div>
            {ilPlayers.map((p, i) => <GamePlayerRow key={i} player={p} />)}
          </div>
        )}

        {playing.length === 0 && off.length === 0 && (
          <div className="rounded-lg border border-border bg-surface px-6 py-10 text-center text-slate-500">
            No roster data available.
          </div>
        )}
      </div>
      </div>

      {/* Advisor sidebar */}
      <div className="space-y-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Matchup Advisor</div>
        {advisorRecs.length === 0 && (
          <div className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-[12px] text-slate-400">
            Loading recommendations...
          </div>
        )}
        {advisorRecs.map((rec, i) => (
          <div key={i} className={`rounded-lg border px-4 py-3 ${
            rec.priority === "high" ? "border-red-300 bg-red-50" :
            rec.priority === "medium" ? "border-orange-300 bg-orange-50" :
            "border-border bg-surface"
          }`}>
            <div className="flex items-start gap-2">
              <span className={`shrink-0 text-[12px] ${
                rec.type === "score" ? "" :
                rec.type === "target" ? "" :
                rec.type === "stream" ? "" :
                ""
              }`}>
                {rec.type === "score" ? "📊" : rec.type === "target" ? "🎯" : rec.type === "stream" ? "📡" : rec.type === "alert" ? "⚠️" : "💡"}
              </span>
              <div>
                <div className={`text-[12px] font-bold ${
                  rec.priority === "high" ? "text-red-700" :
                  rec.priority === "medium" ? "text-orange-700" : "text-slate-700"
                }`}>{rec.title}</div>
                <div className="mt-0.5 text-[11px] text-slate-600">{rec.description}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      </div>
    </div>
  );
}
