import type { TournamentStatus } from "@prisma/client";

export interface TournamentListItem {
  id: string;
  name: string;
  location: string;
  startDate: Date;
  endDate: Date;
  status: TournamentStatus;
  playerCount: number;
  federation: string;
}

export interface TournamentDetails extends TournamentListItem {
  externalId: string;
  lastSynced: Date;
  players: TournamentPlayerWithDetails[];
  rounds: RoundWithPairings[];
}

export interface TournamentPlayerWithDetails {
  id: string;
  seed: number | null;
  points: number;
  rank: number | null;
  tiebreak1: number | null;
  tiebreak2: number | null;
  tiebreak3: number | null;
  player: {
    id: string;
    name: string;
    federation: string;
    lichessTitle: string | null;
    fideTitle: string | null;
    fideRating: number | null;
    lichessRapid: number | null;
    lichessBlitz: number | null;
    lichessClassical: number | null;
  };
}

export interface RoundWithPairings {
  id: string;
  number: number;
  name: string | null;
  startTime: Date | null;
  pairings: PairingWithPlayers[];
}

export interface PairingWithPlayers {
  id: string;
  board: number | null;
  result: string | null;
  whitePlayer: {
    id: string;
    name: string;
    federation: string;
    lichessTitle: string | null;
    fideRating: number | null;
    lichessRapid: number | null;
  } | null;
  blackPlayer: {
    id: string;
    name: string;
    federation: string;
    lichessTitle: string | null;
    fideRating: number | null;
    lichessRapid: number | null;
  } | null;
}

export interface PlayerListItem {
  id: string;
  name: string;
  federation: string;
  lichessUsername: string | null;
  lichessTitle: string | null;
  fideTitle: string | null;
  fideRating: number | null;
  lichessRapid: number | null;
  lichessBlitz: number | null;
  lichessClassical: number | null;
}

export interface PlayerProfile extends PlayerListItem {
  lichessUsername: string | null;
  fideId: string | null;
  lichessLastSeen: Date | null;
  tournaments: TournamentHistory[];
  stats: PlayerStats | null;
}

export interface TournamentHistory {
  id: string;
  name: string;
  location: string;
  startDate: Date;
  endDate: Date;
  status: TournamentStatus;
  points: number;
  rank: number | null;
}

export interface PlayerStats {
  totalTournaments: number;
  wins: number;
  draws: number;
  losses: number;
  averageScore: number;
}

export interface SearchResult {
  players: {
    id: string;
    name: string;
    federation: string;
    lichessTitle: string | null;
    fideRating: number | null;
  }[];
  tournaments: {
    id: string;
    name: string;
    status: TournamentStatus;
  }[];
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: "success" | "error";
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LiveSearchResult {
  type: "player" | "tournament";
  id: string;
  title: string;
  subtitle: string;
  status?: TournamentStatus;
}
