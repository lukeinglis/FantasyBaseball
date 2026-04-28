export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CATS_ORDER = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG", "K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"];
const LOWER_IS_BETTER = new Set(["ERA", "WHIP", "L"]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeFetch(url: string, ms = 10000): Promise<any | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { signal: ac.signal });
    return r.ok ? await r.json() : null;
  } catch { return null; }
  finally { clearTimeout(t); }
}

function fmt(cat: string, val: number): string {
  if (!Number.isFinite(val)) return "–";
  if (cat === "AVG") return val.toFixed(3);
  if (cat === "ERA" || cat === "WHIP") return val.toFixed(2);
  if (cat === "IP") return val.toFixed(1);
  return String(Math.round(val));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPrompt(matchup: any, league: any, standings: any, schedule: any, zScores: any): string {
  const lines: string[] = [];
  const myId = matchup?.myTeamId ?? league?.myTeamId ?? standings?.myTeamId;

  // ── Team overview ──────────────────────────────────────────────────────────
  const teamName = matchup?.myTeamName ?? "My Team";
  const myStandingsEntry = standings?.teams?.find((t: any) => t.teamId === myId); // eslint-disable-line @typescript-eslint/no-explicit-any
  const rank = myStandingsEntry?.rank ?? "?";
  const total = standings?.teams?.length ?? 10;
  const streak = myStandingsEntry?.streak ?? "–";
  const weeksLeft = schedule?.weeks
    ? schedule.weeks.filter((w: any) => w.period > (schedule.currentMatchupPeriod ?? 0)).length // eslint-disable-line @typescript-eslint/no-explicit-any
    : "?";

  lines.push(`=== TEAM: ${teamName} ===`);
  lines.push(`Season record: ${myStandingsEntry?.wins ?? "?"}W-${myStandingsEntry?.losses ?? "?"}L | League rank: #${rank}/${total} | Streak: ${streak} | Weeks left: ${weeksLeft}`);
  lines.push("");

  // ── Current matchup ────────────────────────────────────────────────────────
  if (matchup && !matchup.error) {
    const daysLeft = matchup.matchupEndDate
      ? Math.max(0, Math.ceil((new Date(matchup.matchupEndDate + "T23:59:59").getTime() - Date.now()) / 86400000))
      : "?";

    lines.push(`=== CURRENT MATCHUP — Week ${matchup.scoringPeriodId} vs ${matchup.oppTeamName ?? "Unknown"} ===`);
    lines.push(`Score: ${matchup.myWins}-${matchup.myLosses}-${matchup.myTies} | Days remaining: ${daysLeft}`);

    const cats: { cat: string; result: string; myVal: number; oppVal: number }[] = (matchup.categories ?? []).map((c: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
      cat: c.cat, result: c.result, myVal: c.myValue ?? 0, oppVal: c.oppValue ?? 0,
    }));

    const winning = cats.filter(c => c.result === "WIN");
    const losing = cats.filter(c => c.result === "LOSS");
    const tied = cats.filter(c => c.result === "TIE");

    if (winning.length)
      lines.push(`Winning: ${winning.map(c => `${c.cat}(me:${fmt(c.cat, c.myVal)} vs ${fmt(c.cat, c.oppVal)})`).join(", ")}`);
    if (losing.length)
      lines.push(`Losing: ${losing.map(c => `${c.cat}(me:${fmt(c.cat, c.myVal)} vs ${fmt(c.cat, c.oppVal)})`).join(", ")}`);
    if (tied.length)
      lines.push(`Tied: ${tied.map(c => c.cat).join(", ")}`);

    // Gap analysis — categories close to flipping
    const flippable = losing
      .map(c => {
        const lower = LOWER_IS_BETTER.has(c.cat);
        const gap = lower ? c.myVal - c.oppVal : c.oppVal - c.myVal;
        return { cat: c.cat, gap };
      })
      .filter(c => c.gap > 0)
      .sort((a, b) => a.gap - b.gap)
      .slice(0, 3);
    if (flippable.length)
      lines.push(`Closest to flipping (smallest gap): ${flippable.map(c => `${c.cat}(gap:${c.gap.toFixed(c.cat === "AVG" ? 3 : c.cat === "ERA" || c.cat === "WHIP" ? 2 : 0)})`).join(", ")}`);

    lines.push("");
  }

  // ── My active roster ───────────────────────────────────────────────────────
  if (matchup?.myRoster?.length) {
    const BATTER_SLOTS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 12]);
    const PITCHER_SLOTS = new Set([13, 14, 15]);

    const batters = matchup.myRoster.filter((p: any) => BATTER_SLOTS.has(p.slotId)); // eslint-disable-line @typescript-eslint/no-explicit-any
    const pitchers = matchup.myRoster.filter((p: any) => PITCHER_SLOTS.has(p.slotId)); // eslint-disable-line @typescript-eslint/no-explicit-any
    const bench = matchup.myRoster.filter((p: any) => p.slotId === 16); // eslint-disable-line @typescript-eslint/no-explicit-any
    const il = matchup.myRoster.filter((p: any) => p.slotId === 17); // eslint-disable-line @typescript-eslint/no-explicit-any

    lines.push("=== MY ROSTER ===");
    if (batters.length) {
      lines.push("Batters (active):");
      for (const p of batters) {
        const s = p.stats ?? {};
        const inj = p.injuryStatus !== "ACTIVE" ? ` [${p.injuryLabel}]` : "";
        const avg = Number.isFinite(s.AVG) ? s.AVG.toFixed(3) : ".000";
        lines.push(`  ${p.name} (${p.pos}/${p.proTeam}): ${avg} AVG, ${Math.round(s.HR ?? 0)} HR, ${Math.round(s.RBI ?? 0)} RBI, ${Math.round(s.SB ?? 0)} SB, ${Math.round(s.R ?? 0)} R${inj}`);
      }
    }
    if (pitchers.length) {
      lines.push("Pitchers (active):");
      for (const p of pitchers) {
        const s = p.stats ?? {};
        const inj = p.injuryStatus !== "ACTIVE" ? ` [${p.injuryLabel}]` : "";
        const era = Number.isFinite(s.ERA) ? s.ERA.toFixed(2) : "–";
        const whip = Number.isFinite(s.WHIP) ? s.WHIP.toFixed(2) : "–";
        const ip = Number.isFinite(s.IP) ? s.IP.toFixed(1) : "0.0";
        lines.push(`  ${p.name} (${p.pos}/${p.proTeam}): ${era} ERA, ${whip} WHIP, ${Math.round(s.K ?? 0)} K, ${ip} IP, ${Math.round(s.W ?? 0)}W${inj}`);
      }
    }
    if (bench.length) lines.push(`Bench: ${bench.map((p: any) => p.name).join(", ")}`); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (il.length) lines.push(`IL: ${il.map((p: any) => `${p.name}[${p.injuryLabel}]`).join(", ")}`); // eslint-disable-line @typescript-eslint/no-explicit-any
    lines.push("");
  }

  // ── Season category rankings ───────────────────────────────────────────────
  if (league?.teams) {
    const myLeagueTeam = league.teams.find((t: any) => t.teamId === myId); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (myLeagueTeam?.ranks) {
      const n = league.teams.length;
      lines.push(`=== SEASON CATEGORY RANKINGS (out of ${n}, #1=best) ===`);
      lines.push(CATS_ORDER.map(c => `${c}:#${myLeagueTeam.ranks[c] ?? "?"}`).join("  "));

      const strengths = CATS_ORDER.filter(c => (myLeagueTeam.ranks[c] ?? 99) <= 3);
      const weaknesses = CATS_ORDER.filter(c => (myLeagueTeam.ranks[c] ?? 0) >= n - 1);
      if (strengths.length) lines.push(`Top strengths: ${strengths.join(", ")}`);
      if (weaknesses.length) lines.push(`Bottom weaknesses: ${weaknesses.join(", ")}`);

      // Raw category values for context
      if (myLeagueTeam.categories) {
        const batVals = ["H","R","HR","TB","RBI","BB","SB","AVG"].map(c => `${c}:${fmt(c, myLeagueTeam.categories[c] ?? 0)}`).join(" ");
        const pitVals = ["K","QS","W","L","SV","HD","ERA","WHIP"].map(c => `${c}:${fmt(c, myLeagueTeam.categories[c] ?? 0)}`).join(" ");
        lines.push(`My batting totals: ${batVals}`);
        lines.push(`My pitching totals: ${pitVals}`);
      }
      lines.push("");
    }
  }

  // ── Top free agents ────────────────────────────────────────────────────────
  if (zScores?.players) {
    const fas = (zScores.players as any[]) // eslint-disable-line @typescript-eslint/no-explicit-any
      .filter(p => p.onTeamId === 0)
      .slice(0, 12);
    if (fas.length) {
      lines.push("=== TOP AVAILABLE FREE AGENTS (ranked by FAR) ===");
      for (const p of fas) {
        const s = p.seasonStats ?? {};
        const key = p.isPitcher
          ? `${(s.ERA ?? 0).toFixed(2)} ERA, ${(s.WHIP ?? 0).toFixed(2)} WHIP, ${Math.round(s.K ?? 0)} K, ${(s.IP ?? 0).toFixed(1)} IP`
          : `${(s.AVG ?? 0).toFixed(3)} AVG, ${Math.round(s.HR ?? 0)} HR, ${Math.round(s.RBI ?? 0)} RBI, ${Math.round(s.SB ?? 0)} SB`;
        lines.push(`  ${p.name} (${p.pos}/${p.proTeam}): ${key} — FAR ${(p.far ?? 0).toFixed(1)}`);
      }
      lines.push("");
    }
  }

  // ── Upcoming schedule ──────────────────────────────────────────────────────
  if (schedule?.weeks) {
    const cur = schedule.currentMatchupPeriod ?? 0;
    const upcoming = schedule.weeks
      .filter((w: any) => w.period > cur) // eslint-disable-line @typescript-eslint/no-explicit-any
      .slice(0, 5);
    if (upcoming.length) {
      lines.push("=== UPCOMING SCHEDULE ===");
      for (const w of upcoming) {
        const opp = league?.teams?.find((t: any) => t.teamId === w.myOpponentId); // eslint-disable-line @typescript-eslint/no-explicit-any
        const rankStr = opp?.powerRank ? ` (Power Rank #${opp.powerRank}/${league.teams.length})` : "";
        lines.push(`  Week ${w.period}: vs ${w.myOpponentName ?? "TBD"}${rankStr}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

export async function GET(req: Request) {
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY_MISSING" }, { status: 503 });
  }

  const origin = new URL(req.url).origin;

  const [matchup, league, standings, schedule, zScores] = await Promise.all([
    safeFetch(`${origin}/api/espn/matchup`, 8000),
    safeFetch(`${origin}/api/espn/league-stats?scope=season`, 10000),
    safeFetch(`${origin}/api/espn/standings`, 6000),
    safeFetch(`${origin}/api/espn/schedule`, 6000),
    safeFetch(`${origin}/api/analysis/z-scores`, 18000),
  ]);

  if (!matchup && !league) {
    return Response.json({ error: "Could not load ESPN data" }, { status: 502 });
  }

  const dataPrompt = buildPrompt(matchup, league, standings, schedule, zScores);

  const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-opus-4-7",
      max_tokens: 2000,
      system: `You are the most ruthless, analytically precise GM in fantasy baseball history. You have been hired specifically to tear apart this roster and tell the owner exactly what they're doing wrong and what to fix. You cite specific players by name, quote exact stats, and give harsh but actionable directives. No compliments. No hedging. No generic advice.

Respond ONLY with a valid JSON object — no markdown, no preamble:
{
  "week": ["bullet 1", "bullet 2", "bullet 3"],
  "month": ["bullet 1", "bullet 2", "bullet 3", "bullet 4"],
  "season": ["bullet 1", "bullet 2", "bullet 3", "bullet 4"]
}

week = specific tactical moves for this week's matchup (streaming, starts, category targeting)
month = roster construction actions for the next 30 days (drops, pickups, trade targets, injury watch)
season = what must happen structurally to win the championship (category strategy, positional gaps, big trades)

Every bullet starts with an action verb. Name players. Quote their stats. Be blunt.`,
      messages: [{ role: "user", content: dataPrompt }],
    }),
  });

  if (!aiRes.ok) {
    const errText = await aiRes.text();
    return Response.json({ error: `Claude API error ${aiRes.status}: ${errText}` }, { status: 502 });
  }

  const aiData = await aiRes.json();
  const rawText: string = aiData.content?.[0]?.text ?? "";

  let advice: { week: string[]; month: string[]; season: string[] };
  try {
    const cleaned = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    advice = JSON.parse(match?.[0] ?? cleaned);
  } catch {
    return Response.json({ error: "Failed to parse AI response", raw: rawText }, { status: 500 });
  }

  return Response.json({ ...advice, generatedAt: new Date().toISOString() });
}
