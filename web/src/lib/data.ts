const REPO_BASE = "https://raw.githubusercontent.com/lukeinglis/FantasyBaseball/main";

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === "," && !inQuotes) { result.push(current); current = ""; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

async function fetchCsv(filePath: string, revalidate = 3600): Promise<Record<string, string>[]> {
  const res = await fetch(`${REPO_BASE}/${filePath}`, { next: { revalidate } });
  if (!res.ok) return [];
  const text = await res.text();
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const vals = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h.trim()] = (vals[i] ?? "").trim()));
    return row;
  });
}

async function fetchJson(filePath: string): Promise<unknown> {
  const res = await fetch(`${REPO_BASE}/${filePath}`, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  return res.json();
}

// --- Rankings ---

export interface Player {
  rank: number;
  name: string;
  team: string;
  pos: string;
  type: string;
  zTotal: number;
  // batting
  H?: number; R?: number; HR?: number; TB?: number;
  RBI?: number; BB?: number; SB?: number; AVG?: number;
  // pitching
  K?: number; QS?: number; W?: number; L?: number;
  SV?: number; HD?: number; ERA?: number; WHIP?: number;
  // espn
  espnRank?: number;
  espnAuction?: number;
  // z-scores
  zH?: number; zR?: number; zHR?: number; zTB?: number;
  zRBI?: number; zBB?: number; zSB?: number; zAVG?: number;
  zK?: number; zQS?: number; zW?: number; zL?: number;
  zSV?: number; zHD?: number; zERA?: number; zWHIP?: number;
}

export async function getRankings(): Promise<Player[]> {
  const rows = await fetchCsv("output/draft_rankings.csv", 60); // short cache — rankings update frequently pre-draft
  return rows.map((r, i) => ({
    rank: r["Overall_Rank"] ? parseInt(r["Overall_Rank"]) : (r[""] ? parseInt(r[""]) + 1 : i + 1),
    name: r["Name"] ?? "",
    team: r["Team"] ?? "",
    pos: r["Pos"] ?? "",
    type: r["Type"] ?? "BAT",
    zTotal: parseFloat(r["z_total"] ?? "0"),
    H: num(r["H"]), R: num(r["R"]), HR: num(r["HR"]), TB: num(r["TB"]),
    RBI: num(r["RBI"]), BB: num(r["BB"]), SB: num(r["SB"]), AVG: num(r["AVG"]),
    K: num(r["K"]), QS: num(r["QS"]), W: num(r["W"]), L: num(r["L"]),
    SV: num(r["SV"]), HD: num(r["HD"]), ERA: num(r["ERA"]), WHIP: num(r["WHIP"]),
    espnRank: num(r["espn_rank"]),
    espnAuction: num(r["espn_auction"]),
    zH: num(r["z_H"]), zR: num(r["z_R"]), zHR: num(r["z_HR"]), zTB: num(r["z_TB"]),
    zRBI: num(r["z_RBI"]), zBB: num(r["z_BB"]), zSB: num(r["z_SB"]), zAVG: num(r["z_AVG"]),
    zK: num(r["z_K"]), zQS: num(r["z_QS"]), zW: num(r["z_W"]), zL: num(r["z_L"]),
    zSV: num(r["z_SV"]), zHD: num(r["z_HD"]), zERA: num(r["z_ERA"]), zWHIP: num(r["z_WHIP"]),
  }));
}

function num(v: string | undefined): number | undefined {
  if (!v || v === "" || v === "nan" || v === "NaN") return undefined;
  const n = parseFloat(v);
  return isNaN(n) ? undefined : n;
}

// --- Category Weights ---

export interface CategoryWeights {
  weights: Record<string, number>;
  raw_correlations: Record<string, number>;
  negative_categories: string[];
  method: string;
  sample_sizes: Record<string, number>;
}

export async function getCategoryWeights(): Promise<CategoryWeights | null> {
  return fetchJson("output/category_weights.json") as Promise<CategoryWeights | null>;
}

// --- Owners ---

export interface OwnerSeason {
  year: number;
  owner: string;
  teamName: string;
  standing: number;
  wins: number;
  losses: number;
  ties: number;
}

export async function getOwnerSeasons(): Promise<OwnerSeason[]> {
  const rows = await fetchCsv("owners/owners.csv");
  return rows.map((r) => ({
    year: parseInt(r["year"]),
    owner: r["owner"]?.trim() ?? "",
    teamName: r["team_name"]?.trim() ?? "",
    standing: parseInt(r["standing"]),
    wins: parseInt(r["wins"]),
    losses: parseInt(r["losses"]),
    ties: parseInt(r["ties"]),
  }));
}

// --- Standings ---

export interface StandingsRow {
  year: number;
  rank: number;
  team: string;
  W: number; L: number; T: number; PCT: number;
  H?: number; R?: number; HR?: number; TB?: number;
  RBI?: number; BB?: number; SB?: number; AVG?: number;
  K?: number; QS?: number; SV?: number; HD?: number;
  ERA?: number; WHIP?: number;
}

const STANDINGS_YEARS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

export async function getAllStandings(): Promise<StandingsRow[]> {
  const results = await Promise.all(
    STANDINGS_YEARS.map(async (year) => {
      const rows = await fetchCsv(`seasons/${year}/standings.csv`);
      return rows.map((r) => ({
        year,
        rank: parseInt(r["RK"] ?? "0"),
        team: r["Team"] ?? "",
        W: parseInt(r["W"] ?? "0"), L: parseInt(r["L"] ?? "0"),
        T: parseInt(r["T"] ?? "0"), PCT: parseFloat(r["PCT"] ?? "0"),
        H: num(r["H"]), R: num(r["R"]), HR: num(r["HR"]), TB: num(r["TB"]),
        RBI: num(r["RBI"]), BB: num(r["BB"]), SB: num(r["SB"]), AVG: num(r["AVG"]),
        K: num(r["K"]), QS: num(r["QS"]), SV: num(r["SV"]), HD: num(r["HD"]),
        ERA: num(r["ERA"]), WHIP: num(r["WHIP"]),
      }));
    })
  );
  return results.flat();
}

// --- Draft Profiles ---

export interface DraftProfile {
  team: string;
  seasons: number;
  firstSp: number;
  firstRp: number;
  firstC: number;
  firstSs: number;
  finishes: Record<number, number>;
  ownerName: string;
  teamNames: string[]; // all historical team names for this franchise
}

// Some franchise canonical names don't match any historical team_name in owners.csv
const FRANCHISE_OWNER_OVERRIDES: Record<string, string> = {
  "Craig Albernaz": "Luke Inglis",
};

export async function getDraftProfiles(): Promise<DraftProfile[]> {
  const [rows, ownerRows] = await Promise.all([
    fetchCsv("output/draft_profiles.csv"),
    fetchCsv("owners/owners.csv"),
  ]);

  const ownerToTeams: Record<string, string[]> = {};
  const teamToOwner: Record<string, string> = {};
  for (const r of ownerRows) {
    const owner = r["owner"]?.trim() ?? "";
    const teamName = r["team_name"]?.trim() ?? "";
    if (!owner || !teamName) continue;
    if (!ownerToTeams[owner]) ownerToTeams[owner] = [];
    if (!ownerToTeams[owner].includes(teamName)) ownerToTeams[owner].push(teamName);
    teamToOwner[teamName] = owner;
  }

  return rows.map((r) => {
    const finishes: Record<number, number> = {};
    for (const [k, v] of Object.entries(r)) {
      if (k.startsWith("finish_") && v) {
        finishes[parseInt(k.replace("finish_", ""))] = parseFloat(v);
      }
    }
    const franchise = r["team"]?.trim() ?? "";
    const ownerName = teamToOwner[franchise] ?? FRANCHISE_OWNER_OVERRIDES[franchise] ?? "";
    const teamNames = ownerName ? (ownerToTeams[ownerName] ?? [franchise]) : [franchise];
    return {
      team: franchise,
      seasons: parseInt(r["seasons"] ?? "0"),
      firstSp: parseFloat(r["first_sp"] ?? "0"),
      firstRp: parseFloat(r["first_rp"] ?? "0"),
      firstC: parseFloat(r["first_c"] ?? "0"),
      firstSs: parseFloat(r["first_ss"] ?? "0"),
      finishes,
      ownerName,
      teamNames,
    };
  });
}

// --- Draft Results ---

export interface DraftPick {
  year: number;
  round: number;
  pick: number;
  team: string;
  playerName: string;
  keeper: boolean;
}

const DRAFT_RESULT_YEARS = [2019, 2021, 2022, 2023, 2024, 2025];

export async function getDraftResults(): Promise<DraftPick[]> {
  const results = await Promise.all(
    DRAFT_RESULT_YEARS.map(async (year) => {
      const rows = await fetchCsv(`seasons/${year}/draft_results.csv`);
      return rows.map((r) => ({
        year,
        round: parseInt(r["round"] ?? "0"),
        pick: parseInt(r["pick"] ?? "0"),
        team: r["team"]?.trim() ?? "",
        playerName: r["player_name"]?.trim() ?? "",
        keeper: r["keeper"] === "True",
      }));
    })
  );
  return results.flat();
}

// --- Player Positions (from rosters) ---

const ROSTER_YEARS = [2021, 2022, 2023, 2024, 2025];
const REAL_POS = new Set(["SP","RP","C","1B","2B","3B","SS","OF","CF","RF","LF","DH"]);

function posFromSlots(slotsStr: string): string {
  const slots = slotsStr.split(",").map((s) => s.trim());
  for (const s of slots) {
    if (REAL_POS.has(s)) return ["CF","RF","LF"].includes(s) ? "OF" : s;
  }
  for (const s of slots) {
    if (s === "P") return "SP";
    if (s.includes("SS")) return "SS";
    if (s.includes("2B")) return "2B";
    if (s.includes("3B")) return "3B";
    if (s.includes("1B")) return "1B";
  }
  return "";
}

export async function getPlayerPositions(): Promise<Record<string, string>> {
  const results = await Promise.all(
    ROSTER_YEARS.map((year) => fetchCsv(`seasons/${year}/rosters.csv`))
  );
  const posMap: Record<string, string> = {};
  for (const rows of results) {
    for (const r of rows) {
      const name = r["player_name"]?.trim() ?? "";
      const slots = r["eligible_slots"]?.trim() ?? "";
      if (!name || !slots) continue;
      const pos = posFromSlots(slots);
      if (pos) posMap[name] = pos;
    }
  }
  return posMap;
}
