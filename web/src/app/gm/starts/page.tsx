"use client";

import { useState, useEffect, useMemo } from "react";

interface ProbableStart {
  date: string;
  pitcherName: string;
  team: string;
  opponent: string;
  gameTime: string;
}

interface ProbablePitchersData {
  byPitcher: Record<string, ProbableStart[]>;
  allStarts: ProbableStart[];
}

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
  currentMatchupPeriod: number;
  currentDates: { start: string; end: string } | null;
  nextDates: { start: string; end: string } | null;
  teams: StartsTeam[];
  rosteredPitchers: string[];
}

interface MatchupData {
  oppTeamId: number;
  oppTeamName: string;
}

function fmtDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function fmtShortDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
}

function fmtDateRange(start: string, end: string): string {
  const s = new Date(start + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const e = new Date(end + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${s} – ${e}`;
}

// Match pitcher names between ESPN roster and MLB probable pitchers
function findStarts(pitcherName: string, proTeam: string, probables: ProbablePitchersData | null): ProbableStart[] {
  if (!probables) return [];
  // Exact match
  if (probables.byPitcher[pitcherName]) return probables.byPitcher[pitcherName];
  // Case-insensitive
  const lower = pitcherName.toLowerCase();
  for (const [name, starts] of Object.entries(probables.byPitcher)) {
    if (name.toLowerCase() === lower) return starts;
  }
  // Last name + team fallback
  const lastName = pitcherName.split(" ").pop()?.replace(/[.,]|Jr|Sr|III|II$/g, "").trim().toLowerCase();
  if (lastName) {
    for (const [name, starts] of Object.entries(probables.byPitcher)) {
      const probLast = name.split(" ").pop()?.replace(/[.,]|Jr|Sr|III|II$/g, "").trim().toLowerCase();
      if (probLast === lastName && starts.some((s) => s.team === proTeam)) return starts;
    }
  }
  return [];
}

function EspnSetupCard() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-surface px-8 py-10 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-orange-600/60">Setup Required</div>
      <div className="mt-3 text-xl font-bold text-gray-900">Connect ESPN Credentials</div>
    </div>
  );
}

export default function StartsPage() {
  const [startsData, setStartsData] = useState<StartsData | null>(null);
  const [currentProbables, setCurrentProbables] = useState<ProbablePitchersData | null>(null);
  const [nextProbables, setNextProbables] = useState<ProbablePitchersData | null>(null);
  const [matchup, setMatchup] = useState<MatchupData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"next" | "current">("next");

  useEffect(() => {
    fetch("/api/espn/starts")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); setLoading(false); return; }
        setStartsData(data);

        // Fetch probable pitchers for current and next week
        const fetches: Promise<any>[] = [];

        if (data.currentDates) {
          fetches.push(
            fetch(`/api/mlb/probable-pitchers?startDate=${data.currentDates.start}&endDate=${data.currentDates.end}`)
              .then((r) => r.json()).catch(() => null)
          );
        } else {
          fetches.push(Promise.resolve(null));
        }

        if (data.nextDates) {
          fetches.push(
            fetch(`/api/mlb/probable-pitchers?startDate=${data.nextDates.start}&endDate=${data.nextDates.end}`)
              .then((r) => r.json()).catch(() => null)
          );
        } else {
          fetches.push(Promise.resolve(null));
        }

        fetches.push(
          fetch("/api/espn/matchup").then((r) => r.json()).catch(() => null)
        );

        return Promise.all(fetches).then(([curr, next, mup]) => {
          if (curr && !curr.error) setCurrentProbables(curr);
          if (next && !next.error) setNextProbables(next);
          if (mup && !mup.error) setMatchup(mup);
        });
      })
      .catch(() => setError("FETCH_FAILED"))
      .finally(() => setLoading(false));
  }, []);

  const probables = view === "next" ? nextProbables : currentProbables;
  const dates = view === "next" ? startsData?.nextDates : startsData?.currentDates;

  const myTeam = useMemo(() => startsData?.teams.find((t) => t.teamId === startsData.myTeamId), [startsData]);
  const oppTeam = useMemo(() => {
    if (!matchup || !startsData) return null;
    return startsData.teams.find((t) => t.teamId === matchup.oppTeamId);
  }, [startsData, matchup]);

  // Build pitcher start counts
  type PitcherWithStarts = StartsTeamPitcher & { starts: ProbableStart[]; startCount: number };

  function enrichPitchers(pitchers: StartsTeamPitcher[]): PitcherWithStarts[] {
    return pitchers
      .filter((p) => p.pos === "SP" && !p.onIL)
      .map((p) => {
        const starts = findStarts(p.name, p.proTeam, probables);
        return { ...p, starts, startCount: starts.length };
      })
      .sort((a, b) => b.startCount - a.startCount);
  }

  const myPitchers = useMemo(() => myTeam ? enrichPitchers(myTeam.pitchers) : [], [myTeam, probables]);
  const oppPitchers = useMemo(() => oppTeam ? enrichPitchers(oppTeam.pitchers) : [], [oppTeam, probables]);

  const myTotalStarts = useMemo(() => myPitchers.reduce((s, p) => s + p.startCount, 0), [myPitchers]);
  const oppTotalStarts = useMemo(() => oppPitchers.reduce((s, p) => s + p.startCount, 0), [oppPitchers]);

  // Free agent double starters
  const rosteredSet = useMemo(() => new Set(startsData?.rosteredPitchers ?? []), [startsData]);
  const freeAgentDoubleStarters = useMemo(() => {
    if (!probables) return [];
    return Object.entries(probables.byPitcher)
      .filter(([, starts]) => starts.length >= 2)
      .filter(([name]) => !rosteredSet.has(name))
      .map(([name, starts]) => ({ name, starts, team: starts[0]?.team ?? "" }))
      .sort((a, b) => b.starts.length - a.starts.length);
  }, [probables, rosteredSet]);

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading starts...</div>;
  if (error === "ESPN_CREDS_MISSING" || error === "MY_ESPN_TEAM_ID_MISSING") {
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnSetupCard /></div>;
  }
  if (error || !startsData) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load starts</div>
        <div className="text-[12px] text-slate-500">{error}</div>
      </div>
    );
  }

  const PitcherRow = ({ p }: { p: PitcherWithStarts }) => (
    <div className="border-b border-border px-3 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-[13px] font-medium ${p.startCount >= 2 ? "text-emerald-700" : "text-slate-700"}`}>
            {p.name}
          </span>
          <span className="text-[10px] text-slate-500">{p.proTeam}</span>
        </div>
        <span className={`text-[14px] font-bold tabular-nums ${
          p.startCount >= 2 ? "text-emerald-600" : p.startCount === 1 ? "text-slate-600" : "text-slate-400"
        }`}>
          {p.startCount}
        </span>
      </div>
      {p.starts.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5 ml-0">
          {p.starts.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] bg-surface border border-border text-slate-600">
              <span className="font-semibold">{fmtShortDate(s.date)}</span>
              <span className="text-slate-500">{s.opponent}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Pitcher Starts</h1>
          {dates && (
            <span className="text-[12px] text-slate-500">
              {view === "next" ? "Next week" : "This week"}: {fmtDateRange(dates.start, dates.end)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-0.5 rounded bg-surface border border-border p-0.5">
            <button onClick={() => setView("next")}
              className={`rounded px-3 py-1 text-[11px] font-bold transition-colors ${
                view === "next" ? "bg-black/10 text-gray-900" : "text-slate-500 hover:text-slate-700"
              }`}>Next Week</button>
            <button onClick={() => setView("current")}
              className={`rounded px-3 py-1 text-[11px] font-bold transition-colors ${
                view === "current" ? "bg-black/10 text-gray-900" : "text-slate-500 hover:text-slate-700"
              }`}>This Week</button>
          </div>
        </div>
      </div>

      {/* Starts comparison: My team vs Opponent */}
      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        {/* My team */}
        <div className="rounded-lg border border-orange-300 bg-surface">
          <div className="border-b border-orange-300 px-3 py-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-orange-600">
              {myTeam?.teamName ?? "My Team"}
            </span>
            <span className={`text-[16px] font-bold tabular-nums ${
              myTotalStarts >= oppTotalStarts ? "text-emerald-600" : "text-red-600"
            }`}>{myTotalStarts} starts</span>
          </div>
          {myPitchers.map((p, i) => <PitcherRow key={i} p={p} />)}
          {myPitchers.length === 0 && (
            <div className="px-3 py-4 text-[12px] text-slate-500">No SP data available</div>
          )}
        </div>

        {/* Opponent */}
        <div className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-3 py-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {oppTeam?.teamName ?? matchup?.oppTeamName ?? "Opponent"}
            </span>
            <span className="text-[16px] font-bold tabular-nums text-slate-600">{oppTotalStarts} starts</span>
          </div>
          {oppPitchers.map((p, i) => <PitcherRow key={i} p={p} />)}
          {oppPitchers.length === 0 && (
            <div className="px-3 py-4 text-[12px] text-slate-500">No SP data available</div>
          )}
        </div>
      </div>

      {/* Starts advantage */}
      {myTotalStarts > 0 && oppTotalStarts > 0 && (
        <div className={`mb-6 rounded-lg border px-4 py-3 text-center ${
          myTotalStarts > oppTotalStarts ? "border-emerald-300 bg-emerald-50" :
          myTotalStarts < oppTotalStarts ? "border-red-300 bg-red-50" :
          "border-orange-300 bg-orange-50"
        }`}>
          <span className={`text-[13px] font-semibold ${
            myTotalStarts > oppTotalStarts ? "text-emerald-700" :
            myTotalStarts < oppTotalStarts ? "text-red-700" : "text-orange-700"
          }`}>
            {myTotalStarts > oppTotalStarts
              ? `You have a ${myTotalStarts - oppTotalStarts}-start advantage`
              : myTotalStarts < oppTotalStarts
              ? `Opponent has a ${oppTotalStarts - myTotalStarts}-start advantage`
              : "Even on starts"}
          </span>
        </div>
      )}

      {/* Free Agent Double Starters — the pickup targets */}
      <div className="rounded-lg border border-emerald-300 bg-surface">
        <div className="border-b border-emerald-300 px-4 py-2.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">
              Free Agent Double Starters
            </span>
            <span className="ml-2 text-[10px] text-slate-500">
              Available SPs with 2+ starts {view === "next" ? "next week" : "this week"}
            </span>
          </div>
          <span className="text-[14px] font-bold tabular-nums text-emerald-600">{freeAgentDoubleStarters.length}</span>
        </div>

        {freeAgentDoubleStarters.length > 0 ? (
          <div>
            {freeAgentDoubleStarters.map((fa, i) => (
              <div key={i} className="border-b border-border px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-emerald-700">{fa.name}</span>
                    <span className="text-[10px] text-slate-500">{fa.team}</span>
                  </div>
                  <span className="text-[14px] font-bold tabular-nums text-emerald-600">{fa.starts.length} starts</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {fa.starts.map((s, j) => (
                    <span key={j} className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-700">
                      <span className="font-semibold">{fmtDate(s.date)}</span>
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
              ? "Probable pitcher schedule not yet available for this period."
              : "No unrostered double starters found."}
          </div>
        )}
      </div>

      {!probables && (
        <div className="mt-3 text-[11px] text-slate-400 text-center">
          Probable pitchers are typically announced 1-5 days in advance. Next week&apos;s schedule may not be fully populated yet.
        </div>
      )}
    </div>
  );
}
