"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function EventRoom({ code }: { code: string }) {
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

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="animate-pulse text-gray-400 text-lg">
          Loading event&hellip;
        </p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-lg font-medium text-gray-700">
          {error ? "Something went wrong." : "Event not found."}
        </p>
        <p className="text-sm text-gray-500">
          Double-check your event code and try again.
        </p>
        <Link
          href="/"
          className="mt-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8">
      <EventHeader event={event} />
      <AddSongForm eventId={event.id} userId={user.id} />
      <SongQueue songs={event.songRequests} userId={user.id} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header with share controls
// ---------------------------------------------------------------------------

function EventHeader({ event }: { event: EventRow }) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  function copy(text: string, kind: "code" | "link") {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/event/${event.joinCode}`
      : "";

  return (
    <header className="mb-8">
      <Link
        href="/"
        className="text-sm text-gray-400 transition hover:text-gray-600"
      >
        &larr; Home
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">{event.name}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-gray-100 px-3 py-1 font-mono text-sm tracking-widest text-gray-700">
          {event.joinCode}
        </span>
        <button
          onClick={() => copy(event.joinCode, "code")}
          className="rounded-md px-2.5 py-1 text-xs font-medium text-indigo-600 ring-1 ring-indigo-200 transition hover:bg-indigo-50"
        >
          {copied === "code" ? "Copied!" : "Copy Code"}
        </button>
        <button
          onClick={() => copy(shareUrl, "link")}
          className="rounded-md px-2.5 py-1 text-xs font-medium text-indigo-600 ring-1 ring-indigo-200 transition hover:bg-indigo-50"
        >
          {copied === "link" ? "Copied!" : "Copy Link"}
        </button>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Add-song form
// ---------------------------------------------------------------------------

function AddSongForm({
  eventId,
  userId,
}: {
  eventId: string;
  userId: string;
}) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    const a = artist.trim();
    if (!t || !a) return;

    setBusy(true);
    try {
      const reqId = id();
      await db.transact(
        db.tx.songRequests[reqId]
          .update({
            title: t,
            artist: a,
            ...(url.trim() ? { url: url.trim() } : {}),
            submittedBy: userId,
            createdAt: Date.now(),
          })
          .link({ event: eventId }),
      );
      setTitle("");
      setArtist("");
      setUrl("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-8 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200"
    >
      <h2 className="text-sm font-semibold text-gray-900">Add a Song</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input
          type="text"
          required
          maxLength={200}
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        <input
          type="text"
          required
          maxLength={200}
          placeholder="Artist"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
      </div>
      <input
        type="url"
        maxLength={500}
        placeholder="Link (optional)"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
      />
      <button
        type="submit"
        disabled={busy || !title.trim() || !artist.trim()}
        className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-50 sm:w-auto"
      >
        {busy ? "Adding\u2026" : "Add to Queue"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Song queue
// ---------------------------------------------------------------------------

function SongQueue({ songs, userId }: { songs: SongRow[]; userId: string }) {
  const sorted = [...songs].sort((a, b) => {
    const scoreA = a.votes.reduce((s, v) => s + v.value, 0);
    const scoreB = b.votes.reduce((s, v) => s + v.value, 0);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return b.createdAt - a.createdAt;
  });

  if (sorted.length === 0) {
    return (
      <p className="text-center text-sm text-gray-400">
        No songs yet &mdash; be the first to add one!
      </p>
    );
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-gray-500">
        Queue &middot; {sorted.length} {sorted.length === 1 ? "song" : "songs"}
      </h2>
      <ul className="space-y-2">
        {sorted.map((song) => (
          <SongCard key={song.id} song={song} userId={userId} />
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Individual song card with voting
// ---------------------------------------------------------------------------

function SongCard({ song, userId }: { song: SongRow; userId: string }) {
  const score = song.votes.reduce((s, v) => s + v.value, 0);
  const userVote = song.votes.find((v) => v.voterId === userId);

  function handleVote(newValue: 1 | -1) {
    if (userVote && userVote.value === newValue) {
      // Toggle off
      db.transact(db.tx.votes[userVote.id].delete());
    } else {
      const lookupKey = `${song.id}:${userId}`;
      db.transact(
        db.tx.votes
          .lookup("lookupKey", lookupKey)
          .update({ value: newValue, voterId: userId })
          .link({ songRequest: song.id }),
      );
    }
  }

  return (
    <li className="flex items-center gap-4 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-200">
      {/* Vote controls */}
      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={() => handleVote(1)}
          aria-label="Upvote"
          className={`rounded p-1 text-lg leading-none transition ${
            userVote?.value === 1
              ? "text-emerald-600"
              : "text-gray-300 hover:text-emerald-500"
          }`}
        >
          ▲
        </button>
        <span
          className={`min-w-[1.5rem] text-center text-sm font-bold ${
            score > 0
              ? "text-emerald-700"
              : score < 0
                ? "text-rose-600"
                : "text-gray-500"
          }`}
        >
          {score}
        </span>
        <button
          onClick={() => handleVote(-1)}
          aria-label="Downvote"
          className={`rounded p-1 text-lg leading-none transition ${
            userVote?.value === -1
              ? "text-rose-600"
              : "text-gray-300 hover:text-rose-500"
          }`}
        >
          ▼
        </button>
      </div>

      {/* Song info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">
          {song.title}
        </p>
        <p className="truncate text-sm text-gray-500">{song.artist}</p>
      </div>

      {/* Optional link */}
      {song.url && (
        <a
          href={song.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-indigo-500 transition hover:text-indigo-700"
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
    </li>
  );
}
