"use client";

const IL_INJURY_STATUSES = new Set(["SEVEN_DAY_DL", "TEN_DAY_DL", "FIFTEEN_DAY_DL", "SIXTY_DAY_DL", "OUT"]);
function isOnIL(status: string): boolean { return IL_INJURY_STATUSES.has(status); }

import { useState, useEffect, useMemo, useCallback } from "react";
import { DataFreshness } from "@/components/DataFreshness";

interface MatchupCat {
  cat: string;
  myValue: number | null;
  oppValue: number | null;
  result: "WIN" | "LOSS" | "TIE" | "PENDING";
}

interface MatchupPlayer {
  name: string;
  pos: string;
  slotLabel: string;
  slotId: number;
  injuryStatus: string;
  injuryLabel: string;
  injuryColor: string;
  proTeam: string;
  stats: Record<string, number>;
}

interface MatchupData {
  scoringPeriodId: number;
  matchupStartDate: string | null;
  matchupEndDate: string | null;
  myTeamName: string;
  oppTeamName: string;
  myWins: number;
  myLosses: number;
  myTies: number;
  oppWins: number;
  oppLosses: number;
  oppTies: number;
  categories: MatchupCat[];
  myRoster: MatchupPlayer[];
  oppRoster: MatchupPlayer[];
}

interface TeamSchedule {
  todayOpponent: string | null;
  todayTime: string | null;
  weekGames: number;
}

interface ProbableStart {
  date: string;
  pitcherName: string;
  team: string;
  opponent: string;
  gameTime: string;
}

interface ProbablePitchersData {
  byPitcher: Record<string, ProbableStart[]>;
}

// Slot IDs
const BATTER_SLOT_IDS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 12]);  // C,1B,2B,3B,SS,OF×3,UTIL
const PITCHER_SLOT_IDS = new Set([13, 14, 15]);                     // P, SP, RP
const BENCH_SLOT_ID = 16;


const BAT_CATS = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG"];
const PIT_CATS = ["K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"];
const LOWER_IS_BETTER = new Set(["ERA", "WHIP", "L"]);

function catResultColor(result: string) {
  if (result === "WIN") return "text-emerald-600";
  if (result === "LOSS") return "text-red-600";
  if (result === "TIE") return "text-orange-600";
  return "text-slate-500";
}

function catBg(result: string) {
  if (result === "WIN") return "bg-emerald-100 border-emerald-300";
  if (result === "LOSS") return "bg-red-100 border-red-300";
  if (result === "TIE") return "bg-orange-100 border-orange-300";
  return "bg-surface border-border";
}

function fmtCat(cat: string, val: number | null): string {
  if (val === null) return "—";
  if (cat === "AVG" || cat === "ERA" || cat === "WHIP") return val.toFixed(3);
  return String(Math.round(val));
}

// Standard deviation per day (rough estimates for daily variance per team)
const DAILY_SD: Record<string, number> = {
  H: 3, R: 2.5, HR: 1.1, TB: 5, RBI: 2.5, BB: 2, SB: 0.7,
  K: 3, QS: 0.5, W: 0.5, L: 0.5, SV: 0.5, HD: 0.5,
  // Rate stats: daily swing in team rate stats
  AVG: 0.012,   // team AVG can swing ~.012/day
  ERA: 0.6,     // team ERA can swing ~0.6/day
  WHIP: 0.06,   // team WHIP can swing ~0.06/day
};

/**
 * Estimate how "locked" a category is based on current gap and days remaining.
 * Returns 0-100 representing confidence the current result holds.
 */
function lockPct(cat: string, myVal: number | null, oppVal: number | null, daysLeft: number): number | null {
  if (myVal === null || oppVal === null || daysLeft <= 0) return null;

  const lower = LOWER_IS_BETTER.has(cat);
  const gap = lower ? oppVal - myVal : myVal - oppVal; // positive = I'm winning

  // For rate stats, both teams' rates can move, so variance is higher
  const isRate = cat === "AVG" || cat === "ERA" || cat === "WHIP";
  const dailySd = DAILY_SD[cat] ?? 1;

  // Combined variance: both teams can swing independently
  // Rate stats swing less as the matchup progresses (more IP/AB stabilizes)
  // but we use a simplified model
  const sd = dailySd * Math.sqrt(daysLeft) * (isRate ? 1.4 : 1);
  if (sd === 0) return gap > 0 ? 99 : gap < 0 ? 1 : 50;

  // Simple normal approximation: how many SDs is the gap?
  const zScore = gap / sd;

  // Convert z-score to rough percentage
  const pct = Math.round(50 + zScore * 20);
  return Math.max(1, Math.min(99, pct));
}

function lockLabel(pct: number): string {
  if (pct >= 90) return "Locked";
  if (pct >= 75) return "Likely";
  if (pct >= 55) return "Lean";
  if (pct >= 45) return "Toss-up";
  if (pct >= 25) return "Behind";
  if (pct >= 10) return "Unlikely";
  return "Lost";
}

function lockColor(pct: number): string {
  if (pct >= 75) return "text-emerald-600";
  if (pct >= 55) return "text-emerald-600/60";
  if (pct >= 45) return "text-orange-600";
  if (pct >= 25) return "text-red-600/60";
  return "text-red-600";
}

function fmtDateRange(start: string | null, end: string | null): string {
  if (!start || !end) return "";
  const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function fmtPlayerStat(cat: string, val: number | undefined): string {
  if (val === undefined || val === null) return "-";
  if (cat === "AVG") return val.toFixed(3);
  if (cat === "ERA" || cat === "WHIP") return val.toFixed(2);
  if (cat === "IP") return val.toFixed(1);
  return String(Math.round(val));
}

function PlayerRow({
  player,
  schedule,
  isMine,
  starts,
}: {
  player: MatchupPlayer;
  schedule: TeamSchedule | null;
  isMine: boolean;
  starts: number;
}) {
  const hasGame = !!schedule?.todayOpponent;
  const isPitcher = player.pos === "SP" || player.pos === "RP";
  const s = player.stats ?? {};
  const hasStats = Object.keys(s).length > 0;

  return (
    <div className={`border-b border-border px-2 py-1.5 ${isMine ? "" : "opacity-90"}`}>
      <div className="flex items-center gap-2">
        {/* Slot */}
        <span className="w-7 shrink-0 text-[10px] font-bold text-slate-600">{player.slotLabel}</span>

        {/* Name */}
        <span className="min-w-0 w-[120px] truncate text-[12px] text-slate-700">{player.name}</span>

        {/* Pro team */}
        <span className="w-7 shrink-0 text-[10px] text-slate-500">{player.proTeam}</span>

        {/* Today's game — only show if playing */}
        {hasGame && (
          <div className="shrink-0">
            <span className="text-[10px] text-slate-600 whitespace-nowrap">
              {schedule!.todayOpponent}
            </span>
          </div>
        )}

        {/* Season stats (compact) */}
        {hasStats && !isPitcher && (
          <div className="flex-1 flex items-center gap-2 justify-end text-[9px] font-mono text-slate-500 tabular-nums">
            <span>{fmtPlayerStat("AVG", s.AVG)}</span>
            <span>{fmtPlayerStat("HR", s.HR)} <span className="text-slate-400">HR</span></span>
            <span>{fmtPlayerStat("RBI", s.RBI)} <span className="text-slate-400">RBI</span></span>
            <span>{fmtPlayerStat("R", s.R)} <span className="text-slate-400">R</span></span>
            <span>{fmtPlayerStat("SB", s.SB)} <span className="text-slate-400">SB</span></span>
          </div>
        )}
        {hasStats && isPitcher && (
          <div className="flex-1 flex items-center gap-2 justify-end text-[9px] font-mono text-slate-500 tabular-nums">
            <span>{fmtPlayerStat("ERA", s.ERA)}</span>
            <span>{fmtPlayerStat("WHIP", s.WHIP)} <span className="text-slate-400">WHIP</span></span>
            <span>{fmtPlayerStat("K", s.K)} <span className="text-slate-400">K</span></span>
            <span>{fmtPlayerStat("W", s.W)} <span className="text-slate-400">W</span></span>
            {(s.SV ?? 0) > 0 && <span>{fmtPlayerStat("SV", s.SV)} <span className="text-slate-400">SV</span></span>}
          </div>
        )}
        {!hasStats && <div className="flex-1" />}

        {/* Starts this matchup (SP only) */}
        {isPitcher && player.pos === "SP" && starts > 0 && (
          <span className={`shrink-0 text-[10px] tabular-nums font-bold ${
            starts >= 2 ? "text-emerald-600" : "text-orange-600"
          }`}>{starts}S</span>
        )}

        {/* Games this week */}
        {schedule && (
          <span className={`shrink-0 text-[10px] tabular-nums font-semibold ${
            schedule.weekGames >= 5 ? "text-emerald-600" :
            schedule.weekGames >= 3 ? "text-orange-600" : "text-slate-600"
          }`}>{schedule.weekGames}G</span>
        )}

        {/* Injury */}
        {player.injuryStatus !== "ACTIVE" && (
          <span className={`shrink-0 text-[10px] font-bold ${player.injuryColor}`}>
            {player.injuryLabel}
          </span>
        )}
      </div>
    </div>
  );
}

function RosterPanel({
  teamName,
  roster,
  schedule,
  isMine,
  probables,
}: {
  teamName: string;
  roster: MatchupPlayer[];
  schedule: Record<string, TeamSchedule>;
  isMine: boolean;
  probables: ProbablePitchersData | null;
}) {
  const batters = roster.filter((p) => BATTER_SLOT_IDS.has(p.slotId)).sort((a, b) => a.slotId - b.slotId);
  const pitchers = roster.filter((p) => PITCHER_SLOT_IDS.has(p.slotId)).sort((a, b) => a.slotId - b.slotId);
  const bench = roster.filter((p) => p.slotId === BENCH_SLOT_ID);
  const il = roster.filter((p) => isOnIL(p.injuryStatus));

  const borderColor = isMine ? "border-orange-300" : "border-border";
  const headerColor = isMine ? "text-orange-600 border-orange-300" : "text-slate-600 border-border";

  function getStarts(playerName: string): number {
    if (!probables) return 0;
    return probables.byPitcher[playerName]?.length ?? 0;
  }

  // Total SP starts for this team
  const totalStarts = pitchers
    .filter((p) => p.pos === "SP")
    .reduce((sum, p) => sum + getStarts(p.name), 0);

  const Section = ({ label, players, showStarts }: { label: string; players: MatchupPlayer[]; showStarts?: boolean }) => (
    <>
      <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-slate-400 bg-black/[0.03] flex justify-between">
        <span>{label}</span>
        {showStarts && totalStarts > 0 && (
          <span className="text-orange-600/60">{totalStarts} starts</span>
        )}
      </div>
      {players.map((p, i) => (
        <PlayerRow key={i} player={p} schedule={schedule[p.proTeam] ?? null} isMine={isMine} starts={getStarts(p.name)} />
      ))}
    </>
  );

  return (
    <div className={`rounded-lg border ${borderColor} bg-surface flex-1 min-w-0`}>
      <div className={`border-b ${headerColor} px-3 py-2`}>
        <span className="text-[12px] font-semibold">{teamName}</span>
      </div>
      <Section label="Batters" players={batters} />
      <Section label="Pitchers" players={pitchers} showStarts />
      {bench.length > 0 && <Section label="Bench" players={bench} />}
      {il.length > 0 && <Section label="IL" players={il} />}
    </div>
  );
}

function EspnSetupCard() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-surface px-8 py-10 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-orange-600/60">Setup Required</div>
      <div className="mt-3 text-xl font-bold text-gray-900">Connect ESPN Credentials</div>
      <div className="mt-3 text-[13px] text-slate-500">
        The Matchup view pulls live data from your private ESPN league. Add these environment variables to Vercel.
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

export default function MatchupPage() {
  const [data, setData] = useState<MatchupData | null>(null);
  const [schedule, setSchedule] = useState<Record<string, TeamSchedule>>({});
  const [probables, setProbables] = useState<ProbablePitchersData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch("/api/espn/matchup")
      .then((r) => r.json())
      .then((d: MatchupData & { error?: string }) => {
        if (d.error) { setError(d.error); setLoading(false); return; }
        setData(d);

        // Fetch MLB schedule and probable pitchers for the matchup period
        const today = new Date().toISOString().slice(0, 10);
        const startDate = d.matchupStartDate ?? today;
        const endDate = d.matchupEndDate ?? (() => {
          const e = new Date(today); e.setDate(e.getDate() + 13); return e.toISOString().slice(0, 10);
        })();
        return Promise.all([
          fetch(`/api/mlb/schedule?startDate=${startDate}&endDate=${endDate}`)
            .then((r) => r.json()),
          fetch(`/api/mlb/probable-pitchers?startDate=${startDate}&endDate=${endDate}`)
            .then((r) => r.json()).catch(() => null),
        ]).then(([s, p]) => {
          if (!s.error) setSchedule(s);
          if (p && !p.error) setProbables(p);
        });
      })
      .catch(() => setError("FETCH_FAILED"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Calculate days remaining in matchup
  const daysLeft = useMemo(() => {
    if (!data?.matchupEndDate) return 7; // fallback
    const end = new Date(data.matchupEndDate + "T23:59:59");
    const now = new Date();
    return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }, [data]);

  const batCats = useMemo(() => data?.categories.filter((c) => BAT_CATS.includes(c.cat)) ?? [], [data]);
  const pitCats = useMemo(() => data?.categories.filter((c) => PIT_CATS.includes(c.cat)) ?? [], [data]);
  const myWinCount = useMemo(() => data?.categories.filter((c) => c.result === "WIN").length ?? 0, [data]);
  const myTieCount = useMemo(() => data?.categories.filter((c) => c.result === "TIE").length ?? 0, [data]);
  const oppWinCount = useMemo(() => data?.categories.filter((c) => c.result === "LOSS").length ?? 0, [data]);

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading matchup...</div>;
  if (error === "ESPN_CREDS_MISSING" || error === "MY_ESPN_TEAM_ID_MISSING") {
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnSetupCard /></div>;
  }
  if (error || !data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load matchup</div>
        <div className="text-[12px] text-slate-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-600">
              Week {data.scoringPeriodId}
            </span>
            <DataFreshness onRefresh={fetchData} loading={loading} />
            {data.matchupStartDate && (
              <span className="text-[11px] text-slate-400">
                {fmtDateRange(data.matchupStartDate, data.matchupEndDate)}
                {daysLeft > 0 && <span className="ml-1">({daysLeft}d left)</span>}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3">
            <span className="text-xl font-bold text-orange-600">{data.myTeamName}</span>
            <span className="text-slate-600">vs</span>
            <span className="text-xl font-bold text-slate-400">{data.oppTeamName}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold tabular-nums text-emerald-600">{myWinCount}</div>
            <div className="text-[10px] text-slate-600">WON</div>
          </div>
          <div className="text-slate-400">-</div>
          <div className="text-center">
            <div className="text-2xl font-bold tabular-nums text-red-600">{oppWinCount}</div>
            <div className="text-[10px] text-slate-600">LOST</div>
          </div>
          {myTieCount > 0 && (
            <>
              <div className="text-slate-400">-</div>
              <div className="text-center">
                <div className="text-2xl font-bold tabular-nums text-orange-600">{myTieCount}</div>
                <div className="text-[10px] text-slate-600">TIED</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Category scoreboard — donut charts */}
      <div className="mb-6 space-y-3">
        {[
          { label: "Batting", cats: batCats },
          { label: "Pitching", cats: pitCats },
        ].map(({ label, cats }) => (
          <div key={label}>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
              {cats.map((c) => {
                const pct = lockPct(c.cat, c.myValue, c.oppValue, daysLeft);
                const myVal = c.myValue ?? 0;
                const oppVal = c.oppValue ?? 0;
                const total = Math.abs(myVal) + Math.abs(oppVal);
                // For donut: my share as percentage
                const myShare = total > 0 ? (Math.abs(myVal) / total) * 100 : 50;
                // SVG donut math (circumference of r=30 circle = 2πr ≈ 188.5)
                const circumference = 188.5;
                const myArc = (myShare / 100) * circumference;
                const oppArc = circumference - myArc;

                // Colors based on result
                const myColor = c.result === "WIN" ? "#059669" : c.result === "TIE" ? "#ea580c" : "#cbd5e1";
                const oppColor = c.result === "LOSS" ? "#dc2626" : c.result === "TIE" ? "#ea580c" : "#cbd5e1";

                return (
                  <div key={c.cat} className="flex flex-col items-center">
                    {/* Category label */}
                    <span className="text-[10px] font-bold text-slate-500 mb-1">{c.cat}</span>

                    {/* Donut chart */}
                    <div className="relative w-[72px] h-[72px]">
                      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                        {/* My arc */}
                        <circle
                          cx="40" cy="40" r="30"
                          fill="none"
                          stroke={myColor}
                          strokeWidth="8"
                          strokeDasharray={`${myArc} ${circumference}`}
                          strokeDashoffset="0"
                          strokeLinecap="round"
                        />
                        {/* Opponent arc */}
                        <circle
                          cx="40" cy="40" r="30"
                          fill="none"
                          stroke={oppColor}
                          strokeWidth="8"
                          strokeDasharray={`${oppArc} ${circumference}`}
                          strokeDashoffset={`${-myArc}`}
                          strokeLinecap="round"
                        />
                      </svg>
                      {/* Center value */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-[11px] font-bold font-mono tabular-nums leading-tight ${catResultColor(c.result)}`}>
                          {fmtCat(c.cat, c.myValue)}
                        </span>
                        <span className="text-[9px] font-mono tabular-nums text-slate-400 leading-tight">
                          {fmtCat(c.cat, c.oppValue)}
                        </span>
                      </div>
                    </div>

                    {/* Result + lock */}
                    <div className="mt-1 flex flex-col items-center">
                      {c.result !== "PENDING" && (
                        <span className={`text-[9px] font-bold uppercase ${catResultColor(c.result)}`}>
                          {c.result}
                        </span>
                      )}
                      {pct !== null && daysLeft > 0 && (
                        <span className={`text-[8px] font-bold ${lockColor(pct)}`}>
                          {pct}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Column legend */}
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">Rosters</div>
        <div className="text-[10px] text-slate-400">
          <span className="mr-3">Slot · Name · Team · Today&apos;s game</span>
          <span className="text-emerald-600">5G+</span>
          <span className="mx-1 text-slate-400">/</span>
          <span className="text-orange-600">3–4G</span>
          <span className="mx-1 text-slate-400">/</span>
          <span className="text-slate-600">≤2G</span>
          <span className="ml-1 text-slate-400">this matchup</span>
        </div>
      </div>

      {/* Side-by-side rosters */}
      <div className="flex gap-4">
        <RosterPanel
          teamName={data.myTeamName}
          roster={data.myRoster}
          schedule={schedule}
          isMine={true}
          probables={probables}
        />
        <RosterPanel
          teamName={data.oppTeamName}
          roster={data.oppRoster}
          schedule={schedule}
          isMine={false}
          probables={probables}
        />
      </div>
    </div>
  );
}
