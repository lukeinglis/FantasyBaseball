import { espnFetch, hasEspnCreds, STAT_ID_MAP, POS_MAP, getProTeam, getCurrentMatchupPeriod, getMatchupDates } from "@/lib/espn";

interface Recommendation {
  type: "score" | "target" | "alert" | "stream" | "sit";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

const MY_TEAM_ID = parseInt(process.env.MY_ESPN_TEAM_ID ?? "0");
const CATS_ORDER = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG", "K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"];
const LOWER_IS_BETTER = new Set(["ERA", "WHIP", "L"]);

export async function GET() {
  if (!hasEspnCreds() || !MY_TEAM_ID) {
    return Response.json({ recommendations: [] });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await espnFetch(["mMatchup", "mMatchupScore", "mRoster", "mTeam", "mStatus", "mSettings"]);
    const currentPeriod = getCurrentMatchupPeriod(data);
    const dates = getMatchupDates(data, currentPeriod);
    const recommendations: Recommendation[] = [];

    // Find my matchup
    const schedule: any[] = data.schedule ?? [];
    const myMatchup = schedule.find(
      (m: any) => m.matchupPeriodId === currentPeriod &&
        (m.home?.teamId === MY_TEAM_ID || m.away?.teamId === MY_TEAM_ID)
    );

    if (!myMatchup) {
      return Response.json({ recommendations: [{ type: "alert", title: "No active matchup", description: "Could not find your current matchup.", priority: "low" }] });
    }

    const iAmHome = myMatchup.home?.teamId === MY_TEAM_ID;
    const mySide = iAmHome ? myMatchup.home : myMatchup.away;
    const oppSide = iAmHome ? myMatchup.away : myMatchup.home;

    // Parse category scores
    const myStats: Record<string, { score: number; result: string | null }> = {};
    const oppStats: Record<string, number> = {};
    for (const [statId, statData] of Object.entries(mySide?.cumulativeScore?.scoreByStat ?? {})) {
      const cat = STAT_ID_MAP[parseInt(statId)];
      if (cat) myStats[cat] = { score: (statData as any).score ?? 0, result: (statData as any).result ?? null };
    }
    for (const [statId, statData] of Object.entries(oppSide?.cumulativeScore?.scoreByStat ?? {})) {
      const cat = STAT_ID_MAP[parseInt(statId)];
      if (cat) oppStats[cat] = (statData as any).score ?? 0;
    }

    // Count W/L/T
    let wins = 0, losses = 0, ties = 0;
    for (const cat of CATS_ORDER) {
      const r = myStats[cat]?.result;
      if (r === "WIN") wins++;
      else if (r === "LOSS") losses++;
      else if (r === "TIE") ties++;
    }

    // Days left
    const daysLeft = dates ? Math.max(0, Math.ceil((new Date(dates.end + "T23:59:59").getTime() - Date.now()) / 86400000)) : 0;

    // 1. Score assessment
    if (wins > losses) {
      const lead = wins - losses;
      recommendations.push({
        type: "score",
        title: `Leading ${wins}-${losses}${ties > 0 ? `-${ties}` : ""}`,
        description: lead >= 4 ? `Comfortable ${lead}-cat lead with ${daysLeft} days left. Focus on protecting your leads.` : `Slim ${lead}-cat lead. Don't get complacent — ${daysLeft} days left.`,
        priority: lead >= 4 ? "low" : "medium",
      });
    } else if (losses > wins) {
      const deficit = losses - wins;
      const needed = Math.ceil(deficit / 2) + (deficit % 2 === 0 ? 1 : 0);
      recommendations.push({
        type: "score",
        title: `Trailing ${wins}-${losses}${ties > 0 ? `-${ties}` : ""}`,
        description: `Need to flip ${needed} categor${needed > 1 ? "ies" : "y"} with ${daysLeft} days left. Time to get aggressive.`,
        priority: "high",
      });
    } else {
      recommendations.push({
        type: "score",
        title: `Tied ${wins}-${losses}${ties > 0 ? `-${ties}` : ""}`,
        description: `Dead even with ${daysLeft} days left. Every category matters.`,
        priority: "high",
      });
    }

    // 2. Categories to target (closest to flipping)
    const flippable: { cat: string; gap: number; direction: "flip_to_win" | "protect" }[] = [];
    for (const cat of CATS_ORDER) {
      const myVal = myStats[cat]?.score ?? 0;
      const oppVal = oppStats[cat] ?? 0;
      const result = myStats[cat]?.result;
      if (!result || result === "TIE") continue;

      const lower = LOWER_IS_BETTER.has(cat);
      const gap = lower ? myVal - oppVal : oppVal - myVal; // positive = I'm behind

      if (result === "LOSS" && Math.abs(gap) > 0) {
        flippable.push({ cat, gap: Math.abs(gap), direction: "flip_to_win" });
      } else if (result === "WIN" && Math.abs(gap) > 0) {
        const defenseGap = lower ? oppVal - myVal : myVal - oppVal;
        if (defenseGap < 5) { // close lead
          flippable.push({ cat, gap: defenseGap, direction: "protect" });
        }
      }
    }

    // Sort by smallest gap (easiest to flip)
    flippable.sort((a, b) => a.gap - b.gap);

    const topTargets = flippable.filter((f) => f.direction === "flip_to_win").slice(0, 3);
    if (topTargets.length > 0) {
      recommendations.push({
        type: "target",
        title: `Target: ${topTargets.map((t) => t.cat).join(", ")}`,
        description: topTargets.map((t) => {
          const myVal = myStats[t.cat]?.score ?? 0;
          const oppVal = oppStats[t.cat] ?? 0;
          const fmtGap = LOWER_IS_BETTER.has(t.cat)
            ? `${(myVal - oppVal).toFixed(t.cat === "AVG" || t.cat === "ERA" || t.cat === "WHIP" ? 3 : 0)} behind`
            : `${Math.round(oppVal - myVal)} behind`;
          return `${t.cat}: ${fmtGap}`;
        }).join(" · "),
        priority: "high",
      });
    }

    const atRisk = flippable.filter((f) => f.direction === "protect").slice(0, 2);
    if (atRisk.length > 0) {
      recommendations.push({
        type: "alert",
        title: `At risk: ${atRisk.map((t) => t.cat).join(", ")}`,
        description: `You're barely leading in ${atRisk.map((t) => t.cat).join(", ")}. A bad day could flip these.`,
        priority: "medium",
      });
    }

    // 3. Injury watch
    const myTeam = (data.teams ?? []).find((t: any) => t.id === MY_TEAM_ID);
    const injuredPlayers: string[] = [];
    for (const e of myTeam?.roster?.entries ?? []) {
      const player = e.playerPoolEntry?.player ?? {};
      const status = player.injuryStatus ?? "ACTIVE";
      if (status === "DAY_TO_DAY") {
        injuredPlayers.push(player.fullName ?? "Unknown");
      }
    }
    if (injuredPlayers.length > 0) {
      recommendations.push({
        type: "alert",
        title: `Day-to-Day: ${injuredPlayers.length} player${injuredPlayers.length > 1 ? "s" : ""}`,
        description: `${injuredPlayers.join(", ")} — may not play today. Check before lineups lock.`,
        priority: "high",
      });
    }

    // 4. Streaming tip
    if (losses > wins && daysLeft >= 2) {
      const losingPitchingCats = CATS_ORDER.filter((cat) =>
        ["K", "QS", "W"].includes(cat) && myStats[cat]?.result === "LOSS"
      );
      if (losingPitchingCats.length >= 2) {
        recommendations.push({
          type: "stream",
          title: "Stream a starter",
          description: `You're losing ${losingPitchingCats.join(", ")} — pick up a SP with a start in the next ${daysLeft} days to boost these categories.`,
          priority: "medium",
        });
      }
    }

    return Response.json({ recommendations });
  } catch (err) {
    return Response.json({ recommendations: [{ type: "alert", title: "Error", description: String(err), priority: "low" }] });
  }
}
