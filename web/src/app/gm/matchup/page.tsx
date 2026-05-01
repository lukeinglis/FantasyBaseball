"use client";

const IL_INJURY_STATUSES = new Set(["SEVEN_DAY_DL", "TEN_DAY_DL", "FIFTEEN_DAY_DL", "SIXTY_DAY_DL", "OUT"]);
function isOnIL(status: string): boolean { return IL_INJURY_STATUSES.has(status); }

import { useState, useEffect, useMemo, useCallback } from "react";
import { DataFreshness } from "@/components/DataFreshness";
import { simulateCategoryWinProb } from "@/lib/monte-carlo";

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
  myTeamId: number;
  myTeamName: string;
  oppTeamId: number;
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

interface StartsTeamData {
  teamId: number;
  teamName: string;
  pitchers: { name: string; pos: string; proTeam: string; onIL: boolean }[];
}

interface StartsData {
  myTeamId: number;
  teams: StartsTeamData[];
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
  if (typeof val !== "number" || !Number.isFinite(val)) return "—";
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

function winProbColor(prob: number): string {
  if (prob > 66) return "text-emerald-600";
  if (prob >= 34) return "text-yellow-600";
  return "text-red-600";
}

function fmtDateRange(start: string | null, end: string | null): string {
  if (!start || !end) return "";
  const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function fmtPlayerStat(cat: string, val: number | undefined): string {
  if (typeof val !== "number" || !Number.isFinite(val)) return "-";
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
  selectedCat,
}: {
  player: MatchupPlayer;
  schedule: TeamSchedule | null;
  isMine: boolean;
  starts: number;
  selectedCat: string | null;
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

        {/* Player stats — filtered to selected category or show all */}
        {selectedCat && s[selectedCat] !== undefined ? (
          <div className="flex-1 flex items-center justify-end">
            <span className={`text-[14px] font-mono font-bold tabular-nums ${
              (s[selectedCat] ?? 0) > 0 ? "text-slate-700" : "text-slate-400"
            }`}>
              {fmtPlayerStat(selectedCat, s[selectedCat])}
            </span>
            <span className="ml-1 text-[10px] text-slate-400">{selectedCat}</span>
          </div>
        ) : selectedCat ? (
          <div className="flex-1 flex items-center justify-end">
            <span className="text-[11px] text-slate-300">-</span>
          </div>
        ) : hasStats && !isPitcher ? (
          <div className="flex-1 flex items-center gap-2 justify-end text-[9px] font-mono text-slate-500 tabular-nums">
            <span>{fmtPlayerStat("AVG", s.AVG)}</span>
            <span>{fmtPlayerStat("HR", s.HR)} <span className="text-slate-400">HR</span></span>
            <span>{fmtPlayerStat("RBI", s.RBI)} <span className="text-slate-400">RBI</span></span>
            <span>{fmtPlayerStat("R", s.R)} <span className="text-slate-400">R</span></span>
            <span>{fmtPlayerStat("SB", s.SB)} <span className="text-slate-400">SB</span></span>
          </div>
        ) : hasStats && isPitcher ? (
          <div className="flex-1 flex items-center gap-2 justify-end text-[9px] font-mono text-slate-500 tabular-nums">
            <span>{fmtPlayerStat("ERA", s.ERA)}</span>
            <span>{fmtPlayerStat("WHIP", s.WHIP)} <span className="text-slate-400">WHIP</span></span>
            <span>{fmtPlayerStat("K", s.K)} <span className="text-slate-400">K</span></span>
            <span>{fmtPlayerStat("W", s.W)} <span className="text-slate-400">W</span></span>
            {(s.SV ?? 0) > 0 && <span>{fmtPlayerStat("SV", s.SV)} <span className="text-slate-400">SV</span></span>}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* Starts this matchup (SP only) */}
        {isPitcher && player.pos === "SP" && starts > 0 && (
          <span className={`shrink-0 text-[10px] tabular-nums font-bold ${
            starts >= 2 ? "text-emerald-600" : "text-orange-600"
          }`}>{starts}S</span>
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
  selectedCat,
}: {
  teamName: string;
  roster: MatchupPlayer[];
  schedule: Record<string, TeamSchedule>;
  isMine: boolean;
  probables: ProbablePitchersData | null;
  selectedCat: string | null;
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
        <PlayerRow key={i} player={p} schedule={schedule[p.proTeam] ?? null} isMine={isMine} starts={getStarts(p.name)} selectedCat={selectedCat} />
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
  const [startsData, setStartsData] = useState<StartsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

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
          fetch("/api/espn/starts")
            .then((r) => r.json()).catch(() => null),
        ]).then(([s, p, st]) => {
          if (!s.error) setSchedule(s);
          if (p && !p.error) setProbables(p);
          if (st && !st.error) setStartsData(st);
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

  // Roster-aware projections: estimate remaining contributions per team
  const projections = useMemo(() => {
    if (!data || daysLeft <= 0 || !data.matchupStartDate || !data.matchupEndDate) return null;

    const start = new Date(data.matchupStartDate + "T12:00:00");
    const end = new Date(data.matchupEndDate + "T12:00:00");
    const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const daysElapsed = Math.max(1, totalDays - daysLeft);

    function projectTeamRemaining(roster: MatchupPlayer[]) {
      const activeBatters = roster.filter(p => BATTER_SLOT_IDS.has(p.slotId) && !isOnIL(p.injuryStatus));
      const activePitchers = roster.filter(p => PITCHER_SLOT_IDS.has(p.slotId) && !isOnIL(p.injuryStatus));

      const teamGamesLeft: Record<string, number> = {};
      for (const p of [...activeBatters, ...activePitchers]) {
        if (!(p.proTeam in teamGamesLeft)) {
          const ts = schedule[p.proTeam];
          teamGamesLeft[p.proTeam] = ts ? ts.weekGames * (daysLeft / totalDays) : daysLeft * 0.8;
        }
      }

      const rem: Record<string, number> = {};

      for (const b of activeBatters) {
        const s = b.stats;
        const ab = s.AB ?? 0;
        if (ab < 10) continue;
        const gPlayed = ab / 3.8;
        const gLeft = teamGamesLeft[b.proTeam] ?? 0;
        for (const cat of ["H", "R", "HR", "TB", "RBI", "BB", "SB"]) {
          rem[cat] = (rem[cat] ?? 0) + ((s[cat] ?? 0) / gPlayed) * gLeft;
        }
        rem["_AB"] = (rem["_AB"] ?? 0) + (ab / gPlayed) * gLeft;
        rem["_H"] = (rem["_H"] ?? 0) + ((s.H ?? 0) / gPlayed) * gLeft;
      }

      for (const p of activePitchers) {
        const s = p.stats;
        const ip = s.IP ?? 0;
        if (ip < 3) continue;
        const isSP = p.pos === "SP";
        const ipPerApp = isSP ? 5.5 : 1.0;
        const gPlayed = ip / ipPerApp;
        const gLeft = teamGamesLeft[p.proTeam] ?? 0;
        const apps = isSP ? gLeft / 5 : gLeft * 0.6;
        for (const cat of ["K", "QS", "W", "L", "SV", "HD"]) {
          rem[cat] = (rem[cat] ?? 0) + ((s[cat] ?? 0) / gPlayed) * apps;
        }
        const projIP = ipPerApp * apps;
        rem["_IP"] = (rem["_IP"] ?? 0) + projIP;
        rem["_ER"] = (rem["_ER"] ?? 0) + ((s.ERA ?? 4.0) * projIP / 9);
        rem["_WHIP_NUM"] = (rem["_WHIP_NUM"] ?? 0) + ((s.WHIP ?? 1.3) * projIP);
      }

      return rem;
    }

    const myRem = projectTeamRemaining(data.myRoster);
    const oppRem = projectTeamRemaining(data.oppRoster);

    // Current matchup values are for the week so far. Estimate current components from them.
    const currentMatchupDays = daysElapsed;
    function estimateCurrentComponents(cats: Record<string, { myValue: number | null; oppValue: number | null }>) {
      const myEra = cats["ERA"]?.myValue ?? 4.0;
      const oppEra = cats["ERA"]?.oppValue ?? 4.0;
      const myWhip = cats["WHIP"]?.myValue ?? 1.3;
      const oppWhip = cats["WHIP"]?.oppValue ?? 1.3;
      // Estimate current IP from counting stat volume (rough: ~5 IP/team/day)
      const estIP = currentMatchupDays * 5;
      return {
        myIP: estIP, oppIP: estIP,
        myER: myEra * estIP / 9, oppER: oppEra * estIP / 9,
        myWN: myWhip * estIP, oppWN: oppWhip * estIP,
        myH: cats["H"]?.myValue ?? 0, oppH: cats["H"]?.oppValue ?? 0,
        myAB: (cats["H"]?.myValue ?? 0) / Math.max(0.001, cats["AVG"]?.myValue ?? 0.250),
        oppAB: (cats["H"]?.oppValue ?? 0) / Math.max(0.001, cats["AVG"]?.oppValue ?? 0.250),
      };
    }

    const catMap: Record<string, { myValue: number | null; oppValue: number | null }> = {};
    for (const c of data.categories) catMap[c.cat] = { myValue: c.myValue, oppValue: c.oppValue };
    const comp = estimateCurrentComponents(catMap);

    return data.categories.map(c => {
      const cur = { my: c.myValue ?? 0, opp: c.oppValue ?? 0 };
      let myProj: number, oppProj: number;

      if (c.cat === "AVG") {
        const myTotalH = comp.myH + (myRem["_H"] ?? 0);
        const myTotalAB = comp.myAB + (myRem["_AB"] ?? 0);
        const oppTotalH = comp.oppH + (oppRem["_H"] ?? 0);
        const oppTotalAB = comp.oppAB + (oppRem["_AB"] ?? 0);
        myProj = myTotalAB > 0 ? myTotalH / myTotalAB : cur.my;
        oppProj = oppTotalAB > 0 ? oppTotalH / oppTotalAB : cur.opp;
      } else if (c.cat === "ERA") {
        const myTotalER = comp.myER + (myRem["_ER"] ?? 0);
        const myTotalIP = comp.myIP + (myRem["_IP"] ?? 0);
        const oppTotalER = comp.oppER + (oppRem["_ER"] ?? 0);
        const oppTotalIP = comp.oppIP + (oppRem["_IP"] ?? 0);
        myProj = myTotalIP > 0 ? (myTotalER / myTotalIP) * 9 : cur.my;
        oppProj = oppTotalIP > 0 ? (oppTotalER / oppTotalIP) * 9 : cur.opp;
      } else if (c.cat === "WHIP") {
        const myTotalWN = comp.myWN + (myRem["_WHIP_NUM"] ?? 0);
        const myTotalIP = comp.myIP + (myRem["_IP"] ?? 0);
        const oppTotalWN = comp.oppWN + (oppRem["_WHIP_NUM"] ?? 0);
        const oppTotalIP = comp.oppIP + (oppRem["_IP"] ?? 0);
        myProj = myTotalIP > 0 ? myTotalWN / myTotalIP : cur.my;
        oppProj = oppTotalIP > 0 ? oppTotalWN / oppTotalIP : cur.opp;
      } else {
        myProj = cur.my + (myRem[c.cat] ?? 0);
        oppProj = cur.opp + (oppRem[c.cat] ?? 0);
      }

      const lower = LOWER_IS_BETTER.has(c.cat);
      const projResult = lower
        ? (myProj < oppProj ? "WIN" : myProj > oppProj ? "LOSS" : "TIE")
        : (myProj > oppProj ? "WIN" : myProj < oppProj ? "LOSS" : "TIE");
      const willFlip = c.result !== "PENDING" && projResult !== c.result;

      return { cat: c.cat, myProj, oppProj, projResult, willFlip };
    });
  }, [data, schedule, daysLeft]);

  const projectedRecord = useMemo(() => {
    if (!projections) return null;
    const wins = projections.filter(p => p.projResult === "WIN").length;
    const losses = projections.filter(p => p.projResult === "LOSS").length;
    const ties = projections.filter(p => p.projResult === "TIE").length;
    const flips = projections.filter(p => p.willFlip).length;
    return { wins, losses, ties, flips };
  }, [projections]);

  const winProbs = useMemo(() => {
    if (!projections) return null;
    return Object.fromEntries(
      projections.map(p => [
        p.cat,
        simulateCategoryWinProb(
          p.myProj,
          p.oppProj,
          DAILY_SD[p.cat] ?? 1,
          daysLeft,
          LOWER_IS_BETTER.has(p.cat)
        ),
      ])
    );
  }, [projections, daysLeft]);

  // Count SP starts using ESPN's starterStatusByProGame PP data
  const startsCounts = useMemo(() => {
    if (!startsData || !data) return null;
    const myTeam = startsData.teams.find((t: any) => t.teamId === data.myTeamId);
    const oppTeam = startsData.teams.find((t: any) => t.teamId === data.oppTeamId);
    if (!myTeam || !oppTeam) return null;

    function countPPStarts(pitchers: any[]): number {
      return pitchers
        .filter((p: any) => p.pos === "SP" && !p.onIL)
        .reduce((sum: number, p: any) => sum + (p.ppCount ?? 0), 0);
    }

    return { my: countPPStarts(myTeam.pitchers), opp: countPPStarts(oppTeam.pitchers) };
  }, [startsData, data]);

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

      {/* Starts counter bar */}
      {startsCounts && (
        <div className="mb-4 flex items-center justify-center gap-4 rounded-lg border border-border bg-surface px-4 py-2">
          <span className="text-[11px] font-semibold text-slate-500">SP Starts:</span>
          <span className={`text-[13px] font-bold tabular-nums ${
            startsCounts.my > startsCounts.opp ? "text-emerald-600" :
            startsCounts.my < startsCounts.opp ? "text-red-600" : "text-slate-600"
          }`}>
            You {startsCounts.my}
          </span>
          <span className="text-slate-400">|</span>
          <span className={`text-[13px] font-bold tabular-nums ${
            startsCounts.opp > startsCounts.my ? "text-emerald-600" :
            startsCounts.opp < startsCounts.my ? "text-red-600" : "text-slate-600"
          }`}>
            Opp {startsCounts.opp}
          </span>
          {startsCounts.my !== startsCounts.opp && (
            <span className={`text-[11px] font-bold ${
              startsCounts.my > startsCounts.opp ? "text-emerald-600" : "text-red-600"
            }`}>
              ({startsCounts.my > startsCounts.opp ? "+" : ""}{startsCounts.my - startsCounts.opp})
            </span>
          )}
          {daysLeft > 0 && (
            <span className="text-[11px] text-slate-400 ml-2">{daysLeft}d left</span>
          )}
        </div>
      )}

      {/* Projected Final */}
      {projectedRecord && daysLeft > 0 && (
        <div className="mb-4 rounded-lg border border-border bg-surface px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Projected Final</span>
              <span className="text-[14px] font-bold tabular-nums">
                <span className={projectedRecord.wins > projectedRecord.losses ? "text-emerald-600" : "text-red-600"}>
                  {projectedRecord.wins}
                </span>
                <span className="text-slate-400">-</span>
                <span className={projectedRecord.losses > projectedRecord.wins ? "text-emerald-600" : "text-red-600"}>
                  {projectedRecord.losses}
                </span>
                {projectedRecord.ties > 0 && (
                  <><span className="text-slate-400">-</span><span className="text-orange-600">{projectedRecord.ties}</span></>
                )}
              </span>
            </div>
            {projectedRecord.flips > 0 && (
              <span className="text-[11px] font-bold text-orange-600">
                {projectedRecord.flips} {projectedRecord.flips === 1 ? "category" : "categories"} projected to flip
              </span>
            )}
          </div>
          {projections && projections.some(p => p.willFlip) && (
            <div className="mt-2 flex gap-2 flex-wrap">
              {projections.filter(p => p.willFlip).map(p => (
                <span key={p.cat} className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  p.projResult === "WIN" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                }`}>
                  {p.cat}: {p.projResult === "WIN" ? "flipping to W" : "flipping to L"}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

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
                const proj = projections?.find(p => p.cat === c.cat);
                const winProb = winProbs?.[c.cat] ?? null;
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

                // Danger flag logic: win probability in contested zone
                const isWinningAtRisk = winProb !== null && daysLeft > 0 && c.result === "WIN" && winProb < 67;
                const isLosingFlippable = winProb !== null && daysLeft > 0 && c.result === "LOSS" && winProb > 33;
                const dangerRing = isWinningAtRisk
                  ? "ring-2 ring-orange-400 animate-pulse"
                  : isLosingFlippable
                  ? "ring-2 ring-red-400 animate-pulse"
                  : "";

                return (
                  <div key={c.cat}
                    className={`flex flex-col items-center cursor-pointer rounded-lg px-1 py-1 transition-all ${
                      selectedCat === c.cat ? "ring-2 ring-orange-400 bg-orange-50" :
                      dangerRing ? dangerRing :
                      "hover:bg-black/[0.03]"
                    }`}
                    onClick={() => setSelectedCat(selectedCat === c.cat ? null : c.cat)}>
                    {/* Category label */}
                    <span className="text-[10px] font-bold text-slate-500 mb-1">
                      {c.cat}{(isWinningAtRisk || isLosingFlippable) && " \u26A0"}
                    </span>

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

                    {/* Result + projection + win probability */}
                    <div className="mt-1 flex flex-col items-center">
                      {c.result !== "PENDING" && (
                        <span className={`text-[9px] font-bold uppercase ${catResultColor(c.result)}`}>
                          {c.result}
                        </span>
                      )}
                      {proj && daysLeft > 0 && (
                        <span className={`text-[8px] font-bold ${
                          proj.willFlip ? "text-orange-600" : proj.projResult === "WIN" ? "text-emerald-600" : proj.projResult === "LOSS" ? "text-red-500" : "text-slate-400"
                        }`}>
                          {fmtCat(c.cat, proj.myProj)}{proj.willFlip ? " !" : ""}
                        </span>
                      )}
                      {winProb !== null && daysLeft > 0 && (
                        <span className={`text-[8px] font-bold tabular-nums ${winProbColor(winProb)}`}>
                          {winProb}%
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
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">Rosters</span>
          {selectedCat && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-2 py-0.5">
              Showing: {selectedCat}
              <button onClick={() => setSelectedCat(null)} className="ml-1 text-slate-400 hover:text-slate-700">✕</button>
            </span>
          )}
        </div>
        {!selectedCat && (
          <div className="text-[10px] text-slate-400">
            Click a category donut to filter player stats
          </div>
        )}
      </div>

      {/* Side-by-side rosters */}
      <div className="flex gap-4">
        <RosterPanel
          teamName={data.myTeamName}
          roster={data.myRoster}
          schedule={schedule}
          isMine={true}
          probables={probables}
          selectedCat={selectedCat}
        />
        <RosterPanel
          teamName={data.oppTeamName}
          roster={data.oppRoster}
          schedule={schedule}
          isMine={false}
          probables={probables}
          selectedCat={selectedCat}
        />
      </div>
    </div>
  );
}
