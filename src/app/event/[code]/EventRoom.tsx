"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "react-qr-code";
import { id } from "@instantdb/react";
import db from "@/lib/db";

// ---------------------------------------------------------------------------
// Types derived from the query shape
// ---------------------------------------------------------------------------

type VoteRow = { id: string; value: number; voterId: string; lookupKey: string };
type SongRow = {
  id: string;
  title: string;
  artist: string;
  url?: string;
  imageUrl?: string;
  durationMs?: number;
  submittedBy: string;
  createdAt: number;
  votes: VoteRow[];
};
type EventRow = {
  id: string;
  name: string;
  joinCode: string;
  creatorId: string;
  songRequests: SongRow[];
  memberships: { id: string; userId: string }[];
};

const CJ_PICK_THRESHOLD = 3;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function EventRoom({
  code,
  initialShareUrl,
}: {
  code: string;
  initialShareUrl?: string;
}) {
  const user = db.useUser();

  const { isLoading, error, data } = db.useQuery({
    events: {
      $: { where: { joinCode: code } },
      songRequests: { votes: {} },
      memberships: { $: { where: { userId: user.id } } },
    },
  });

  const event = (data?.events as unknown as EventRow[] | undefined)?.[0];

  // Auto-join when the user first visits an event they're not a member of.
  const joined = useRef(false);
  useEffect(() => {
    if (!event || joined.current) return;
    if (event.memberships.length > 0) return;
    joined.current = true;

    db.transact(
      db.tx.memberships
        .lookup("lookupKey", `${event.id}:${user.id}`)
        .update({
          userId: user.id,
          createdAt: Date.now(),
        })
        .link({ event: event.id }),
    );
  }, [event, user.id]);

  // Persist the current event code so native share extensions can default to it.
  useEffect(() => {
    try {
      localStorage.setItem("crowdjuke:lastEventCode", code);
    } catch {}
    // Capacitor Preferences (writes to App Group on iOS, SharedPreferences on Android)
    import("@capacitor/preferences")
      .then(({ Preferences }) =>
        Preferences.set({ key: "lastEventCode", value: code }),
      )
      .catch(() => {});
  }, [code]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="animate-pulse text-text-muted text-lg">
          Loading event&hellip;
        </p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-lg font-medium text-text-primary">
          {error ? "Something went wrong." : "Event not found."}
        </p>
        <p className="text-sm text-text-muted">
          Double-check your event code and try again.
        </p>
        <Link
          href="/"
          className="mt-2 rounded-lg border border-ui-cyan/40 bg-ui-cyan/10 px-4 py-2 text-sm font-semibold text-ui-cyan transition hover:bg-ui-cyan/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-cyan/60"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8">
      <EventHeader event={event} />
      <AddSongForm
        eventId={event.id}
        userId={user.id}
        initialShareUrl={initialShareUrl}
        existingSongs={event.songRequests}
      />
      <SongQueue songs={event.songRequests} userId={user.id} isHost={user.id === event.creatorId} creatorId={event.creatorId} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header with share controls
// ---------------------------------------------------------------------------

function useShareUrl(joinCode: string) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const base =
      process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    setUrl(`${base}/event/${joinCode}`);
  }, [joinCode]);
  return url;
}

function EventHeader({ event }: { event: EventRow }) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [showQr, setShowQr] = useState(false);
  const shareUrl = useShareUrl(event.joinCode);

  function copy(text: string, kind: "code" | "link") {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const btnCls =
    "rounded-md px-2.5 py-1 text-xs font-medium text-ui-cyan ring-1 ring-ui-cyan/30 transition hover:bg-ui-cyan/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-cyan/60";

  return (
    <header className="mb-8">
      <Link
        href="/"
        className="text-sm text-text-muted transition hover:text-ui-cyan"
      >
        &larr; Home
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-text-primary">{event.name}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-canvas-elevated px-3 py-1 font-mono text-sm tracking-widest text-text-primary">
          {event.joinCode}
        </span>
        <button onClick={() => copy(event.joinCode, "code")} className={btnCls}>
          {copied === "code" ? "Copied!" : "Copy Code"}
        </button>
        <button onClick={() => copy(shareUrl, "link")} className={btnCls}>
          {copied === "link" ? "Copied!" : "Copy Link"}
        </button>
        <button onClick={() => setShowQr((v) => !v)} className={btnCls}>
          {showQr ? "Hide QR" : "Show QR"}
        </button>
      </div>

      {showQr && shareUrl && (
        <div className="mt-4 inline-block rounded-xl bg-white p-3">
          <QRCode value={shareUrl} size={160} />
        </div>
      )}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Resolve-link types (matching API response shape)
// ---------------------------------------------------------------------------

interface ResolvedTrack {
  title: string;
  artist: string;
  url?: string;
  imageUrl?: string;
  durationMs?: number;
}

interface ResolveResult {
  provider: string;
  kind: string;
  items: ResolvedTrack[];
}

// ---------------------------------------------------------------------------
// Track search suggestions hook
// ---------------------------------------------------------------------------

interface SearchTrack {
  title: string;
  artist: string;
  url?: string;
  imageUrl?: string;
  durationMs?: number;
}

function useTrackSearch(query: string) {
  const [results, setResults] = useState<SearchTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search-tracks?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        setResults(data.results ?? []);
      } catch (err: any) {
        if (err?.name !== "AbortError") setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  const clear = useCallback(() => setResults([]), []);
  return { results, loading, clear };
}

// ---------------------------------------------------------------------------
// Add-song form — link-paste primary, manual fallback
// ---------------------------------------------------------------------------

const normalize = (s: string) => s.toLowerCase().trim();

function AddSongForm({
  eventId,
  userId,
  initialShareUrl,
  existingSongs,
}: {
  eventId: string;
  userId: string;
  initialShareUrl?: string;
  existingSongs: SongRow[];
}) {
  const [mode, setMode] = useState<"link" | "manual">(initialShareUrl ? "link" : "manual");

  // Link mode state
  const [linkInput, setLinkInput] = useState(initialShareUrl ?? "");
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<ResolveResult | null>(null);
  const [linkError, setLinkError] = useState("");
  const [selectedTracks, setSelectedTracks] = useState<Set<number>>(new Set());

  // Manual mode state
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualImageUrl, setManualImageUrl] = useState("");
  const [manualDurationMs, setManualDurationMs] = useState<number | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  // Toast for duplicate-merge feedback
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function showToast(msg: string) {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  function findDuplicate(trackTitle: string, trackArtist: string) {
    const key = `${normalize(trackTitle)}::${normalize(trackArtist)}`;
    return existingSongs.find(
      (s) => `${normalize(s.title)}::${normalize(s.artist)}` === key,
    );
  }

  async function upvoteExisting(song: SongRow) {
    const lookupKey = `${song.id}:${userId}`;
    try {
      await db.transact(
        db.tx.votes
          .lookup("lookupKey", lookupKey)
          .update({ value: 1, voterId: userId, lookupKey })
          .link({ songRequest: song.id }),
      );
    } catch {
      showToast("Couldn\u2019t record your vote \u2014 please try again.");
    }
  }

  // Suggestion state
  const searchQuery = `${title.trim()} ${artist.trim()}`.trim();
  const { results: suggestions, loading: suggestionsLoading, clear: clearSuggestions } =
    useTrackSearch(searchQuery);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const suggestionsRef = useRef<HTMLUListElement>(null);
  const formWrapperRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside the manual form area
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        formWrapperRef.current &&
        !formWrapperRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Reset highlight when suggestions change
  useEffect(() => {
    setHighlightIdx(-1);
  }, [suggestions]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIdx < 0) return;
    const el = suggestionsRef.current?.children[highlightIdx] as
      | HTMLElement
      | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightIdx]);

  function pickSuggestion(track: SearchTrack) {
    setTitle(track.title);
    setArtist(track.artist);
    if (track.url) setManualUrl(track.url);
    setManualImageUrl(track.imageUrl ?? "");
    setManualDurationMs(track.durationMs);
    setShowSuggestions(false);
    clearSuggestions();
  }

  function handleSuggestionKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && highlightIdx >= 0) {
      e.preventDefault();
      pickSuggestion(suggestions[highlightIdx]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  // Auto-resolve if opened via ?share= deep link
  const autoResolved = useRef(false);
  useEffect(() => {
    if (initialShareUrl && !autoResolved.current) {
      autoResolved.current = true;
      resolveUrl(initialShareUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialShareUrl]);

  async function resolveUrl(raw: string) {
    const url = raw.trim();
    if (!url) return;
    setResolving(true);
    setResolved(null);
    setLinkError("");
    try {
      const res = await fetch("/api/resolve-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Error ${res.status}`);
      }
      const data: ResolveResult = await res.json();
      if (data.items.length === 0) throw new Error("No tracks found");
      setResolved(data);
      setSelectedTracks(new Set(data.items.map((_, i) => i)));
    } catch (err: any) {
      setLinkError(err.message ?? "Could not resolve link");
    } finally {
      setResolving(false);
    }
  }

  async function addTracks(tracks: ResolvedTrack[]) {
    setBusy(true);
    try {
      const newTracks: { track: ResolvedTrack; index: number }[] = [];
      let mergedCount = 0;

      for (let i = 0; i < tracks.length; i++) {
        const dup = findDuplicate(tracks[i].title, tracks[i].artist);
        if (dup) {
          upvoteExisting(dup);
          mergedCount++;
        } else {
          newTracks.push({ track: tracks[i], index: i });
        }
      }

      if (newTracks.length > 0) {
        const now = Date.now();
        const txns = newTracks.map(({ track: t, index: i }) => {
          const reqId = id();
          return db.tx.songRequests[reqId]
            .update({
              title: t.title,
              artist: t.artist,
              ...(t.url ? { url: t.url } : {}),
              ...(t.imageUrl ? { imageUrl: t.imageUrl } : {}),
              ...(t.durationMs != null ? { durationMs: t.durationMs } : {}),
              submittedBy: userId,
              createdAt: now + i,
            })
            .link({ event: eventId });
        });
        try {
          await db.transact(txns);
        } catch {
          showToast("Couldn\u2019t add songs \u2014 please try again.");
          return;
        }
      }

      if (mergedCount > 0 && newTracks.length > 0) {
        showToast(
          `Added ${newTracks.length} new. ${mergedCount} already in queue — upvoted instead.`,
        );
      } else if (mergedCount > 0) {
        showToast(
          mergedCount === 1
            ? "Already in the queue — your vote has been counted!"
            : `All ${mergedCount} already in queue — upvoted instead.`,
        );
      }

      setLinkInput("");
      setResolved(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    const a = artist.trim();
    if (!t || !a) return;

    setBusy(true);
    try {
      const dup = findDuplicate(t, a);
      if (dup) {
        upvoteExisting(dup);
        showToast("Already in the queue — your vote has been counted!");
      } else {
        const reqId = id();
        try {
          await db.transact(
            db.tx.songRequests[reqId]
              .update({
                title: t,
                artist: a,
                ...(manualUrl.trim() ? { url: manualUrl.trim() } : {}),
                ...(manualImageUrl.trim() ? { imageUrl: manualImageUrl.trim() } : {}),
                ...(manualDurationMs != null ? { durationMs: manualDurationMs } : {}),
                submittedBy: userId,
                createdAt: Date.now(),
              })
              .link({ event: eventId }),
          );
        } catch {
          showToast("Couldn\u2019t add song \u2014 please try again.");
          return;
        }
      }
      setTitle("");
      setArtist("");
      setManualUrl("");
      setManualImageUrl("");
      setManualDurationMs(undefined);
      setShowSuggestions(false);
      clearSuggestions();
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-primary shadow-sm placeholder:text-text-muted/50 focus-visible:border-ui-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-cyan/30";

  const tabCls = (active: boolean) =>
    `px-3 py-1.5 text-xs font-semibold rounded-md transition ${
      active
        ? "bg-ui-cyan/15 text-ui-cyan"
        : "text-text-muted hover:text-text-primary"
    }`;

  return (
    <div className="mb-8 rounded-2xl border border-ui-cyan/15 bg-canvas-elevated/80 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">Add a Song</h2>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setMode("link")}
            className={tabCls(mode === "link")}
          >
            Paste Link
          </button>
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={tabCls(mode === "manual")}
          >
            Manual
          </button>
        </div>
      </div>

      {toast && (
        <div className="mt-3 rounded-lg border border-ui-cyan/20 bg-ui-cyan/10 px-3 py-2 text-xs font-medium text-ui-cyan">
          {toast}
        </div>
      )}

      {mode === "link" ? (
        <div className="mt-3">
          <div className="flex gap-2">
            <input
              type="url"
              maxLength={500}
              placeholder="Paste a Spotify, YouTube, or Apple Music link"
              value={linkInput}
              onChange={(e) => {
                setLinkInput(e.target.value);
                setResolved(null);
                setLinkError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  resolveUrl(linkInput);
                }
              }}
              className={`flex-1 ${inputCls}`}
            />
            <button
              type="button"
              disabled={resolving || !linkInput.trim()}
              onClick={() => resolveUrl(linkInput)}
              className="shrink-0 rounded-lg bg-ui-cyan/15 px-4 py-2 text-sm font-semibold text-ui-cyan transition hover:bg-ui-cyan/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-cyan/60 disabled:opacity-50"
            >
              {resolving ? "Resolving\u2026" : "Resolve"}
            </button>
          </div>

          {linkError && (
            <p className="mt-2 text-xs text-action-red">{linkError}</p>
          )}

          {resolved && (
            <div className="mt-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs text-text-muted">
                  {resolved.items.length === 1
                    ? "1 track found"
                    : `${resolved.items.length} tracks found`}
                  {" \u00b7 "}
                  <span className="capitalize">{resolved.provider}</span>
                  {resolved.kind !== "track" && (
                    <> &middot; <span className="capitalize">{resolved.kind}</span></>
                  )}
                </p>
                {resolved.items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedTracks.size === resolved.items.length) {
                        setSelectedTracks(new Set());
                      } else {
                        setSelectedTracks(new Set(resolved.items.map((_, i) => i)));
                      }
                    }}
                    className="text-xs font-medium text-ui-cyan transition hover:text-ui-cyan-muted"
                  >
                    {selectedTracks.size === resolved.items.length
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                )}
              </div>

              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-white/5 bg-canvas p-2">
                {resolved.items.map((t, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 px-2 py-1 text-sm"
                  >
                    {resolved.items.length > 1 && (
                      <input
                        type="checkbox"
                        checked={selectedTracks.has(i)}
                        onChange={() => {
                          setSelectedTracks((prev) => {
                            const next = new Set(prev);
                            if (next.has(i)) next.delete(i);
                            else next.add(i);
                            return next;
                          });
                        }}
                        className="h-3.5 w-3.5 shrink-0 accent-ui-cyan"
                      />
                    )}
                    {t.imageUrl ? (
                      <img
                        src={t.imageUrl}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <span className="shrink-0 text-text-muted/40">
                        {i + 1}.
                      </span>
                    )}
                    <span className="truncate text-text-primary">
                      {t.title}
                    </span>
                    <span className="shrink-0 text-text-muted">
                      {t.artist}
                    </span>
                    {t.durationMs != null && (
                      <span className="shrink-0 text-text-muted/50 text-xs tabular-nums">
                        {formatDuration(t.durationMs)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={busy || selectedTracks.size === 0}
                onClick={() =>
                  addTracks(
                    resolved.items.filter((_, i) => selectedTracks.has(i)),
                  )
                }
                className="mt-3 w-full rounded-lg bg-gradient-to-r from-brand-gold-muted to-brand-gold px-4 py-2.5 text-sm font-bold text-canvas shadow-md shadow-brand-gold/20 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 disabled:opacity-50 sm:w-auto"
              >
                {busy
                  ? "Adding\u2026"
                  : resolved.items.length === 1
                    ? "Add to Queue"
                    : selectedTracks.size === resolved.items.length
                      ? `Add All ${resolved.items.length} to Queue`
                      : `Add ${selectedTracks.size} of ${resolved.items.length} to Queue`}
              </button>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleManualSubmit} className="mt-3">
          <div ref={formWrapperRef} className="relative">
            <div
              className="grid gap-3 sm:grid-cols-2"
              onKeyDown={handleSuggestionKeyDown}
            >
              <input
                type="text"
                required
                maxLength={200}
                placeholder="Title"
                value={title}
                autoComplete="off"
                onChange={(e) => {
                  setTitle(e.target.value);
                  setManualDurationMs(undefined);
                  setShowSuggestions(true);
                }}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                className={inputCls}
                role="combobox"
                aria-expanded={showSuggestions && suggestions.length > 0}
                aria-controls="track-suggestions"
                aria-autocomplete="list"
                aria-activedescendant={
                  highlightIdx >= 0 ? `suggestion-${highlightIdx}` : undefined
                }
              />
              <input
                type="text"
                required
                maxLength={200}
                placeholder="Artist"
                value={artist}
                autoComplete="off"
                onChange={(e) => {
                  setArtist(e.target.value);
                  setManualDurationMs(undefined);
                  setShowSuggestions(true);
                }}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                className={inputCls}
              />
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <ul
                id="track-suggestions"
                ref={suggestionsRef}
                role="listbox"
                className="absolute left-0 right-0 z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-white/10 bg-canvas-elevated shadow-lg"
              >
                {suggestions.map((track, i) => (
                  <li
                    key={`${track.title}-${track.artist}-${i}`}
                    id={`suggestion-${i}`}
                    role="option"
                    aria-selected={i === highlightIdx}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pickSuggestion(track);
                    }}
                    onMouseEnter={() => setHighlightIdx(i)}
                    className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm transition ${
                      i === highlightIdx
                        ? "bg-ui-cyan/15 text-text-primary"
                        : "text-text-primary hover:bg-white/5"
                    }`}
                  >
                    {track.imageUrl ? (
                      <img
                        src={track.imageUrl}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white/5 text-text-muted/30">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                          <path fillRule="evenodd" d="M17.721 1.599a.75.75 0 0 1 .279.583v12.568a.75.75 0 0 1-.773.75 15.065 15.065 0 0 0-2.227.13.75.75 0 0 1-.88-.607 15.066 15.066 0 0 0-.39-1.545.75.75 0 0 1 .467-.881A13.564 13.564 0 0 1 16.5 12v-5.7l-9 2.25v6.2a.75.75 0 0 1-.773.75 15.065 15.065 0 0 0-2.227.13.75.75 0 0 1-.88-.607 15.066 15.066 0 0 0-.39-1.545.75.75 0 0 1 .467-.881A13.564 13.564 0 0 1 6 12V3.75a.75.75 0 0 1 .544-.721l10-2.5a.75.75 0 0 1 1.177.57Z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{track.title}</span>
                      <span className="block truncate text-xs text-text-muted">
                        {track.artist}
                      </span>
                    </div>
                    {track.durationMs != null && (
                      <span className="shrink-0 text-xs tabular-nums text-text-muted/50">
                        {formatDuration(track.durationMs)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {showSuggestions && suggestionsLoading && searchQuery.length >= 2 && suggestions.length === 0 && (
              <div className="absolute left-0 right-0 z-10 mt-1 rounded-lg border border-white/10 bg-canvas-elevated px-3 py-2 text-xs text-text-muted shadow-lg">
                Searching&hellip;
              </div>
            )}
          </div>

          <input
            type="url"
            maxLength={500}
            placeholder="Link (optional)"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            className={`mt-3 w-full ${inputCls}`}
          />
          <button
            type="submit"
            disabled={busy || !title.trim() || !artist.trim()}
            className="mt-4 w-full rounded-lg bg-gradient-to-r from-brand-gold-muted to-brand-gold px-4 py-2.5 text-sm font-bold text-canvas shadow-md shadow-brand-gold/20 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 disabled:opacity-50 sm:w-auto"
          >
            {busy ? "Adding\u2026" : "Add to Queue"}
          </button>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Duration formatting
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Song queue
// ---------------------------------------------------------------------------

function SongQueue({ songs, userId, isHost, creatorId }: { songs: SongRow[]; userId: string; isHost: boolean; creatorId: string }) {
  const sorted = [...songs].sort((a, b) => {
    const scoreA = a.votes.reduce((s, v) => s + v.value, 0);
    const scoreB = b.votes.reduce((s, v) => s + v.value, 0);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return b.createdAt - a.createdAt;
  });

  if (sorted.length === 0) {
    return (
      <p className="text-center text-sm text-text-muted">
        No songs yet &mdash; be the first to add one!
      </p>
    );
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-text-muted">
        Queue &middot; {sorted.length} {sorted.length === 1 ? "song" : "songs"}
      </h2>
      <ul className="space-y-2">
        {sorted.map((song) => (
          <SongCard key={song.id} song={song} userId={userId} isHost={isHost} creatorId={creatorId} />
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Individual song card with voting
// ---------------------------------------------------------------------------

function SongCard({ song, userId, isHost, creatorId }: { song: SongRow; userId: string; isHost: boolean; creatorId: string }) {
  const score = song.votes.reduce((s, v) => s + v.value, 0);
  const userVote = song.votes.find((v) => v.voterId === userId);
  const canDelete = song.submittedBy === userId || isHost;
  const isDjPick = song.submittedBy === creatorId;
  const isCjPick = score >= CJ_PICK_THRESHOLD;

  async function handleDelete() {
    if (!confirm(`Remove "${song.title}" from the queue?`)) return;
    try {
      await db.transact([
        ...song.votes.map((v) => db.tx.votes[v.id].delete()),
        db.tx.songRequests[song.id].delete(),
      ]);
    } catch {
      // Best-effort; deletion failures are rare and non-critical.
    }
  }

  async function handleVote(newValue: 1 | -1) {
    if (userVote?.value === newValue) return;
    const lookupKey = `${song.id}:${userId}`;
    try {
      await db.transact(
        db.tx.votes
          .lookup("lookupKey", lookupKey)
          .update({ value: newValue, voterId: userId })
          .link({ songRequest: song.id }),
      );
    } catch {
      // Silently ignore vote failures; the UI stays consistent via optimistic updates.
    }
  }

  return (
    <li className="flex items-center gap-4 rounded-xl border border-white/5 bg-canvas-elevated px-4 py-3">
      {/* Vote controls */}
      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={() => handleVote(1)}
          disabled={userVote?.value === 1}
          aria-label="Upvote"
          className={`rounded p-1 text-lg leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-cyan/60 disabled:cursor-default disabled:opacity-50 ${
            userVote?.value === 1
              ? "text-action-red drop-shadow-[0_0_4px_rgba(255,45,85,0.5)]"
              : "text-text-muted/40 hover:text-action-red/70"
          }`}
        >
          ▲
        </button>
        <span
          className={`min-w-[1.5rem] text-center text-sm font-bold ${
            score > 0
              ? "text-action-red"
              : score < 0
                ? "text-text-muted/60"
                : "text-text-muted/40"
          }`}
        >
          {score}
        </span>
        <button
          onClick={() => handleVote(-1)}
          disabled={userVote?.value === -1}
          aria-label="Downvote"
          className={`rounded p-1 text-lg leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-cyan/60 disabled:cursor-default disabled:opacity-50 ${
            userVote?.value === -1
              ? "text-text-muted"
              : "text-text-muted/40 hover:text-text-muted/70"
          }`}
        >
          ▼
        </button>
      </div>

      {/* Album art */}
      {song.imageUrl ? (
        <img
          src={song.imageUrl}
          alt=""
          className="h-10 w-10 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/5 text-text-muted/30">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path fillRule="evenodd" d="M17.721 1.599a.75.75 0 0 1 .279.583v12.568a.75.75 0 0 1-.773.75 15.065 15.065 0 0 0-2.227.13.75.75 0 0 1-.88-.607 15.066 15.066 0 0 0-.39-1.545.75.75 0 0 1 .467-.881A13.564 13.564 0 0 1 16.5 12v-5.7l-9 2.25v6.2a.75.75 0 0 1-.773.75 15.065 15.065 0 0 0-2.227.13.75.75 0 0 1-.88-.607 15.066 15.066 0 0 0-.39-1.545.75.75 0 0 1 .467-.881A13.564 13.564 0 0 1 6 12V3.75a.75.75 0 0 1 .544-.721l10-2.5a.75.75 0 0 1 1.177.57Z" clipRule="evenodd" />
          </svg>
        </div>
      )}

      {/* Song info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-text-primary">
            {song.title}
          </p>
          {isDjPick && (
            <span className="shrink-0 rounded-full bg-brand-gold/15 px-1.5 py-0.5 text-[10px] font-bold leading-none text-brand-gold">
              DJ Pick
            </span>
          )}
          {isCjPick && (
            <span className="shrink-0 rounded-full bg-ui-cyan/15 px-1.5 py-0.5 text-[10px] font-bold leading-none text-ui-cyan">
              CJ Pick
            </span>
          )}
        </div>
        <p className="truncate text-sm text-text-muted">
          {song.artist}
          {song.durationMs != null && (
            <span className="ml-2 text-text-muted/50">{formatDuration(song.durationMs)}</span>
          )}
        </p>
      </div>

      {/* Optional link */}
      {song.url && (
        <a
          href={song.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-ui-cyan transition hover:text-ui-cyan-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-cyan/60"
          aria-label="Open link"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path
              fillRule="evenodd"
              d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Zm7.25-.75a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0V6.31l-5.47 5.47a.75.75 0 1 1-1.06-1.06l5.47-5.47H12.25a.75.75 0 0 1-.75-.75Z"
              clipRule="evenodd"
            />
          </svg>
        </a>
      )}

      {canDelete && (
        <button
          onClick={handleDelete}
          aria-label="Remove song"
          className="shrink-0 rounded p-1 text-text-muted/40 transition hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path
              fillRule="evenodd"
              d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.519.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
    </li>
  );
}
