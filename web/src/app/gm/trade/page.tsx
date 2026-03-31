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

interface PlayerStats {
  name: string;
  pos: string;
  proTeam: string;
  seasonStats: Record<string, number>;
  last7Stats: Record<string, number>;
  last15Stats: Record<string, number>;
  last30Stats: Record<string, number>;
}

const BAT_CATS = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG"];
const PIT_CATS = ["K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"];
const ALL_CATS = [...BAT_CATS, ...PIT_CATS];

function fmtStat(cat: string, val: number | undefined): string {
  if (val === undefined || val === null) return "-";
  if (cat === "AVG") return val.toFixed(3);
  if (cat === "ERA" || cat === "WHIP") return val.toFixed(2);
  return String(Math.round(val));
}

function EspnSetupCard() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-surface px-8 py-10 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-orange-600/60">Setup Required</div>
      <div className="mt-3 text-xl font-bold text-gray-900">Connect ESPN Credentials</div>
      <div className="mt-3 text-[13px] text-slate-500">
        Trade Room needs your ESPN roster data to evaluate trades.
      </div>
    </div>
  );
}

export default function TradeRoomPage() {
  const [teams, setTeams] = useState<EspnTeam[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [myTeamId, setMyTeamId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Trade state
  const [sending, setSending] = useState<string[]>([]);
  const [receiving, setReceiving] = useState<string[]>([]);
  const [tradePartner, setTradePartner] = useState<number | null>(null);
  const [searchSend, setSearchSend] = useState("");
  const [searchReceive, setSearchReceive] = useState("");
  const [statPeriod, setStatPeriod] = useState<"season" | "last7" | "last15" | "last30">("season");

  useEffect(() => {
    Promise.all([
      fetch("/api/espn/roster").then((r) => r.json()),
      fetch("/api/espn/player-stats").then((r) => r.json()).catch(() => ({ players: [] })),
      fetch("/api/espn/matchup").then((r) => r.json()).catch(() => ({})),
    ]).then(([rosterData, statsData, matchupData]) => {
      if (rosterData.error) { setError(rosterData.error); return; }
      setTeams(rosterData);
      if (statsData.players) setPlayerStats(statsData.players);
      if (matchupData.myTeamId) setMyTeamId(matchupData.myTeamId);
    })
    .catch(() => setError("FETCH_FAILED"))
    .finally(() => setLoading(false));
  }, []);

  const statsMap = useMemo(() => {
    const m = new Map<string, PlayerStats>();
    playerStats.forEach((p) => m.set(p.name, p));
    return m;
  }, [playerStats]);

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

  function getStats(name: string): Record<string, number> {
    const ps = statsMap.get(name);
    if (!ps) return {};
    if (statPeriod === "last7") return ps.last7Stats;
    if (statPeriod === "last15") return ps.last15Stats;
    if (statPeriod === "last30") return ps.last30Stats;
    return ps.seasonStats;
  }

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

  // Calculate trade impact using actual stats
  const tradeImpact = useMemo(() => {
    const impact: Record<string, { sending: number; receiving: number; net: number }> = {};

    for (const cat of ALL_CATS) {
      const sendTotal = sending.reduce((sum, name) => sum + (getStats(name)[cat] ?? 0), 0);
      const recvTotal = receiving.reduce((sum, name) => sum + (getStats(name)[cat] ?? 0), 0);
      impact[cat] = { sending: sendTotal, receiving: recvTotal, net: recvTotal - sendTotal };
    }

    return impact;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sending, receiving, statsMap, statPeriod]);

  const hasTrade = sending.length > 0 || receiving.length > 0;

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading trade room...</div>;
  if (error === "ESPN_CREDS_MISSING") {
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnSetupCard /></div>;
  }
  if (error || !myTeam) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load trade room</div>
        <div className="text-[12px] text-slate-500">{error}</div>
      </div>
    );
  }

  const PlayerChip = ({ name, onRemove, side }: { name: string; onRemove: () => void; side: "send" | "recv" }) => {
    const ps = statsMap.get(name);
    const stats = getStats(name);
    const mainStat = ps?.pos === "SP" || ps?.pos === "RP"
      ? `${fmtStat("ERA", stats.ERA)} ERA`
      : `${fmtStat("AVG", stats.AVG)} AVG`;
    return (
      <div className={`flex items-center gap-2 rounded border px-2 py-1.5 ${
        side === "send" ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"
      }`}>
        <div className="min-w-0">
          <div className="text-[12px] font-medium text-slate-700">{name}</div>
          <div className="text-[10px] text-slate-500">{ps?.pos} · {mainStat}</div>
        </div>
        <button onClick={onRemove} className="ml-1 text-slate-400 hover:text-red-600 text-[10px] font-bold">x</button>
      </div>
    );
  };

  const PlayerOption = ({ player, onClick }: { player: RosterPlayer; onClick: () => void }) => {
    const stats = getStats(player.name);
    const isPitcher = player.pos === "SP" || player.pos === "RP";
    const headline = isPitcher
      ? `${fmtStat("ERA", stats.ERA)} ERA · ${fmtStat("K", stats.K)} K · ${fmtStat("W", stats.W)} W`
      : `${fmtStat("AVG", stats.AVG)} · ${fmtStat("HR", stats.HR)} HR · ${fmtStat("RBI", stats.RBI)} RBI`;

    return (
      <button onClick={onClick}
        className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left hover:bg-black/[0.03]">
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-medium text-slate-700">{player.name}</div>
          <div className="text-[10px] text-slate-500">{player.pos} · {player.proTeam}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] font-mono text-slate-600">{headline}</div>
        </div>
      </button>
    );
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Trade Room</h1>
          <span className="text-[12px] text-slate-500">Evaluate trades using current season stats</span>
        </div>
        {/* Stat period toggle */}
        <div className="flex gap-0.5 rounded bg-surface border border-border p-0.5">
          {([
            { key: "season", label: "Season" },
            { key: "last30", label: "30D" },
            { key: "last15", label: "15D" },
            { key: "last7", label: "7D" },
          ] as const).map((v) => (
            <button key={v.key} onClick={() => setStatPeriod(v.key)}
              className={`rounded px-2.5 py-1 text-[11px] font-bold transition-colors ${
                statPeriod === v.key ? "bg-black/10 text-gray-900" : "text-slate-500 hover:text-slate-700"
              }`}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Trade partner selector */}
      <div className="mb-5">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">
          Trade Partner
        </label>
        <select
          value={tradePartner ?? ""}
          onChange={(e) => {
            setTradePartner(e.target.value ? parseInt(e.target.value) : null);
            setReceiving([]);
            setSearchReceive("");
          }}
          className="rounded border border-border bg-surface px-3 py-1.5 text-[13px] text-slate-700 outline-none"
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
        <div className="rounded-lg border border-red-300 bg-surface">
          <div className="border-b border-red-300 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-red-600/70">Sending</span>
          </div>
          {sending.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-border">
              {sending.map((name) => (
                <PlayerChip key={name} name={name} side="send" onRemove={() => setSending(sending.filter((n) => n !== name))} />
              ))}
            </div>
          )}
          <div className="px-3 py-2">
            <input type="text" placeholder="Search your roster..."
              value={searchSend} onChange={(e) => setSearchSend(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1 text-[12px] text-slate-700 outline-none placeholder:text-slate-400" />
          </div>
          <div className="overflow-y-auto max-h-[280px]">
            {myRosterFiltered.map((p, i) => (
              <PlayerOption key={i} player={p} onClick={() => { setSending([...sending, p.name]); setSearchSend(""); }} />
            ))}
          </div>
        </div>

        {/* Receiving (partner's players) */}
        <div className="rounded-lg border border-emerald-300 bg-surface">
          <div className="border-b border-emerald-300 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600/70">Receiving</span>
          </div>
          {receiving.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-border">
              {receiving.map((name) => (
                <PlayerChip key={name} name={name} side="recv" onRemove={() => setReceiving(receiving.filter((n) => n !== name))} />
              ))}
            </div>
          )}
          {tradePartner ? (
            <>
              <div className="px-3 py-2">
                <input type="text" placeholder={`Search ${partnerTeam?.name ?? "partner"}'s roster...`}
                  value={searchReceive} onChange={(e) => setSearchReceive(e.target.value)}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-[12px] text-slate-700 outline-none placeholder:text-slate-400" />
              </div>
              <div className="overflow-y-auto max-h-[280px]">
                {partnerRosterFiltered.map((p, i) => (
                  <PlayerOption key={i} player={p} onClick={() => { setReceiving([...receiving, p.name]); setSearchReceive(""); }} />
                ))}
              </div>
            </>
          ) : (
            <div className="px-6 py-10 text-center text-[12px] text-slate-500">
              Select a trade partner above
            </div>
          )}
        </div>
      </div>

      {/* Trade impact analysis */}
      {hasTrade && (
        <div className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-4 py-3 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Trade Impact</span>
              <span className="ml-2 text-[10px] text-slate-400">
                ({statPeriod === "season" ? "Season" : statPeriod === "last7" ? "Last 7 days" : statPeriod === "last15" ? "Last 15 days" : "Last 30 days"})
              </span>
            </div>
          </div>

          {/* Category-by-category impact */}
          {[
            { label: "Batting", cats: BAT_CATS },
            { label: "Pitching", cats: PIT_CATS },
          ].map(({ label, cats }) => (
            <div key={label}>
              <div className="px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-400 bg-black/[0.02]">
                {label}
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-8">
                {cats.map((cat) => {
                  const imp = tradeImpact[cat];
                  if (!imp) return null;
                  const net = imp.net;
                  const isRate = cat === "AVG" || cat === "ERA" || cat === "WHIP";
                  const isLower = cat === "ERA" || cat === "WHIP" || cat === "L";
                  // For rate stats, show values; for counting stats, show +/- difference
                  const displayNet = isRate ? net : net;
                  const isPositive = isLower ? net < 0 : net > 0;
                  const isNegative = isLower ? net > 0 : net < 0;

                  return (
                    <div key={cat} className="border-r border-b border-border last:border-r-0 px-2 py-2.5 text-center">
                      <div className="text-[10px] font-bold text-slate-500">{cat}</div>
                      <div className="mt-1 text-[10px] text-slate-500">
                        <span className="text-red-600">{fmtStat(cat, imp.sending)}</span>
                        {" → "}
                        <span className="text-emerald-600">{fmtStat(cat, imp.receiving)}</span>
                      </div>
                      <div className={`mt-0.5 text-[13px] font-bold font-mono tabular-nums ${
                        isPositive ? "text-emerald-600" : isNegative ? "text-red-600" : "text-slate-500"
                      }`}>
                        {isRate
                          ? fmtStat(cat, displayNet)
                          : `${net > 0 ? "+" : ""}${Math.round(net)}`
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Player stat comparison */}
          {(sending.length > 0 || receiving.length > 0) && (
            <div className="border-t border-border">
              <div className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-slate-400 bg-black/[0.02]">
                Player Comparison
              </div>
              <div className="grid gap-0 sm:grid-cols-2">
                {/* Sending details */}
                <div className="border-r border-border">
                  {sending.map((name) => {
                    const stats = getStats(name);
                    const ps = statsMap.get(name);
                    const isPitcher = ps?.pos === "SP" || ps?.pos === "RP";
                    const cats = isPitcher ? PIT_CATS : BAT_CATS;
                    return (
                      <div key={name} className="border-b border-border px-3 py-2">
                        <div className="text-[12px] font-medium text-red-600">{name}</div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]">
                          {cats.map((cat) => (
                            <span key={cat} className="text-slate-500">
                              <span className="text-slate-400">{cat}</span> {fmtStat(cat, stats[cat])}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Receiving details */}
                <div>
                  {receiving.map((name) => {
                    const stats = getStats(name);
                    const ps = statsMap.get(name);
                    const isPitcher = ps?.pos === "SP" || ps?.pos === "RP";
                    const cats = isPitcher ? PIT_CATS : BAT_CATS;
                    return (
                      <div key={name} className="border-b border-border px-3 py-2">
                        <div className="text-[12px] font-medium text-emerald-600">{name}</div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]">
                          {cats.map((cat) => (
                            <span key={cat} className="text-slate-500">
                              <span className="text-slate-400">{cat}</span> {fmtStat(cat, stats[cat])}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Reset */}
          <div className="px-4 py-3 border-t border-border">
            <button onClick={() => { setSending([]); setReceiving([]); }}
              className="text-[11px] text-slate-500 hover:text-slate-700">
              Clear trade
            </button>
          </div>
        </div>
      )}

      {/* No stats notice */}
      {playerStats.length === 0 && (
        <div className="mt-4 text-[11px] text-slate-400 text-center">
          Live player stats will appear once games have been played this season.
        </div>
      )}
    </div>
  );
}
