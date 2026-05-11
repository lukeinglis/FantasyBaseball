"use client";

import { useState, useEffect, useMemo } from "react";
import { EspnAuthRequired } from "@/components/EspnAuthRequired";
import { DataFreshness } from "@/components/DataFreshness";
import {
  CATEGORY_WEIGHTS,
  categoryTier,
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
  title: string;
  detail: string;
  color: string;
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

  const fetchAll = () => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    Promise.all([
      fetch("/api/analysis/roster-diagnosis").then((r) => r.json()),
      fetch("/api/espn/matchup").then((r) => r.json()),
      fetch(
        `/api/mlb/probable-pitchers?startDate=${today}&endDate=${today}`
      )
        .then((r) => r.json())
        .catch(() => null),
      fetch("/api/analysis/z-scores")
        .then((r) => r.json())
        .catch(() => ({ players: [] })),
      fetch(`/api/mlb/schedule?startDate=${today}&endDate=${today}`)
        .then((r) => r.json())
        .catch(() => ({})),
    ])
      .then(([diag, mup, pp, zData, sched]) => {
        if (diag.error) {
          setError(diag.error);
          return;
        }
        setDiagnosis(diag);
        if (!mup.error) setMatchup(mup);
        if (pp && !pp.error) setProbables(pp);
        setZPlayers(zData.players ?? []);
        if (!sched.error) setSchedule(sched);
      })
      .catch(() => setError("FETCH_FAILED"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const actions = useMemo((): DailyAction[] => {
    const items: DailyAction[] = [];
    if (!matchup || !diagnosis) return items;

    const daysLeft = matchup.matchupEndDate
      ? Math.max(
          0,
          Math.ceil(
            (new Date(matchup.matchupEndDate + "T23:59:59").getTime() -
              Date.now()) /
              86400000
          )
        )
      : 7;

    // Lineup: bench batters who have games today
    const benchBatters = matchup.myRoster.filter(
      (p) =>
        p.slotId === BENCH_SLOT_ID &&
        !IL_STATUSES.has(p.injuryStatus) &&
        !["SP", "RP"].includes(p.pos)
    );
    const benchWithGames = benchBatters.filter(
      (p) => schedule[p.proTeam]?.todayOpponent
    );
    for (const p of benchWithGames) {
      items.push({
        type: "lineup",
        priority: 90,
        title: `Start ${p.name} (${p.pos}, ${p.proTeam})`,
        detail: `On bench but has a game today vs ${schedule[p.proTeam]?.todayOpponent}`,
        color: "text-blue-600",
      });
    }

    // Lineup: starters on off days
    const startersNoGame = matchup.myRoster.filter(
      (p) =>
        BATTER_SLOT_IDS.has(p.slotId) &&
        !IL_STATUSES.has(p.injuryStatus) &&
        !schedule[p.proTeam]?.todayOpponent
    );
    if (startersNoGame.length > 0) {
      items.push({
        type: "lineup",
        priority: 85,
        title: `${startersNoGame.length} starter${startersNoGame.length > 1 ? "s" : ""} have no game today`,
        detail: startersNoGame.map((p) => `${p.name} (${p.pos})`).join(", "),
        color: "text-amber-600",
      });
    }

    // Streaming: SPs pitching today from probables
    if (probables) {
      const rosteredNames = new Set(matchup.myRoster.map((p) => p.name));
      const todaysStarts = probables.allStarts.filter(
        (s) => s.date === new Date().toISOString().slice(0, 10)
      );
      const myStartsToday = todaysStarts.filter((s) =>
        rosteredNames.has(s.pitcherName)
      );
      if (myStartsToday.length > 0) {
        items.push({
          type: "stream",
          priority: 80,
          title: `${myStartsToday.length} SP${myStartsToday.length > 1 ? "s" : ""} pitching today`,
          detail: myStartsToday
            .map((s) => `${s.pitcherName} vs ${s.opponent}`)
            .join(", "),
          color: "text-purple-600",
        });
      }

      // Free agent SPs pitching today
      const faStartsToday = todaysStarts.filter(
        (s) => !rosteredNames.has(s.pitcherName)
      );
      const faWithZ = faStartsToday
        .map((s) => {
          const z = zPlayers.find(
            (p) => p.name === s.pitcherName && p.onTeamId === 0
          );
          return { ...s, far: z?.far ?? 0 };
        })
        .filter((s) => s.far > 0)
        .sort((a, b) => b.far - a.far)
        .slice(0, 3);

      for (const s of faWithZ) {
        items.push({
          type: "stream",
          priority: 75 + s.far,
          title: `Stream ${s.pitcherName} (${s.team}) vs ${s.opponent}`,
          detail: `Free agent SP, FAR ${s.far.toFixed(1)}`,
          color: "text-emerald-600",
        });
      }
    }

    // Waiver: best FA pickups for weak categories
    const weakCats = diagnosis.categoryRankings
      .filter((c) => c.tier === "WEAK" && !c.isPunt)
      .sort((a, b) => b.weight - a.weight);

    const freeAgents = zPlayers
      .filter((p) => p.onTeamId === 0 && p.far > 0)
      .sort((a, b) => b.far - a.far);

    for (const weak of weakCats.slice(0, 2)) {
      const helpers = freeAgents
        .filter((p) => (p.zScores[weak.cat] ?? 0) > 0.5)
        .slice(0, 1);
      for (const fa of helpers) {
        const statVal = fa.seasonStats[weak.cat];
        const statStr =
          statVal !== undefined ? ` ${fmtStat(weak.cat, statVal)}` : "";
        items.push({
          type: "waiver",
          priority: 70 + (CATEGORY_WEIGHTS[weak.cat] ?? 0) * 100,
          title: `Pick up ${fa.name} (${fa.pos}, ${fa.proTeam})`,
          detail: `Improves ${weak.cat} (currently #${weak.rank})${statStr}, FAR ${fa.far.toFixed(1)}`,
          color: "text-orange-600",
        });
      }
    }

    // Matchup: contested categories
    const contested = matchup.categories
      .filter((c) => {
        if (isPunt(c.cat)) return false;
        if (c.myValue === null || c.oppValue === null) return false;
        const lower = LOWER_IS_BETTER.has(c.cat);
        const gap = lower
          ? c.oppValue - c.myValue
          : c.myValue - c.oppValue;
        const range = Math.max(
          Math.abs(c.myValue),
          Math.abs(c.oppValue),
          1
        );
        return Math.abs(gap) / range < 0.15;
      })
      .sort(
        (a, b) =>
          (CATEGORY_WEIGHTS[b.cat] ?? 0) - (CATEGORY_WEIGHTS[a.cat] ?? 0)
      )
      .slice(0, 3);

    for (const c of contested) {
      const lower = LOWER_IS_BETTER.has(c.cat);
      const gap =
        c.myValue !== null && c.oppValue !== null
          ? lower
            ? c.oppValue - c.myValue
            : c.myValue - c.oppValue
          : 0;
      items.push({
        type: "matchup",
        priority: 60 + (CATEGORY_WEIGHTS[c.cat] ?? 0) * 200,
        title: `${c.cat} is contested: ${fmtStat(c.cat, c.myValue ?? 0)} vs ${fmtStat(c.cat, c.oppValue ?? 0)}`,
        detail: `${c.result === "WIN" ? "Leading" : c.result === "LOSS" ? "Trailing" : "Tied"} by ${fmtStat(c.cat, Math.abs(gap))} with ${daysLeft}d left (weight: ${(CATEGORY_WEIGHTS[c.cat] ?? 0).toFixed(3)})`,
        color:
          c.result === "WIN"
            ? "text-emerald-600"
            : c.result === "LOSS"
              ? "text-red-600"
              : "text-amber-600",
      });
    }

    // Include high-priority diagnosis actions
    const highActions = diagnosis.actionItems
      .filter((a) => a.priority === "HIGH")
      .slice(0, 2);
    for (const a of highActions) {
      items.push({
        type: a.type === "STREAM" ? "stream" : "waiver",
        priority: 65,
        title: a.message,
        detail: `${a.type} action from roster diagnosis`,
        color:
          a.type === "DROP"
            ? "text-red-600"
            : a.type === "STREAM"
              ? "text-purple-600"
              : "text-blue-600",
      });
    }

    items.sort((a, b) => b.priority - a.priority);
    return items;
  }, [matchup, diagnosis, probables, zPlayers, schedule]);

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

  if (
    error === "ESPN_CREDS_MISSING" ||
    error === "MY_ESPN_TEAM_ID_MISSING"
  ) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <EspnAuthRequired />
      </div>
    );
  }

  if (error || !diagnosis) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load actions</div>
        <div className="text-[12px] text-slate-600">{error}</div>
      </div>
    );
  }

  const typeIcon: Record<DailyAction["type"], string> = {
    lineup: "LU",
    stream: "SP",
    waiver: "FA",
    matchup: "MU",
  };

  const typeBg: Record<DailyAction["type"], string> = {
    lineup: "bg-blue-100 text-blue-700",
    stream: "bg-purple-100 text-purple-700",
    waiver: "bg-orange-100 text-orange-700",
    matchup: "bg-slate-100 text-slate-700",
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Daily Actions</h1>
          <span className="text-[12px] text-slate-500">
            {actions.length} action{actions.length !== 1 ? "s" : ""} for today
          </span>
        </div>
        <DataFreshness onRefresh={fetchAll} loading={loading} />
      </div>

      {actions.length === 0 && (
        <div className="rounded-xl border border-border bg-surface px-6 py-12 text-center">
          <div className="text-[14px] font-medium text-slate-600">
            No actions for today
          </div>
          <div className="mt-1 text-[12px] text-slate-400">
            Check back when games are scheduled
          </div>
        </div>
      )}

      <div className="space-y-3">
        {actions.map((action, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-surface px-4 py-3 hover:bg-black/[0.01] transition-colors"
          >
            <div className="flex items-start gap-3">
              <span
                className={`shrink-0 mt-0.5 rounded px-2 py-1 text-[10px] font-bold ${typeBg[action.type]}`}
              >
                {typeIcon[action.type]}
              </span>
              <div className="flex-1 min-w-0">
                <div className={`text-[14px] font-medium ${action.color}`}>
                  {action.title}
                </div>
                <div className="mt-0.5 text-[12px] text-slate-500">
                  {action.detail}
                </div>
              </div>
              <span className="shrink-0 text-[10px] font-mono text-slate-300 tabular-nums">
                #{i + 1}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Weak categories summary */}
      {diagnosis.categoryRankings.some(
        (c) => c.tier === "WEAK" && !c.isPunt
      ) && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50/50 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-red-600 mb-2">
            Weak Categories
          </div>
          <div className="flex flex-wrap gap-2">
            {diagnosis.categoryRankings
              .filter((c) => c.tier === "WEAK" && !c.isPunt)
              .sort((a, b) => b.weight - a.weight)
              .map((c) => (
                <span
                  key={c.cat}
                  className="rounded border border-red-200 bg-white px-2 py-1 text-[11px]"
                >
                  <span className="font-bold text-red-700">{c.cat}</span>
                  <span className="ml-1 text-slate-500">
                    #{c.rank}
                  </span>
                  <span className="ml-1 text-[9px] text-slate-400">
                    w:{c.weight.toFixed(3)}
                  </span>
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
