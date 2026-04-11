import { NextRequest, NextResponse } from "next/server";
import { spotifyAccessToken, spotifyFetch } from "@/lib/music-url/spotify-auth";

interface SearchTrack {
  title: string;
  artist: string;
  url?: string;
  imageUrl?: string;
  durationMs?: number;
}

// Rate limit: 60 req/IP/min (higher than resolve since typeahead is chatty)
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;
const hits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now >= entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_REQUESTS;
}

const MAX_RESULTS = 8;

async function searchItunes(term: string): Promise<SearchTrack[]> {
  const qs = new URLSearchParams({
    term,
    entity: "song",
    limit: String(MAX_RESULTS),
  });
  const res = await fetch(`https://itunes.apple.com/search?${qs}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results ?? []).map((r: any) => ({
    title: r.trackName ?? "Unknown",
    artist: r.artistName ?? "Unknown",
    url: r.trackViewUrl,
    imageUrl: r.artworkUrl100 as string | undefined,
    durationMs: r.trackTimeMillis as number | undefined,
  }));
}

async function searchSpotify(term: string): Promise<SearchTrack[]> {
  try {
    const token = await spotifyAccessToken();
    const qs = new URLSearchParams({
      q: term,
      type: "track",
      limit: String(MAX_RESULTS),
    });
    const data = await spotifyFetch(`/search?${qs}`, token);
    return (data.tracks?.items ?? []).map((t: any) => ({
      title: t.name,
      artist: (t.artists ?? []).map((a: any) => a.name).join(", ") || "Unknown",
      url: t.external_urls?.spotify,
      imageUrl: (t.album?.images?.[2]?.url ?? t.album?.images?.[0]?.url) as string | undefined,
      durationMs: t.duration_ms as number | undefined,
    }));
  } catch {
    return [];
  }
}

function dedup(tracks: SearchTrack[]): SearchTrack[] {
  const seen = new Map<string, number>();
  return tracks.filter((t, idx) => {
    const key = `${t.title.toLowerCase()}::${t.artist.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.set(key, idx);
      return true;
    }
    const prevIdx = seen.get(key)!;
    if (!tracks[prevIdx].durationMs && t.durationMs) {
      tracks[prevIdx].durationMs = t.durationMs;
    }
    return false;
  });
}

export async function GET(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const hasSpotify =
    !!process.env.SPOTIFY_CLIENT_ID && !!process.env.SPOTIFY_CLIENT_SECRET;

  const [itunesResults, spotifyResults] = await Promise.all([
    searchItunes(q),
    hasSpotify ? searchSpotify(q) : Promise.resolve([]),
  ]);

  // Prefer Spotify when available, fill remaining slots with iTunes
  const merged = dedup([...spotifyResults, ...itunesResults]).slice(
    0,
    MAX_RESULTS,
  );

  return NextResponse.json({ results: merged });
}
