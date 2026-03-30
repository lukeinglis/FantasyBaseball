"use client";

import { useState, useEffect, useMemo } from "react";

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
const BATTER_SLOT_IDS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8]);   // C,1B,2B,3B,SS,OF×3,UTIL
const PITCHER_SLOT_IDS = new Set([14, 15, 17]);                    // SP, RP, P
const BENCH_SLOT_ID = 16;
const IL_SLOT_ID = 12;

const BAT_CATS = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG"];
const PIT_CATS = ["K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"];
const LOWER_IS_BETTER = new Set(["ERA", "WHIP", "L"]);

function catResultColor(result: string) {
  if (result === "WIN") return "text-emerald-400";
  if (result === "LOSS") return "text-red-400";
  if (result === "TIE") return "text-orange-500";
  return "text-slate-500";
}

function catBg(result: string) {
  if (result === "WIN") return "bg-emerald-500/10 border-emerald-500/20";
  if (result === "LOSS") return "bg-red-500/10 border-red-500/20";
  if (result === "TIE") return "bg-orange-600/10 border-orange-600/20";
  return "bg-surface border-border";
}

function fmtCat(cat: string, val: number | null): string {
  if (val === null) return "—";
  if (cat === "AVG" || cat === "ERA" || cat === "WHIP") return val.toFixed(3);
  return String(Math.round(val));
}

function fmtDateRange(start: string | null, end: string | null): string {
  if (!start || !end) return "";
  const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
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
  const isPitcher = PITCHER_SLOT_IDS.has(player.slotId);
  return (
    <div className={`flex items-center gap-2 border-b border-border/30 px-2 py-1.5 ${
      isMine ? "" : "opacity-90"
    }`}>
      {/* Slot */}
      <span className="w-7 shrink-0 text-[10px] font-bold text-slate-600">{player.slotLabel}</span>

      {/* Name */}
      <span className="min-w-0 w-[130px] truncate text-[12px] text-slate-200">{player.name}</span>

      {/* Pro team */}
      <span className="w-7 shrink-0 text-[10px] text-slate-600">{player.proTeam}</span>

      {/* Today's game */}
      <div className="flex-1 min-w-0">
        {hasGame ? (
          <span className="text-[10px] text-slate-400 whitespace-nowrap">
            {schedule!.todayOpponent}
            {schedule!.todayTime && (
              <span className="ml-1 text-slate-600">{schedule!.todayTime}</span>
            )}
          </span>
        ) : (
          <span className="text-[10px] text-slate-700">Off</span>
        )}
      </div>

      {/* Starts this matchup (SP only) */}
      {isPitcher && player.pos === "SP" && starts > 0 && (
        <span className={`shrink-0 text-[10px] tabular-nums font-bold ${
          starts >= 2 ? "text-emerald-400" : "text-orange-500"
        }`}>{starts}S</span>
      )}

      {/* Games this week */}
      {schedule && (
        <span className={`shrink-0 text-[10px] tabular-nums font-semibold ${
          schedule.weekGames >= 5 ? "text-emerald-400" :
          schedule.weekGames >= 3 ? "text-orange-500" : "text-slate-600"
        }`}>{schedule.weekGames}G</span>
      )}

      {/* Injury */}
      {player.injuryStatus !== "ACTIVE" && (
        <span className={`shrink-0 text-[10px] font-bold ${player.injuryColor}`}>
          {player.injuryLabel}
        </span>
      )}
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
  const il = roster.filter((p) => p.slotId === IL_SLOT_ID);

  const borderColor = isMine ? "border-orange-600/20" : "border-border";
  const headerColor = isMine ? "text-orange-500 border-orange-600/20" : "text-slate-300 border-border";

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
      <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-slate-700 bg-white/[0.02] flex justify-between">
        <span>{label}</span>
        {showStarts && totalStarts > 0 && (
          <span className="text-orange-500/60">{totalStarts} starts</span>
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
      <div className="text-[11px] font-semibold uppercase tracking-widest text-orange-500/60">Setup Required</div>
      <div className="mt-3 text-xl font-bold text-white">Connect ESPN Credentials</div>
      <div className="mt-3 text-[13px] text-slate-400">
        The Matchup view pulls live data from your private ESPN league. Add these environment variables to Vercel.
      </div>
      <div className="mt-5 rounded-lg border border-border bg-background px-4 py-4 text-left text-[12px]">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
          Vercel → Settings → Environment Variables
        </div>
        <div className="space-y-2 font-mono">
          <div><span className="text-orange-500">ESPN_S2</span> <span className="text-slate-600">=</span> <span className="text-slate-400">AE...</span></div>
          <div><span className="text-orange-500">ESPN_SWID</span> <span className="text-slate-600">=</span> <span className="text-slate-400">{"{XXXX-...}"}</span></div>
          <div><span className="text-orange-500">MY_ESPN_TEAM_ID</span> <span className="text-slate-600">=</span> <span className="text-slate-400">9</span></div>
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

  useEffect(() => {
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

  const batCats = useMemo(() => data?.categories.filter((c) => BAT_CATS.includes(c.cat)) ?? [], [data]);
  const pitCats = useMemo(() => data?.categories.filter((c) => PIT_CATS.includes(c.cat)) ?? [], [data]);
  const myWinCount = useMemo(() => data?.categories.filter((c) => c.result === "WIN").length ?? 0, [data]);
  const oppWinCount = useMemo(() => data?.categories.filter((c) => c.result === "LOSS").length ?? 0, [data]);

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading matchup...</div>;
  if (error === "ESPN_CREDS_MISSING" || error === "MY_ESPN_TEAM_ID_MISSING") {
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnSetupCard /></div>;
  }
  if (error || !data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-400">Failed to load matchup</div>
        <div className="text-[12px] text-slate-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-600">
              Week {data.scoringPeriodId}
            </span>
            {data.matchupStartDate && (
              <span className="text-[11px] text-slate-700">
                {fmtDateRange(data.matchupStartDate, data.matchupEndDate)}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3">
            <span className="text-xl font-bold text-orange-500">{data.myTeamName}</span>
            <span className="text-slate-600">vs</span>
            <span className="text-xl font-bold text-slate-200">{data.oppTeamName}</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold tabular-nums text-emerald-400">{myWinCount}</div>
            <div className="text-[10px] text-slate-600">CATS WON</div>
          </div>
          <div className="text-slate-700">—</div>
          <div className="text-center">
            <div className="text-2xl font-bold tabular-nums text-red-400">{oppWinCount}</div>
            <div className="text-[10px] text-slate-600">CATS LOST</div>
          </div>
        </div>
      </div>

      {/* Category scoreboard */}
      <div className="mb-6 space-y-3">
        {[
          { label: "Batting", cats: batCats },
          { label: "Pitching", cats: pitCats },
        ].map(({ label, cats }) => (
          <div key={label}>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-700">{label}</div>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
              {cats.map((c) => (
                <div key={c.cat} className={`rounded-lg border px-2 py-2 text-center ${catBg(c.result)}`}>
                  <div className="text-[10px] font-bold text-slate-500">{c.cat}</div>
                  <div className={`mt-0.5 font-mono text-[14px] font-bold ${catResultColor(c.result)}`}>
                    {fmtCat(c.cat, c.myValue)}
                  </div>
                  <div className="text-[11px] font-mono text-slate-600">
                    {fmtCat(c.cat, c.oppValue)}
                  </div>
                  {c.result !== "PENDING" && (
                    <div className={`mt-0.5 text-[9px] font-bold uppercase ${catResultColor(c.result)}`}>
                      {c.result}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Column legend */}
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">Rosters</div>
        <div className="text-[10px] text-slate-700">
          <span className="mr-3">Slot · Name · Team · Today&apos;s game</span>
          <span className="text-emerald-400">5G+</span>
          <span className="mx-1 text-slate-700">/</span>
          <span className="text-orange-500">3–4G</span>
          <span className="mx-1 text-slate-700">/</span>
          <span className="text-slate-600">≤2G</span>
          <span className="ml-1 text-slate-700">this matchup</span>
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
