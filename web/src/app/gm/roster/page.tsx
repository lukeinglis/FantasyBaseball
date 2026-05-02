"use client";

const IL_INJURY_STATUSES = new Set(["SEVEN_DAY_DL", "TEN_DAY_DL", "FIFTEEN_DAY_DL", "SIXTY_DAY_DL", "OUT"]);
function isOnIL(status: string): boolean { return IL_INJURY_STATUSES.has(status); }

import { useState, useEffect, useMemo, useCallback } from "react";
import { computePercentile, trendDirection, safeNum } from "@/lib/roster-utils";

interface RosterPlayer {
  name: string;
  pos: string;
  slotLabel: string;
  slotId: number;
  injuryStatus: string;
  injuryLabel: string;
  injuryColor: string;
  injuryNote?: string;
  proTeam: string;
  acquisitionType: string;
}

interface EspnTeam {
  id: number;
  name: string;
  abbrev: string;
  wins: number;
  losses: number;
  ties: number;
  roster: RosterPlayer[];
}

interface TeamSchedule {
  todayOpponent: string | null;
  todayTime: string | null;
  weekGames: number;
}

interface ZScorePlayer {
  name: string;
  zScores: Record<string, number>;
  zTotal: number;
  far: number;
}

interface PlayerSeasonStats {
  name: string;
  pos: string;
  seasonStats: Record<string, number>;
  last7Stats: Record<string, number>;
  last15Stats: Record<string, number>;
  last30Stats: Record<string, number>;
}

const MY_TEAM_ID_KEY = "espnMyTeamId";

function fmtStat(cat: string, val: number | undefined): string {
  if (val === undefined || val === null) return "-";
  if (cat === "AVG") return val.toFixed(3);
  if (cat === "ERA" || cat === "WHIP") return val.toFixed(2);
  if (cat === "IP") return val.toFixed(1);
  return String(Math.round(val));
}

function zColor(z: number): string {
  if (z >= 1.5) return "text-emerald-700 font-bold";
  if (z >= 0.5) return "text-emerald-600";
  if (z >= 0) return "text-slate-600";
  return "text-red-600";
}

const BATTER_Z_CATS = ["AVG", "HR", "R", "RBI", "SB", "H", "BB", "TB"];
const PITCHER_Z_CATS = ["K", "QS", "W", "SV", "HD", "ERA", "WHIP", "L"];
const BATTER_TREND_CATS = ["HR", "RBI", "R", "SB"];
const PITCHER_TREND_CATS = ["W", "K", "ERA", "WHIP"];
const INVERT_TREND_CATS = new Set(["ERA", "WHIP"]);

// Slot IDs
const BATTER_SLOT_IDS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 12]);
const PITCHER_SLOT_IDS = new Set([13, 14, 15]);
const BENCH_SLOT_ID = 16;

function TrendSparkline({ points, invert }: { points: (number | undefined | null)[]; invert?: boolean }) {
  const valid = points.filter((v): v is number => v != null && Number.isFinite(v));
  if (valid.length < 2) {
    return <span className="text-[9px] text-slate-400">No data</span>;
  }

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  const w = 48;
  const h = 16;
  const pad = 2;

  const pts = valid.map((v, i) => {
    const x = pad + (i / (valid.length - 1)) * (w - 2 * pad);
    let y = pad + (1 - (v - min) / range) * (h - 2 * pad);
    if (invert) y = pad + ((v - min) / range) * (h - 2 * pad);
    return `${x},${y}`;
  });

  const dir = trendDirection(invert ? valid.map((v) => -v) : valid);
  const color = dir === "up" ? "#059669" : dir === "down" ? "#dc2626" : "#94a3b8";

  return (
    <svg width={w} height={h} className="inline-block align-middle">
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExpandedDetail({
  player,
  stats,
  zp,
  allZScores,
}: {
  player: RosterPlayer;
  stats?: PlayerSeasonStats;
  zp?: ZScorePlayer;
  allZScores: ZScorePlayer[];
}) {
  const isPitcher = player.pos === "SP" || player.pos === "RP";
  const cats = isPitcher ? PITCHER_Z_CATS : BATTER_Z_CATS;
  const trendCats = isPitcher ? PITCHER_TREND_CATS : BATTER_TREND_CATS;

  return (
    <div className="bg-slate-50 border-b border-border px-3 py-3 space-y-3">
      {/* Full season stats grid */}
      {stats && (
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Season Stats</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono tabular-nums">
            {Object.entries(stats.seasonStats).map(([cat, val]) => (
              <span key={cat}>
                <span className="text-slate-400">{cat}</span>{" "}
                <span className="text-slate-700">{fmtStat(cat, safeNum(val))}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Z-score breakdown */}
      {zp && (
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Z-Score Breakdown</div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono tabular-nums">
            {cats.map((cat) => {
              const z = safeNum(zp.zScores[cat]);
              const allVals = allZScores
                .filter((p) => p.zScores[cat] !== undefined)
                .map((p) => safeNum(p.zScores[cat]));
              const pct = computePercentile(z, allVals);
              const colorCls =
                z > 0.5 ? "text-emerald-600" : z < -0.5 ? "text-red-600" : "text-slate-500";
              return (
                <span key={cat} className={colorCls}>
                  {cat} {z >= 0 ? "+" : ""}{z.toFixed(1)}{" "}
                  <span className="text-slate-400">top {100 - pct}%</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Trend sparklines */}
      {stats && (
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Trend (30d → 15d → 7d)</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 items-center text-[10px]">
            {trendCats.map((cat) => {
              const points = [
                stats.last30Stats[cat],
                stats.last15Stats[cat],
                stats.last7Stats[cat],
              ];
              return (
                <span key={cat} className="inline-flex items-center gap-1">
                  <span className="text-slate-400 font-mono">{cat}</span>
                  <TrendSparkline points={points} invert={INVERT_TREND_CATS.has(cat)} />
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerRow({
  player,
  schedule,
  zp,
  stats,
  showDetail,
  expanded,
  onToggle,
  allZScores,
}: {
  player: RosterPlayer;
  schedule: TeamSchedule | null;
  zp?: ZScorePlayer;
  stats?: PlayerSeasonStats;
  showDetail: boolean;
  expanded: boolean;
  onToggle: () => void;
  allZScores: ZScorePlayer[];
}) {
  const hasGame = !!schedule?.todayOpponent;
  const isInjured = player.injuryStatus !== "ACTIVE";
  const isPitcher = player.pos === "SP" || player.pos === "RP";

  return (
    <>
      <div className={`border-b border-border px-2 py-1.5 cursor-pointer hover:bg-slate-50 transition-colors ${expanded ? "bg-slate-50" : ""}`} onClick={onToggle}>
        <div className="flex items-center gap-2">
          <span className={`w-3 shrink-0 text-[9px] text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`}>▸</span>
          <span className="w-7 shrink-0 text-[10px] font-bold text-slate-600">{player.slotLabel}</span>
          <span className={`min-w-0 w-[140px] truncate text-[12px] ${isInjured ? "text-slate-500" : "text-slate-700"}`}>
            {player.name}
          </span>
          <span className="w-6 shrink-0 text-[10px] text-slate-500">{player.pos}</span>
          <span className="w-7 shrink-0 text-[10px] text-slate-500">{player.proTeam}</span>

          {showDetail && stats ? (
            <div className="flex-1 flex items-center gap-2 justify-end text-[9px] font-mono text-slate-500 tabular-nums">
              {!isPitcher ? (
                <>
                  <span>{fmtStat("AVG", stats.seasonStats.AVG)}</span>
                  <span>{fmtStat("HR", stats.seasonStats.HR)} <span className="text-slate-400">HR</span></span>
                  <span>{fmtStat("RBI", stats.seasonStats.RBI)} <span className="text-slate-400">RBI</span></span>
                  <span>{fmtStat("SB", stats.seasonStats.SB)} <span className="text-slate-400">SB</span></span>
                </>
              ) : (
                <>
                  <span>{fmtStat("ERA", stats.seasonStats.ERA)}</span>
                  <span>{fmtStat("WHIP", stats.seasonStats.WHIP)}</span>
                  <span>{fmtStat("K", stats.seasonStats.K)} <span className="text-slate-400">K</span></span>
                  <span>{fmtStat("IP", stats.seasonStats.IP)} <span className="text-slate-400">IP</span></span>
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 min-w-0">
              {hasGame ? (
                <span className="text-[10px] text-slate-600 whitespace-nowrap">
                  {schedule!.todayOpponent}
                  {schedule!.todayTime && (
                    <span className="ml-1 text-slate-500">{schedule!.todayTime}</span>
                  )}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400">Off</span>
              )}
            </div>
          )}

          {/* FAR badge */}
          {zp && (
            <span className={`shrink-0 text-[9px] font-mono font-bold ${zColor(zp.zTotal)}`}>
              {safeNum(zp.far).toFixed(1)}
            </span>
          )}

          {/* Games this week */}
          {schedule && (
            <span className={`shrink-0 text-[10px] tabular-nums font-semibold ${
              schedule.weekGames >= 5 ? "text-emerald-600" :
              schedule.weekGames >= 3 ? "text-orange-600" : "text-slate-600"
            }`}>{schedule.weekGames}G</span>
          )}

          {/* Injury */}
          {isInjured && (
            <span className={`shrink-0 text-[10px] font-bold ${player.injuryColor}`}>
              {player.injuryLabel}
            </span>
          )}
        </div>
      </div>
      {expanded && (
        <ExpandedDetail player={player} stats={stats} zp={zp} allZScores={allZScores} />
      )}
    </>
  );
}

// ── GM Advisor ────────────────────────────────────────────────────────────────

interface GmAdvice {
  week: string[];
  month: string[];
  season: string[];
  generatedAt: string | null;
}

const TABS: { key: keyof Omit<GmAdvice, "generatedAt">; label: string; accent: string; bullet: string }[] = [
  { key: "week",   label: "This Week",      accent: "border-orange-400 bg-orange-50 text-orange-700", bullet: "text-orange-500" },
  { key: "month",  label: "Next 30 Days",   accent: "border-blue-400 bg-blue-50 text-blue-700",       bullet: "text-blue-500"   },
  { key: "season", label: "Win the League", accent: "border-purple-400 bg-purple-50 text-purple-700", bullet: "text-purple-500" },
];

function GmAdvisor() {
  const [advice, setAdvice] = useState<GmAdvice | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<keyof Omit<GmAdvice, "generatedAt">>("week");

  useEffect(() => {
    fetch("/gm-advice.json")
      .then(r => r.ok ? r.json() : null)
      .then((d: GmAdvice | null) => { if (d?.generatedAt) setAdvice(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activeStyle = TABS.find(t => t.key === activeTab)!;
  const hasAdvice = advice && advice.week.length > 0;

  return (
    <div className="mt-6 rounded-xl border border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">AI · Claude Opus</div>
          <div className="text-[14px] font-bold text-slate-800">GM Advisor</div>
        </div>
        {advice?.generatedAt && (
          <span className="text-[10px] text-slate-400">
            Updated {new Date(advice.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </span>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center px-6 py-8">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !hasAdvice && (
        <div className="px-6 py-10 text-center">
          <div className="text-[13px] text-slate-500">No analysis yet.</div>
          <div className="mt-2 text-[12px] text-slate-400">
            Run <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-600">/gm-advice</code> in Claude Code to generate.
          </div>
        </div>
      )}

      {/* Advice */}
      {!loading && hasAdvice && (
        <>
          {/* Tab bar */}
          <div className="flex border-b border-border text-[11px] font-semibold">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex-1 px-3 py-2.5 transition-colors ${
                  activeTab === t.key
                    ? `border-b-2 ${t.accent}`
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Bullets */}
          <div className="px-5 py-5">
            <ul className="space-y-3">
              {(advice![activeTab] ?? []).map((bullet, i) => (
                <li key={i} className="flex gap-2.5 leading-snug">
                  <span className={`mt-0.5 shrink-0 text-[18px] leading-none ${activeStyle.bullet}`}>›</span>
                  <span className="text-[13px] text-slate-700">{bullet}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 text-[10px] text-slate-400">
              Run <code className="font-mono">/gm-advice</code> in Claude Code to refresh
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function EspnSetupCard() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-surface px-8 py-10 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-orange-600/60">Setup Required</div>
      <div className="mt-3 text-xl font-bold text-gray-900">Connect ESPN Credentials</div>
      <div className="mt-3 text-[13px] text-slate-500">
        The Roster view pulls live data from your private ESPN league. Add these environment variables to Vercel.
      </div>
      <div className="mt-5 rounded-lg border border-border bg-background px-4 py-4 text-left text-[12px]">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
          Vercel → Settings → Environment Variables
        </div>
        <div className="space-y-2 font-mono">
          <div><span className="text-orange-600">ESPN_S2</span> <span className="text-slate-600">=</span> <span className="text-slate-500">AE...</span></div>
          <div><span className="text-orange-600">ESPN_SWID</span> <span className="text-slate-600">=</span> <span className="text-slate-500">{"{XXXX-...}"}</span></div>
          <div><span className="text-orange-600">MY_ESPN_TEAM_ID</span> <span className="text-slate-600">=</span> <span className="text-slate-500">9</span></div>
        </div>
      </div>
    </div>
  );
}

export default function RosterPage() {
  const [teams, setTeams] = useState<EspnTeam[]>([]);
  const [schedule, setSchedule] = useState<Record<string, TeamSchedule>>({});
  const [zScoreMap, setZScoreMap] = useState<Map<string, ZScorePlayer>>(new Map());
  const [playerStatsMap, setPlayerStatsMap] = useState<Map<string, PlayerSeasonStats>>(new Map());
  const [showStats, setShowStats] = useState(true);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/espn/roster").then(r => r.json()),
      fetch("/api/analysis/z-scores").then(r => r.json()).catch(() => ({ players: [] })),
      fetch("/api/espn/player-stats").then(r => r.json()).catch(() => ({ players: [] })),
    ]).then(([rosterData, zData, statsData]) => {
      if (rosterData.error) { setError(rosterData.error); setLoading(false); return; }
      setTeams(rosterData);

      const zMap = new Map<string, ZScorePlayer>();
      for (const p of zData.players ?? []) zMap.set(p.name, p);
      setZScoreMap(zMap);

      const sMap = new Map<string, PlayerSeasonStats>();
      for (const p of statsData.players ?? []) sMap.set(p.name, p);
      setPlayerStatsMap(sMap);

      const today = new Date().toISOString().slice(0, 10);
      const end = new Date();
      end.setDate(end.getDate() + 6);
      const endDate = end.toISOString().slice(0, 10);
      return fetch(`/api/mlb/schedule?startDate=${today}&endDate=${endDate}`)
        .then((r) => r.json())
        .then((s) => { if (!s.error) setSchedule(s); });
    })
    .catch(() => setError("FETCH_FAILED"))
    .finally(() => setLoading(false));
  }, []);

  // Determine my team — use MY_ESPN_TEAM_ID from the matchup endpoint or first team
  const myTeam = useMemo(() => {
    if (teams.length === 0) return null;
    // Try to get MY_ESPN_TEAM_ID from matchup endpoint
    const stored = typeof window !== "undefined" ? localStorage.getItem(MY_TEAM_ID_KEY) : null;
    if (stored) {
      const found = teams.find((t) => t.id === parseInt(stored));
      if (found) return found;
    }
    // Fetch from matchup to get the ID
    return null;
  }, [teams]);

  const [resolvedTeam, setResolvedTeam] = useState<EspnTeam | null>(null);

  useEffect(() => {
    if (myTeam) {
      setResolvedTeam(myTeam);
      return;
    }
    if (teams.length === 0) return;

    // Resolve from matchup API
    fetch("/api/espn/matchup")
      .then((r) => r.json())
      .then((d) => {
        if (d.myTeamId) {
          localStorage.setItem(MY_TEAM_ID_KEY, String(d.myTeamId));
          const found = teams.find((t) => t.id === d.myTeamId);
          if (found) { setResolvedTeam(found); return; }
        }
        // Fallback to first team
        setResolvedTeam(teams[0]);
      })
      .catch(() => setResolvedTeam(teams[0]));
  }, [myTeam, teams]);

  const allZScores = useMemo(() => Array.from(zScoreMap.values()), [zScoreMap]);
  const togglePlayer = useCallback((name: string) => {
    setExpandedPlayer((prev) => (prev === name ? null : name));
  }, []);

  const roster = resolvedTeam?.roster ?? [];
  const batters = useMemo(() => roster.filter((p) => BATTER_SLOT_IDS.has(p.slotId)).sort((a, b) => a.slotId - b.slotId), [roster]);
  const pitchers = useMemo(() => roster.filter((p) => PITCHER_SLOT_IDS.has(p.slotId)).sort((a, b) => a.slotId - b.slotId), [roster]);
  const bench = useMemo(() => roster.filter((p) => p.slotId === BENCH_SLOT_ID), [roster]);
  const il = useMemo(() => roster.filter((p) => isOnIL(p.injuryStatus)), [roster]);

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading roster...</div>;
  if (error === "ESPN_CREDS_MISSING") {
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnSetupCard /></div>;
  }
  if (error || !resolvedTeam) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load roster</div>
        <div className="text-[12px] text-slate-600">{error}</div>
      </div>
    );
  }

  const Section = ({ label, players, borderColor = "border-border" }: { label: string; players: RosterPlayer[]; borderColor?: string }) => (
    <div className={`rounded-lg border ${borderColor} bg-surface`}>
      <div className={`border-b ${borderColor} px-3 py-2 flex items-center justify-between`}>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">{label}</span>
        <span className="text-[10px] tabular-nums text-slate-400">{players.length}</span>
      </div>
      {players.map((p, i) => (
        <PlayerRow key={i} player={p} schedule={schedule[p.proTeam] ?? null}
          zp={zScoreMap.get(p.name)} stats={playerStatsMap.get(p.name)} showDetail={showStats}
          expanded={expandedPlayer === p.name} onToggle={() => togglePlayer(p.name)}
          allZScores={allZScores} />
      ))}
      {players.length === 0 && (
        <div className="px-3 py-3 text-[11px] text-slate-400">-</div>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{resolvedTeam.name}</h1>
          <span className="text-[12px] tabular-nums text-slate-500">
            {resolvedTeam.wins}-{resolvedTeam.losses}{resolvedTeam.ties > 0 ? `-${resolvedTeam.ties}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {/* Roster counts */}
          <div className="flex gap-2 text-[10px]">
            <span className="rounded bg-surface px-2 py-1 border border-border">
              <span className="text-slate-500">BAT</span>{" "}
              <span className="font-bold text-slate-700">{batters.length}</span>
            </span>
            <span className="rounded bg-surface px-2 py-1 border border-border">
              <span className="text-slate-500">PIT</span>{" "}
              <span className="font-bold text-slate-700">{pitchers.length}</span>
            </span>
            <span className="rounded bg-surface px-2 py-1 border border-border">
              <span className="text-slate-500">BN</span>{" "}
              <span className="font-bold text-slate-700">{bench.length}</span>
            </span>
            {il.length > 0 && (
              <span className="rounded bg-red-50 px-2 py-1 border border-red-200">
                <span className="text-red-600">IL</span>{" "}
                <span className="font-bold text-red-600">{il.length}</span>
              </span>
            )}
          </div>
          {/* View toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden text-[11px] font-semibold">
            <button onClick={() => setShowStats(true)}
              className={`px-3 py-1.5 transition-colors ${showStats ? "bg-orange-600 text-white" : "bg-surface text-slate-600 hover:bg-slate-100"}`}>
              Stats
            </button>
            <button onClick={() => setShowStats(false)}
              className={`px-3 py-1.5 transition-colors ${!showStats ? "bg-orange-600 text-white" : "bg-surface text-slate-600 hover:bg-slate-100"}`}>
              Schedule
            </button>
          </div>
        </div>
      </div>

      {/* Roster grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Section label="Batting" players={batters} borderColor="border-orange-300" />
        <Section label="Pitching" players={pitchers} />
        <div className="space-y-4">
          <Section label="Bench" players={bench} />
          {il.length > 0 && (
            <Section label="Injured List" players={il} borderColor="border-red-300" />
          )}
        </div>
      </div>

      {/* IL details — only show players with actual injuries */}
      {il.filter((p) => p.injuryStatus !== "ACTIVE").length > 0 && (
        <div className="mt-4 rounded-lg border border-red-300 bg-surface">
          <div className="border-b border-red-300 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-red-600/70">
            Injury Details
          </div>
          <div className="divide-y divide-border">
            {il.filter((p) => p.injuryStatus !== "ACTIVE").map((p, i) => (
              <div key={i} className="flex items-start gap-3 px-3 py-2">
                <span className={`shrink-0 text-[11px] font-bold ${p.injuryColor}`}>{p.injuryLabel}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] text-slate-700">{p.name}</div>
                  {p.injuryNote && <div className="mt-0.5 text-[11px] text-slate-500">{p.injuryNote}</div>}
                </div>
                <span className="shrink-0 text-[10px] text-slate-500">{p.proTeam}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GM Advisor */}
      <GmAdvisor />
    </div>
  );
}
