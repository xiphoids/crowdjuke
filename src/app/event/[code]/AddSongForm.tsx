"use client";

import { useEffect, useRef, useState } from "react";
import { id } from "@instantdb/react";
import db from "@/lib/db";
import type { ResolvedTrack, ResolveResult, SearchTrack, SongRow } from "./types";
import { useTrackSearch } from "./useTrackSearch";
import { formatDuration } from "./format-duration";
import { MusicNoteIcon } from "@/components/MusicNoteIcon";
import { cn } from "@/lib/cn";
import { useDropdownPosition } from "@/lib/use-dropdown-position";

const normalize = (s: string) => s.toLowerCase().trim();

export default function AddSongForm({
  eventId,
  userId,
  initialShareUrl,
  existingSongs,
  showToast,
  onSongAdded,
  queueEmpty,
}: {
  eventId: string;
  userId: string;
  initialShareUrl?: string;
  existingSongs: SongRow[];
  showToast: (msg: string) => void;
  onSongAdded: (ids: string[]) => void;
  queueEmpty?: boolean;
}) {
  const [input, setInput] = useState(initialShareUrl ?? "");
  const isUrl = /^https?:\/\//i.test(input.trim());

  // Link-resolve state
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<ResolveResult | null>(null);
  const [linkError, setLinkError] = useState("");
  const [selectedTracks, setSelectedTracks] = useState<Set<number>>(new Set());

  // Search / manual state
  const [selectedTrack, setSelectedTrack] = useState<{ title: string; artist: string } | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const [manualImageUrl, setManualImageUrl] = useState("");
  const [manualDurationMs, setManualDurationMs] = useState<number | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  function findDuplicate(trackTitle: string, trackArtist: string) {
    const key = `${normalize(trackTitle)}::${normalize(trackArtist)}`;
    return existingSongs.find(
      (s) => `${normalize(s.title)}::${normalize(s.artist)}` === key,
    );
  }

  function makeUpvoteTx(songId: string, voterId: string) {
    const lookupKey = `${songId}:${voterId}`;
    return db.tx.votes
      .lookup("lookupKey", lookupKey)
      .update({ value: 1, voterId })
      .link({ songRequest: songId });
  }

  async function upvoteExisting(song: SongRow): Promise<boolean> {
    const existing = song.votes.find((v) => v.voterId === userId);
    if (existing && existing.value !== 0) return true;
    const lookupKey = `${song.id}:${userId}`;
    try {
      await db.transact(
        db.tx.votes
          .lookup("lookupKey", lookupKey)
          .update({ value: 1, voterId: userId })
          .link({ songRequest: song.id }),
      );
      return true;
    } catch {
      return false;
    }
  }

  // Suggestion state — suppress search when input looks like a URL
  const searchQuery = selectedTrack || isUrl ? "" : input.trim();
  const { results: suggestions, loading: suggestionsLoading, clear: clearSuggestions } =
    useTrackSearch(searchQuery);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);
  const formWrapperRef = useRef<HTMLDivElement>(null);

  const dropdownOpen = !isUrl && showSuggestions && (
    suggestions.length > 0 || (suggestionsLoading && searchQuery.length >= 2)
  );
  const dropdownStyle = useDropdownPosition(formWrapperRef, dropdownOpen);

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

  useEffect(() => {
    setHighlightIdx(-1);
  }, [suggestions]);

  useEffect(() => {
    if (highlightIdx < 0) return;
    const el = suggestionsRef.current?.children[highlightIdx] as
      | HTMLElement
      | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightIdx]);

  const didAutoFocus = useRef(false);
  useEffect(() => {
    if (queueEmpty && !didAutoFocus.current && !initialShareUrl) {
      didAutoFocus.current = true;
      inputRef.current?.focus({ preventScroll: true });
    }
    if (!queueEmpty) {
      didAutoFocus.current = false;
    }
  }, [queueEmpty, initialShareUrl]);

  function pickSuggestion(track: SearchTrack) {
    setSelectedTrack({ title: track.title, artist: track.artist });
    setInput(`${track.title} \u2014 ${track.artist}`);
    if (track.url) setManualUrl(track.url);
    setManualImageUrl(track.imageUrl ?? "");
    setManualDurationMs(track.durationMs);
    setShowSuggestions(false);
    clearSuggestions();
  }

  function clearSelection() {
    setSelectedTrack(null);
    setInput("");
    setManualUrl("");
    setManualImageUrl("");
    setManualDurationMs(undefined);
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
      let mergeFailed = 0;

      for (let i = 0; i < tracks.length; i++) {
        const dup = findDuplicate(tracks[i].title, tracks[i].artist);
        if (dup) {
          const ok = await upvoteExisting(dup);
          if (ok) mergedCount++;
          else mergeFailed++;
        } else {
          newTracks.push({ track: tracks[i], index: i });
        }
      }

      const newSongIds: string[] = [];
      if (newTracks.length > 0) {
        const now = Date.now();
        const txns = newTracks.flatMap(({ track: t, index: i }) => {
          const reqId = id();
          newSongIds.push(reqId);
          return [
            db.tx.songRequests[reqId]
              .update({
                title: t.title,
                artist: t.artist,
                ...(t.url ? { url: t.url } : {}),
                ...(t.imageUrl ? { imageUrl: t.imageUrl } : {}),
                ...(t.durationMs != null ? { durationMs: t.durationMs } : {}),
                submittedBy: userId,
                createdAt: now + i,
              })
              .link({ event: eventId }),
            makeUpvoteTx(reqId, userId),
          ];
        });
        try {
          await db.transact(txns);
        } catch {
          showToast("Couldn\u2019t add songs \u2014 please try again.");
          return;
        }
      }

      if (mergeFailed > 0 && mergedCount === 0 && newTracks.length === 0) {
        showToast("Couldn\u2019t record your vote \u2014 please try again.");
      } else if (mergedCount > 0 && newTracks.length > 0) {
        showToast(
          `Added ${newTracks.length} new. ${mergedCount} already in queue \u2014 upvoted instead.`,
        );
      } else if (mergedCount > 0) {
        showToast(
          mergedCount === 1
            ? "Already in the queue \u2014 your vote has been counted!"
            : `All ${mergedCount} already in queue \u2014 upvoted instead.`,
        );
      }

      if (newSongIds.length > 0) onSongAdded(newSongIds);

      setInput("");
      setResolved(null);
      inputRef.current?.blur();
    } finally {
      setBusy(false);
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = selectedTrack?.title ?? input.trim();
    const a = selectedTrack?.artist ?? "Unknown";
    if (!t) return;

    setBusy(true);
    try {
      const dup = findDuplicate(t, a);
      if (dup) {
        const ok = await upvoteExisting(dup);
        showToast(
          ok
            ? "Already in the queue \u2014 your vote has been counted!"
            : "Couldn\u2019t record your vote \u2014 please try again.",
        );
      } else {
        const reqId = id();
        try {
          await db.transact([
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
            makeUpvoteTx(reqId, userId),
          ]);
        } catch {
          showToast("Couldn\u2019t add song \u2014 please try again.");
          return;
        }
        onSongAdded([reqId]);
      }
      setInput("");
      setSelectedTrack(null);
      setManualUrl("");
      setManualImageUrl("");
      setManualDurationMs(undefined);
      setShowSuggestions(false);
      clearSuggestions();
      inputRef.current?.blur();
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-primary shadow-sm placeholder:text-text-muted/50 focus-visible:border-ui-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-cyan/30";

  function handleInputChange(value: string) {
    const wasUrl = isUrl;
    const willBeUrl = /^https?:\/\//i.test(value.trim());

    setInput(value);

    if (willBeUrl && !wasUrl) {
      setSelectedTrack(null);
      setManualUrl("");
      setManualImageUrl("");
      setManualDurationMs(undefined);
      setShowSuggestions(false);
      clearSuggestions();
    } else if (!willBeUrl && wasUrl) {
      setResolved(null);
      setLinkError("");
      setSelectedTracks(new Set());
    }

    if (!willBeUrl) {
      setSelectedTrack(null);
      setManualUrl("");
      setManualImageUrl("");
      setManualDurationMs(undefined);
      setShowSuggestions(true);
    } else {
      setResolved(null);
      setLinkError("");
    }
  }

  return (
    <div className="rounded-2xl border border-ui-cyan/15 bg-canvas-elevated/80 p-5">
      <form onSubmit={isUrl ? (e) => { e.preventDefault(); resolveUrl(input); } : handleManualSubmit} className="mt-3">
        <div ref={formWrapperRef} className="relative">
          <div className="flex gap-2" onKeyDown={!isUrl ? handleSuggestionKeyDown : undefined}>
            <input
              ref={inputRef}
              type="text"
              maxLength={500}
              placeholder="Song name, artist, or link"
              value={input}
              autoComplete="off"
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={isUrl ? (e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  resolveUrl(input);
                }
              } : undefined}
              onFocus={() => !isUrl && suggestions.length > 0 && setShowSuggestions(true)}
              className={cn("flex-1", inputCls)}
              {...(!isUrl ? {
                role: "combobox" as const,
                "aria-expanded": showSuggestions && suggestions.length > 0,
                "aria-controls": "track-suggestions",
                "aria-autocomplete": "list" as const,
                "aria-activedescendant": highlightIdx >= 0 ? `suggestion-${highlightIdx}` : undefined,
              } : {})}
            />
            {isUrl && (
              <button
                type="button"
                disabled={resolving || !input.trim()}
                onClick={() => resolveUrl(input)}
                className="shrink-0 rounded-lg bg-ui-cyan/15 px-4 py-2 text-sm font-semibold text-ui-cyan transition hover:bg-ui-cyan/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-cyan/60 disabled:opacity-50"
              >
                {resolving ? "Resolving\u2026" : "Resolve"}
              </button>
            )}
          </div>

          {/* Search suggestions dropdown (non-URL mode) */}
          {!isUrl && showSuggestions && suggestions.length > 0 && dropdownStyle && (
            <ul
              id="track-suggestions"
              ref={suggestionsRef}
              role="listbox"
              style={dropdownStyle}
              className="overflow-y-auto rounded-lg border border-white/10 bg-canvas-elevated shadow-lg"
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
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm transition",
                    i === highlightIdx
                      ? "bg-ui-cyan/15 text-text-primary"
                      : "text-text-primary hover:bg-white/5",
                  )}
                >
                  {track.imageUrl ? (
                    <img
                      src={track.imageUrl}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white/5 text-text-muted/30">
                      <MusicNoteIcon />
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

          {!isUrl && showSuggestions && suggestionsLoading && searchQuery.length >= 2 && suggestions.length === 0 && dropdownStyle && (
            <div style={dropdownStyle} className="rounded-lg border border-white/10 bg-canvas-elevated px-3 py-2 text-xs text-text-muted shadow-lg">
              Searching&hellip;
            </div>
          )}
        </div>

        {/* Selected track card (search mode) */}
        {!isUrl && selectedTrack && (
          <div className="mt-2 flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            {manualImageUrl ? (
              <img
                src={manualImageUrl}
                alt=""
                className="h-8 w-8 shrink-0 rounded object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white/5 text-text-muted/30">
                <MusicNoteIcon />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-text-primary">{selectedTrack.title}</span>
              <span className="block truncate text-xs text-text-muted">{selectedTrack.artist}</span>
            </div>
            {manualDurationMs != null && (
              <span className="shrink-0 text-xs tabular-nums text-text-muted/50">
                {formatDuration(manualDurationMs)}
              </span>
            )}
            <button
              type="button"
              onClick={clearSelection}
              aria-label="Clear selection"
              className="shrink-0 rounded p-1 text-text-muted/40 transition hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-cyan/60"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>
        )}

        {/* Link error */}
        {isUrl && linkError && (
          <p className="mt-2 text-xs text-action-red">{linkError}</p>
        )}

        {/* Resolved tracks list (URL mode) */}
        {isUrl && resolved && (
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
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-text-primary">
                      {t.title}
                    </span>
                    <span className="block truncate text-xs text-text-muted">
                      {t.artist}
                    </span>
                  </div>
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

        {/* Submit button (search mode) */}
        {!isUrl && (
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="mt-4 w-full rounded-lg bg-gradient-to-r from-brand-gold-muted to-brand-gold px-4 py-2.5 text-sm font-bold text-canvas shadow-md shadow-brand-gold/20 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 disabled:opacity-50 sm:w-auto"
          >
            {busy ? "Adding\u2026" : "Add to Queue"}
          </button>
        )}
      </form>
    </div>
  );
}
