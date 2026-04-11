import { type ParsedMusicUrl, type Provider } from "./parse";
import { spotifyAccessToken, spotifyFetch } from "./spotify-auth";

export interface ResolvedTrack {
  title: string;
  artist: string;
  url?: string;
  imageUrl?: string;
  durationMs?: number;
}

export interface ResolveResult {
  provider: Provider;
  kind: "track" | "playlist" | "album";
  items: ResolvedTrack[];
}

const MAX_PLAYLIST_ITEMS = 50;

// ---------------------------------------------------------------------------
// Spotify
// ---------------------------------------------------------------------------

function spotifyArtists(artists: { name: string }[]): string {
  return artists.map((a) => a.name).join(", ");
}

function spotifyImage(images?: { url: string }[]): string | undefined {
  if (!images?.length) return undefined;
  return images[images.length - 1]?.url ?? images[0]?.url;
}

async function resolveSpotify(parsed: ParsedMusicUrl): Promise<ResolveResult> {
  const token = await spotifyAccessToken();

  if (parsed.kind === "track") {
    const t = await spotifyFetch(`/tracks/${parsed.id}`, token);
    return {
      provider: "spotify",
      kind: "track",
      items: [
        {
          title: t.name,
          artist: spotifyArtists(t.artists),
          url: t.external_urls?.spotify,
          imageUrl: spotifyImage(t.album?.images),
          durationMs: t.duration_ms,
        },
      ],
    };
  }

  if (parsed.kind === "album") {
    const album = await spotifyFetch(`/albums/${parsed.id}`, token);
    const albumImage = spotifyImage(album.images);
    const items: ResolvedTrack[] = album.tracks.items
      .slice(0, MAX_PLAYLIST_ITEMS)
      .map((t: any) => ({
        title: t.name,
        artist: spotifyArtists(t.artists),
        url: t.external_urls?.spotify,
        imageUrl: albumImage,
        durationMs: t.duration_ms,
      }));
    return { provider: "spotify", kind: "album", items };
  }

  // playlist
  const pl = await spotifyFetch(
    `/playlists/${parsed.id}/tracks?limit=${MAX_PLAYLIST_ITEMS}`,
    token,
  );
  const items: ResolvedTrack[] = pl.items
    .filter((i: any) => i.track)
    .map((i: any) => ({
      title: i.track.name,
      artist: spotifyArtists(i.track.artists),
      url: i.track.external_urls?.spotify,
      imageUrl: spotifyImage(i.track.album?.images),
      durationMs: i.track.duration_ms,
    }));
  return { provider: "spotify", kind: "playlist", items };
}

// ---------------------------------------------------------------------------
// YouTube
// ---------------------------------------------------------------------------

async function resolveYouTube(parsed: ParsedMusicUrl): Promise<ResolveResult> {
  if (parsed.kind === "track") {
    // oEmbed is free and keyless for single videos
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(parsed.sourceUrl)}&format=json`,
    );
    if (!res.ok) throw new Error(`YouTube oEmbed ${res.status}`);
    const data = await res.json();
    // oEmbed title is "Song - Artist" or just the video title
    const title = data.title ?? "Unknown";
    const artist = data.author_name ?? "Unknown";
    return {
      provider: "youtube",
      kind: "track",
      items: [{ title, artist, url: parsed.sourceUrl, imageUrl: data.thumbnail_url }],
    };
  }

  // Playlist requires Data API key
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    throw new Error("YouTube playlists require a YOUTUBE_API_KEY");
  }

  const items: ResolvedTrack[] = [];
  let pageToken = "";

  while (items.length < MAX_PLAYLIST_ITEMS) {
    const qs = new URLSearchParams({
      part: "snippet",
      playlistId: parsed.id,
      maxResults: String(Math.min(50, MAX_PLAYLIST_ITEMS - items.length)),
      key,
      ...(pageToken ? { pageToken } : {}),
    });
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?${qs}`,
    );
    if (!res.ok) throw new Error(`YouTube API ${res.status}`);
    const data = await res.json();

    for (const item of data.items ?? []) {
      const s = item.snippet;
      items.push({
        title: s.title,
        artist: s.videoOwnerChannelTitle?.replace(/ - Topic$/, "") ?? "Unknown",
        url: `https://www.youtube.com/watch?v=${s.resourceId.videoId}`,
        imageUrl: s.thumbnails?.default?.url,
      });
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return { provider: "youtube", kind: "playlist", items };
}

// ---------------------------------------------------------------------------
// Apple Music (iTunes Lookup — no key needed for catalog data)
// ---------------------------------------------------------------------------

async function resolveApple(parsed: ParsedMusicUrl): Promise<ResolveResult> {
  if (parsed.kind === "track") {
    const res = await fetch(
      `https://itunes.apple.com/lookup?id=${parsed.id}&entity=song`,
    );
    if (!res.ok) throw new Error(`iTunes Lookup ${res.status}`);
    const data = await res.json();
    const song = data.results?.[0];
    if (!song) throw new Error("Track not found on Apple Music");
    return {
      provider: "apple",
      kind: "track",
      items: [
        {
          title: song.trackName ?? "Unknown",
          artist: song.artistName ?? "Unknown",
          url: song.trackViewUrl,
          imageUrl: song.artworkUrl100,
          durationMs: song.trackTimeMillis,
        },
      ],
    };
  }

  if (parsed.kind === "album") {
    const res = await fetch(
      `https://itunes.apple.com/lookup?id=${parsed.id}&entity=song&limit=${MAX_PLAYLIST_ITEMS}`,
    );
    if (!res.ok) throw new Error(`iTunes Lookup ${res.status}`);
    const data = await res.json();
    const songs = (data.results ?? []).filter(
      (r: any) => r.wrapperType === "track",
    );
    return {
      provider: "apple",
      kind: "album",
      items: songs.map((s: any) => ({
        title: s.trackName,
        artist: s.artistName,
        url: s.trackViewUrl,
        imageUrl: s.artworkUrl100,
        durationMs: s.trackTimeMillis,
      })),
    };
  }

  // Apple Music playlists don't have a reliable public lookup by playlist ID
  // without MusicKit JS auth. We fall back to scraping Open Graph as best-effort.
  const res = await fetch(parsed.sourceUrl, { redirect: "follow" });
  if (!res.ok) throw new Error(`Apple Music page ${res.status}`);
  const html = await res.text();
  const titleMatch = html.match(
    /<meta\s+property="og:title"\s+content="([^"]+)"/,
  );
  const title = titleMatch?.[1] ?? "Unknown Playlist";
  return {
    provider: "apple",
    kind: "playlist",
    items: [{ title, artist: "Apple Music Playlist", url: parsed.sourceUrl }],
  };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const resolvers: Record<
  string,
  (p: ParsedMusicUrl) => Promise<ResolveResult>
> = {
  spotify: resolveSpotify,
  youtube: resolveYouTube,
  apple: resolveApple,
};

export async function resolveLink(
  parsed: ParsedMusicUrl,
): Promise<ResolveResult> {
  const resolver = resolvers[parsed.provider];
  if (!resolver) throw new Error(`Unsupported provider: ${parsed.provider}`);
  return resolver(parsed);
}
