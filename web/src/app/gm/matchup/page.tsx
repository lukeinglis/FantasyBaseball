"use client";

const IL_INJURY_STATUSES = new Set(["SEVEN_DAY_DL", "TEN_DAY_DL", "FIFTEEN_DAY_DL", "SIXTY_DAY_DL", "OUT"]);
function isOnIL(status: string): boolean { return IL_INJURY_STATUSES.has(status); }

import { useState, useEffect, useMemo, useCallback } from "react";
import { DataFreshness } from "@/components/DataFreshness";
import { EspnAuthRequired } from "@/components/EspnAuthRequired";
import { simulateCategoryWinProb } from "@/lib/monte-carlo";
import { isPunt, isHighImpact, categoryTierClass, CATEGORY_WEIGHTS, LOWER_IS_BETTER, categoryTier } from "@/lib/category-weights";
import { sanitizeNum } from "@/lib/sanitize";

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
  pitchers: { name: string; pos: string; proTeam: string; onIL: boolean; ppCount: number; ppNextCount: number }[];
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

interface TrackerTeamRawStats {
  H: number; AB: number; R: number; HR: number;
  TB: number; RBI: number; BB: number; SB: number; AVG: number;
}

interface TrackerTeamPitchingRaw {
  IP: number; H: number; ER: number; BB: number;
  K: number; QS: number; W: number; L: number;
  SV: number; HD: number; ERA: number; WHIP: number;
}

interface DailyPoints {
  date: string; dayLabel: string; myPts: number; oppPts: number;
}

interface TrackerCatResult {
  cat: string; myValue: number; oppValue: number;
  result: "WIN" | "LOSS" | "TIE" | "PENDING";
}

interface TrackerData {
  week: number;
  startDate: string;
  endDate: string;
  daysElapsed: number;
  totalDays: number;
  myTeam: { id: number; name: string };
  oppTeam: { id: number; name: string };
  batting: { my: TrackerTeamRawStats; opp: TrackerTeamRawStats };
  pitching: { my: TrackerTeamPitchingRaw; opp: TrackerTeamPitchingRaw };
  dailyPoints: DailyPoints[];
  catResults: TrackerCatResult[];
}

const TRACKER_BAT_COLS = ["H", "AB", "R", "HR", "TB", "RBI", "BB", "SB", "AVG"] as const;
const TRACKER_PIT_COLS = ["IP", "H", "ER", "BB", "K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"] as const;

function fmtTrackerVal(cat: string, val: number): string {
  if (!Number.isFinite(val)) return "-";
  if (cat === "AVG") return val.toFixed(3);
  if (cat === "ERA" || cat === "WHIP") return val.toFixed(2);
  if (cat === "IP") return val.toFixed(1);
  return String(Math.round(val));
}

function compareCat(cat: string, myVal: number, oppVal: number): "WIN" | "LOSS" | "TIE" {
  if (LOWER_IS_BETTER.has(cat)) {
    if (myVal < oppVal) return "WIN";
    if (myVal > oppVal) return "LOSS";
    return "TIE";
  }
  if (myVal > oppVal) return "WIN";
  if (myVal < oppVal) return "LOSS";
  return "TIE";
}

// Slot IDs
const BATTER_SLOT_IDS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 12]);  // C,1B,2B,3B,SS,OF×3,UTIL
const PITCHER_SLOT_IDS = new Set([13, 14, 15]);                     // P, SP, RP
const BENCH_SLOT_ID = 16;


const BAT_CATS = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG"];
const PIT_CATS = ["K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"];

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

function RosterSection({ label, players, showStarts, totalStarts, schedule, isMine, getStarts, selectedCat }: {
  label: string;
  players: MatchupPlayer[];
  showStarts?: boolean;
  totalStarts: number;
  schedule: Record<string, TeamSchedule>;
  isMine: boolean;
  getStarts: (name: string) => number;
  selectedCat: string | null;
}) {
  return (
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

  return (
    <div className={`rounded-lg border ${borderColor} bg-surface flex-1 min-w-0`}>
      <div className={`border-b ${headerColor} px-3 py-2`}>
        <span className="text-[12px] font-semibold">{teamName}</span>
      </div>
      <RosterSection label="Batters" players={batters} totalStarts={totalStarts} schedule={schedule} isMine={isMine} getStarts={getStarts} selectedCat={selectedCat} />
      <RosterSection label="Pitchers" players={pitchers} showStarts totalStarts={totalStarts} schedule={schedule} isMine={isMine} getStarts={getStarts} selectedCat={selectedCat} />
      {bench.length > 0 && <RosterSection label="Bench" players={bench} totalStarts={totalStarts} schedule={schedule} isMine={isMine} getStarts={getStarts} selectedCat={selectedCat} />}
      {il.length > 0 && <RosterSection label="IL" players={il} totalStarts={totalStarts} schedule={schedule} isMine={isMine} getStarts={getStarts} selectedCat={selectedCat} />}
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
  const [activeTab, setActiveTab] = useState<"matchup" | "tracker" | "next-week">("matchup");
  const [trackerData, setTrackerData] = useState<TrackerData | null>(null);
  const [trackerLoading, setTrackerLoading] = useState(false);
  const [h2hData, setH2hData] = useState<{
    opponents: Record<number, {
      teamName: string;
      totalWins: number;
      totalLosses: number;
      totalTies: number;
      catWins: Record<string, number>;
      catLosses: Record<string, number>;
      matchupsPlayed: number;
    }>;
  } | null>(null);
  const [oppLeagueRanks, setOppLeagueRanks] = useState<Record<string, number> | null>(null);

  const fetchData = useCallback(() => {
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

  useEffect(() => {
    if (activeTab !== "tracker" || trackerData) return;
    let cancelled = false;
    const loadTracker = async () => {
      try {
        const r = await fetch("/api/espn/matchup-tracker");
        const d = (await r.json()) as TrackerData & { error?: string };
        if (!cancelled && !d.error) setTrackerData(d);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setTrackerLoading(false);
      }
    };
    setTrackerLoading(true);
    loadTracker();
    return () => { cancelled = true; };
  }, [activeTab, trackerData]);

  useEffect(() => {
    if (!data) return;
    Promise.all([
      fetch("/api/espn/h2h").then((r) => r.json()).catch(() => null),
      fetch("/api/espn/league-stats?scope=season").then((r) => r.json()).catch(() => null),
    ]).then(([h2h, leagueStats]) => {
      if (h2h && !h2h.error) setH2hData({ opponents: h2h.opponents });
      if (leagueStats && !leagueStats.error && leagueStats.teams) {
        const oppTeam = leagueStats.teams.find((t: { teamId: number }) => t.teamId === data.oppTeamId);
        if (oppTeam) setOppLeagueRanks(oppTeam.ranks);
      }
    });
  }, [data]);

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
    const myTeam = startsData.teams.find((t) => t.teamId === data.myTeamId);
    const oppTeam = startsData.teams.find((t) => t.teamId === data.oppTeamId);
    if (!myTeam || !oppTeam) return null;

    function countPPStarts(pitchers: StartsTeamData["pitchers"]): number {
      return pitchers
        .filter((p) => p.pos === "SP" && !p.onIL)
        .reduce((sum, p) => sum + (p.ppCount ?? 0), 0);
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
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnAuthRequired /></div>;
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

      {/* Tab bar */}
      <div className="mb-4 flex gap-1 border-b border-border">
        {(["matchup", "tracker", "next-week"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-[12px] font-semibold border-b-2 transition-colors ${
              activeTab === tab
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab === "matchup" ? "Matchup" : tab === "tracker" ? "Daily Tracker" : "Next Week"}
          </button>
        ))}
      </div>

      {/* Daily Tracker Tab */}
      {activeTab === "tracker" && (
        <DailyTrackerSection data={trackerData} loading={trackerLoading} />
      )}

      {/* Next Week Tab */}
      {activeTab === "next-week" && (
        <NextWeekSection />
      )}

      {/* Main Matchup Tab */}
      {activeTab === "matchup" && <>

      {/* Live Scoreboard */}
      <div className="mb-4 rounded-xl border border-border bg-surface overflow-hidden">
        <div className="border-b border-border px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Live Scoreboard</span>
            <span className="text-[14px] font-bold tabular-nums">
              <span className={myWinCount > oppWinCount ? "text-emerald-600" : myWinCount < oppWinCount ? "text-red-600" : "text-slate-600"}>
                {myWinCount > oppWinCount ? "Winning" : myWinCount < oppWinCount ? "Losing" : "Tied"} {myWinCount}-{oppWinCount}{myTieCount > 0 ? `-${myTieCount}` : ""}
              </span>
            </span>
          </div>
          {winProbs && (() => {
            const catWinProbs = Object.values(winProbs);
            const avgWinProb = catWinProbs.length > 0
              ? Math.round(catWinProbs.reduce((s, v) => s + v, 0) / catWinProbs.length)
              : 50;
            return (
              <span className={`text-[14px] font-bold tabular-nums ${
                avgWinProb > 55 ? "text-emerald-600" : avgWinProb < 45 ? "text-red-600" : "text-orange-600"
              }`}>
                {avgWinProb}% win prob
              </span>
            );
          })()}
        </div>
        <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {data.categories.map((c) => {
            const myVal = c.myValue ?? 0;
            const oppVal = c.oppValue ?? 0;
            const lower = LOWER_IS_BETTER.has(c.cat);
            const gap = lower ? oppVal - myVal : myVal - oppVal;
            const range = Math.max(Math.abs(myVal), Math.abs(oppVal), 1);
            const isContested = !isPunt(c.cat) && Math.abs(gap) / range < 0.10;
            const canPush = !isPunt(c.cat) && c.result === "LOSS" && winProbs && (winProbs[c.cat] ?? 0) > 33;
            return (
              <div key={c.cat} className={`rounded-lg px-3 py-2 text-[12px] ${
                isContested ? "bg-yellow-50 border border-yellow-300" :
                canPush ? "bg-blue-50 border border-blue-200" :
                "border border-transparent"
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`font-bold ${catResultColor(c.result)}`}>{c.cat}</span>
                  <span className={`text-[9px] font-bold ${catResultColor(c.result)}`}>{c.result}</span>
                </div>
                <div className="mt-0.5 font-mono tabular-nums">
                  <span className="text-slate-700">{fmtCat(c.cat, c.myValue)}</span>
                  <span className="text-slate-400"> vs </span>
                  <span className="text-slate-500">{fmtCat(c.cat, c.oppValue)}</span>
                  {c.result !== "PENDING" && (
                    <span className={`ml-1 text-[10px] font-bold ${gap > 0 ? "text-emerald-600" : gap < 0 ? "text-red-600" : "text-slate-400"}`}>
                      ({gap > 0 ? "+" : ""}{c.cat === "AVG" || c.cat === "ERA" || c.cat === "WHIP" ? gap.toFixed(3) : Math.round(gap)})
                    </span>
                  )}
                </div>
                {isContested && <div className="text-[9px] font-bold text-yellow-600 mt-0.5">CONTESTED</div>}
                {canPush && !isContested && <div className="text-[9px] font-bold text-blue-600 mt-0.5">PUSHABLE</div>}
              </div>
            );
          })}
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

      {/* At-Risk Categories */}
      {winProbs && projections && daysLeft > 0 && (() => {
        const atRisk = data.categories
          .filter((c) => {
            if (isPunt(c.cat)) return false;
            const prob = winProbs[c.cat] ?? null;
            if (prob === null) return false;
            if (c.result === "WIN" && prob < 67) return true;
            if (c.result === "LOSS" && prob > 33) return true;
            return false;
          })
          .map((c) => {
            const prob = winProbs[c.cat] ?? 50;
            const proj = projections.find((p) => p.cat === c.cat);
            const gap = c.myValue !== null && c.oppValue !== null
              ? LOWER_IS_BETTER.has(c.cat)
                ? c.oppValue - c.myValue
                : c.myValue - c.oppValue
              : 0;
            const weight = CATEGORY_WEIGHTS[c.cat] ?? 0;
            return { ...c, prob, proj, gap, weight };
          })
          .sort((a, b) => b.weight - a.weight);

        if (atRisk.length === 0) return null;

        return (
          <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50/50">
            <div className="border-b border-orange-200 px-4 py-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-orange-600">At-Risk Categories</span>
              <span className="text-[10px] text-orange-400">{atRisk.length} contested</span>
            </div>
            <div className="px-4 py-3 space-y-2">
              {atRisk.map((c) => (
                <div key={c.cat} className="flex items-center gap-3">
                  <span className={`w-12 text-[12px] font-bold ${
                    c.result === "WIN" ? "text-emerald-600" : "text-red-600"
                  }`}>{c.cat}</span>
                  <span className={`text-[10px] font-semibold ${
                    c.result === "WIN" ? "text-emerald-600" : "text-red-600"
                  }`}>{c.result}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="font-mono tabular-nums text-slate-700">
                        {fmtCat(c.cat, c.myValue)} vs {fmtCat(c.cat, c.oppValue)}
                      </span>
                      <span className={`font-semibold ${c.gap > 0 ? "text-emerald-600" : "text-red-600"}`}>
                        ({c.gap > 0 ? "+" : ""}{c.cat === "AVG" || c.cat === "ERA" || c.cat === "WHIP" ? c.gap.toFixed(3) : Math.round(c.gap)})
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-[11px] font-bold tabular-nums ${
                      c.prob > 55 ? "text-emerald-600" : c.prob < 45 ? "text-red-600" : "text-orange-600"
                    }`}>{c.prob}% win</span>
                  </div>
                  {c.proj?.willFlip && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      c.proj.projResult === "WIN" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                    }`}>FLIP</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

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
                const isWinningAtRisk = winProb !== null && daysLeft > 0 && c.result === "WIN" && winProb < 67 && !isPunt(c.cat);
                const isLosingFlippable = winProb !== null && daysLeft > 0 && c.result === "LOSS" && winProb > 33 && !isPunt(c.cat);
                const dangerRing = isWinningAtRisk
                  ? "ring-2 ring-orange-400 animate-pulse"
                  : isLosingFlippable
                  ? "ring-2 ring-red-400 animate-pulse"
                  : "";

                return (
                  <div key={c.cat}
                    className={`flex flex-col items-center cursor-pointer rounded-lg px-1 py-1 transition-all ${
                      isPunt(c.cat) ? "opacity-50" : ""
                    } ${
                      isHighImpact(c.cat) ? "border-t-2 border-t-amber-400" : ""
                    } ${
                      selectedCat === c.cat ? "ring-2 ring-orange-400 bg-orange-50" :
                      dangerRing ? dangerRing :
                      "hover:bg-black/[0.03]"
                    }`}
                    onClick={() => setSelectedCat(selectedCat === c.cat ? null : c.cat)}>
                    {/* Category label */}
                    <span className="text-[10px] font-bold text-slate-500 mb-1">
                      {c.cat}{(isWinningAtRisk || isLosingFlippable) && " \u26A0"}
                    </span>
                    {isPunt(c.cat) && <span className="text-[8px] text-slate-400">punt</span>}
                    {isHighImpact(c.cat) && <span className="text-[8px] text-amber-600">key</span>}

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

      {/* Opponent Scouting */}
      {data && (h2hData || oppLeagueRanks) && (() => {
        const oppH2H = h2hData?.opponents[data.oppTeamId];
        const allCats = [...BAT_CATS, ...PIT_CATS];
        return (
          <div className="mb-6 rounded-lg border border-border bg-surface">
            <div className="border-b border-border px-4 py-2 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Opponent Scouting</span>
                <span className="ml-2 text-[11px] text-slate-400">{data.oppTeamName}</span>
              </div>
              {oppH2H && (
                <span className="text-[11px] font-mono tabular-nums text-slate-500">
                  {oppH2H.matchupsPlayed} matchup{oppH2H.matchupsPlayed !== 1 ? "s" : ""} this season
                </span>
              )}
            </div>
            <div className="px-4 py-3">
              {/* Historical category record vs this opponent */}
              {oppH2H && oppH2H.matchupsPlayed > 0 && (
                <div className="mb-3">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Category record vs {data.oppTeamName}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {allCats.map((cat) => {
                      const wins = oppH2H.catWins[cat] ?? 0;
                      const losses = oppH2H.catLosses[cat] ?? 0;
                      const ties = oppH2H.matchupsPlayed - wins - losses;
                      const dominant = wins > losses;
                      const weak = losses > wins;
                      return (
                        <div key={cat} className={`rounded px-2 py-1 text-center min-w-[48px] border ${
                          dominant ? "bg-emerald-50 border-emerald-200" :
                          weak ? "bg-red-50 border-red-200" :
                          "bg-slate-50 border-border"
                        } ${isPunt(cat) ? "opacity-50" : ""}`}>
                          <div className="text-[9px] font-bold text-slate-600">{cat}</div>
                          <div className={`text-[11px] font-bold font-mono tabular-nums ${
                            dominant ? "text-emerald-600" : weak ? "text-red-600" : "text-slate-500"
                          }`}>
                            {wins}-{losses}{ties > 0 ? `-${ties}` : ""}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Opponent league-wide category rankings */}
              {oppLeagueRanks && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Opponent league rankings (season)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {allCats.map((cat) => {
                      const rank = oppLeagueRanks[cat] ?? 0;
                      const isStrength = rank <= 3;
                      const isWeakness = rank >= 9;
                      return (
                        <div key={cat} className={`rounded px-2 py-1 text-center min-w-[40px] border ${
                          isWeakness ? "bg-emerald-50 border-emerald-200" :
                          isStrength ? "bg-red-50 border-red-200" :
                          "bg-slate-50 border-border"
                        } ${isPunt(cat) ? "opacity-50" : ""}`}>
                          <div className="text-[9px] font-bold text-slate-600">{cat}</div>
                          <div className={`text-[11px] font-bold tabular-nums ${
                            isWeakness ? "text-emerald-600" :
                            isStrength ? "text-red-600" : "text-slate-500"
                          }`}>
                            #{rank}
                          </div>
                          <div className="text-[7px] text-slate-400">
                            {isWeakness ? "weak" : isStrength ? "strong" : ""}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

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
      </>}
    </div>
  );
}

function TrackerStatTable({ label, myStats, oppStats, cols, myTeamName, oppTeamName }: {
  label: string;
  myStats: Record<string, number>;
  oppStats: Record<string, number>;
  cols: readonly string[];
  myTeamName: string;
  oppTeamName: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface overflow-x-auto">
      <div className="border-b border-border px-4 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</span>
      </div>
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-border bg-black/[0.02]">
            <th className="px-3 py-1.5 text-left font-semibold text-slate-500 w-28">Team</th>
            {cols.map((col) => {
              const result = compareCat(col, sanitizeNum(myStats[col]), sanitizeNum(oppStats[col]));
              return (
                <th key={col} className={`px-2 py-1.5 text-right font-semibold tabular-nums ${
                  result === "WIN" ? "text-emerald-600" : result === "LOSS" ? "text-red-600" : result === "TIE" ? "text-orange-600" : "text-slate-500"
                }`}>{col}</th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border">
            <td className="px-3 py-1.5 font-semibold text-orange-600 truncate max-w-[120px]">{myTeamName}</td>
            {cols.map((col) => {
              const result = compareCat(col, sanitizeNum(myStats[col]), sanitizeNum(oppStats[col]));
              return (
                <td key={col} className={`px-2 py-1.5 text-right font-mono tabular-nums font-bold ${
                  result === "WIN" ? "bg-emerald-50 text-emerald-600" : result === "LOSS" ? "bg-red-50 text-red-600" : result === "TIE" ? "bg-orange-50 text-orange-600" : ""
                }`}>{fmtTrackerVal(col, sanitizeNum(myStats[col]))}</td>
              );
            })}
          </tr>
          <tr className="border-b border-border">
            <td className="px-3 py-1.5 font-semibold text-slate-500 truncate max-w-[120px]">{oppTeamName}</td>
            {cols.map((col) => {
              const result = compareCat(col, sanitizeNum(myStats[col]), sanitizeNum(oppStats[col]));
              const oppResult = result === "WIN" ? "LOSS" : result === "LOSS" ? "WIN" : "TIE";
              return (
                <td key={col} className={`px-2 py-1.5 text-right font-mono tabular-nums ${
                  oppResult === "WIN" ? "bg-emerald-50 text-emerald-600" : oppResult === "LOSS" ? "bg-red-50 text-red-600" : oppResult === "TIE" ? "bg-orange-50 text-orange-600" : ""
                }`}>{fmtTrackerVal(col, sanitizeNum(oppStats[col]))}</td>
              );
            })}
          </tr>
          <tr className="bg-black/[0.02]">
            <td className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase">Diff</td>
            {cols.map((col) => {
              const myVal = sanitizeNum(myStats[col]);
              const oppVal = sanitizeNum(oppStats[col]);
              const diff = LOWER_IS_BETTER.has(col) ? oppVal - myVal : myVal - oppVal;
              const isRate = ["AVG", "ERA", "WHIP"].includes(col);
              return (
                <td key={col} className={`px-2 py-1.5 text-right font-mono tabular-nums text-[10px] font-bold ${
                  diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-600" : "text-slate-400"
                }`}>{diff > 0 ? "+" : ""}{isRate ? diff.toFixed(3) : col === "IP" ? diff.toFixed(1) : Math.round(diff)}</td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function DailyTrackerSection({ data, loading }: { data: TrackerData | null; loading: boolean }) {
  if (loading) return <div className="flex h-32 items-center justify-center text-slate-500">Loading tracker...</div>;
  if (!data) return <div className="text-center text-slate-400 py-8">Tracker data unavailable</div>;

  const winCount = data.catResults.filter((c) => c.result === "WIN").length;
  const lossCount = data.catResults.filter((c) => c.result === "LOSS").length;
  const tieCount = data.catResults.filter((c) => c.result === "TIE").length;
  const maxDailyPts = Math.max(1, ...data.dailyPoints.map((d) => Math.max(d.myPts, d.oppPts)));
  const hasDailyData = data.dailyPoints.some((d) => d.myPts > 0 || d.oppPts > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold tabular-nums text-emerald-600">{winCount}</span>
          <span className="text-[10px] text-slate-500">W</span>
          <span className="text-slate-400">-</span>
          <span className="text-2xl font-bold tabular-nums text-red-600">{lossCount}</span>
          <span className="text-[10px] text-slate-500">L</span>
          {tieCount > 0 && (<>
            <span className="text-slate-400">-</span>
            <span className="text-2xl font-bold tabular-nums text-orange-600">{tieCount}</span>
            <span className="text-[10px] text-slate-500">T</span>
          </>)}
        </div>
        <span className="text-[11px] text-slate-400">Day {data.daysElapsed} of {data.totalDays}</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {data.catResults.map((c) => (
          <div key={c.cat} className={`rounded px-2.5 py-1.5 text-center min-w-[52px] border ${
            c.result === "WIN" ? "bg-emerald-50 border-emerald-200" :
            c.result === "LOSS" ? "bg-red-50 border-red-200" :
            c.result === "TIE" ? "bg-orange-50 border-orange-200" :
            "bg-slate-50 border-border"
          }`}>
            <div className={`text-[9px] font-bold ${categoryTierClass(c.cat)}`}>{c.cat}</div>
            <div className={`text-[12px] font-bold font-mono tabular-nums ${
              c.result === "WIN" ? "text-emerald-600" : c.result === "LOSS" ? "text-red-600" : c.result === "TIE" ? "text-orange-600" : "text-slate-500"
            }`}>{fmtTrackerVal(c.cat, c.myValue)}</div>
            <div className="text-[10px] font-mono tabular-nums text-slate-400">{fmtTrackerVal(c.cat, c.oppValue)}</div>
          </div>
        ))}
      </div>

      <TrackerStatTable
        label="Batting"
        myStats={data.batting.my as unknown as Record<string, number>}
        oppStats={data.batting.opp as unknown as Record<string, number>}
        cols={TRACKER_BAT_COLS}
        myTeamName={data.myTeam.name}
        oppTeamName={data.oppTeam.name}
      />

      <TrackerStatTable
        label="Pitching"
        myStats={data.pitching.my as unknown as Record<string, number>}
        oppStats={data.pitching.opp as unknown as Record<string, number>}
        cols={TRACKER_PIT_COLS}
        myTeamName={data.myTeam.name}
        oppTeamName={data.oppTeam.name}
      />

      {hasDailyData && (
        <div className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-4 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Daily Fantasy Points</span>
          </div>
          <div className="px-4 py-3 space-y-2">
            {data.dailyPoints.map((d, i) => {
              const isPast = i < data.daysElapsed;
              const isToday = i === data.daysElapsed - 1;
              const myW = Math.max(0, (d.myPts / maxDailyPts) * 100);
              const oppW = Math.max(0, (d.oppPts / maxDailyPts) * 100);
              return (
                <div key={d.date} className={`flex items-center gap-2 ${!isPast && !isToday ? "opacity-30" : ""}`}>
                  <span className={`w-12 text-[10px] font-bold ${isToday ? "text-orange-600" : "text-slate-500"}`}>{d.dayLabel}</span>
                  <div className="flex-1 flex gap-1">
                    <div className="flex-1 flex items-center gap-1">
                      <div className="h-3 rounded bg-orange-400" style={{ width: `${myW}%`, minWidth: d.myPts > 0 ? "4px" : "0px" }} />
                      <span className="text-[10px] font-mono tabular-nums text-slate-600">{d.myPts > 0 ? d.myPts.toFixed(1) : ""}</span>
                    </div>
                    <div className="flex-1 flex items-center gap-1">
                      <div className="h-3 rounded bg-slate-300" style={{ width: `${oppW}%`, minWidth: d.oppPts > 0 ? "4px" : "0px" }} />
                      <span className="text-[10px] font-mono tabular-nums text-slate-400">{d.oppPts > 0 ? d.oppPts.toFixed(1) : ""}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function NextWeekSection() {
  const [probables, setProbables] = useState<{ byPitcher: Record<string, { date: string; pitcherName: string; team: string; opponent: string }[]>; allStarts: { date: string; pitcherName: string; team: string; opponent: string }[] } | null>(null);
  const [startsData, setStartsData] = useState<{ myTeamId: number; nextDates: { start: string; end: string } | null; teams: { teamId: number; teamName: string; pitchers: { name: string; pos: string; proTeam: string; onIL: boolean }[] }[]; rosteredPitchers: string[] } | null>(null);
  const [leagueTeams, setLeagueTeams] = useState<{ teamId: number; teamName: string; ranks: Record<string, number> }[]>([]);
  const [nextOppId, setNextOppId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/espn/starts")
      .then((r) => r.json())
      .then((data: { error?: string; nextDates?: { start: string; end: string }; myTeamId?: number; teams?: { teamId: number; teamName: string; pitchers: { name: string; pos: string; proTeam: string; onIL: boolean }[] }[]; rosteredPitchers?: string[] }) => {
        if (data.error) { setLoading(false); return; }
        setStartsData(data as typeof startsData);

        const fetches: Promise<unknown>[] = [];
        if (data.nextDates) {
          fetches.push(fetch(`/api/mlb/probable-pitchers?startDate=${data.nextDates.start}&endDate=${data.nextDates.end}`).then((r) => r.json()).catch(() => null));
        } else {
          fetches.push(Promise.resolve(null));
        }
        fetches.push(fetch("/api/espn/league-stats?scope=season").then((r) => r.json()).catch(() => ({ teams: [] })));
        fetches.push(fetch("/api/espn/schedule").then((r) => r.json()).catch(() => null));

        return Promise.all(fetches).then(([pp, league, sched]) => {
          const p = pp as (typeof probables & { error?: string }) | null;
          const l = league as { teams?: typeof leagueTeams; error?: string };
          if (p && !(p as { error?: string }).error) setProbables(p as typeof probables);
          if (l.teams) setLeagueTeams(l.teams);
          const schedData = sched as { error?: string; nextOpponent?: { teamId: number } } | null;
          if (schedData && !schedData.error && schedData.nextOpponent) setNextOppId(schedData.nextOpponent.teamId);
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex h-32 items-center justify-center text-slate-500">Loading next week...</div>;
  if (!startsData) return <div className="text-center text-slate-400 py-8">Next week data unavailable</div>;

  const nextDates = startsData.nextDates;
  const oppTeam = nextOppId ? leagueTeams.find((t) => t.teamId === nextOppId) : null;
  const oppWeakCats = oppTeam ? Object.entries(oppTeam.ranks).filter(([, r]) => r >= 8).sort(([, a], [, b]) => b - a).map(([cat, rank]) => ({ cat, rank })) : [];
  const oppStrongCats = oppTeam ? Object.entries(oppTeam.ranks).filter(([, r]) => r <= 3).sort(([, a], [, b]) => a - b).map(([cat, rank]) => ({ cat, rank })) : [];

  const myTeam = startsData.teams.find((t) => t.teamId === startsData.myTeamId);
  const rosteredSet = new Set(startsData.rosteredPitchers ?? []);

  function findPitcherStarts(pitcherName: string) {
    if (!probables) return [];
    if (probables.byPitcher[pitcherName]) return probables.byPitcher[pitcherName];
    const lower = pitcherName.toLowerCase();
    for (const [name, starts] of Object.entries(probables.byPitcher)) {
      if (name.toLowerCase() === lower) return starts;
    }
    return [];
  }

  const myDoubleStarters = myTeam ? myTeam.pitchers
    .filter((p) => p.pos === "SP" && !p.onIL)
    .map((p) => ({ ...p, starts: findPitcherStarts(p.name), startCount: findPitcherStarts(p.name).length }))
    .filter((p) => p.startCount >= 2)
    .sort((a, b) => b.startCount - a.startCount) : [];

  const faDoubleStarters = probables ? Object.entries(probables.byPitcher)
    .filter(([, starts]) => starts.length >= 2)
    .filter(([name]) => !rosteredSet.has(name))
    .map(([name, starts]) => ({ name, starts, team: starts[0]?.team ?? "" }))
    .sort((a, b) => b.starts.length - a.starts.length) : [];

  const fmtD = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const fmtRange = (s: string, e: string) => `${new Date(s + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} to ${new Date(e + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  return (
    <div className="space-y-4">
      {nextDates && <div className="text-[12px] text-slate-500">{fmtRange(nextDates.start, nextDates.end)}</div>}

      {oppTeam && (
        <div className="rounded-lg border border-border bg-surface overflow-hidden">
          <div className="border-b border-border px-4 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Next Opponent </span>
            <span className="text-[14px] font-bold text-slate-700">{oppTeam.teamName}</span>
          </div>
          <div className="px-4 py-3 grid gap-4 sm:grid-cols-2">
            {oppWeakCats.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-2">Their Weaknesses</div>
                <div className="flex flex-wrap gap-1.5">
                  {oppWeakCats.map(({ cat, rank }) => (
                    <span key={cat} className="rounded bg-emerald-50 border border-emerald-200 px-2 py-1 text-[11px]">
                      <span className="font-bold text-emerald-700">{cat}</span>
                      <span className="ml-1 text-slate-500">#{rank}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {oppStrongCats.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-red-600 uppercase tracking-wider mb-2">Their Strengths</div>
                <div className="flex flex-wrap gap-1.5">
                  {oppStrongCats.map(({ cat, rank }) => (
                    <span key={cat} className="rounded bg-red-50 border border-red-200 px-2 py-1 text-[11px]">
                      <span className="font-bold text-red-700">{cat}</span>
                      <span className="ml-1 text-slate-500">#{rank}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {myDoubleStarters.length > 0 && (
        <div className="rounded-lg border border-orange-300 bg-surface overflow-hidden">
          <div className="border-b border-orange-300 px-4 py-2.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-600">Your Double Starters</span>
            <span className="text-[14px] font-bold tabular-nums text-orange-600">{myDoubleStarters.length}</span>
          </div>
          <div className="divide-y divide-border">
            {myDoubleStarters.map((p) => (
              <div key={p.name} className="px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-emerald-700">{p.name} <span className="text-[10px] text-slate-500">{p.proTeam}</span></span>
                  <span className="text-[14px] font-bold tabular-nums text-emerald-600">{p.startCount} starts</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {p.starts.map((s, i) => (
                    <span key={i} className="rounded px-2 py-0.5 text-[10px] bg-orange-50 border border-orange-200 text-orange-700">
                      <span className="font-semibold">{fmtD(s.date)}</span> <span className="text-orange-600">{s.opponent}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-emerald-300 bg-surface overflow-hidden">
        <div className="border-b border-emerald-300 px-4 py-2.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">FA Double Starters</span>
          <span className="text-[14px] font-bold tabular-nums text-emerald-600">{faDoubleStarters.length}</span>
        </div>
        {faDoubleStarters.length > 0 ? (
          <div className="divide-y divide-border">
            {faDoubleStarters.map((fa) => (
              <div key={fa.name} className="px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-emerald-700">{fa.name} <span className="text-[10px] text-slate-500">{fa.team}</span></span>
                  <span className="text-[14px] font-bold tabular-nums text-emerald-600">{fa.starts.length} starts</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {fa.starts.map((s, i) => (
                    <span key={i} className="rounded px-2 py-0.5 text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-700">
                      <span className="font-semibold">{fmtD(s.date)}</span> <span className="text-emerald-600">{s.opponent}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-6 text-center text-[12px] text-slate-500">
            {!probables ? "Probable pitchers not yet available for next week." : "No unrostered double starters found."}
          </div>
        )}
      </div>
    </div>
  );
}
