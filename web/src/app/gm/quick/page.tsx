"use client";

import { useState, useEffect, useMemo } from "react";
import { EspnAuthRequired } from "@/components/EspnAuthRequired";
import {
  CATEGORY_WEIGHTS,
  isPunt,
  LOWER_IS_BETTER,
} from "@/lib/category-weights";

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

interface CategoryRanking {
  cat: string;
  tier: "STRONG" | "MIDDLE" | "WEAK";
  isPunt: boolean;
  rank: number;
  weight: number;
}

interface ActionItem {
  priority: "HIGH" | "MEDIUM" | "LOW";
  type: string;
  message: string;
}

interface DiagnosisData {
  actionItems: ActionItem[];
  categoryRankings: CategoryRanking[];
}

interface ProbableStart {
  date: string;
  pitcherName: string;
  opponent: string;
}

interface ProbablePitchersData {
  allStarts: ProbableStart[];
}

interface TeamSchedule {
  todayOpponent: string | null;
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

export default function QuickViewPage() {
  const [matchup, setMatchup] = useState<MatchupData | null>(null);
  const [diagnosis, setDiagnosis] = useState<DiagnosisData | null>(null);
  const [probables, setProbables] = useState<ProbablePitchersData | null>(null);
  const [schedule, setSchedule] = useState<Record<string, TeamSchedule>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    Promise.all([
      fetch("/api/espn/matchup").then((r) => r.json()),
      fetch("/api/analysis/roster-diagnosis")
        .then((r) => r.json())
        .catch(() => null),
      fetch(`/api/mlb/probable-pitchers?startDate=${today}&endDate=${today}`)
        .then((r) => r.json())
        .catch(() => null),
      fetch(`/api/mlb/schedule?startDate=${today}&endDate=${today}`)
        .then((r) => r.json())
        .catch(() => ({})),
    ])
      .then(([mup, diag, pp, sched]) => {
        if (mup.error) {
          setError(mup.error);
          return;
        }
        setMatchup(mup);
        if (diag && !diag.error) setDiagnosis(diag);
        if (pp && !pp.error) setProbables(pp);
        if (!sched.error) setSchedule(sched);
      })
      .catch(() => setError("FETCH_FAILED"))
      .finally(() => setLoading(false));
  }, []);

  // Matchup score
  const score = useMemo(() => {
    if (!matchup) return null;
    const wins = matchup.categories.filter((c) => c.result === "WIN").length;
    const losses = matchup.categories.filter(
      (c) => c.result === "LOSS"
    ).length;
    const ties = matchup.categories.filter((c) => c.result === "TIE").length;
    return { wins, losses, ties };
  }, [matchup]);

  // Top 3 actions
  const topActions = useMemo(() => {
    const actions: string[] = [];

    if (matchup) {
      // Bench batters with games
      const benchWithGame = matchup.myRoster.filter(
        (p) =>
          p.slotId === BENCH_SLOT_ID &&
          !IL_STATUSES.has(p.injuryStatus) &&
          !["SP", "RP"].includes(p.pos) &&
          schedule[p.proTeam]?.todayOpponent
      );
      for (const p of benchWithGame.slice(0, 1)) {
        actions.push(
          `Start ${p.name} (benched, has game vs ${schedule[p.proTeam]?.todayOpponent})`
        );
      }
    }

    if (diagnosis) {
      const highActions = diagnosis.actionItems.filter(
        (a) => a.priority === "HIGH"
      );
      for (const a of highActions.slice(0, 2)) {
        actions.push(a.message);
      }
    }

    // SP pitching today
    if (matchup && probables) {
      const today = new Date().toISOString().slice(0, 10);
      const myNames = new Set(matchup.myRoster.map((p) => p.name));
      const myStarts = probables.allStarts.filter(
        (s) => s.date === today && myNames.has(s.pitcherName)
      );
      if (myStarts.length > 0 && actions.length < 3) {
        actions.push(
          `${myStarts.length} SP${myStarts.length > 1 ? "s" : ""} pitching: ${myStarts.map((s) => s.pitcherName).join(", ")}`
        );
      }
    }

    return actions.slice(0, 3);
  }, [matchup, diagnosis, probables, schedule]);

  // Bench batters who should be starting
  const benchShouldStart = useMemo(() => {
    if (!matchup) return [];
    return matchup.myRoster
      .filter(
        (p) =>
          p.slotId === BENCH_SLOT_ID &&
          !IL_STATUSES.has(p.injuryStatus) &&
          !["SP", "RP"].includes(p.pos) &&
          schedule[p.proTeam]?.todayOpponent
      )
      .slice(0, 3);
  }, [matchup, schedule]);

  // Next SP start
  const nextSPStart = useMemo(() => {
    if (!matchup || !probables) return null;
    const myNames = new Set(matchup.myRoster.map((p) => p.name));
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = probables.allStarts
      .filter((s) => s.date >= today && myNames.has(s.pitcherName))
      .sort((a, b) => a.date.localeCompare(b.date));
    return upcoming[0] ?? null;
  }, [matchup, probables]);

  if (loading)
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent mr-2" />
        Loading...
      </div>
    );
  if (error === "ESPN_CREDS_MISSING" || error === "MY_ESPN_TEAM_ID_MISSING")
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <EspnAuthRequired />
      </div>
    );
  if (error || !matchup)
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load</div>
        <div className="text-[12px] text-slate-500">{error}</div>
      </div>
    );

  return (
    <div className="mx-auto max-w-lg px-4 py-4">
      {/* Matchup score: big, tappable */}
      {score && (
        <div className="mb-4 rounded-2xl border border-border bg-surface px-6 py-5 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
            vs {matchup.oppTeamName}
          </div>
          <div className="flex items-center justify-center gap-4">
            <div>
              <div className="text-4xl font-bold tabular-nums text-emerald-600">
                {score.wins}
              </div>
              <div className="text-[10px] text-slate-500">W</div>
            </div>
            <div className="text-2xl text-slate-300">-</div>
            <div>
              <div className="text-4xl font-bold tabular-nums text-red-600">
                {score.losses}
              </div>
              <div className="text-[10px] text-slate-500">L</div>
            </div>
            {score.ties > 0 && (
              <>
                <div className="text-2xl text-slate-300">-</div>
                <div>
                  <div className="text-4xl font-bold tabular-nums text-orange-600">
                    {score.ties}
                  </div>
                  <div className="text-[10px] text-slate-500">T</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Top 3 actions */}
      {topActions.length > 0 && (
        <div className="mb-4 rounded-2xl border border-orange-200 bg-orange-50/50 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-orange-600 mb-2">
            Today&apos;s Actions
          </div>
          <div className="space-y-2">
            {topActions.map((action, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-[13px] text-slate-700"
              >
                <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-orange-100 text-orange-600 text-[10px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span>{action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bench alerts */}
      {benchShouldStart.length > 0 && (
        <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50/50 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 mb-2">
            Bench Players With Games
          </div>
          {benchShouldStart.map((p) => (
            <div key={p.name} className="py-1.5 text-[13px] text-slate-700">
              <span className="font-medium">{p.name}</span>
              <span className="text-slate-500 ml-1">
                ({p.pos}) vs {schedule[p.proTeam]?.todayOpponent}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Next SP */}
      {nextSPStart && (
        <div className="mb-4 rounded-2xl border border-purple-200 bg-purple-50/50 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-purple-600 mb-1">
            Next SP Start
          </div>
          <div className="text-[14px] font-medium text-slate-700">
            {nextSPStart.pitcherName}
          </div>
          <div className="text-[12px] text-slate-500">
            vs {nextSPStart.opponent} on{" "}
            {new Date(nextSPStart.date + "T12:00:00").toLocaleDateString(
              "en-US",
              { weekday: "short", month: "short", day: "numeric" }
            )}
          </div>
        </div>
      )}

      <div className="text-center text-[10px] text-slate-400 mt-6">
        Mobile Quick View
      </div>
    </div>
  );
}
