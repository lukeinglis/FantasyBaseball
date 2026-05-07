import { sanitizeNum } from "@/lib/sanitize";

const LOWER_IS_BETTER = new Set(["ERA", "WHIP", "L"]);

const ALL_CATS = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG", "K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"];

export interface CatResult {
  cat: string;
  myValue: number;
  oppValue: number;
  result: "WIN" | "LOSS" | "TIE";
}

export interface CompareResult {
  wins: number;
  losses: number;
  ties: number;
  catResults: CatResult[];
}

export function compareTeams(
  myStats: Record<string, number>,
  oppStats: Record<string, number>,
  cats: string[] = ALL_CATS,
): CompareResult {
  let wins = 0, losses = 0, ties = 0;
  const catResults: CatResult[] = [];

  for (const cat of cats) {
    const myVal = sanitizeNum(myStats[cat]);
    const oppVal = sanitizeNum(oppStats[cat]);
    const lower = LOWER_IS_BETTER.has(cat);
    let result: "WIN" | "LOSS" | "TIE";

    if (myVal === oppVal) {
      result = "TIE";
      ties++;
    } else if (lower ? myVal < oppVal : myVal > oppVal) {
      result = "WIN";
      wins++;
    } else {
      result = "LOSS";
      losses++;
    }

    catResults.push({ cat, myValue: myVal, oppValue: oppVal, result });
  }

  return { wins, losses, ties, catResults };
}
