"use client";

import { useState, useEffect, useMemo } from "react";

interface RosterPlayer {
  name: string;
  pos: string;
  slotLabel: string;
  slotId: number;
  proTeam: string;
  injuryStatus: string;
  injuryLabel: string;
  injuryColor: string;
}

interface EspnTeam {
  id: number;
  name: string;
  roster: RosterPlayer[];
}

// Z-score fields from rankings
interface PlayerRanking {
  name: string;
  pos: string;
  team: string;
  type: string;
  zTotal: number;
  zH?: number; zR?: number; zHR?: number; zTB?: number;
  zRBI?: number; zBB?: number; zSB?: number; zAVG?: number;
  zK?: number; zQS?: number; zW?: number; zL?: number;
  zSV?: number; zHD?: number; zERA?: number; zWHIP?: number;
}

const BAT_CATS = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG"];
const PIT_CATS = ["K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"];
const Z_FIELDS: Record<string, string> = {
  H: "zH", R: "zR", HR: "zHR", TB: "zTB", RBI: "zRBI", BB: "zBB", SB: "zSB", AVG: "zAVG",
  K: "zK", QS: "zQS", W: "zW", L: "zL", SV: "zSV", HD: "zHD", ERA: "zERA", WHIP: "zWHIP",
};

function getZ(p: PlayerRanking, cat: string): number {
  const field = Z_FIELDS[cat] as keyof PlayerRanking;
  return (p[field] as number) ?? 0;
}

function EspnSetupCard() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-surface px-8 py-10 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-amber-400/60">Setup Required</div>
      <div className="mt-3 text-xl font-bold text-white">Connect ESPN Credentials</div>
      <div className="mt-3 text-[13px] text-slate-400">
        Trade Room needs your ESPN roster data to evaluate trades.
      </div>
    </div>
  );
}

export default function TradeRoomPage() {
  const [teams, setTeams] = useState<EspnTeam[]>([]);
  const [rankings, setRankings] = useState<PlayerRanking[]>([]);
  const [myTeamId, setMyTeamId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Trade state
  const [sending, setSending] = useState<string[]>([]);
  const [receiving, setReceiving] = useState<string[]>([]);
  const [tradePartner, setTradePartner] = useState<number | null>(null);
  const [searchSend, setSearchSend] = useState("");
  const [searchReceive, setSearchReceive] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/espn/roster").then((r) => r.json()),
      fetch("/api/rankings").then((r) => r.json()),
      fetch("/api/espn/matchup").then((r) => r.json()).catch(() => ({})),
    ]).then(([rosterData, rankData, matchupData]) => {
      if (rosterData.error) { setError(rosterData.error); return; }
      setTeams(rosterData);
      setRankings(rankData);
      if (matchupData.myTeamId) setMyTeamId(matchupData.myTeamId);
    })
    .catch(() => setError("FETCH_FAILED"))
    .finally(() => setLoading(false));
  }, []);

  const rankMap = useMemo(() => {
    const m = new Map<string, PlayerRanking>();
    rankings.forEach((p) => m.set(p.name, p));
    return m;
  }, [rankings]);

  const myTeam = useMemo(() => {
    if (!teams.length) return null;
    if (myTeamId) return teams.find((t) => t.id === myTeamId) ?? teams[0];
    return teams[0];
  }, [teams, myTeamId]);

  const partnerTeam = useMemo(() => {
    if (!tradePartner) return null;
    return teams.find((t) => t.id === tradePartner) ?? null;
  }, [teams, tradePartner]);

  const otherTeams = useMemo(() => teams.filter((t) => t.id !== myTeam?.id), [teams, myTeam]);

  // Filter rosters for search
  const myRosterFiltered = useMemo(() => {
    if (!myTeam) return [];
    return myTeam.roster
      .filter((p) => !sending.includes(p.name))
      .filter((p) => !searchSend || p.name.toLowerCase().includes(searchSend.toLowerCase()));
  }, [myTeam, sending, searchSend]);

  const partnerRosterFiltered = useMemo(() => {
    if (!partnerTeam) return [];
    return partnerTeam.roster
      .filter((p) => !receiving.includes(p.name))
      .filter((p) => !searchReceive || p.name.toLowerCase().includes(searchReceive.toLowerCase()));
  }, [partnerTeam, receiving, searchReceive]);

  // Calculate z-score impact
  const tradeImpact = useMemo(() => {
    const cats = [...BAT_CATS, ...PIT_CATS];
    const impact: Record<string, { sending: number; receiving: number; net: number }> = {};
    let totalSending = 0, totalReceiving = 0;

    for (const cat of cats) {
      const sendZ = sending.reduce((sum, name) => sum + getZ(rankMap.get(name) ?? {} as PlayerRanking, cat), 0);
      const recvZ = receiving.reduce((sum, name) => sum + getZ(rankMap.get(name) ?? {} as PlayerRanking, cat), 0);
      impact[cat] = { sending: sendZ, receiving: recvZ, net: recvZ - sendZ };
    }

    totalSending = sending.reduce((sum, name) => sum + (rankMap.get(name)?.zTotal ?? 0), 0);
    totalReceiving = receiving.reduce((sum, name) => sum + (rankMap.get(name)?.zTotal ?? 0), 0);

    return { categories: impact, totalSending, totalReceiving, netTotal: totalReceiving - totalSending };
  }, [sending, receiving, rankMap]);

  const hasTrade = sending.length > 0 || receiving.length > 0;

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading trade room...</div>;
  if (error === "ESPN_CREDS_MISSING") {
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnSetupCard /></div>;
  }
  if (error || !myTeam) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-400">Failed to load trade room</div>
        <div className="text-[12px] text-slate-600">{error}</div>
      </div>
    );
  }

  const PlayerChip = ({ name, onRemove }: { name: string; onRemove: () => void }) => {
    const p = rankMap.get(name);
    return (
      <div className="flex items-center gap-1.5 rounded bg-white/5 border border-border px-2 py-1">
        <span className="text-[12px] text-slate-200">{name}</span>
        {p && (
          <span className={`text-[10px] font-mono ${p.zTotal >= 0 ? "text-sky-400" : "text-red-400/70"}`}>
            {p.zTotal.toFixed(2)}
          </span>
        )}
        <button onClick={onRemove} className="ml-1 text-slate-600 hover:text-red-400 text-[10px]">x</button>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-white">Trade Room</h1>
        <span className="text-[12px] text-slate-500">Evaluate trade impact using projected z-scores</span>
      </div>

      {/* Trade partner selector */}
      <div className="mb-5">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 block mb-1.5">
          Trade Partner
        </label>
        <select
          value={tradePartner ?? ""}
          onChange={(e) => {
            setTradePartner(e.target.value ? parseInt(e.target.value) : null);
            setReceiving([]);
            setSearchReceive("");
          }}
          className="rounded border border-border bg-surface px-3 py-1.5 text-[13px] text-slate-200 outline-none"
        >
          <option value="">Select a team...</option>
          {otherTeams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Two-column trade builder */}
      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        {/* Sending (my players) */}
        <div className="rounded-lg border border-red-500/20 bg-surface">
          <div className="border-b border-red-500/20 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400/70">Sending</span>
          </div>
          {/* Selected players */}
          {sending.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-border/30">
              {sending.map((name) => (
                <PlayerChip key={name} name={name} onRemove={() => setSending(sending.filter((n) => n !== name))} />
              ))}
            </div>
          )}
          {/* Search + add */}
          <div className="px-3 py-2">
            <input
              type="text"
              placeholder="Search your roster..."
              value={searchSend}
              onChange={(e) => setSearchSend(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1 text-[12px] text-slate-200 outline-none placeholder:text-slate-700"
            />
          </div>
          <div className="overflow-y-auto max-h-[240px]">
            {myRosterFiltered.map((p, i) => (
              <button key={i}
                onClick={() => { setSending([...sending, p.name]); setSearchSend(""); }}
                className="flex w-full items-center gap-2 border-b border-border/20 px-3 py-1.5 text-left hover:bg-white/[0.03]">
                <span className="text-[12px] text-slate-300">{p.name}</span>
                <span className="text-[10px] text-slate-600">{p.pos} · {p.proTeam}</span>
                {rankMap.get(p.name) && (
                  <span className={`ml-auto text-[10px] font-mono ${
                    (rankMap.get(p.name)?.zTotal ?? 0) >= 0 ? "text-sky-400/70" : "text-red-400/60"
                  }`}>{rankMap.get(p.name)!.zTotal.toFixed(2)}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Receiving (partner's players) */}
        <div className="rounded-lg border border-emerald-500/20 bg-surface">
          <div className="border-b border-emerald-500/20 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/70">Receiving</span>
          </div>
          {receiving.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-border/30">
              {receiving.map((name) => (
                <PlayerChip key={name} name={name} onRemove={() => setReceiving(receiving.filter((n) => n !== name))} />
              ))}
            </div>
          )}
          {tradePartner ? (
            <>
              <div className="px-3 py-2">
                <input
                  type="text"
                  placeholder={`Search ${partnerTeam?.name ?? "partner"}'s roster...`}
                  value={searchReceive}
                  onChange={(e) => setSearchReceive(e.target.value)}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-[12px] text-slate-200 outline-none placeholder:text-slate-700"
                />
              </div>
              <div className="overflow-y-auto max-h-[240px]">
                {partnerRosterFiltered.map((p, i) => (
                  <button key={i}
                    onClick={() => { setReceiving([...receiving, p.name]); setSearchReceive(""); }}
                    className="flex w-full items-center gap-2 border-b border-border/20 px-3 py-1.5 text-left hover:bg-white/[0.03]">
                    <span className="text-[12px] text-slate-300">{p.name}</span>
                    <span className="text-[10px] text-slate-600">{p.pos} · {p.proTeam}</span>
                    {rankMap.get(p.name) && (
                      <span className={`ml-auto text-[10px] font-mono ${
                        (rankMap.get(p.name)?.zTotal ?? 0) >= 0 ? "text-sky-400/70" : "text-red-400/60"
                      }`}>{rankMap.get(p.name)!.zTotal.toFixed(2)}</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="px-6 py-10 text-center text-[12px] text-slate-600">
              Select a trade partner above
            </div>
          )}
        </div>
      </div>

      {/* Trade impact analysis */}
      {hasTrade && (
        <div className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-4 py-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Trade Impact</span>
            <div className="flex items-center gap-3">
              <span className={`text-[18px] font-bold font-mono tabular-nums ${
                tradeImpact.netTotal > 0.05 ? "text-emerald-400" :
                tradeImpact.netTotal < -0.05 ? "text-red-400" : "text-amber-400"
              }`}>
                {tradeImpact.netTotal > 0 ? "+" : ""}{tradeImpact.netTotal.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-600">NET z-SCORE</span>
            </div>
          </div>

          {/* Category-by-category impact */}
          {[
            { label: "Batting", cats: BAT_CATS },
            { label: "Pitching", cats: PIT_CATS },
          ].map(({ label, cats }) => (
            <div key={label}>
              <div className="px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-700 bg-white/[0.02]">
                {label}
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-8">
                {cats.map((cat) => {
                  const imp = tradeImpact.categories[cat];
                  if (!imp) return null;
                  const net = imp.net;
                  return (
                    <div key={cat} className="border-r border-b border-border/30 last:border-r-0 px-2 py-2.5 text-center">
                      <div className="text-[10px] font-bold text-slate-500">{cat}</div>
                      <div className={`mt-0.5 text-[14px] font-bold font-mono tabular-nums ${
                        net > 0.05 ? "text-emerald-400" :
                        net < -0.05 ? "text-red-400" : "text-slate-500"
                      }`}>
                        {net > 0 ? "+" : ""}{net.toFixed(2)}
                      </div>
                      <div className="mt-0.5 flex justify-center gap-1 text-[9px]">
                        <span className="text-red-400/50">-{Math.abs(imp.sending).toFixed(1)}</span>
                        <span className="text-emerald-400/50">+{Math.abs(imp.receiving).toFixed(1)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Reset */}
          <div className="px-4 py-3 border-t border-border/30">
            <button
              onClick={() => { setSending([]); setReceiving([]); }}
              className="text-[11px] text-slate-500 hover:text-slate-300"
            >
              Clear trade
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
