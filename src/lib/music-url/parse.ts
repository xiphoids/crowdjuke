/**
 * Parses music service URLs into a structured descriptor so the correct
 * provider-specific resolver can be dispatched.
 */

export type Provider = "spotify" | "youtube" | "apple";
export type ResourceKind = "track" | "album" | "playlist";

export interface ParsedMusicUrl {
  provider: Provider;
  kind: ResourceKind;
  id: string;
  /** Original URL, preserved for the songRequest record. */
  sourceUrl: string;
}

const SPOTIFY_HOSTS = new Set([
  "open.spotify.com",
  "play.spotify.com",
  "spotify.link",
]);

const YOUTUBE_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "m.youtube.com",
  "youtu.be",
  "music.youtube.com",
]);

const APPLE_HOSTS = new Set([
  "music.apple.com",
  "itunes.apple.com",
  "geo.music.apple.com",
]);

// ---------------------------------------------------------------------------
// Spotify – open.spotify.com/track|album|playlist/:id
// ---------------------------------------------------------------------------

function parseSpotify(url: URL): ParsedMusicUrl | null {
  const segments = url.pathname.split("/").filter(Boolean);
  // Expect ["intl-XX", kind, id] or [kind, id]
  const kindIdx = segments.findIndex((s) =>
    ["track", "album", "playlist"].includes(s),
  );
  if (kindIdx === -1 || kindIdx + 1 >= segments.length) return null;
  return {
    provider: "spotify",
    kind: segments[kindIdx] as ResourceKind,
    id: segments[kindIdx + 1].split("?")[0],
    sourceUrl: url.href,
  };
}

// ---------------------------------------------------------------------------
// YouTube – watch?v=ID / youtu.be/ID / list=ID
// ---------------------------------------------------------------------------

function parseYouTube(url: URL): ParsedMusicUrl | null {
  const listId = url.searchParams.get("list");
  if (listId) {
    return { provider: "youtube", kind: "playlist", id: listId, sourceUrl: url.href };
  }

  let videoId = url.searchParams.get("v");
  if (!videoId && url.hostname === "youtu.be") {
    videoId = url.pathname.slice(1).split("/")[0];
  }
  if (!videoId) return null;
  return { provider: "youtube", kind: "track", id: videoId, sourceUrl: url.href };
}

// ---------------------------------------------------------------------------
// Apple Music – music.apple.com/:storefront/album|playlist/:name/:id
//   tracks are albums with ?i=trackId
// ---------------------------------------------------------------------------

function parseAppleMusic(url: URL): ParsedMusicUrl | null {
  const segments = url.pathname.split("/").filter(Boolean);
  // e.g. ["us", "album", "album-name", "1234567890"]
  const kindIdx = segments.findIndex((s) =>
    ["album", "playlist"].includes(s),
  );
  if (kindIdx === -1 || kindIdx + 1 >= segments.length) return null;

  // If "?i=<trackId>" is present the user shared a specific track
  const trackId = url.searchParams.get("i");
  if (trackId) {
    return { provider: "apple", kind: "track", id: trackId, sourceUrl: url.href };
  }

  const kind = segments[kindIdx] as "album" | "playlist";
  // The numeric ID is always the last segment
  const appleId = segments[segments.length - 1];
  return {
    provider: "apple",
    kind,
    id: appleId,
    sourceUrl: url.href,
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

const ALLOWED_HOSTS = new Map<string, (u: URL) => ParsedMusicUrl | null>();
for (const h of SPOTIFY_HOSTS) ALLOWED_HOSTS.set(h, parseSpotify);
for (const h of YOUTUBE_HOSTS) ALLOWED_HOSTS.set(h, parseYouTube);
for (const h of APPLE_HOSTS) ALLOWED_HOSTS.set(h, parseAppleMusic);

export function parseMusicUrl(raw: string): ParsedMusicUrl | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const parser = ALLOWED_HOSTS.get(url.hostname);
  return parser ? parser(url) : null;
}
