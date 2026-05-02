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

// Slot IDs
const BATTER_SLOT_IDS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 12]);
const PITCHER_SLOT_IDS = new Set([13, 14, 15]);
const BENCH_SLOT_ID = 16;


function PlayerRow({
  player,
  schedule,
  zp,
  stats,
  showDetail,
}: {
  player: RosterPlayer;
  schedule: TeamSchedule | null;
  zp?: ZScorePlayer;
  stats?: PlayerSeasonStats;
  showDetail: boolean;
}) {
  const hasGame = !!schedule?.todayOpponent;
  const isInjured = player.injuryStatus !== "ACTIVE";
  const isPitcher = player.pos === "SP" || player.pos === "RP";

  return (
    <div className="border-b border-border px-2 py-1.5">
      <div className="flex items-center gap-2">
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
            {zp.far.toFixed(1)}
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
  );
}

// ── GM Advisor ────────────────────────────────────────────────────────────────

export interface GmTierAdvice {
  bullets: string[];
  generatedAt: string | null;
}

export type TierKey = "week" | "month" | "season";

export interface GmTierResult {
  key: TierKey;
  data: GmTierAdvice | null;
  error: boolean;
}

const TIERS: { key: TierKey; label: string; file: string; borderColor: string; bgColor: string; textColor: string; bulletColor: string }[] = [
  { key: "week",   label: "This Week",     file: "/gm-advice-week.json",   borderColor: "border-orange-400", bgColor: "bg-orange-50",  textColor: "text-orange-700", bulletColor: "text-orange-500" },
  { key: "month",  label: "Next 30 Days",  file: "/gm-advice-month.json",  borderColor: "border-blue-400",   bgColor: "bg-blue-50",    textColor: "text-blue-700",   bulletColor: "text-blue-500"   },
  { key: "season", label: "Win the League", file: "/gm-advice-season.json", borderColor: "border-purple-400", bgColor: "bg-purple-50",  textColor: "text-purple-700", bulletColor: "text-purple-500" },
];

export function parseGmTierJson(raw: unknown): GmTierAdvice | null {
  if (raw === null || raw === undefined || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.bullets)) return null;
  const bullets = obj.bullets.filter((b): b is string => typeof b === "string" && b.length > 0);
  if (bullets.length === 0) return null;
  const generatedAt = typeof obj.generatedAt === "string" ? obj.generatedAt : null;
  return { bullets, generatedAt };
}

function TierFallback() {
  return (
    <div className="px-5 py-4 text-center">
      <div className="text-[12px] text-slate-500">No analysis available for this tier.</div>
      <div className="mt-1 text-[11px] text-slate-400">
        Run <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-600">/gm-advice</code> in Claude Code to generate.
      </div>
    </div>
  );
}

function AccordionSection({
  tier,
  result,
  isOpen,
  onToggle,
}: {
  tier: typeof TIERS[number];
  result: GmTierResult;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={onToggle}
        className={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-slate-50 ${isOpen ? tier.bgColor : ""}`}
      >
        <div className="flex items-center gap-2">
          <span className={`text-[12px] font-semibold ${isOpen ? tier.textColor : "text-slate-700"}`}>
            {tier.label}
          </span>
          {result.data && (
            <span className="text-[10px] text-slate-400">{result.data.bullets.length} items</span>
          )}
          {result.error && (
            <span className="text-[10px] text-amber-500">unavailable</span>
          )}
        </div>
        <span className={`text-[14px] text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>
      </button>
      {isOpen && (
        <div className="px-5 pb-4">
          {result.data ? (
            <>
              <ul className="space-y-3">
                {(Array.isArray(result.data.bullets) ? result.data.bullets : []).map((bullet, i) => (
                  <li key={i} className="flex gap-2.5 leading-snug">
                    <span className={`mt-0.5 shrink-0 text-[18px] leading-none ${tier.bulletColor}`}>›</span>
                    <span className="text-[13px] text-slate-700">{String(bullet ?? '')}</span>
                  </li>
                ))}
              </ul>
              {result.data.generatedAt && (
                <div className="mt-3 text-[10px] text-slate-400">
                  Updated {new Date(result.data.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </div>
              )}
            </>
          ) : (
            <TierFallback />
          )}
        </div>
      )}
    </div>
  );
}

function GmAdvisor() {
  const [tiers, setTiers] = useState<GmTierResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTiers, setOpenTiers] = useState<Set<TierKey>>(new Set(["week"]));

  useEffect(() => {
    let mounted = true;
    Promise.all(
      TIERS.map(async (tier): Promise<GmTierResult> => {
        try {
          const r = await fetch(tier.file);
          if (!r.ok) return { key: tier.key, data: null, error: true };
          const raw = await r.json();
          const parsed = parseGmTierJson(raw);
          return { key: tier.key, data: parsed, error: parsed === null };
        } catch {
          return { key: tier.key, data: null, error: true };
        }
      })
    ).then(results => {
      if (!mounted) return;
      setTiers(results);
      const firstWithData = results.find(r => r.data !== null);
      if (firstWithData) setOpenTiers(new Set([firstWithData.key]));
    }).catch(() => {}).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const toggleTier = (key: TierKey) => {
    setOpenTiers(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const hasAnyAdvice = tiers.some(t => t.data !== null && Array.isArray(t.data.bullets) && t.data.bullets.length > 0);

  return (
    <div className="mt-6 rounded-xl border border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">AI · Claude Opus</div>
          <div className="text-[14px] font-bold text-slate-800">GM Advisor</div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center px-6 py-8">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        </div>
      )}

      {/* Empty state: all tiers failed */}
      {!loading && !hasAnyAdvice && (
        <div className="px-6 py-10 text-center">
          <div className="text-[13px] text-slate-500">No analysis yet.</div>
          <div className="mt-2 text-[12px] text-slate-400">
            Run <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-600">/gm-advice</code> in Claude Code to generate.
          </div>
        </div>
      )}

      {/* Accordion sections */}
      {!loading && hasAnyAdvice && (
        <div>
          {TIERS.map(tier => {
            const result = tiers.find(t => t.key === tier.key) ?? { key: tier.key, data: null, error: true };
            return (
              <AccordionSection
                key={tier.key}
                tier={tier}
                result={result}
                isOpen={openTiers.has(tier.key)}
                onToggle={() => toggleTier(tier.key)}
              />
            );
          })}
          <div className="px-5 py-3 text-[10px] text-slate-400 border-t border-border">
            Run <code className="font-mono">/gm-advice</code> in Claude Code to refresh
          </div>
        </div>
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
          zp={zScoreMap.get(p.name)} stats={playerStatsMap.get(p.name)} showDetail={showStats} />
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
