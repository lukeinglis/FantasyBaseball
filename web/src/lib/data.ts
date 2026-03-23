const REPO_BASE = "https://raw.githubusercontent.com/lukeinglis/FantasyBaseball/main";

async function fetchCsv(filePath: string, revalidate = 3600): Promise<Record<string, string>[]> {
  const res = await fetch(`${REPO_BASE}/${filePath}`, { next: { revalidate } });
  if (!res.ok) return [];
  const text = await res.text();
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const vals = line.split(",");
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
}

export async function getDraftProfiles(): Promise<DraftProfile[]> {
  const rows = await fetchCsv("output/draft_profiles.csv");
  return rows.map((r) => {
    const finishes: Record<number, number> = {};
    for (const [k, v] of Object.entries(r)) {
      if (k.startsWith("finish_") && v) {
        finishes[parseInt(k.replace("finish_", ""))] = parseFloat(v);
      }
    }
    return {
      team: r["team"] ?? "",
      seasons: parseInt(r["seasons"] ?? "0"),
      firstSp: parseFloat(r["first_sp"] ?? "0"),
      firstRp: parseFloat(r["first_rp"] ?? "0"),
      firstC: parseFloat(r["first_c"] ?? "0"),
      firstSs: parseFloat(r["first_ss"] ?? "0"),
      finishes,
    };
  });
}
