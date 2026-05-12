"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { EspnAuthRequired } from "@/components/EspnAuthRequired";
import { DataFreshness } from "@/components/DataFreshness";
import {
  CATEGORY_WEIGHTS,
  isPunt,
  LOWER_IS_BETTER,
} from "@/lib/category-weights";

interface CategoryRanking {
  cat: string;
  weight: number;
  rank: number;
  value: number;
  tier: "STRONG" | "MIDDLE" | "WEAK";
  isPunt: boolean;
}

interface ActionItem {
  priority: "HIGH" | "MEDIUM" | "LOW";
  type: "DROP" | "IMPROVE" | "TRADE" | "STREAM" | "PUNT";
  message: string;
}

interface DiagnosisData {
  teamName: string;
  categoryRankings: CategoryRanking[];
  actionItems: ActionItem[];
  marginToFlip: {
    cat: string;
    weight: number;
    currentRank: number;
    targetRank: number;
    gap: number;
  }[];
}

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
  proTeam: string;
  stats: Record<string, number>;
}

interface MatchupData {
  matchupEndDate: string | null;
  myTeamName: string;
  oppTeamName: string;
  categories: MatchupCat[];
  myRoster: MatchupPlayer[];
}

interface ProbableStart {
  date: string;
  pitcherName: string;
  team: string;
  opponent: string;
}

interface ProbablePitchersData {
  allStarts: ProbableStart[];
  byPitcher: Record<string, ProbableStart[]>;
}

interface ZScorePlayer {
  name: string;
  pos: string;
  proTeam: string;
  onTeamId: number;
  zScores: Record<string, number>;
  far: number;
  seasonStats: Record<string, number>;
}

interface TeamSchedule {
  todayOpponent: string | null;
}

interface DailyAction {
  type: "lineup" | "stream" | "waiver" | "matchup";
  priority: number;
  sentence: string;
}

const IL_STATUSES = new Set([
  "SEVEN_DAY_DL",
  "TEN_DAY_DL",
  "FIFTEEN_DAY_DL",
  "SIXTY_DAY_DL",
  "OUT",
]);
const BENCH_SLOT_ID = 16;
const BATTER_SLOT_IDS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 12]);

function fmtStat(cat: string, val: number): string {
  if (!Number.isFinite(val)) return "-";
  if (cat === "AVG") return val.toFixed(3);
  if (cat === "ERA" || cat === "WHIP") return val.toFixed(2);
  return String(Math.round(val));
}

export default function ActionsPage() {
  const [diagnosis, setDiagnosis] = useState<DiagnosisData | null>(null);
  const [matchup, setMatchup] = useState<MatchupData | null>(null);
  const [probables, setProbables] = useState<ProbablePitchersData | null>(null);
  const [zPlayers, setZPlayers] = useState<ZScorePlayer[]>([]);
  const [schedule, setSchedule] = useState<Record<string, TeamSchedule>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const doFetch = useCallback(() => {
    const day = new Date().toISOString().slice(0, 10);
    return Promise.all([
      fetch("/api/analysis/roster-diagnosis").then((r) => r.json()),
      fetch("/api/espn/matchup").then((r) => r.json()),
      fetch(`/api/mlb/probable-pitchers?startDate=${day}&endDate=${day}`)
        .then((r) => r.json())
        .catch(() => null),
      fetch("/api/analysis/z-scores")
        .then((r) => r.json())
        .catch(() => ({ players: [] })),
      fetch(`/api/mlb/schedule?startDate=${day}&endDate=${day}`)
        .then((r) => r.json())
        .catch(() => ({})),
    ])
      .then(([diag, mup, pp, zData, sched]) => {
        if (diag.error) { setError(diag.error); return; }
        setDiagnosis(diag);
        if (!mup.error) setMatchup(mup);
        if (pp && !pp.error) setProbables(pp);
        setZPlayers(zData.players ?? []);
        if (!sched.error) setSchedule(sched);
      })
      .catch(() => setError("FETCH_FAILED"))
      .finally(() => setLoading(false));
  }, []);

  const fetchAll = () => { setLoading(true); doFetch(); };

  useEffect(() => { doFetch(); }, [doFetch]);

  const [renderTime] = useState(() => Date.now());
  const [todayStr] = useState(() => new Date().toISOString().slice(0, 10));

  const actions = useMemo((): DailyAction[] => {
    const items: DailyAction[] = [];
    if (!matchup || !diagnosis) return items;

    const daysLeft = matchup.matchupEndDate
      ? Math.max(0, Math.ceil((new Date(matchup.matchupEndDate + "T23:59:59").getTime() - renderTime) / 86400000))
      : 7;

    // Bench batters with games today
    const benchBatters = matchup.myRoster.filter(
      (p) => p.slotId === BENCH_SLOT_ID && !IL_STATUSES.has(p.injuryStatus) && !["SP", "RP"].includes(p.pos)
    );
    for (const p of benchBatters.filter((p) => schedule[p.proTeam]?.todayOpponent)) {
      items.push({
        type: "lineup",
        priority: 90,
        sentence: `Start ${p.name} today vs ${schedule[p.proTeam]?.todayOpponent} (on bench with a game).`,
      });
    }

    // Starters on off days
    const startersNoGame = matchup.myRoster.filter(
      (p) => BATTER_SLOT_IDS.has(p.slotId) && !IL_STATUSES.has(p.injuryStatus) && !schedule[p.proTeam]?.todayOpponent
    );
    if (startersNoGame.length > 0) {
      items.push({
        type: "lineup",
        priority: 85,
        sentence: `Swap out ${startersNoGame.map((p) => p.name).join(", ")} (no game today).`,
      });
    }

    // Free agent SP streaming
    if (probables) {
      const rosteredNames = new Set(matchup.myRoster.map((p) => p.name));
      const todaysStarts = probables.allStarts.filter((s) => s.date === todayStr);
      const faStartsToday = todaysStarts.filter((s) => !rosteredNames.has(s.pitcherName));
      const faWithZ = faStartsToday
        .map((s) => {
          const z = zPlayers.find((p) => p.name === s.pitcherName && p.onTeamId === 0);
          return { ...s, far: z?.far ?? 0 };
        })
        .filter((s) => s.far > 0)
        .sort((a, b) => b.far - a.far)
        .slice(0, 2);

      for (const s of faWithZ) {
        items.push({
          type: "stream",
          priority: 75 + s.far,
          sentence: `Stream ${s.pitcherName} today vs ${s.opponent} for K upside (FAR ${s.far.toFixed(1)}).`,
        });
      }
    }

    // Waiver pickups for weak categories
    const weakCats = diagnosis.categoryRankings
      .filter((c) => c.tier === "WEAK" && !c.isPunt)
      .sort((a, b) => b.weight - a.weight);

    const freeAgents = zPlayers
      .filter((p) => p.onTeamId === 0 && p.far > 0)
      .sort((a, b) => b.far - a.far);

    for (const weak of weakCats.slice(0, 2)) {
      const helpers = freeAgents.filter((p) => (p.zScores[weak.cat] ?? 0) > 0.5).slice(0, 1);
      for (const fa of helpers) {
        items.push({
          type: "waiver",
          priority: 70 + (CATEGORY_WEIGHTS[weak.cat] ?? 0) * 100,
          sentence: `Pick up ${fa.name} (${fa.pos}) to improve ${weak.cat} (you are #${weak.rank}, gap of ${fmtStat(weak.cat, Math.abs(weak.value))}).`,
        });
      }
    }

    // Contested matchup categories
    const contested = matchup.categories
      .filter((c) => {
        if (isPunt(c.cat) || c.myValue === null || c.oppValue === null) return false;
        const lower = LOWER_IS_BETTER.has(c.cat);
        const gap = lower ? c.oppValue - c.myValue : c.myValue - c.oppValue;
        const range = Math.max(Math.abs(c.myValue), Math.abs(c.oppValue), 1);
        return Math.abs(gap) / range < 0.15;
      })
      .sort((a, b) => (CATEGORY_WEIGHTS[b.cat] ?? 0) - (CATEGORY_WEIGHTS[a.cat] ?? 0))
      .slice(0, 2);

    for (const c of contested) {
      const lower = LOWER_IS_BETTER.has(c.cat);
      const gap = c.myValue !== null && c.oppValue !== null
        ? lower ? c.oppValue - c.myValue : c.myValue - c.oppValue
        : 0;
      items.push({
        type: "matchup",
        priority: 60 + (CATEGORY_WEIGHTS[c.cat] ?? 0) * 200,
        sentence: `${c.result === "WIN" ? "Protect" : "Push"} ${c.cat}: ${fmtStat(c.cat, c.myValue ?? 0)} vs ${fmtStat(c.cat, c.oppValue ?? 0)} (${gap > 0 ? "+" : ""}${fmtStat(c.cat, gap)}, ${daysLeft}d left).`,
      });
    }

    items.sort((a, b) => b.priority - a.priority);
    return items.slice(0, 5);
  }, [matchup, diagnosis, probables, zPlayers, schedule, renderTime, todayStr]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          Building action list...
        </div>
      </div>
    );
  }

  if (error === "ESPN_CREDS_MISSING" || error === "MY_ESPN_TEAM_ID_MISSING") {
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnAuthRequired /></div>;
  }

  if (error || !diagnosis) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load actions</div>
        <div className="text-[12px] text-slate-600">{error}</div>
      </div>
    );
  }

  const typeBg: Record<DailyAction["type"], string> = {
    lineup: "bg-blue-600",
    stream: "bg-purple-600",
    waiver: "bg-orange-600",
    matchup: "bg-slate-600",
  };

  const typeLabel: Record<DailyAction["type"], string> = {
    lineup: "LINEUP",
    stream: "STREAM",
    waiver: "WAIVER",
    matchup: "MATCHUP",
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Actions</h1>
        <DataFreshness onRefresh={fetchAll} loading={loading} />
      </div>

      {actions.length === 0 && (
        <div className="rounded-xl border border-border bg-surface px-6 py-16 text-center">
          <div className="text-lg font-medium text-slate-600">No actions for today</div>
          <div className="mt-1 text-[13px] text-slate-400">Check back when games are scheduled</div>
        </div>
      )}

      <div className="space-y-4">
        {actions.map((action, i) => (
          <div key={i} className="flex items-start gap-4">
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-2xl font-bold tabular-nums text-slate-300">{i + 1}</span>
              <span className={`rounded px-2 py-0.5 text-[9px] font-bold text-white ${typeBg[action.type]}`}>
                {typeLabel[action.type]}
              </span>
            </div>
            <p className="text-lg text-slate-800 leading-relaxed pt-0.5">{action.sentence}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
