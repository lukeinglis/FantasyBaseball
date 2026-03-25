"use client";

import { useState, useEffect } from "react";

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

const BAT_CATS = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG"];
const PIT_CATS = ["K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"];
// Lower is better for these categories
const LOWER_IS_BETTER = new Set(["ERA", "WHIP", "L"]);

const STARTING_SLOTS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 14, 15, 17]);

function catResultColor(result: string) {
  if (result === "WIN") return "text-emerald-400";
  if (result === "LOSS") return "text-red-400";
  if (result === "TIE") return "text-amber-400";
  return "text-slate-500";
}

function catBg(result: string) {
  if (result === "WIN") return "bg-emerald-500/10 border-emerald-500/20";
  if (result === "LOSS") return "bg-red-500/10 border-red-500/20";
  if (result === "TIE") return "bg-amber-500/10 border-amber-500/20";
  return "bg-surface border-border";
}

function fmtCat(cat: string, val: number | null): string {
  if (val === null) return "—";
  if (cat === "AVG" || cat === "ERA" || cat === "WHIP") return val.toFixed(3);
  return String(Math.round(val));
}

function PlayerRow({ p, highlightSlots }: { p: MatchupPlayer; highlightSlots: boolean }) {
  const isStarter = STARTING_SLOTS.has(p.slotId);
  return (
    <div className={`flex items-center gap-2 border-b border-border/30 px-3 py-1.5 ${
      highlightSlots && !isStarter ? "opacity-40" : ""
    }`}>
      <span className="w-7 shrink-0 text-[10px] font-bold text-slate-600">{p.slotLabel}</span>
      <span className="min-w-0 flex-1 truncate text-[12px] text-slate-200">{p.name}</span>
      <span className="shrink-0 text-[10px] text-slate-600">{p.proTeam}</span>
      {p.injuryStatus !== "ACTIVE" && (
        <span className={`shrink-0 text-[10px] font-semibold ${p.injuryColor}`}>
          {p.injuryLabel}
        </span>
      )}
    </div>
  );
}

function EspnSetupCard() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-surface px-8 py-10 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-amber-400/60">Setup Required</div>
      <div className="mt-3 text-xl font-bold text-white">Connect ESPN Credentials</div>
      <div className="mt-3 text-[13px] text-slate-400">
        The Matchup view pulls live data from your private ESPN league. Add two environment variables to Vercel to enable it.
      </div>
      <div className="mt-5 rounded-lg border border-border bg-background px-4 py-4 text-left text-[12px]">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
          Vercel → Settings → Environment Variables
        </div>
        <div className="space-y-2 font-mono">
          <div><span className="text-amber-400">ESPN_S2</span> <span className="text-slate-600">=</span> <span className="text-slate-400">AE...</span></div>
          <div><span className="text-amber-400">ESPN_SWID</span> <span className="text-slate-600">=</span> <span className="text-slate-400">{"{"}{"{"}XXXX-...{"}"}{"]"}</span></div>
          <div><span className="text-amber-400">MY_ESPN_TEAM_ID</span> <span className="text-slate-600">=</span> <span className="text-slate-400">1</span> <span className="text-slate-700"># your team&apos;s numeric ID</span></div>
        </div>
      </div>
      <div className="mt-4 text-[11px] text-slate-600">
        Find your cookies: ESPN.com → DevTools → Application → Cookies → espn.com
      </div>
    </div>
  );
}

export default function MatchupPage() {
  const [data, setData] = useState<MatchupData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showStartersOnly, setShowStartersOnly] = useState(false);

  useEffect(() => {
    fetch("/api/espn/matchup")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
        setLoading(false);
      })
      .catch(() => { setError("FETCH_FAILED"); setLoading(false); });
  }, []);

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-500">Loading matchup...</div>;
  }

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

  const batCats = data.categories.filter((c) => BAT_CATS.includes(c.cat));
  const pitCats = data.categories.filter((c) => PIT_CATS.includes(c.cat));
  const myWinCount = data.categories.filter((c) => c.result === "WIN").length;
  const oppWinCount = data.categories.filter((c) => c.result === "LOSS").length;

  const myRosterSorted = [...data.myRoster].sort((a, b) => a.slotId - b.slotId);
  const oppRosterSorted = [...data.oppRoster].sort((a, b) => a.slotId - b.slotId);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-600">
            Week {data.scoringPeriodId}
          </div>
          <div className="mt-1 flex items-center gap-3">
            <span className="text-xl font-bold text-amber-400">{data.myTeamName}</span>
            <span className="text-slate-600">vs</span>
            <span className="text-xl font-bold text-slate-200">{data.oppTeamName}</span>
          </div>
        </div>
        {/* Category score summary */}
        <div className="flex items-center gap-4">
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
        <div className="text-right text-[12px] text-slate-500">
          <div>{data.myTeamName}: {data.myWins}–{data.myLosses}{data.myTies > 0 ? `–${data.myTies}` : ""} cats</div>
          <div>{data.oppTeamName}: {data.oppWins}–{data.oppLosses}{data.oppTies > 0 ? `–${data.oppTies}` : ""} cats</div>
        </div>
      </div>

      {/* Category scores */}
      <div className="mb-8 space-y-3">
        {[
          { label: "Batting", cats: batCats },
          { label: "Pitching", cats: pitCats },
        ].map(({ label, cats }) => (
          <div key={label}>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-700">{label}</div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {cats.map((c) => {
                const lowerBetter = LOWER_IS_BETTER.has(c.cat);
                const myIsAhead = c.myValue !== null && c.oppValue !== null
                  ? (lowerBetter ? c.myValue < c.oppValue : c.myValue > c.oppValue)
                  : null;
                return (
                  <div key={c.cat}
                    className={`rounded-lg border px-2 py-2 text-center ${catBg(c.result)}`}>
                    <div className="text-[10px] font-bold text-slate-500">{c.cat}</div>
                    <div className={`mt-0.5 font-mono text-[15px] font-bold ${catResultColor(c.result)}`}>
                      {fmtCat(c.cat, c.myValue)}
                    </div>
                    <div className="text-[11px] font-mono text-slate-600">
                      {fmtCat(c.cat, c.oppValue)}
                    </div>
                    <div className={`mt-0.5 text-[9px] font-bold uppercase ${catResultColor(c.result)}`}>
                      {c.result === "PENDING" ? "" : c.result}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Roster comparison */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">Rosters</div>
        <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-slate-500">
          <input
            type="checkbox"
            checked={showStartersOnly}
            onChange={(e) => setShowStartersOnly(e.target.checked)}
            className="accent-amber-500"
          />
          Starters only
        </label>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {/* My roster */}
        <div className="rounded-lg border border-amber-500/20 bg-surface">
          <div className="border-b border-amber-500/20 px-3 py-2">
            <span className="text-[12px] font-semibold text-amber-400">{data.myTeamName}</span>
          </div>
          <div>
            {myRosterSorted
              .filter((p) => !showStartersOnly || STARTING_SLOTS.has(p.slotId))
              .map((p, i) => <PlayerRow key={i} p={p} highlightSlots={false} />)}
          </div>
        </div>
        {/* Opponent roster */}
        <div className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-3 py-2">
            <span className="text-[12px] font-semibold text-slate-300">{data.oppTeamName}</span>
          </div>
          <div>
            {oppRosterSorted
              .filter((p) => !showStartersOnly || STARTING_SLOTS.has(p.slotId))
              .map((p, i) => <PlayerRow key={i} p={p} highlightSlots={false} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
