export interface EspnScoreByStat {
  score: number;
  result?: string | null;
}

export interface EspnStatBlock {
  id: string;
  stats?: Record<string, number>;
}

export interface EspnPlayer {
  id?: number;
  fullName?: string;
  defaultPositionId?: number;
  injuryStatus?: string;
  injuryStatusNote?: string;
  proTeamId?: number;
  proTeamAbbrev?: string;
  stats?: EspnStatBlock[];
  starterStatusByProGame?: Record<string, string>;
}

export interface EspnRosterEntry {
  playerPoolEntry?: {
    player?: EspnPlayer;
    acquisitionType?: string;
  };
  lineupSlotId?: number;
}

export interface EspnMatchupSide {
  teamId?: number;
  cumulativeScore?: {
    scoreByStat?: Record<string, EspnScoreByStat>;
  };
}

export interface EspnScheduleRecord {
  matchupPeriodId?: number;
  home?: EspnMatchupSide;
  away?: EspnMatchupSide;
}

export interface EspnTeamRecord {
  id: number;
  location?: string;
  nickname?: string;
  abbrev?: string;
  record?: {
    overall?: {
      wins?: number;
      losses?: number;
      ties?: number;
      streakType?: string;
      streakLength?: number;
      pointsFor?: number;
      pointsAgainst?: number;
    };
  };
  roster?: {
    entries?: EspnRosterEntry[];
  };
  rankCalculatedFinal?: number;
  playoffSeed?: number;
}

export interface EspnLeagueData {
  status?: {
    currentMatchupPeriod?: number;
  };
  scoringPeriodId?: number;
  settings?: {
    scheduleSettings?: {
      matchupPeriodCount?: number;
    };
  };
  teams?: EspnTeamRecord[];
  schedule?: EspnScheduleRecord[];
}

export interface EspnPlayerStatsResponse {
  players?: Array<{
    player?: EspnPlayer;
  }>;
}

export interface MlbPerson {
  id: number;
  fullName: string;
}

export interface MlbBvpSplit {
  stat?: {
    atBats?: number;
    hits?: number;
    homeRuns?: number;
    strikeOuts?: number;
    baseOnBalls?: number;
    rbi?: number;
  };
}

export interface BvpTotals {
  atBats: number;
  hits: number;
  homeRuns: number;
  strikeOuts: number;
  baseOnBalls: number;
  rbi: number;
}
