"use client";

import { useState, useEffect, useMemo } from "react";
import { EspnAuthRequired } from "@/components/EspnAuthRequired";

interface StartsTeamPitcher {
  name: string;
  pos: string;
  proTeam: string;
  onIL: boolean;
}

interface StartsTeam {
  teamId: number;
  teamName: string;
  pitchers: StartsTeamPitcher[];
}

interface StartsData {
  myTeamId: number;
  nextDates: { start: string; end: string } | null;
  teams: StartsTeam[];
  rosteredPitchers: string[];
}

interface ProbableStart {
  date: string;
  pitcherName: string;
  team: string;
  opponent: string;
}

interface ProbablePitchersData {
  byPitcher: Record<string, ProbableStart[]>;
  allStarts: ProbableStart[];
}

interface LiveTeam {
  teamId: number;
  teamName: string;
  ranks: Record<string, number>;
}

interface ScheduleDay {
  date: string;
  games: number;
}

function fmtDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function fmtDateRange(start: string, end: string): string {
  const s = new Date(start + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const e = new Date(end + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${s} to ${e}`;
}

function findStarts(
  pitcherName: string,
  probables: ProbablePitchersData | null
): ProbableStart[] {
  if (!probables) return [];
  if (probables.byPitcher[pitcherName]) return probables.byPitcher[pitcherName];
  const lower = pitcherName.toLowerCase();
  for (const [name, starts] of Object.entries(probables.byPitcher)) {
    if (name.toLowerCase() === lower) return starts;
  }
  const lastName = pitcherName
    .split(" ")
    .pop()
    ?.replace(/[.,]|Jr|Sr|III|II$/g, "")
    .trim()
    .toLowerCase();
  if (lastName) {
    for (const [name, starts] of Object.entries(probables.byPitcher)) {
      const probLast = name
        .split(" ")
        .pop()
        ?.replace(/[.,]|Jr|Sr|III|II$/g, "")
        .trim()
        .toLowerCase();
      if (probLast === lastName) return starts;
    }
  }
  return [];
}

export default function NextWeekPage() {
  const [startsData, setStartsData] = useState<StartsData | null>(null);
  const [probables, setProbables] = useState<ProbablePitchersData | null>(null);
  const [leagueTeams, setLeagueTeams] = useState<LiveTeam[]>([]);
  const [nextOppId, setNextOppId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/espn/starts")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          setLoading(false);
          return;
        }
        setStartsData(data);

        const fetches: Promise<unknown>[] = [];

        if (data.nextDates) {
          fetches.push(
            fetch(
              `/api/mlb/probable-pitchers?startDate=${data.nextDates.start}&endDate=${data.nextDates.end}`
            )
              .then((r) => r.json())
              .catch(() => null)
          );
        } else {
          fetches.push(Promise.resolve(null));
        }

        fetches.push(
          fetch("/api/espn/league-stats?scope=season")
            .then((r) => r.json())
            .catch(() => ({ teams: [] }))
        );

        fetches.push(
          fetch("/api/espn/schedule")
            .then((r) => r.json())
            .catch(() => null)
        );

        return Promise.all(fetches).then(([pp, league, sched]) => {
          type WithError = { error?: string };
          const p = pp as (ProbablePitchersData & WithError) | null;
          const l = league as { teams?: LiveTeam[] } & WithError;
          if (p && !p.error) setProbables(p);
          if (l.teams) setLeagueTeams(l.teams);

          // Try to find next week's opponent from schedule
          const schedData = sched as { error?: string; nextOpponent?: { teamId: number } } | null;
          if (schedData && !schedData.error && schedData.nextOpponent) {
            setNextOppId(schedData.nextOpponent.teamId);
          }
        });
      })
      .catch(() => setError("FETCH_FAILED"))
      .finally(() => setLoading(false));
  }, []);

  const nextDates = startsData?.nextDates;

  // My team double starters
  const myTeam = useMemo(
    () => startsData?.teams.find((t) => t.teamId === startsData.myTeamId),
    [startsData]
  );

  type PitcherWithStarts = StartsTeamPitcher & {
    starts: ProbableStart[];
    startCount: number;
  };

  const myDoubleStarters = useMemo((): PitcherWithStarts[] => {
    if (!myTeam || !probables) return [];
    return myTeam.pitchers
      .filter((p) => p.pos === "SP" && !p.onIL)
      .map((p) => {
        const starts = findStarts(p.name, probables);
        return { ...p, starts, startCount: starts.length };
      })
      .filter((p) => p.startCount >= 2)
      .sort((a, b) => b.startCount - a.startCount);
  }, [myTeam, probables]);

  // FA double starters
  const rosteredSet = useMemo(
    () => new Set(startsData?.rosteredPitchers ?? []),
    [startsData]
  );

  const faDoubleStarters = useMemo(() => {
    if (!probables) return [];
    return Object.entries(probables.byPitcher)
      .filter(([, starts]) => starts.length >= 2)
      .filter(([name]) => !rosteredSet.has(name))
      .map(([name, starts]) => ({
        name,
        starts,
        team: starts[0]?.team ?? "",
      }))
      .sort((a, b) => b.starts.length - a.starts.length);
  }, [probables, rosteredSet]);

  // Schedule density (games per day next week)
  const scheduleDensity = useMemo((): ScheduleDay[] => {
    if (!probables || !nextDates) return [];
    const dayCounts: Record<string, number> = {};

    for (const start of probables.allStarts) {
      dayCounts[start.date] = (dayCounts[start.date] ?? 0) + 1;
    }

    const days: ScheduleDay[] = [];
    const d = new Date(nextDates.start + "T12:00:00");
    const end = new Date(nextDates.end + "T12:00:00");
    while (d <= end) {
      const dateStr = d.toISOString().slice(0, 10);
      days.push({ date: dateStr, games: dayCounts[dateStr] ?? 0 });
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, [probables, nextDates]);

  // Opponent info
  const oppTeam = useMemo(() => {
    if (!nextOppId) return null;
    return leagueTeams.find((t) => t.teamId === nextOppId) ?? null;
  }, [leagueTeams, nextOppId]);

  const oppWeakCats = useMemo(() => {
    if (!oppTeam) return [];
    return Object.entries(oppTeam.ranks)
      .filter(([, r]) => r >= 8)
      .sort(([, a], [, b]) => b - a)
      .map(([cat, rank]) => ({ cat, rank }));
  }, [oppTeam]);

  const oppStrongCats = useMemo(() => {
    if (!oppTeam) return [];
    return Object.entries(oppTeam.ranks)
      .filter(([, r]) => r <= 3)
      .sort(([, a], [, b]) => a - b)
      .map(([cat, rank]) => ({ cat, rank }));
  }, [oppTeam]);

  if (loading)
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        Loading next week...
      </div>
    );
  if (
    error === "ESPN_CREDS_MISSING" ||
    error === "MY_ESPN_TEAM_ID_MISSING"
  )
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <EspnAuthRequired />
      </div>
    );
  if (error || !startsData)
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load</div>
        <div className="text-[12px] text-slate-500">{error}</div>
      </div>
    );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-gray-900">Next Week Lookahead</h1>
        {nextDates && (
          <span className="text-[12px] text-slate-500">
            {fmtDateRange(nextDates.start, nextDates.end)}
          </span>
        )}
      </div>

      {/* Opponent scouting */}
      {oppTeam && (
        <div className="mb-6 rounded-xl border border-border bg-surface overflow-hidden">
          <div className="border-b border-border px-4 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              Next Opponent
            </span>
            <span className="ml-2 text-[14px] font-bold text-slate-700">
              {oppTeam.teamName}
            </span>
          </div>
          <div className="px-4 py-3 grid gap-4 sm:grid-cols-2">
            {oppWeakCats.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-2">
                  Their Weaknesses (exploit these)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {oppWeakCats.map(({ cat, rank }) => (
                    <span
                      key={cat}
                      className="rounded bg-emerald-50 border border-emerald-200 px-2 py-1 text-[11px]"
                    >
                      <span className="font-bold text-emerald-700">{cat}</span>
                      <span className="ml-1 text-slate-500">#{rank}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {oppStrongCats.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-red-600 uppercase tracking-wider mb-2">
                  Their Strengths (avoid these)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {oppStrongCats.map(({ cat, rank }) => (
                    <span
                      key={cat}
                      className="rounded bg-red-50 border border-red-200 px-2 py-1 text-[11px]"
                    >
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

      {/* Schedule density */}
      {scheduleDensity.length > 0 && (
        <div className="mb-6 rounded-xl border border-border bg-surface overflow-hidden">
          <div className="border-b border-border px-4 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              Schedule Density
            </span>
          </div>
          <div className="px-4 py-3">
            <div className="flex gap-2">
              {scheduleDensity.map((d) => {
                const maxGames = Math.max(
                  ...scheduleDensity.map((x) => x.games),
                  1
                );
                const pct = (d.games / maxGames) * 100;
                const isBusiest = d.games === maxGames;
                const isLightest =
                  d.games ===
                  Math.min(...scheduleDensity.map((x) => x.games));
                return (
                  <div key={d.date} className="flex-1 text-center">
                    <div className="text-[10px] font-bold text-slate-500">
                      {new Date(d.date + "T12:00:00").toLocaleDateString(
                        "en-US",
                        { weekday: "short" }
                      )}
                    </div>
                    <div className="mt-1 mx-auto w-8 h-16 bg-slate-100 rounded relative overflow-hidden">
                      <div
                        className={`absolute bottom-0 w-full rounded transition-all ${
                          isBusiest
                            ? "bg-emerald-400"
                            : isLightest
                              ? "bg-slate-300"
                              : "bg-blue-300"
                        }`}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                    <div
                      className={`mt-1 text-[12px] font-bold tabular-nums ${
                        isBusiest
                          ? "text-emerald-600"
                          : isLightest
                            ? "text-slate-400"
                            : "text-slate-600"
                      }`}
                    >
                      {d.games}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-[10px] text-slate-400 text-center">
              Games with probable starters announced
            </div>
          </div>
        </div>
      )}

      {/* My team double starters */}
      {myDoubleStarters.length > 0 && (
        <div className="mb-6 rounded-xl border border-orange-300 bg-surface overflow-hidden">
          <div className="border-b border-orange-300 px-4 py-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-600">
                Your Double Starters
              </span>
              <span className="ml-2 text-[10px] text-slate-500">
                SPs with 2+ starts next week
              </span>
            </div>
            <span className="text-[14px] font-bold tabular-nums text-orange-600">
              {myDoubleStarters.length}
            </span>
          </div>
          <div className="divide-y divide-border">
            {myDoubleStarters.map((p) => (
              <div key={p.name} className="px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-emerald-700">
                      {p.name}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {p.proTeam}
                    </span>
                  </div>
                  <span className="text-[14px] font-bold tabular-nums text-emerald-600">
                    {p.startCount} starts
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {p.starts.map((s, i) => (
                    <span
                      key={i}
                      className="rounded px-2 py-0.5 text-[10px] bg-orange-50 border border-orange-200 text-orange-700"
                    >
                      <span className="font-semibold">{fmtDate(s.date)}</span>{" "}
                      <span className="text-orange-600">{s.opponent}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FA double starters: grab today */}
      <div className="rounded-xl border border-emerald-300 bg-surface overflow-hidden">
        <div className="border-b border-emerald-300 px-4 py-2.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
              FA Double Starters
            </span>
            <span className="ml-2 text-[10px] text-slate-500">
              Grab today before opponents claim them
            </span>
          </div>
          <span className="text-[14px] font-bold tabular-nums text-emerald-600">
            {faDoubleStarters.length}
          </span>
        </div>
        {faDoubleStarters.length > 0 ? (
          <div className="divide-y divide-border">
            {faDoubleStarters.map((fa) => (
              <div key={fa.name} className="px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-emerald-700">
                      {fa.name}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {fa.team}
                    </span>
                  </div>
                  <span className="text-[14px] font-bold tabular-nums text-emerald-600">
                    {fa.starts.length} starts
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {fa.starts.map((s, i) => (
                    <span
                      key={i}
                      className="rounded px-2 py-0.5 text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-700"
                    >
                      <span className="font-semibold">{fmtDate(s.date)}</span>{" "}
                      <span className="text-emerald-600">{s.opponent}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-6 text-center text-[12px] text-slate-500">
            {!probables
              ? "Probable pitchers not yet available for next week."
              : "No unrostered double starters found."}
          </div>
        )}
      </div>

      {!probables && (
        <div className="mt-3 text-[11px] text-slate-400 text-center">
          Probable pitchers are typically announced 1 to 5 days in advance.
        </div>
      )}
    </div>
  );
}
