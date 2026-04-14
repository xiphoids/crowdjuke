"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import db from "@/lib/db";
import type { SongRow } from "./types";
import { CJ_PICK_THRESHOLD } from "./types";
import { formatDuration } from "./format-duration";
import { MusicNoteIcon } from "@/components/MusicNoteIcon";
import { ConfirmModal } from "@/components/ConfirmModal";
import { cn } from "@/lib/cn";
import { shareOrCopy } from "./shareOrCopy";
import { useShareUrl } from "./useShareUrl";

export default function SongQueue({ songs, nowPlaying, eventId, userId, isHost, creatorId, highlightIds, clearHighlight, joinCode }: { songs: SongRow[]; nowPlaying?: SongRow; eventId: string; userId: string; isHost: boolean; creatorId: string; highlightIds: Set<string>; clearHighlight: (id: string) => void; joinCode: string }) {
  const upcoming = [...songs]
    .filter((s) => !s.playedAt && s.id !== nowPlaying?.id)
    .sort((a, b) => {
      const dedupA = new Map<string, number>();
      for (const v of a.votes) dedupA.set(v.voterId, v.value);
      const dedupB = new Map<string, number>();
      for (const v of b.votes) dedupB.set(v.voterId, v.value);
      const scoreA = Array.from(dedupA.values()).reduce((s, v) => s + v, 0);
      const scoreB = Array.from(dedupB.values()).reduce((s, v) => s + v, 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return a.createdAt - b.createdAt;
    });

  if (!nowPlaying && upcoming.length === 0) {
    return isHost ? (
      <HostEmptyState joinCode={joinCode} />
    ) : (
      <p className="text-center text-sm text-text-muted">
        No tracks on the ballot yet. Be the one who gets the party started &mdash; search above!
      </p>
    );
  }

  return (
    <section className="space-y-4">
      {nowPlaying && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-brand-gold">Now Playing</h2>
          <ul>
            <SongCard key={nowPlaying.id} song={nowPlaying} userId={userId} isHost={isHost} creatorId={creatorId} position={0} variant="nowPlaying" eventId={eventId} isHighlighted={highlightIds.has(nowPlaying.id)} clearHighlight={clearHighlight} />
          </ul>
        </div>
      )}
      {upcoming.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-text-muted">
            Up Next &middot; {upcoming.length} {upcoming.length === 1 ? "song" : "songs"}
          </h2>
          <ul className="space-y-2">
            {upcoming.map((song, i) => (
              <SongCard key={song.id} song={song} userId={userId} isHost={isHost} creatorId={creatorId} position={i + 1} eventId={eventId} isHighlighted={highlightIds.has(song.id)} clearHighlight={clearHighlight} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function SongCard({ song, userId, isHost, creatorId, position, variant, eventId, isHighlighted, clearHighlight }: { song: SongRow; userId: string; isHost: boolean; creatorId: string; position: number; variant?: "nowPlaying"; eventId: string; isHighlighted: boolean; clearHighlight: (id: string) => void }) {
  const isNowPlaying = variant === "nowPlaying";
  const [pendingVote, setPendingVote] = useState<1 | -1 | null>(null);

  const userVote = song.votes.find((v) => v.voterId === userId);

  const dedupedVotes = new Map<string, number>();
  for (const v of song.votes) {
    dedupedVotes.set(v.voterId, v.value);
  }
  if (pendingVote !== null) dedupedVotes.set(userId, pendingVote);

  const score = Array.from(dedupedVotes.values()).reduce((s, v) => s + v, 0);
  const effectiveUserValue = pendingVote ?? (userVote?.value ?? 0);
  const isOwnSong = song.submittedBy === userId;
  const hasOtherVotes = song.votes.some((v) => v.voterId !== userId && v.value !== 0);
  const canDelete = isHost || (isOwnSong && !hasOtherVotes);
  const hasVoted = effectiveUserValue !== 0;
  const canVote = !isOwnSong && !hasVoted;
  const isDjPick = song.submittedBy === creatorId;
  const isCjPick = score >= CJ_PICK_THRESHOLD;
  const isTop3 = !isNowPlaying && position <= 3;
  const artSize = isNowPlaying || isTop3 ? "h-12 w-12" : "h-10 w-10";

  const rankBadgeCls =
    position === 1
      ? "h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold bg-brand-gold text-canvas"
      : position === 2
        ? "h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold bg-text-muted/30 text-text-primary"
        : position === 3
          ? "h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold bg-neon-orange/25 text-neon-orange"
          : "";

  const cardRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!isHighlighted || !cardRef.current) return;
    cardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [isHighlighted]);

  const [showConfirm, setShowConfirm] = useState(false);

  async function performDelete() {
    try {
      await db.transact([
        ...song.votes.map((v) => db.tx.votes[v.id].delete()),
        db.tx.songRequests[song.id].delete(),
      ]);
    } catch {
      // Best-effort; deletion failures are rare and non-critical.
    } finally {
      setShowConfirm(false);
    }
  }

  async function handleVote(newValue: 1 | -1) {
    if ((userVote?.value ?? 0) !== 0 || pendingVote !== null) return;
    setPendingVote(newValue);
    const lookupKey = `${song.id}:${userId}`;
    try {
      await db.transact(
        db.tx.votes
          .lookup("lookupKey", lookupKey)
          .update({ value: newValue, voterId: userId })
          .link({ songRequest: song.id }),
      );
    } catch {
      setPendingVote(null);
    }
  }

  useEffect(() => {
    if (pendingVote !== null && userVote?.value === pendingVote) {
      setPendingVote(null);
    }
  }, [userVote?.value, pendingVote]);

  return (
    <li
      ref={cardRef}
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border bg-canvas-elevated px-4 py-3 sm:flex-nowrap sm:gap-4",
        isNowPlaying
          ? "border-brand-gold/30 shadow-[0_0_12px_-4px_rgba(255,186,8,0.25)]"
          : "border-white/5",
        !isNowPlaying && position === 1 && "border-l-2 border-l-brand-gold/40",
        isHighlighted && "animate-song-highlight",
      )}
      onAnimationEnd={(e) => {
        if (e.animationName === "song-highlight") clearHighlight(song.id);
      }}
    >
      {isNowPlaying ? (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center text-brand-gold">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 animate-pulse">
            <path d="M10 3.75a.75.75 0 0 0-1.264-.546L4.703 7H3.167a.75.75 0 0 0-.7.48A6.985 6.985 0 0 0 2 10c0 .887.165 1.737.468 2.52.111.29.39.48.699.48h1.535l4.033 3.796A.75.75 0 0 0 10 16.25V3.75ZM15.95 5.05a.75.75 0 0 0-1.06 1.06 5.5 5.5 0 0 1 0 7.78.75.75 0 0 0 1.06 1.06 7 7 0 0 0 0-9.9Z" />
            <path d="M13.829 7.172a.75.75 0 0 0-1.061 1.06 2.5 2.5 0 0 1 0 3.536.75.75 0 0 0 1.06 1.06 4 4 0 0 0 0-5.656Z" />
          </svg>
        </span>
      ) : isTop3 ? (
        <span className={cn("shrink-0", rankBadgeCls)}>{position}</span>
      ) : (
        <span className="w-6 shrink-0 text-center text-xs font-medium tabular-nums text-text-muted/50">
          {position}
        </span>
      )}

      {/* Vote controls */}
      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={() => handleVote(1)}
          disabled={!canVote}
          aria-label="Upvote"
          className={cn(
            "rounded p-1 text-lg leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-cyan/60 disabled:cursor-default disabled:opacity-50",
            effectiveUserValue === 1
              ? "text-brand-gold drop-shadow-[0_0_4px_rgba(255,186,8,0.5)]"
              : "text-text-muted/40 hover:text-brand-gold/70",
          )}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
            <path fillRule="evenodd" d="M9.47 6.47a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 1 1-1.06 1.06L10 8.06l-3.72 3.72a.75.75 0 0 1-1.06-1.06l4.25-4.25Z" clipRule="evenodd" />
          </svg>
        </button>
        <span
          className={cn(
            "min-w-[1.5rem] text-center text-sm font-bold",
            score > 0
              ? "text-brand-gold"
              : score < 0
                ? "text-ui-cyan-muted"
                : "text-text-muted/40",
          )}
        >
          {score}
        </span>
        <div className="group relative">
          <button
            onClick={() => handleVote(-1)}
            disabled={!canVote}
            aria-label="Downvote"
            className={cn(
              "rounded p-1 text-lg leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-cyan/60 disabled:cursor-default disabled:opacity-50",
              effectiveUserValue === -1
                ? "text-ui-cyan-muted"
                : "text-text-muted/40 hover:text-text-muted/70",
            )}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
              <path fillRule="evenodd" d="M10.53 13.53a.75.75 0 0 1-1.06 0l-4.25-4.25a.75.75 0 1 1 1.06-1.06L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25Z" clipRule="evenodd" />
            </svg>
          </button>
          {isOwnSong && (
            <>
              <span className="sr-only">You submitted this song</span>
              <span role="tooltip" className="pointer-events-none absolute -left-1 top-full z-10 mt-1 hidden whitespace-nowrap rounded bg-canvas-elevated px-2 py-1 text-xs text-ui-cyan shadow-lg group-hover:block group-focus-visible:block group-focus-within:block">
                You submitted this song
              </span>
            </>
          )}
        </div>
      </div>

      {/* Album art */}
      {song.imageUrl ? (
        <img
          src={song.imageUrl}
          alt=""
          className={cn(artSize, "shrink-0 rounded-md object-cover")}
        />
      ) : (
        <div className={cn("flex shrink-0 items-center justify-center rounded-md bg-white/5 text-text-muted/30", artSize)}>
          <MusicNoteIcon className="h-5 w-5" />
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

      <div className="basis-full h-0 sm:hidden" aria-hidden="true" />

      <div className="flex items-center gap-2 pl-20 ml-auto sm:ml-0 sm:pl-0">
        {isHost && !isNowPlaying && (
          <button
            onClick={async () => {
              try {
                await db.transact(db.tx.events[eventId].link({ nowPlaying: song.id }));
              } catch {}
            }}
            aria-label="Play now"
            className="shrink-0 rounded p-1 text-brand-gold/50 transition hover:text-brand-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.3 2.84A1.5 1.5 0 0 0 4 4.11v11.78a1.5 1.5 0 0 0 2.3 1.27l9.344-5.891a1.5 1.5 0 0 0 0-2.538L6.3 2.841Z" />
            </svg>
          </button>
        )}
        {isHost && isNowPlaying && (
          <button
            onClick={async () => {
              try {
                await db.transact([
                  db.tx.songRequests[song.id].update({ playedAt: Date.now() }),
                  db.tx.events[eventId].unlink({ nowPlaying: song.id }),
                ]);
              } catch {}
            }}
            aria-label="Mark as played"
            className="shrink-0 rounded-md bg-brand-gold/10 px-2 py-1 text-xs font-semibold text-brand-gold transition hover:bg-brand-gold/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
          >
            Done
          </button>
        )}
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

        {isOwnSong && !isHost && hasOtherVotes && (
          <span
            role="img"
            aria-label="Locked — others have voted on this song"
            tabIndex={0}
            className="group relative shrink-0 rounded p-1 text-text-muted/20 cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-cyan/60"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
                clipRule="evenodd"
              />
            </svg>
            <span role="tooltip" className="pointer-events-none absolute right-0 top-full z-10 mt-1 hidden whitespace-nowrap rounded bg-canvas-elevated px-2 py-1 text-xs text-ui-cyan shadow-lg group-hover:block group-focus-visible:block group-focus-within:block">
              Others have voted on this song
            </span>
          </span>
        )}
        {canDelete && (
          <button
            onClick={() => setShowConfirm(true)}
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
      </div>

      <ConfirmModal
        open={showConfirm}
        title="Remove song"
        message={`Remove "${song.title}" from the queue?`}
        onConfirm={performDelete}
        onCancel={() => setShowConfirm(false)}
      />
    </li>
  );
}

function HostEmptyState({ joinCode }: { joinCode: string }) {
  const shareUrl = useShareUrl(joinCode);
  const [copied, setCopied] = useState(false);

  const share = useCallback(async () => {
    const result = await shareOrCopy(
      { title: "Join my CrowdJuke", url: shareUrl },
      shareUrl,
    );
    if (result === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareUrl]);

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/5 bg-canvas-elevated/60 px-6 py-8 text-center">
      <p className="text-sm text-text-muted">Dead air? Not on your watch.</p>
      <span className="rounded-md bg-canvas px-3 py-1 font-mono text-sm tracking-widest text-text-primary">
        {joinCode}
      </span>
      <button
        type="button"
        onClick={share}
        className="rounded-lg bg-gradient-to-r from-brand-gold-muted to-brand-gold px-5 py-2.5 text-sm font-bold text-canvas shadow-md shadow-brand-gold/20 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
      >
        {copied ? "Link Copied!" : "Share Your Code"}
      </button>
      <p className="text-xs text-text-muted/70">
        Or drop a banger yourself up top.
      </p>
    </div>
  );
}
