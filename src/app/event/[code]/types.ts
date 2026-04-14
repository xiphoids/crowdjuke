export type VoteRow = {
  id: string;
  value: number;
  voterId: string;
  lookupKey: string;
};

export type SongRow = {
  id: string;
  title: string;
  artist: string;
  url?: string;
  imageUrl?: string;
  durationMs?: number;
  playedAt?: number;
  submittedBy: string;
  createdAt: number;
  votes: VoteRow[];
};

export type EventRow = {
  id: string;
  name: string;
  joinCode: string;
  creatorId: string;
  nowPlaying?: SongRow;
  songRequests: SongRow[];
  memberships: { id: string; userId: string }[];
};

export interface ResolvedTrack {
  title: string;
  artist: string;
  url?: string;
  imageUrl?: string;
  durationMs?: number;
}

export interface ResolveResult {
  provider: string;
  kind: string;
  items: ResolvedTrack[];
}

export interface SearchTrack {
  title: string;
  artist: string;
  url?: string;
  imageUrl?: string;
  durationMs?: number;
}

export const CJ_PICK_THRESHOLD = 3;
